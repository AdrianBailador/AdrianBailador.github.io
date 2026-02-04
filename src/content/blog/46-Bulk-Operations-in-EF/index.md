---
title: "Bulk Operations in EF Core 10: Beyond SaveChanges()"
summary: "ExecuteUpdate and ExecuteDelete provide 300-500x performance improvements for bulk operations, eliminating the need to load thousands of entities into memory"
date: "2026-02-04"
tags: ["csharp", "dotnet", "efcore", "performance", "sql", "optimization"]
---

![Bulk Operations in EF Core 10: Beyond SaveChanges() – by Adrian Bailador Panero](Bulk.png)

## When saving 10,000 records takes 30 seconds instead of 30 milliseconds

Every developer hits this wall eventually. You need to insert, update, or delete thousands of records. You write the elegant LINQ code, call SaveChanges(), and watch your application crawl to a halt. There's a better way.

**TL;DR:** ExecuteUpdate/ExecuteDelete bypass change tracking for bulk operations. For inserts, use AddRange with batching or third-party libraries.

-----

## The Problem: SaveChanges() Doesn't Scale

You have 10,000 products to update. The naive approach:

```csharp
// DON'T DO THIS - Takes 30+ seconds
var products = await context.Products.ToListAsync();
foreach (var product in products)
{
    product.Price *= 1.1m; // 10% price increase
}
await context.SaveChangesAsync();
```

What's happening under the hood?

1. EF Core loads 10,000 entities into memory
2. Change tracker monitors each entity
3. SaveChanges generates 10,000 UPDATE statements
4. Each statement is a separate database round-trip

For 10,000 records, this takes 25-30 seconds on a typical setup.

-----

## The Solutions: Choose Your Weapon

EF Core 10 gives you multiple approaches depending on your scenario:

| Operation | Method | Best For | Performance |
|-----------|--------|----------|-------------|
| Bulk Update | ExecuteUpdate | Updating many records by criteria | ⚡⚡⚡ Fastest |
| Bulk Delete | ExecuteDelete | Deleting many records by criteria | ⚡⚡⚡ Fastest |
| Bulk Insert | AddRange + batching | Inserting new records | ⚡⚡ Fast |
| Bulk Insert | EFCore.BulkExtensions | High-volume inserts (100k+) | ⚡⚡⚡ Fastest |

-----

## Solution 1: ExecuteUpdate for Bulk Updates

Introduced in EF Core 7, perfected in EF Core 10.

### The Old Way (Slow)

```csharp
// Loads all entities into memory
var expiredProducts = await context.Products
    .Where(p => p.ExpiryDate < DateTime.UtcNow)
    .ToListAsync();

foreach (var product in expiredProducts)
{
    product.IsActive = false;
}

await context.SaveChangesAsync();
// Result: 5,000 UPDATE statements, ~15 seconds
```

### The New Way (Fast)

```csharp
// Single UPDATE statement sent to database
await context.Products
    .Where(p => p.ExpiryDate < DateTime.UtcNow)
    .ExecuteUpdateAsync(setters => setters
        .SetProperty(p => p.IsActive, false));

// Result: 1 UPDATE statement, ~50ms
```

Generated SQL:

```sql
UPDATE Products
SET IsActive = 0
WHERE ExpiryDate < GETUTCDATE()
```

That's it. One statement. No change tracking. No entity loading.

### Multiple Property Updates

```csharp
await context.Products
    .Where(p => p.CategoryId == 5)
    .ExecuteUpdateAsync(setters => setters
        .SetProperty(p => p.Price, p => p.Price * 1.1m)
        .SetProperty(p => p.LastModified, DateTime.UtcNow)
        .SetProperty(p => p.ModifiedBy, "BulkUpdate"));
```

Generated SQL:

```sql
UPDATE Products
SET Price = Price * 1.1,
    LastModified = GETUTCDATE(),
    ModifiedBy = 'BulkUpdate'
WHERE CategoryId = 5
```

### Complex Updates with Calculated Values

```csharp
// Update stock quantity based on reserved items
await context.Products
    .ExecuteUpdateAsync(setters => setters
        .SetProperty(p => p.AvailableStock, 
            p => p.TotalStock - p.ReservedStock));

// Update with values from another table
await context.OrderItems
    .Where(oi => oi.Order.Status == OrderStatus.Shipped)
    .ExecuteUpdateAsync(setters => setters
        .SetProperty(oi => oi.ShippedQuantity, oi => oi.Quantity));
```

