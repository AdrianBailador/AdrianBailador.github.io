---
title: "Understanding the Cost of Abstractions in .NET"
summary: "Abstractions make our code elegant and modular — but they're not free. In this article, we explore how some common abstractions in .NET can hurt performance if used carelessly, and how to avoid the hidden costs."
date: "2025-05-22"
tags: [".NET", "Performance", "Abstractions", "Optimisation"]
---

![Abstractions](Abstraction.png)

---

Clean code isn't always fast code. While abstractions like **LINQ**, **interfaces**, or **dependency injection** make our code cleaner and more maintainable, they can introduce runtime overhead. And in performance-critical paths, those costs add up quickly.

In this article, we'll walk through **how common .NET abstractions can degrade performance**, explore when to use them with care, and share techniques to avoid unnecessary overhead.

---

## 🧱 1. LINQ and Deferred Execution

LINQ is incredibly expressive, but it's not always the most efficient — especially in tight loops or "hot paths."

#### ❌ Common Issue: Unnecessary Materialisation and Allocations

```csharp
var filtered = data.Where(x => x.IsActive).ToList();
````

While flexible, LINQ's deferred execution model can lead to hidden costs. The `.ToList()` call here forces **immediate materialisation**, introducing new allocations for the list and potentially temporary iterators. If this operation is repeated frequently on large datasets, the overhead can be significant.

#### ✅ Prefer: Explicit Loops for Performance-Critical Code

```csharp
var filtered = new List<MyItem>();
foreach (var item in data)
{
    if (item.IsActive)
        filtered.Add(item);
}
```

For large datasets or performance-critical code, avoiding LINQ can directly reduce **allocations** and **CPU usage**. LINQ is fantastic for readability and composability, but be mindful of its overhead when every millisecond counts.


---

## 👻 2. Interfaces and Virtual Dispatch

Interfaces are core to good architecture, promoting loose coupling and testability. However, they introduce **virtual dispatch**, which can subtly impact performance:

* It can **hinder inlining** by the JIT compiler.
* It might **increase CPU branch mispredictions**.
* It can make **profiling and debugging trickier**.

#### ❌ Hot-Path Abstraction:

```csharp
public interface IProcessor { void Process(); }

public class MyProcessor : IProcessor { /* ... */ }

IProcessor processor = new MyProcessor();
processor.Process(); // Virtual call
```

#### ✅ Alternative: Use Concrete Types or `readonly struct`

```csharp
public readonly struct FastProcessor
{
    public void Process() { /* fast logic */ }
}

var processor = new FastProcessor(); // Value type, no virtual dispatch
processor.Process();
```

Using a `readonly struct` for small, frequently used types enables the JIT to make more aggressive optimisations.


---

## ⏳ 3. Async/Await Overhead

`async`/`await` simplifies asynchronous programming, but introduces **state machines**, **heap allocations**, and **synchronisation context capturing**.

#### ❌ Overhead in Frequently Called Code:

```csharp
public async Task<int> GetDataAsync()
{
    await Task.Delay(100);
    return 42;
}
```

#### ✅ Use `ValueTask<T>` for Sync-Over-Async:

```csharp
public ValueTask<int> GetDataAsync()
{
    return new ValueTask<int>(42);
}
```


---

## 💉 4. Overusing Dependency Injection

DI is powerful but can introduce **resolution overhead**, **slow startup**, and **unnecessary service instantiation**.

#### ❌ Costly Service Registration:

```csharp
services.AddScoped<IMyService, HeavyService>();
```

#### ✅ Optimise with `Lazy<T>` or Factory Injection:

```csharp
services.AddSingleton<Lazy<IHeavyService>>(provider =>
{
    return new Lazy<IHeavyService>(() =>
        new HeavyService(provider.GetRequiredService<ILogger>()));
});
```


---

## 🔍 5. Benchmark and Profile — Don’t Guess

The most crucial rule in performance optimisation: **measure before you optimise.**

#### 🛠️ Recommended Tools

* [BenchmarkDotNet](https://github.com/dotnet/BenchmarkDotNet)
* [dotnet-trace](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/dotnet-trace)
* [PerfView](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/administration/monitor-use-perfview-collect-event-trace-data)
* [Visual Studio Profiler](https://learn.microsoft.com/en-us/visualstudio/profiling/?view=vs-2022)

#### 📊 Example Benchmark:

```csharp
[MemoryDiagnoser]
public class LinqVsLoopBenchmarks
{
    private List<MyItem> _data;

    [GlobalSetup]
    public void Setup()
    {
        _data = Enumerable.Range(0, 1000)
                          .Select(i => new MyItem { Id = i, Flag = i % 2 == 0 })
                          .ToList();
    }

    [Benchmark]
    public List<MyItem> WithLINQ() =>
        _data.Where(x => x.Flag).ToList();

    [Benchmark]
    public List<MyItem> WithLoop()
    {
        var result = new List<MyItem>();
        foreach (var item in _data)
        {
            if (item.Flag)
                result.Add(item);
        }
        return result;
    }
}

public class MyItem { public int Id { get; set; } public bool Flag { get; set; } }
```

---

## 📋 Summary Table

| Abstraction              | Common Risk                           | Recommended Optimisation                                                  |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------------------- |
| **LINQ**                 | Allocations, deferred execution       | Use explicit loops in hot paths.                                          |
| **Interfaces**           | Virtual dispatch overhead             | Prefer concrete types or `readonly struct` where possible.                |
| **Async/Await**          | GC pressure, state machine allocation | Use `ValueTask<T>` if results are often synchronously available.          |
| **Dependency Injection** | Resolution overhead                   | Use `Lazy<T>`, factory methods, and correct lifetimes (Scoped/Singleton). |

---

## ✅ Performance Checklist

* Are you using **LINQ in hot paths** where performance is critical?
* Are **virtual/interface calls** affecting inlining in tight loops?
* Could you use **`ValueTask<T>`** to reduce `async` overhead?
* Are your **DI services scoped correctly** and not overused?
* Have you **benchmarked and profiled** with real workloads?

---

## 🔚 Conclusion

Abstractions make code manageable — but they're not free. In performance-sensitive scenarios, the hidden costs of elegant design can be significant.

Optimisation is not about avoiding abstractions — it's about **understanding their trade-offs** and using them **intentionally**. Write clean code, measure its impact, and optimise only what truly matters.



---


