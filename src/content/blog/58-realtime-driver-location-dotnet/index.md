---
title: "Real-time Driver Location Tracking in .NET: Redis GEO, State Buffer and SignalR"
summary: "Uber processes millions of GPS updates every second. Here's how to build the same real-time location tracking pipeline in .NET — from driver updates to rider map — using Redis GEO, a mutable state buffer and SignalR."
date: "2026-05-11"
tags: ["dotnet", "csharp", "redis", "signalr", "architecture", "production"]
---

![Real-time Driver Location Tracking in .NET – by Adrian Bailador Panero](realtime-driver-location.png)

Every four seconds, every active Uber driver sends their GPS coordinates to a server.

At peak, that's roughly 5 million updates per minute — before you even count the riders watching their driver move on a map in real time. The location pipeline is the heartbeat of the entire platform. If it slows down, drivers and riders fall out of sync. If it falls over, the app is effectively useless.

Building something like this in .NET is a good exercise in knowing when *not* to reach for a database. Location data is high-frequency, short-lived, and geospatial. A relational database would collapse under the write load. What you need is Redis.

This is the first article in a mini-series on designing an Uber-like system in .NET. Here we build the location tracking pipeline. In the next two articles we'll cover the trip state machine and the full system design.

## The Problem in Concrete Terms

Before writing any code, it helps to make the numbers real:

- **5 million active drivers** at peak, each sending a GPS update every 4 seconds
- **~1.25 million writes per second** at the Redis layer
- **Riders** watching a moving dot on a map — updates should feel instant (under 1 second latency)
- **Driver matching** — when a rider requests a trip, the system needs to find available drivers within a radius in milliseconds

A naive implementation stores each update in a SQL table. After two minutes of load it becomes a 150-million-row table with a write queue backed up to the horizon. That's not the bottleneck you want to debug at 11pm.

The architecture we'll build instead:

![Architecture – by Adrian Bailador Panero](diagram.png)
## Step 1: Modelling the Location Update

Keep it simple. A location update is a thin message:

```csharp
public record LocationUpdate(
    string DriverId,
    double Latitude,
    double Longitude,
    DateTimeOffset Timestamp);
```

The driver sends this every four seconds. We don't store history here — that's a separate concern for analytics. What we store is *current position*.

## Step 2: The Location State Buffer

The first instinct here is to use a queue — `Channel<T>`, a message bus, something that holds updates until they can be processed. That instinct is wrong for this problem.

A queue implies every item matters. In location tracking, only the *latest* position per driver matters. If a driver sends 10 updates while the processor is busy, 9 of them are noise — you only need the most recent. A queue retains all 10 and processes them in order; by the time it reaches update 10 it's processing history, not the present.

The right model is mutable state per driver. A `ConcurrentDictionary<string, LocationUpdate>` where each write simply overwrites the previous value:

```csharp
public class LocationStateBuffer
{
    private readonly ConcurrentDictionary<string, LocationUpdate> _latest = new();
    private readonly ConcurrentDictionary<string, byte> _dirty = new();

    public void Update(LocationUpdate update)
    {
        _latest[update.DriverId] = update;
        _dirty[update.DriverId] = 0;
    }

    public IReadOnlyList<LocationUpdate> TakeSnapshot()
    {
        var snapshot = new List<LocationUpdate>();
        foreach (var driverId in _dirty.Keys.ToArray())
        {
            if (_dirty.TryRemove(driverId, out _) && _latest.TryGetValue(driverId, out var update))
                snapshot.Add(update);
        }
        return snapshot;
    }
}
```

The `_dirty` set tracks which drivers have sent updates since the last flush. `TakeSnapshot` returns only those drivers — if a driver hasn't moved, there's nothing to write to Redis. This means the flush is proportional to activity, not total driver count.

The endpoint writes are O(1) and never block regardless of what the background processor is doing:

```csharp
app.MapPost("/drivers/{driverId}/location", (
    string driverId,
    LocationUpdateRequest request,
    LocationStateBuffer buffer) =>
{
    buffer.Update(new LocationUpdate(driverId, request.Latitude, request.Longitude, DateTimeOffset.UtcNow));
    return Results.Accepted();
});
```

No overflow. No stale updates blocking newer ones. Natural rate limiting built in — if a driver sends 10 updates between flushes, only 1 Redis write happens.

## Step 3: Redis GEO

Redis has a native geospatial data type backed by sorted sets. The key commands:

- `GEOADD key longitude latitude member` — store or update a position
- `GEOSEARCH key FROMMEMBER member BYRADIUS radius unit` — find all members within a radius
- `GEOPOS key member` — get the current position of a member

In StackExchange.Redis:

