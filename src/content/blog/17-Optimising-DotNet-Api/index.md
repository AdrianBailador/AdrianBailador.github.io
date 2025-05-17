---
title: "Optimising ASP.NET Core APIs for Speed and Efficiency. Practical techniques to reduce latency, CPU usage, and memory allocations"
summary: "Building a working API is one thing — building a *fast and efficient* API is another. As your application scales or handles more users, performance becomes a critical concern."
date: "2025-05-17"
tags: [".NET", "Performance", "Memory", "API"]

---

![Optimising](Optimising.png)

---





Building a working API is one thing — building a *fast and efficient* API is another. As your application scales or handles more users, performance becomes a critical concern.

In this article, we’ll walk through practical techniques to optimise ASP.NET Core APIs for speed and efficiency, covering compression, caching, efficient serialisation, memory pressure, streaming, and monitoring.

---

## 🚀 1. Enable Response Compression

ASP.NET Core does not enable compression by default. Enabling it can drastically reduce payload sizes — especially for JSON-heavy responses.

📉 *Example*: a 45KB JSON payload can be reduced to 8KB with Gzip compression.

```csharp
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(
        new[] { "application/json" });
});

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});
````

📖 [Response compression in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/performance/response-compression)

---

## 🧠 2. Use Caching Strategically

Caching reduces redundant work and improves throughput dramatically.

### 🔸 a) Response Caching

Response caching stores entire responses and serves them directly, saving CPU cycles and database hits.

```csharp
builder.Services.AddResponseCaching();
app.UseResponseCaching();

[HttpGet]
[ResponseCache(Duration = 60)]
public IActionResult GetCachedData()
{
    return Ok(new { message = "Cached response", time = DateTime.UtcNow });
}
```

### 🔸 b) In-Memory or Distributed Caching

Use `IMemoryCache` or `IDistributedCache` to cache database or computation-heavy results.

```csharp
public class MyService
{
    private readonly IMemoryCache _cache;

    public MyService(IMemoryCache cache) => _cache = cache;

    public async Task<string> GetDataAsync()
    {
        return await _cache.GetOrCreateAsync("data-key", entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
            return FetchFromDatabaseAsync();
        });
    }
}
```

📖 [Caching in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/performance/caching/overview?view=aspnetcore-9.0)

---

## 🧩 3. Use Efficient JSON Serialisation

ASP.NET Core uses `System.Text.Json` by default — it's fast, but you can still tweak it for better results.

### ✅ Recommended options:

```csharp
builder.Services.Configure<JsonOptions>(options =>
{
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});
```

### ⚡ Advanced: Source Generators

Improves serialisation speed and reduces allocations.

```csharp
[JsonSerializable(typeof(MyResponseModel))]
internal partial class MyJsonContext : JsonSerializerContext { }
```

```csharp
var json = JsonSerializer.Serialize(myData, MyJsonContext.Default.MyResponseModel);
```

📖 [System.Text.Json overview](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json-overview)

---

## ♻️ 4. Reduce Allocations and GC Pressure

Excessive allocations → frequent garbage collections → latency spikes. Use low-allocation patterns whenever possible.

### ✅ Tips:

* Reuse buffers with `ArrayPool<T>`:

  ```csharp
  var buffer = ArrayPool<byte>.Shared.Rent(1024);
  // use buffer...
  ArrayPool<byte>.Shared.Return(buffer);
  ```

* Prefer `readonly struct` when the object is immutable and passed by reference.

* Avoid unnecessary `.ToList()`, `.Select()` and LINQ operations in hot paths.

* Don’t return `IEnumerable<T>` if the data is already materialised.

📖 [Performance best practices for .NET](https://learn.microsoft.com/en-us/aspnet/core/performance/overview?view=aspnetcore-9.0)

---

## 🌊 5. Stream Data When Possible

When returning large datasets, avoid loading the full result into memory.

### ✅ Use `IAsyncEnumerable<T>`:

```csharp
[HttpGet]
public async IAsyncEnumerable<MyItem> StreamItems()
{
    await foreach (var item in _repository.GetItemsAsync())
    {
        yield return item;
    }
}
```

This supports efficient streaming over HTTP/2, reducing memory pressure and improving time-to-first-byte.

---

## ⚙️ 6. Use Dependency Injection Efficiently

Registering your services properly avoids unnecessary instantiations and memory waste.

### ✅ Guidelines:

* `Singleton`: for stateless and thread-safe services.
* `Scoped`: for per-request lifetime.
* Avoid injecting large services if only used conditionally.
* Consider lazy loading via `Lazy<T>` or factory methods.

```csharp
services.AddSingleton<HttpClient>();
services.AddScoped<IMyService, MyService>();
```

📖 [Dependency injection in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection)

---

## 📈 7. Measure and Monitor

**Don't optimise blindly. Always profile first.**

### ✅ Tools:

* [`BenchmarkDotNet`](https://benchmarkdotnet.org/) — for isolated performance testing.
* [Visual Studio Profiler](https://learn.microsoft.com/en-us/visualstudio/profiling/) or [JetBrains dotTrace](https://www.jetbrains.com/profiler/)
* Runtime metrics with [OpenTelemetry](https://opentelemetry.io/), [Application Insights](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview), or [Prometheus](https://prometheus.io/).

---

## ✅ Performance Checklist

* [ ] Is response compression enabled?
* [ ] Are you using `System.Text.Json` with proper settings?
* [ ] Are you caching expensive operations or results?
* [ ] Have you measured and reduced memory allocations?
* [ ] Are you streaming large data instead of loading all at once?
* [ ] Is your dependency injection properly scoped?
* [ ] Are you monitoring real performance metrics in production?

---

## 🔚 Conclusion

Efficient APIs aren’t just about fast code — they’re about thoughtful design, strategic trade-offs, and the right tools. These techniques help reduce latency, CPU load, and memory usage, making your APIs ready for real-world scale.

Optimise smartly. Profile often. And ship fast.

---



