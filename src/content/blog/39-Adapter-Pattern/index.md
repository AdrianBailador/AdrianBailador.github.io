---
title: "Adapter Pattern Explained with Real Examples"
summary: "Learn the Adapter Pattern through practical .NET examples: payment gateways, logging systems, and legacy code integration. Understand when and how to use this essential structural design pattern."
date: "2025-12-07"
tags: ["C#", ".NET", "Design Patterns", "Adapter Pattern", "SOLID", "Architecture", "Refactoring", "Best Practices", "Gang of Four", "Structural Patterns"]
---

![Adapter Pattern Explained with Real Examples – by Adrian Bailador Panero](AdapterPattern.png)

## Introduction

You're integrating a third-party payment gateway into your application. Everything looks straightforward until you realize their SDK uses a completely different interface than what your codebase expects. Sound familiar? This is exactly where the **Adapter Pattern** shines.

The Adapter Pattern is one of the most practical design patterns from the Gang of Four. It acts as a bridge between two incompatible interfaces, allowing classes to work together that otherwise couldn't. Think of it like a power adapter when you travel abroad—your device works the same way, but the adapter handles the incompatible outlet.

In this article, I'll walk you through the Adapter Pattern using real-world .NET examples that you'll actually encounter in production code: payment gateways, logging systems, and legacy code integration.

---

## What is the Adapter Pattern?

The Adapter Pattern converts the interface of a class into another interface that clients expect. It lets classes work together that couldn't otherwise because of incompatible interfaces.

### Key Components

- **Target Interface:** The interface your client code expects to work with
- **Adaptee:** The existing class with an incompatible interface
- **Adapter:** The class that bridges the gap between Target and Adaptee
- **Client:** The code that uses the Target interface

---

## Real Example 1: Payment Gateway Integration

Let's start with a common scenario: your application uses a payment interface, but you need to integrate with Stripe, which has its own SDK and conventions.

### The Target Interface (What Your Application Expects)

```csharp
// Your application's payment interface
public interface IPaymentProcessor
{
    Task<PaymentResult> ProcessPaymentAsync(
        decimal amount,
        string currency,
        string cardToken);
    Task<RefundResult> RefundAsync(string transactionId, decimal amount);
}

public record PaymentResult(
    bool Success,
    string TransactionId,
    string? ErrorMessage);

public record RefundResult(
    bool Success,
    string RefundId,
    string? ErrorMessage);
```

### The Adaptee (Stripe's SDK - Simplified)

```csharp
// Stripe's SDK has its own conventions
public class StripeClient
{
    public async Task<StripeCharge> CreateChargeAsync(StripeChargeRequest request)
    {
        // Stripe API call
        await Task.Delay(100); // Simulating API call
        return new StripeCharge
        {
            Id = $"ch_{Guid.NewGuid():N}",
            Status = "succeeded",
            Amount = request.AmountInCents
        };
    }

    public async Task<StripeRefund> CreateRefundAsync(string chargeId, long amountInCents)
    {
        await Task.Delay(100);
        return new StripeRefund
        {
            Id = $"re_{Guid.NewGuid():N}",
            Status = "succeeded"
        };
    }
}

// Stripe uses cents, not decimal amounts!
public class StripeChargeRequest
{
    public long AmountInCents { get; set; }
    public string Currency { get; set; } = "usd";
    public string Source { get; set; } = string.Empty; // Card token
}

public class StripeCharge
{
    public string Id { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public long Amount { get; set; }
}

public class StripeRefund
{
    public string Id { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}
```

### The Adapter (Bridging the Gap)