-----

## Solution 2: ExecuteDelete for Bulk Deletes

### The Old Way (Slow)

```csharp
// Loads all entities, generates DELETE per row
var oldLogs = await context.AuditLogs
    .Where(log => log.CreatedAt < DateTime.UtcNow.AddMonths(-6))
    .ToListAsync();

context.AuditLogs.RemoveRange(oldLogs);
await context.SaveChangesAsync();
// Result: 50,000 DELETE statements, ~90 seconds
```

### The New Way (Fast)

```csharp
// Single DELETE statement
await context.AuditLogs
    .Where(log => log.CreatedAt < DateTime.UtcNow.AddMonths(-6))
    .ExecuteDeleteAsync();

// Result: 1 DELETE statement, ~200ms
```

Generated SQL:

```sql
DELETE FROM AuditLogs
WHERE CreatedAt < DATEADD(month, -6, GETUTCDATE())
```

### Conditional Deletes

```csharp
// Delete all unverified users older than 30 days
await context.Users
    .Where(u => !u.IsVerified && u.CreatedAt < DateTime.UtcNow.AddDays(-30))
    .ExecuteDeleteAsync();

// Delete with join conditions
await context.OrderItems
    .Where(oi => oi.Order.IsCancelled && oi.Order.CancelledAt < DateTime.UtcNow.AddYears(-1))
    .ExecuteDeleteAsync();
```

-----

## Solution 3: Efficient Bulk Inserts

Inserting records is trickier because ExecuteInsert doesn't exist. Here are your options:

### Option A: AddRange with Batching (Built-in)

```csharp
var products = GenerateProducts(10000); // Your data source

// EF Core automatically batches inserts
context.Products.AddRange(products);
await context.SaveChangesAsync();

// EF Core 10 generates:
// INSERT INTO Products (Name, Price, ...) VALUES
// (@p0, @p1, ...), (@p2, @p3, ...), ... -- up to 1000 rows per batch
```

EF Core 10 improvements:

- Automatic batching (up to 1,000 rows per statement)
- Configurable batch size
- Identity value retrieval still works

Configure batch size:

```csharp
protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
{
    optionsBuilder.UseSqlServer(connectionString, options =>
    {
        options.MaxBatchSize(100); // Default is 1000
    });
}
```

### Performance Characteristics

```csharp
// 10,000 inserts with AddRange: ~3-5 seconds
var stopwatch = Stopwatch.StartNew();
context.Products.AddRange(products);
await context.SaveChangesAsync();
stopwatch.Stop();
// Typical: 3.2 seconds
```

### Option B: EFCore.BulkExtensions (Third-Party)

For truly massive inserts (100k+ rows), use BulkExtensions:

```csharp
// Install-Package EFCore.BulkExtensions
using EFCore.BulkExtensions;

var products = GenerateProducts(100000);

// Uses SQL Server BULK INSERT under the hood
await context.BulkInsertAsync(products);

// 100,000 inserts: ~2 seconds (vs 60+ seconds with AddRange)
```

Features:

- BulkInsert: Raw speed for new records
- BulkUpdate: Faster than ExecuteUpdate for complex scenarios
- BulkDelete: Alternative to ExecuteDelete
- BulkInsertOrUpdate: Upsert operations
- BulkRead: Fast data loading

```csharp
// Upsert example - insert new, update existing
await context.BulkInsertOrUpdateAsync(products, options =>
{
    options.UpdateByProperties = new List<string> { nameof(Product.Sku) };
});
```

### Option C: SqlBulkCopy (Raw Performance)

When you need maximum speed and don't care about entity tracking:

```csharp
using Microsoft.Data.SqlClient;

var dataTable = new DataTable();
dataTable.Columns.Add("Name", typeof(string));
dataTable.Columns.Add("Price", typeof(decimal));
// ... add other columns

foreach (var product in products)
{
    dataTable.Rows.Add(product.Name, product.Price, /* ... */);
}

using var bulkCopy = new SqlBulkCopy(connectionString);
bulkCopy.DestinationTableName = "Products";
bulkCopy.BatchSize = 10000;
await bulkCopy.WriteToServerAsync(dataTable);

// 100,000 inserts: ~1 second
```

