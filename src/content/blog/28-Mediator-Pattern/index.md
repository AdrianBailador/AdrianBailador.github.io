---
title: "Applying the Mediator Pattern in ASP.NET Core with MediatR"
summary: "Decouple your ASP.NET Core applications using the Mediator pattern and MediatR. This guide shows how to structure your code for maintainability, testability, and clean architecture with real-world examples and pipeline behaviours."
date: "2025-07-27"
tags: [".NET", "ASP.NET Core", "MediatR", "Design Patterns", "Clean Architecture", "Dependency Injection", "C#"]
---

![Applying the Mediator Pattern in ASP.NET Core with MediatR – by Adrián Bailador Panero](MediatorPattern.png)

In a typical ASP.NET Core application, you might be tempted to place a lot of logic in your controllers or services. As the app grows, this can lead to:

* Controllers bloated with business logic
* Services tightly coupled and difficult to test
* A tangled web of dependencies that becomes a nightmare to maintain

Sound familiar?

Enter the **Mediator pattern**, and more specifically, [**MediatR**](https://github.com/jbogard/MediatR): a lightweight library that brings this pattern to your .NET applications.

---

## What Is the Mediator Pattern?

The Mediator pattern encourages communication between objects through a central "mediator" rather than direct references. It promotes:

- **Loose coupling** between components
- **Single Responsibility** in handlers
- **Centralised coordination** of behaviour

In ASP.NET Core, this means that instead of calling services directly from controllers, we send a **request** to MediatR, which routes it to a **handler**.

---

## Why Use MediatR?

Some key benefits:

✅ Your controllers stay clean and focused  
✅ Business logic is encapsulated in small, testable units  
✅ Great synergy with the [CQRS pattern](https://martinfowler.com/bliki/CQRS.html)  
✅ Built-in support for behaviours (logging, validation, caching)

---

## Getting Started with MediatR

Install the NuGet packages:

```bash
dotnet add package MediatR
dotnet add package MediatR.Extensions.Microsoft.DependencyInjection
````

Register MediatR in your application (example using .NET 8 Minimal APIs):

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddMediatR(cfg =>
    cfg.RegisterServicesFromAssembly(typeof(Program).Assembly));

var app = builder.Build();
```

---

## Define a Request

Create a request that represents your action. For example, fetching a list of products:

```csharp
public record GetAllProductsQuery() : IRequest<IEnumerable<Product>>;
```

This is a **query** (read operation) using the `IRequest<TResponse>` interface from MediatR.

---

## Create the Handler

Now define a handler that contains the actual logic:

```csharp
public class GetAllProductsHandler : IRequestHandler<GetAllProductsQuery, IEnumerable<Product>>
{
    private readonly ProductDbContext _context;

    public GetAllProductsHandler(ProductDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Product>> Handle(GetAllProductsQuery request, CancellationToken cancellationToken)
    {
        return await _context.Products
            .AsNoTracking()
            .ToListAsync(cancellationToken);
    }
}
```

This handler can be easily tested in isolation.

---

## Use It in Your Endpoint

Now, your endpoint becomes clean and focused:

```csharp
app.MapGet("/products", async (ISender sender) =>
{
    var products = await sender.Send(new GetAllProductsQuery());
    return Results.Ok(products);
});
```

Notice how we don’t inject the database context or repository directly — just MediatR's `ISender`.

---

## Structure: Commands vs Queries

When applying **CQRS** with MediatR, we typically separate:

* `IRequest<T>`: **Queries** (read-only, return data)
* `IRequest<Unit>` or `IRequest<bool>`: **Commands** (write operations, return nothing or success/failure)

This encourages clear separation of concerns.

---

## Add Pipeline Behaviours (Validation, Logging, etc.)

One of MediatR’s most powerful features is the **pipeline**.

You can inject cross-cutting concerns like validation, logging, caching, etc., without touching your handlers.

Example: a simple logging behaviour

```csharp
public class LoggingBehaviour<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ILogger<LoggingBehaviour<TRequest, TResponse>> _logger;

    public LoggingBehaviour(ILogger<LoggingBehaviour<TRequest, TResponse>> logger)
    {
        _logger = logger;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("Handling {RequestName}", typeof(TRequest).Name);
        var response = await next();
        _logger.LogInformation("Handled {RequestName}", typeof(TRequest).Name);
        return response;
    }
}
```

Register it in your `Program.cs`:

```csharp
builder.Services.AddTransient(typeof(IPipelineBehavior<,>), typeof(LoggingBehaviour<,>));
```

You can do the same for FluentValidation, retry policies, or performance tracing.

---

## Can I Still Use Dependency Injection?

Absolutely! All your handlers and behaviours can use constructor injection as usual. MediatR plays very well with the standard ASP.NET Core DI system.

---

## How Do I Test It?

Testing is simple. Just instantiate the handler and pass the request directly:

```csharp
[Fact]
public async Task GetAllProducts_ReturnsData()
{
    // Arrange
    var context = FakeDbContextFactory.Create(); // use EF Core InMemory for testing
    var handler = new GetAllProductsHandler(context);

    // Act
    var result = await handler.Handle(new GetAllProductsQuery(), default);

    // Assert
    Assert.NotNull(result);
    Assert.NotEmpty(result);
}
```

No web server or integration test needed.

---

## When Not to Use MediatR?

While MediatR is fantastic for many scenarios, it's not always the best choice:

* If your app is very small, it might add unnecessary complexity
* If handlers become overly fragmented, they can be harder to manage
* For synchronous command chains, consider using a service class instead

Use it where it adds **clarity and structure**, not by default.

---

## Conclusion

The Mediator pattern — implemented with MediatR — is a great way to improve the structure, testability, and maintainability of your ASP.NET Core applications.

By centralising message handling and enabling cross-cutting behaviours through pipelines, MediatR helps you write cleaner, more robust code — especially in applications adopting **Clean Architecture** or **CQRS**.

Give it a try in your next feature. You might never go back.

---