```csharp
public class StripePaymentAdapter : IPaymentProcessor
{
    private readonly StripeClient _stripeClient;
    private readonly ILogger<StripePaymentAdapter> _logger;

    public StripePaymentAdapter(
        StripeClient stripeClient,
        ILogger<StripePaymentAdapter> logger)
    {
        _stripeClient = stripeClient;
        _logger = logger;
    }

    public async Task<PaymentResult> ProcessPaymentAsync(
        decimal amount,
        string currency,
        string cardToken)
    {
        try
        {
            // Adapt: Convert decimal to cents (Stripe's format)
            var request = new StripeChargeRequest
            {
                AmountInCents = (long)(amount * 100),
                Currency = currency.ToLowerInvariant(),
                Source = cardToken
            };

            var charge = await _stripeClient.CreateChargeAsync(request);

            // Adapt: Convert Stripe response to our format
            return new PaymentResult(
                Success: charge.Status == "succeeded",
                TransactionId: charge.Id,
                ErrorMessage: null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Stripe payment failed");
            return new PaymentResult(
                Success: false,
                TransactionId: string.Empty,
                ErrorMessage: ex.Message);
        }
    }

    public async Task<RefundResult> RefundAsync(string transactionId, decimal amount)
    {
        try
        {
            var amountInCents = (long)(amount * 100);
            var refund = await _stripeClient.CreateRefundAsync(transactionId, amountInCents);

            return new RefundResult(
                Success: refund.Status == "succeeded",
                RefundId: refund.Id,
                ErrorMessage: null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Stripe refund failed");
            return new RefundResult(false, string.Empty, ex.Message);
        }
    }
}
```

---

## Real Example 2: Logging System Adapter

Another common scenario: migrating from one logging framework to another, or supporting multiple logging backends simultaneously.

### Target Interface

```csharp
public interface IAppLogger
{
    void LogInfo(string message, params object[] args);
    void LogWarning(string message, params object[] args);
    void LogError(Exception ex, string message, params object[] args);
    void LogDebug(string message, params object[] args);
}
```

### Adaptees (Different Logging Libraries)

```csharp
// Serilog-style logger
public class SerilogLogger
{
    public void Write(LogLevel level, string template, params object[] values) { }
    public void Write(LogLevel level, Exception ex, string template, params object[] values) { }
}

// Legacy logging library
public class LegacyLogger
{
    public void WriteToLog(string category, string message, int severity) { }
    public void WriteException(string category, Exception ex) { }
}
```

### Adapters

```csharp
public class SerilogAdapter : IAppLogger
{
    private readonly SerilogLogger _logger;

    public SerilogAdapter(SerilogLogger logger) => _logger = logger;

    public void LogInfo(string message, params object[] args)
        => _logger.Write(LogLevel.Information, message, args);

    public void LogWarning(string message, params object[] args)
        => _logger.Write(LogLevel.Warning, message, args);

    public void LogError(Exception ex, string message, params object[] args)
        => _logger.Write(LogLevel.Error, ex, message, args);

    public void LogDebug(string message, params object[] args)
        => _logger.Write(LogLevel.Debug, message, args);
}

public class LegacyLoggerAdapter : IAppLogger
{
    private readonly LegacyLogger _logger;
    private readonly string _category;

    public LegacyLoggerAdapter(LegacyLogger logger, string category)
    {
        _logger = logger;
        _category = category;
    }

    public void LogInfo(string message, params object[] args)
        => _logger.WriteToLog(_category, Format(message, args), severity: 1);

    public void LogWarning(string message, params object[] args)
        => _logger.WriteToLog(_category, Format(message, args), severity: 2);

    public void LogError(Exception ex, string message, params object[] args)
    {
        _logger.WriteToLog(_category, Format(message, args), severity: 3);
        _logger.WriteException(_category, ex);
    }

    public void LogDebug(string message, params object[] args)
        => _logger.WriteToLog(_category, Format(message, args), severity: 0);

    private static string Format(string message, object[] args)
        => args.Length > 0 ? string.Format(message, args) : message;
}
```

---

## Real Example 3: Legacy Code Integration

This is perhaps the most valuable use case: you need to integrate a legacy system that can't be modified with your modern codebase.

### Legacy Customer Database

```csharp
// Legacy system - can't be modified
public class LegacyCustomerDatabase
{
    // Uses old naming conventions and synchronous operations
    public DataTable GetCustByID(int custID)
    {
        var dt = new DataTable();
        dt.Columns.Add("CustID", typeof(int));
        dt.Columns.Add("CustName", typeof(string));
        dt.Columns.Add("CustEmail", typeof(string));
        dt.Columns.Add("CustPhone", typeof(string));
        dt.Columns.Add("IsActive", typeof(int)); // 1 or 0
        dt.Rows.Add(custID, "John Doe", "john@example.com", "555-1234", 1);
        return dt;
    }

    public int UpdateCust(int custID, string name, string email, string phone)
    {
        // Simulates database update, returns affected rows
        return 1;
    }
}
```

### Modern Interface