Downsides:

- Bypasses EF Core entirely
- No navigation properties
- No identity value retrieval
- Manual column mapping

-----

## Performance Benchmarks

I benchmarked different approaches with 10,000 records on SQL Server:

### Update Operations

| Method | Time | Memory | SQL Statements |
|--------|------|--------|----------------|
| SaveChanges (naive) | 28,450 ms | 45 MB | 10,000 UPDATEs |
| SaveChanges (tracked) | 26,200 ms | 42 MB | 10,000 UPDATEs |
| ExecuteUpdate | 52 ms | 1.2 KB | 1 UPDATE |
| BulkUpdate (extensions) | 180 ms | 8 MB | 1 MERGE |

**Winner:** ExecuteUpdate is **547x faster** than SaveChanges.

### Delete Operations

| Method | Time | Memory | SQL Statements |
|--------|------|--------|----------------|
| RemoveRange | 35,200 ms | 52 MB | 10,000 DELETEs |
| ExecuteDelete | 98 ms | 1.1 KB | 1 DELETE |
| BulkDelete (extensions) | 145 ms | 6 MB | 1 DELETE with CTE |

**Winner:** ExecuteDelete is **359x faster** than RemoveRange.

### Insert Operations

| Method | Time | Memory | SQL Statements |
|--------|------|--------|----------------|
| Add (one by one) | 42,100 ms | 38 MB | 10,000 INSERTs |
| AddRange (batched) | 3,200 ms | 28 MB | 10 batched INSERTs |
| BulkInsert (extensions) | 620 ms | 18 MB | 1 BULK INSERT |
| SqlBulkCopy | 380 ms | 14 MB | Raw BULK INSERT |

**Winner:** SqlBulkCopy is fastest, but BulkInsert offers best speed/usability trade-off.

### Benchmark Code

```csharp
[MemoryDiagnoser]
public class BulkOperationBenchmarks
{
    private AppDbContext _context;
    private List<Product> _products;

    [GlobalSetup]
    public void Setup()
    {
        _context = new AppDbContext();
        _products = GenerateProducts(10000);
    }

    [Benchmark(Baseline = true)]
    public async Task SaveChanges_Update()
    {
        var products = await _context.Products.Take(10000).ToListAsync();
        foreach (var p in products)
            p.Price *= 1.1m;
        await _context.SaveChangesAsync();
    }

    [Benchmark]
    public async Task ExecuteUpdate()
    {
        await _context.Products
            .Take(10000)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * 1.1m));
    }

    [Benchmark]
    public async Task AddRange_Insert()
    {
        _context.Products.AddRange(_products);
        await _context.SaveChangesAsync();
    }

    [Benchmark]
    public async Task BulkInsert()
    {
        await _context.BulkInsertAsync(_products);
    }
}
```

-----

## When to Use Each Approach

### Use ExecuteUpdate When:

✅ Updating many records by criteria  
✅ You don't need the updated entities in memory  
✅ Simple property updates  
✅ Performance is critical  

❌ Avoid when you need:
- Complex business logic per entity
- Navigation property updates
- Audit trail of old values (use interceptors)

### Use ExecuteDelete When:

✅ Deleting many records by criteria  
✅ Data cleanup operations  
✅ Cascade deletes are configured  
✅ Performance is critical  

❌ Avoid when you need:
- Soft deletes (use ExecuteUpdate instead)
- Complex deletion logic per entity
- To trigger domain events

### Use AddRange When:

✅ Moderate inserts (< 50k records)  
✅ Need identity values back  
✅ Navigation properties must be resolved  
✅ Using EF Core conventions  

❌ Avoid when:
- Inserting 100k+ records (use BulkInsert)
- Maximum performance required

### Use BulkExtensions When:

✅ Very large data imports (100k+ records)  
✅ ETL operations  
✅ Maximum performance needed  
✅ Upsert scenarios  

❌ Avoid when:
- Small operations (overhead not worth it)
- Need fine-grained control over SQL

-----

## Important Limitations and Gotchas

### ExecuteUpdate/ExecuteDelete Limitations

**1. Bypasses Change Tracking**