```csharp
public class RedisLocationStore
{
    private readonly IDatabase _db;
    private const string DriversKey = "drivers:locations";

    public RedisLocationStore(IConnectionMultiplexer redis)
    {
        _db = redis.GetDatabase();
    }

    public async Task UpdateAsync(LocationUpdate update)
    {
        await _db.GeoAddAsync(DriversKey, new GeoEntry(
            longitude: update.Longitude,
            latitude: update.Latitude,
            member: update.DriverId));
    }

    public async Task<IEnumerable<NearbyDriver>> FindNearbyAsync(
        double latitude,
        double longitude,
        double radiusKm)
    {
        var results = await _db.GeoSearchAsync(
            DriversKey,
            longitude, latitude,
            new GeoSearchCircle(radiusKm, GeoUnit.Kilometers),
            options: GeoRadiusOptions.WithDistance | GeoRadiusOptions.WithCoordinates);

        return results.Select(r => new NearbyDriver(
            DriverId: r.Member.ToString(),
            DistanceKm: r.Distance ?? 0,
            Latitude: r.Position?.Latitude ?? 0,
            Longitude: r.Position?.Longitude ?? 0));
    }
}

public record NearbyDriver(string DriverId, double DistanceKm, double Latitude, double Longitude);
```

`GEOSEARCH` returns drivers sorted by distance and is fast enough to query on every rider request — it runs in O(N+log(M)) where N is the result set size, not the total driver count.

One important note: Redis GEO stores positions as compressed floats, so there's a small precision loss (~0.6mm error). For navigation that's irrelevant. What matters is that a `GEOSEARCH` returning the 10 nearest drivers within 5km finishes in under a millisecond even with millions of stored positions.

## Step 4: The Background Processor

The `BackgroundService` flushes the state buffer to Redis every 500ms using `PeriodicTimer`:

```csharp
public class LocationProcessorService : BackgroundService
{
    private readonly LocationStateBuffer _buffer;
    private readonly ILocationStore _store;
    private readonly IHubContext<DriverLocationHub> _hub;
    private readonly ILogger<LocationProcessorService> _logger;

    private static readonly TimeSpan FlushInterval = TimeSpan.FromMilliseconds(500);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(FlushInterval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            var updates = _buffer.TakeSnapshot();
            if (updates.Count == 0) continue;

            foreach (var update in updates)
            {
                try
                {
                    await _store.UpdateAsync(update);

                    await _hub.Clients
                        .Group($"watching:{update.DriverId}")
                        .SendAsync("DriverMoved", new
                        {
                            update.DriverId,
                            update.Latitude,
                            update.Longitude,
                            update.Timestamp
                        }, stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed flushing location for driver {DriverId}", update.DriverId);
                }
            }
        }
    }
}
```

`PeriodicTimer` is the idiomatic .NET 6+ way to run periodic work in a hosted service — it doesn't drift (each tick is measured from the previous tick's start, not end) and cancellation is handled automatically.

Each flush only touches drivers that sent updates since the last tick. If no driver moved, `TakeSnapshot` returns an empty list and the loop skips immediately. The Redis write and SignalR push are independent — a failed push doesn't block the Redis update, and a single missed UI notification is invisible to the rider.

## Step 5: SignalR Hub

The rider opens a WebSocket connection when they're watching a trip. They join a group named after the driver they're tracking:

```csharp
public class DriverLocationHub : Hub
{
    public async Task WatchDriver(string driverId)
    {
        // Leave any previous group first
        var previousDriver = Context.Items["watchingDriver"] as string;
        if (previousDriver is not null)
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"watching:{previousDriver}");

        await Groups.AddToGroupAsync(Context.ConnectionId, $"watching:{driverId}");
        Context.Items["watchingDriver"] = driverId;
    }

    public async Task StopWatching()
    {
        var driverId = Context.Items["watchingDriver"] as string;
        if (driverId is not null)
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"watching:{driverId}");
    }
}
```

On the client side (minimal TypeScript):

```typescript
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/driver-location")
    .withAutomaticReconnect()
    .build();

connection.on("DriverMoved", (data) => {
    updateDriverMarker(data.driverId, data.latitude, data.longitude);
});

await connection.start();
await connection.invoke("WatchDriver", driverId);
```

The `withAutomaticReconnect()` is critical: mobile connections drop constantly. Without it, a brief network hiccup leaves the rider with a frozen map and no indication anything is wrong.

## Step 6: Wiring It Up

```csharp
var builder = WebApplication.CreateBuilder(args);

// Redis
var redis = await ConnectionMultiplexer.ConnectAsync(builder.Configuration["Redis:ConnectionString"]!);
builder.Services.AddSingleton<IConnectionMultiplexer>(redis);
builder.Services.AddSingleton<ILocationStore, RedisLocationStore>();

// Location state buffer — mutable per-driver state, flushed periodically
builder.Services.AddSingleton<LocationStateBuffer>();

// SignalR — add .AddStackExchangeRedis(...) when scaling horizontally
builder.Services.AddSignalR();

// Background processor
builder.Services.AddHostedService<LocationProcessorService>();

var app = builder.Build();

app.MapPost("/drivers/{driverId}/location", (
    string driverId,
    LocationUpdateRequest request,
    LocationStateBuffer buffer) =>
{
    buffer.Update(new LocationUpdate(driverId, request.Latitude, request.Longitude, DateTimeOffset.UtcNow));
    return Results.Accepted();
});

app.MapHub<DriverLocationHub>("/hubs/driver-location");

app.MapGet("/drivers/nearby", async (
    double lat, double lon, double radius,
    ILocationStore store) =>
{
    var drivers = await store.FindNearbyAsync(lat, lon, radius);
    return Results.Ok(drivers);
});

app.Run();
```