```csharp
public interface ICustomerRepository
{
    Task<Customer?> GetByIdAsync(int id);
    Task<bool> UpdateAsync(Customer customer);
}

public class Customer
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}
```

### The Adapter

```csharp
public class LegacyCustomerAdapter : ICustomerRepository
{
    private readonly LegacyCustomerDatabase _legacyDb;

    public LegacyCustomerAdapter(LegacyCustomerDatabase legacyDb)
    {
        _legacyDb = legacyDb;
    }

    public Task<Customer?> GetByIdAsync(int id)
    {
        // Wrap synchronous call in Task for async interface
        return Task.Run(() =>
        {
            var dataTable = _legacyDb.GetCustByID(id);

            if (dataTable.Rows.Count == 0)
                return null;

            var row = dataTable.Rows[0];

            // Adapt DataTable to Customer object
            return new Customer
            {
                Id = (int)row["CustID"],
                Name = row["CustName"].ToString() ?? string.Empty,
                Email = row["CustEmail"].ToString() ?? string.Empty,
                Phone = row["CustPhone"].ToString() ?? string.Empty,
                IsActive = (int)row["IsActive"] == 1
            };
        });
    }

    public Task<bool> UpdateAsync(Customer customer)
    {
        return Task.Run(() =>
        {
            var affectedRows = _legacyDb.UpdateCust(
                customer.Id,
                customer.Name,
                customer.Email,
                customer.Phone);

            return affectedRows > 0;
        });
    }
}
```

---

## Dependency Injection Setup

Here's how you'd wire everything up in ASP.NET Core:

```csharp
// Program.cs or Startup.cs
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddPaymentServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Register the Stripe client
        services.AddSingleton<StripeClient>();

        // Register the adapter as the implementation of IPaymentProcessor
        services.AddScoped<IPaymentProcessor, StripePaymentAdapter>();

        return services;
    }

    public static IServiceCollection AddLegacyCustomerSupport(
        this IServiceCollection services)
    {
        services.AddSingleton<LegacyCustomerDatabase>();
        services.AddScoped<ICustomerRepository, LegacyCustomerAdapter>();

        return services;
    }
}
```

---

## When to Use the Adapter Pattern

### Use It When

1. **Integrating third-party libraries** with different interfaces than your codebase expects
2. **Working with legacy systems** that can't be modified
3. **Migrating between services** (e.g., switching payment providers)
4. **Supporting multiple implementations** of similar functionality
5. **Isolating external dependencies** for easier testing

### Avoid When

1. **You control both interfaces** — refactor instead
2. **Simple mappings** — an extension method or AutoMapper might suffice
3. **One-time integrations** — the overhead might not be worth it

---

## Adapter vs Other Patterns

| Pattern | Purpose | Key Difference |
|---------|---------|----------------|
| **Adapter** | Makes incompatible interfaces work together | Converts one interface to another |
| **Facade** | Simplifies a complex subsystem | Provides a simpler interface |
| **Decorator** | Adds behavior to objects | Keeps the same interface |
| **Bridge** | Separates abstraction from implementation | Designed upfront for flexibility |

---

## Best Practices

1. **Keep adapters focused:** One adapter per adaptee. Don't create Swiss Army knife adapters.
2. **Handle errors gracefully:** Translate exceptions from the adaptee into meaningful exceptions for your domain.
3. **Add logging:** Adapters are great places to add logging for debugging integration issues.
4. **Test thoroughly:** Write unit tests for the adapter and integration tests for the full flow.
5. **Document the mapping:** Make it clear how concepts from the adaptee map to your domain.

---

## Conclusion

The Adapter Pattern is one of those patterns you'll use repeatedly throughout your career. Whether you're integrating payment gateways, migrating logging frameworks, or breathing new life into legacy systems, adapters provide a clean way to bridge incompatible interfaces without polluting your codebase.

The key takeaway is this: **adapters should be invisible to the rest of your application**. Your business logic should work with your interfaces, completely unaware that an adapter is translating calls to a third-party SDK or legacy system underneath.

Next time you find yourself writing wrapper code to make two things work together, reach for the Adapter Pattern. Your future self will thank you.

---

## Further Reading

- [Gang of Four - Design Patterns](https://www.amazon.com/Design-Patterns-Elements-Reusable-Object-Oriented/dp/0201633612)
- [Refactoring Guru - Adapter Pattern](https://refactoring.guru/design-patterns/adapter)