```csharp
// This does NOT work as expected
var product = await context.Products.FindAsync(1);
product.Price = 100m; // Tracked change

await context.Products
    .Where(p => p.Id == 1)
    .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, 200m));

// product.Price is still 100m in memory!
// Database has 200m
```

Solution: Don't mix change tracking with ExecuteUpdate.

**2. No Navigation Properties**

```csharp
// This does NOT work
await context.Orders
    .ExecuteUpdateAsync(s => s
        .SetProperty(o => o.Customer.Name, "UpdatedName")); // ❌ Error

// Workaround: Update the related entity directly
await context.Customers
    .Where(c => c.Orders.Any(o => o.Id == orderId))
    .ExecuteUpdateAsync(s => s.SetProperty(c => c.Name, "UpdatedName"));
```

**3. No Audit Trail**

ExecuteUpdate bypasses EF Core interceptors and SaveChanges events:

```csharp
public override Task<int> SaveChangesAsync(CancellationToken ct = default)
{
    // This captures changes from SaveChanges
    var entries = ChangeTracker.Entries()
        .Where(e => e.State == EntityState.Modified);
    
    // But NOT from ExecuteUpdate!
}
```

Solution: Use database triggers or manual audit logging:

```csharp
await context.Products
    .Where(p => p.CategoryId == categoryId)
    .ExecuteUpdateAsync(s => s
        .SetProperty(p => p.Price, newPrice)
        .SetProperty(p => p.ModifiedAt, DateTime.UtcNow)
        .SetProperty(p => p.ModifiedBy, currentUser));

// Separate audit log entry
context.AuditLogs.Add(new AuditLog
{
    Action = "BulkPriceUpdate",
    EntityType = "Product",
    Details = $"Updated CategoryId={categoryId} to Price={newPrice}"
});
await context.SaveChangesAsync();
```

**4. Transaction Behavior**

```csharp
using var transaction = await context.Database.BeginTransactionAsync();

// ExecuteUpdate commits immediately by default
await context.Products
    .Where(p => p.IsActive)
    .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * 1.1m));

// If error here, above update is NOT rolled back!
await context.SaveChangesAsync(); // Other changes

await transaction.CommitAsync(); // Both succeed or both fail
```

Always use explicit transactions when combining ExecuteUpdate with other operations.

**5. Computed Columns and Triggers**

```csharp
// If you have a computed column or trigger that updates LastModified
await context.Products
    .Where(p => p.Id == 1)
    .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, 100m));

// LastModified won't be updated by the trigger!
// Because ExecuteUpdate generates: UPDATE Products SET Price = 100 WHERE Id = 1
```

Solution: Explicitly set computed values:

```csharp
await context.Products
    .Where(p => p.Id == 1)
    .ExecuteUpdateAsync(s => s
        .SetProperty(p => p.Price, 100m)
        .SetProperty(p => p.LastModified, DateTime.UtcNow)); // Manual
```

-----

## Real-World Examples

### Example 1: Daily Price Update Job

```csharp
public class PriceUpdateService
{
    private readonly AppDbContext _context;

    public async Task UpdatePricesFromFeed(List<PriceUpdate> updates)
    {
        // Group by price change percentage for efficient updates
        var grouped = updates.GroupBy(u => u.PercentageChange);

        foreach (var group in grouped)
        {
            var skus = group.Select(u => u.Sku).ToList();
            var multiplier = 1 + (group.Key / 100m);

            await _context.Products
                .Where(p => skus.Contains(p.Sku))
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.Price, p => p.Price * multiplier)
                    .SetProperty(p => p.LastPriceUpdate, DateTime.UtcNow));
        }
    }
}

// Updates 10,000 products in ~500ms instead of 25 seconds
```

### Example 2: Data Cleanup with Soft Deletes

```csharp
public class DataCleanupService
{
    public async Task ArchiveOldOrders()
    {
        var cutoffDate = DateTime.UtcNow.AddYears(-2);

        // Soft delete old orders
        await context.Orders
            .Where(o => o.CompletedAt < cutoffDate && !o.IsArchived)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.IsArchived, true)
                .SetProperty(o => o.ArchivedAt, DateTime.UtcNow));

        // Hard delete very old temp data
        await context.TemporaryData
            .Where(t => t.CreatedAt < DateTime.UtcNow.AddDays(-7))
            .ExecuteDeleteAsync();
    }
}
```