## Handling Scale

The single-instance version above works fine up to a few thousand concurrent drivers. When you need to scale horizontally, two things change:

**SignalR backplane.** By default SignalR only pushes to connections on the same server instance. With multiple instances, a driver update arriving at instance A won't reach a rider connected to instance B. The fix is a Redis backplane:

```csharp
builder.Services.AddSignalR()
    .AddStackExchangeRedis(builder.Configuration["Redis:ConnectionString"]!);
```

One line, and SignalR uses Redis pub/sub to fan out messages across all instances.

**The state buffer is per-instance.** `LocationStateBuffer` is in-memory — it doesn't survive restarts and doesn't span instances. For this use case that's fine: drivers resend their position every 4 seconds, so after a restart the buffer refills in seconds and no user-visible impact occurs.

## What Uber Actually Does

Uber's real architecture is more complex — they use a custom geospatial sharding system called H3 (hexagonal hierarchical geospatial indexing), partition driver updates by city and region, and process location data through a streaming pipeline (Apache Kafka → Flink). Their dispatch system is a separate service with its own matching algorithm.

What we've built captures the essential shape: a fast write path that doesn't block on persistence, a Redis geospatial index that answers "who's nearby?" in milliseconds, and a WebSocket channel that keeps the rider map live.

The differences are scale and operational complexity, not architectural direction. The building blocks are the same.

## Common Mistakes

### Mistake 1: Writing location directly to SQL

```csharp
// ❌ Every GPS update hits the database
await _dbContext.DriverLocations.AddAsync(new DriverLocation
{
    DriverId = update.DriverId,
    Latitude = update.Latitude,
    Longitude = update.Longitude,
    Timestamp = update.Timestamp
});
await _dbContext.SaveChangesAsync();
```

This works in development and collapses in production. Location is ephemeral data — you only need the current position, not every position. If you need history for analytics, write to a time-series store or an append-only stream asynchronously, not inline in the request path.

### Mistake 2: Blocking the HTTP thread on Redis

```csharp
// ❌ Driver request blocks until Redis confirms the write
await _redis.GeoAddAsync(DriversKey, new GeoEntry(lon, lat, driverId));
return Results.Ok();
```

Redis is fast, but adding network I/O to every driver request serialises your throughput. The state buffer decouples the HTTP response time from the Redis write time — the driver gets `202` in microseconds and Redis catches up on the next flush tick.

### Mistake 3: Using a queue when you need mutable state

```csharp
// ❌ Channel queues every update — processes stale positions
Channel.CreateBounded<LocationUpdate>(new BoundedChannelOptions(10_000)
{
    FullMode = BoundedChannelFullMode.DropOldest
});
```

A queue with `DropOldest` drops unpredictably under load and processes intermediate positions that are already outdated by the time the consumer reaches them. Location tracking is a state problem, not a message-passing problem. Model it as state.

### Mistake 4: One SignalR group per trip instead of per driver

```csharp
// ❌ Naming the group after the trip
await Groups.AddToGroupAsync(connectionId, $"trip:{tripId}");
```

Trip IDs change across retries and reassignments. Driver IDs don't. Name the group after the driver and the rider joins/leaves as the assignment changes.

### Mistake 5: Forgetting the backplane when scaling SignalR

```csharp
// ❌ Multiple instances, no backplane
// Driver updates arrive at instance A, rider is connected to instance B
// → rider map freezes
builder.Services.AddSignalR(); // missing .AddStackExchangeRedis(...)
```

This is the most common production bug in SignalR deployments. Everything works on a single instance in development and silently breaks when you scale to two.

## Conclusion

The location tracking pipeline is a good example of matching the abstraction to the problem. GPS updates are high-frequency, short-lived, and geospatial — so we model them as mutable state (not a queue), index them in Redis GEO (not a relational table), and push changes in real time via SignalR (not polling).

None of this required a heavy framework or a distributed systems PhD. It's a `ConcurrentDictionary`, a Redis sorted set, and a WebSocket group — standard .NET primitives composed to handle a genuinely hard scale problem.

In the next article we'll build the trip state machine: how a ride moves from `Requested` to `Completed`, how to handle concurrent state transitions, and how to persist the lifecycle with EF Core.

---

*Part 1 of the [Uber-like System Design in .NET](#) series.*

*Full source code: [github.com/AdrianBailador/realtime-driver-location-dotnet](https://github.com/AdrianBailador/realtime-driver-location-dotnet)*

*Questions or suggestions? Open an issue on [GitHub](https://github.com/AdrianBailador/realtime-driver-location-dotnet/issues).*