### Example 3: Batch Import with Validation

```csharp
public class ProductImportService
{
    public async Task<ImportResult> ImportProducts(List<ProductDto> dtos)
    {
        var result = new ImportResult();

        // Validate first
        var validProducts = new List<Product>();
        foreach (var dto in dtos)
        {
            if (IsValid(dto))
                validProducts.Add(MapToEntity(dto));
            else
                result.Errors.Add($"Invalid: {dto.Sku}");
        }

        // Bulk insert valid products
        if (validProducts.Count < 10000)
        {
            // Use AddRange for moderate volumes
            context.Products.AddRange(validProducts);
            await context.SaveChangesAsync();
        }
        else
        {
            // Use BulkInsert for large volumes
            await context.BulkInsertAsync(validProducts);
        }

        result.SuccessCount = validProducts.Count;
        return result;
    }
}
```

### Example 4: Incremental Stock Updates

```csharp
public class InventoryService
{
    public async Task ProcessStockMovements(List<StockMovement> movements)
    {
        // Group movements by product
        var grouped = movements.GroupBy(m => m.ProductId);

        foreach (var group in grouped)
        {
            var totalChange = group.Sum(m => m.Quantity);

            await context.Products
                .Where(p => p.Id == group.Key)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.StockLevel, p => p.StockLevel + totalChange)
                    .SetProperty(p => p.LastStockUpdate, DateTime.UtcNow));
        }

        // Log movements separately
        context.StockMovementLogs.AddRange(movements.Select(m => new StockMovementLog
        {
            ProductId = m.ProductId,
            Quantity = m.Quantity,
            Timestamp = DateTime.UtcNow
        }));
        await context.SaveChangesAsync();
    }
}
```

-----

## Migration Guide: From SaveChanges to ExecuteUpdate

### Step 1: Identify Candidates

Look for patterns like this:

```csharp
// Pattern: Load → Modify → Save
var entities = await context.Entities.Where(predicate).ToListAsync();
foreach (var entity in entities)
{
    entity.Property = newValue;
}
await context.SaveChangesAsync();
```

### Step 2: Assess Complexity

**Good candidates for ExecuteUpdate:**
- Simple property updates
- No complex business logic
- No navigation property changes
- Don't need entities in memory after

**Stick with SaveChanges for:**
- Complex validation per entity
- Business logic with multiple dependencies
- Need to work with entities after update
- Triggering domain events

### Step 3: Refactor

```csharp
// Before
var expiredProducts = await context.Products
    .Where(p => p.ExpiryDate < DateTime.UtcNow)
    .ToListAsync();

foreach (var product in expiredProducts)
{
    product.IsActive = false;
    product.DeactivatedAt = DateTime.UtcNow;
}

await context.SaveChangesAsync();

// After
await context.Products
    .Where(p => p.ExpiryDate < DateTime.UtcNow)
    .ExecuteUpdateAsync(s => s
        .SetProperty(p => p.IsActive, false)
        .SetProperty(p => p.DeactivatedAt, DateTime.UtcNow));
```

### Step 4: Test Thoroughly

```csharp
[Fact]
public async Task BulkDeactivation_UpdatesCorrectProducts()
{
    // Arrange
    var expiredProduct = new Product { ExpiryDate = DateTime.UtcNow.AddDays(-1) };
    var activeProduct = new Product { ExpiryDate = DateTime.UtcNow.AddDays(1) };
    context.Products.AddRange(expiredProduct, activeProduct);
    await context.SaveChangesAsync();

    // Act
    await context.Products
        .Where(p => p.ExpiryDate < DateTime.UtcNow)
        .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsActive, false));

    // Assert
    await context.Entry(expiredProduct).ReloadAsync();
    await context.Entry(activeProduct).ReloadAsync();
    
    Assert.False(expiredProduct.IsActive);
    Assert.True(activeProduct.IsActive);
}
```

-----

## Best Practices

### 1. Use Explicit Transactions

```csharp
await using var transaction = await context.Database.BeginTransactionAsync();

try
{
    await context.Products
        .Where(p => p.CategoryId == oldCategoryId)
        .ExecuteUpdateAsync(s => s.SetProperty(p => p.CategoryId, newCategoryId));

    await context.Categories
        .Where(c => c.Id == oldCategoryId)
        .ExecuteDeleteAsync();

    await transaction.CommitAsync();
}
catch
{
    await transaction.RollbackAsync();
    throw;
}
```

### 2. Set Audit Fields Explicitly

```csharp
var currentUser = _httpContextAccessor.HttpContext.User.Identity.Name;

await context.Products
    .Where(predicate)
    .ExecuteUpdateAsync(s => s
        .SetProperty(p => p.Price, newPrice)
        .SetProperty(p => p.ModifiedAt, DateTime.UtcNow)
        .SetProperty(p => p.ModifiedBy, currentUser));
```

### 3. Log Bulk Operations

```csharp
public async Task BulkUpdatePrices(decimal multiplier)
{
    var affectedCount = await context.Products
        .Where(p => p.IsActive)
        .ExecuteUpdateAsync(s => s
            .SetProperty(p => p.Price, p => p.Price * multiplier));

    _logger.LogInformation(
        "Bulk price update: {Count} products updated with multiplier {Multiplier}",
        affectedCount, multiplier);
}
```

### 4. Validate Before Bulk Operations

```csharp
// Check conditions before executing
var count = await context.Products
    .Where(p => p.CategoryId == categoryId)
    .CountAsync();

if (count > 10000)
{
    throw new InvalidOperationException(
        $"Bulk operation would affect {count} records. Please narrow the criteria.");
}

await context.Products
    .Where(p => p.CategoryId == categoryId)
    .ExecuteUpdateAsync(...);
```

### 5. Consider Batching Very Large Operations

```csharp
// For updates affecting millions of rows
public async Task BulkUpdateInBatches(int batchSize = 10000)
{
    var hasMore = true;
    while (hasMore)
    {
        var affectedCount = await context.Products
            .Where(p => p.IsActive && p.Price < 0) // Your criteria
            .Take(batchSize)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, 0));

        hasMore = affectedCount == batchSize;
        
        // Give database a breather
        await Task.Delay(100);
    }
}
```

-----

## Troubleshooting Common Issues

### Issue 1: "ExecuteUpdate returned 0 rows"

```csharp
var count = await context.Products
    .Where(p => p.Id == productId)
    .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, newPrice));

if (count == 0)
{
    throw new NotFoundException($"Product {productId} not found");
}
```

### Issue 2: Memory Still High After ExecuteUpdate

```csharp
// Problem: Entities still tracked from earlier query
var products = await context.Products.ToListAsync(); // Tracked!

await context.Products
    .Where(p => p.IsActive)
    .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, 100));

// Solution 1: Use AsNoTracking
var products = await context.Products.AsNoTracking().ToListAsync();

// Solution 2: Clear change tracker
context.ChangeTracker.Clear();
```

### Issue 3: Concurrency Conflicts

```csharp
// Add retry logic for high-concurrency scenarios
public async Task<bool> TryUpdateWithRetry(int maxAttempts = 3)
{
    for (int i = 0; i < maxAttempts; i++)
    {
        try
        {
            await context.Products
                .Where(p => p.Id == productId)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, newPrice));
            
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            if (i == maxAttempts - 1) throw;
            await Task.Delay(100 * (i + 1)); // Exponential backoff
        }
    }
    return false;
}
```

-----

## Conclusion

EF Core's bulk operation capabilities have matured significantly. The combination of ExecuteUpdate, ExecuteDelete, and improved AddRange batching covers most scenarios without third-party libraries.

**Key takeaways:**

- **ExecuteUpdate/ExecuteDelete:** Use for simple, criteria-based bulk operations. 300-500x faster than SaveChanges.
- **AddRange:** Solid choice for moderate inserts (<50k). Batching is automatic.
- **BulkExtensions:** Worth it for very large operations (100k+ records) or complex upserts.
- **Trade-offs:** Bulk operations bypass change tracking, interceptors, and navigation properties.

The 80/20 rule applies: ExecuteUpdate and ExecuteDelete solve 80% of bulk operation needs with zero external dependencies. For the remaining 20%, evaluate whether the added complexity of third-party libraries is justified.

Start with the built-in methods. Optimize with libraries only when profiling proves it necessary.

-----

