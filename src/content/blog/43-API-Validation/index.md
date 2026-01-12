---
title: "Minimal API Validation in .NET 10"
summary: "Discover the new built-in validation support for Minimal APIs in .NET 10. Learn how to use DataAnnotations, custom validation attributes, and IValidatableObject without external packages."
date: "2026-1-12"
tags: ["csharp", "dotnet", "dotnet10", "aspnetcore", "minimalapi", "validation", "dataannotations", "webapi"]
---


![CMinimal API Validation in .NET 10 – by Adrian Bailador Panero](API-Validation.png)

Minimal APIs have been one of the best additions to ASP.NET Core in recent years. They are lightweight, fast, and a perfect fit for microservices and simple APIs. However, one key feature has been missing since their introduction: built-in validation support.

With .NET 10, that finally changes. Microsoft has introduced native validation support for Minimal APIs using the familiar DataAnnotations attributes, eliminating the need for external packages like FluentValidation or MiniValidation for common scenarios.

## The Problem Before .NET 10

Prior to .NET 10, if you wanted to validate request models in Minimal APIs, you had several options, none of which were ideal:

- **Manual validation**: Writing validation logic inside each endpoint
- **MiniValidation**: A lightweight library by Damian Edwards
- **FluentValidation**: A powerful but heavier external dependency
- **MinimalApis.Extensions**: Community package with validation filters

All these approaches required extra code, packages, or configuration. Meanwhile, MVC controllers had built-in model validation out of the box.

## Enabling Validation in .NET 10

Setting up validation in .NET 10 is straightforward. First, register the validation services:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddValidation();

var app = builder.Build();
```

You also need to add a configuration line to your `.csproj` file to enable the source-generated validation interceptors:

```xml
<PropertyGroup>
    <InterceptorsNamespaces>$(InterceptorsNamespaces);Microsoft.AspNetCore.Http.Validation.Generated</InterceptorsNamespaces>
</PropertyGroup>
```

This extra step enables Microsoft's clever source generator approach, which provides compile-time validation discovery without runtime reflection overhead.

## Basic Validation with DataAnnotations

Once enabled, ASP.NET Core automatically validates Minimal API parameters using the standard DataAnnotations attributes. Here's a simple example:

```csharp
using System.ComponentModel.DataAnnotations;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddValidation();
var app = builder.Build();

app.MapPost("/products", (CreateProductRequest request) =>
{
    // This code only runs if validation passes
    return Results.Created($"/products/{request.Name}", request);
});

app.Run();

public class CreateProductRequest
{
    [Required(ErrorMessage = "Product name is required")]
    [StringLength(100, MinimumLength = 3, 
        ErrorMessage = "Name must be between 3 and 100 characters")]
    public string Name { get; set; } = string.Empty;

    [Required]
    [Range(0.01, 10000.00, 
        ErrorMessage = "Price must be between £0.01 and £10,000")]
    public decimal Price { get; set; }

    [Range(0, 1000, ErrorMessage = "Stock cannot exceed 1000 units")]
    public int Stock { get; set; }
}
```

When validation fails, ASP.NET Core automatically returns a standardised `ProblemDetails` response:

```json
{
    "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
    "title": "One or more validation errors occurred.",
    "status": 400,
    "errors": {
        "Name": ["Product name is required"],
        "Price": ["Price must be between £0.01 and £10,000"]
    }
}
```

## Common DataAnnotations Attributes

.NET provides a rich set of validation attributes in the `System.ComponentModel.DataAnnotations` namespace:

| Attribute | Purpose |
|-----------|---------|
| `[Required]` | Field must have a value |
| `[StringLength]` | Limits string length (min/max) |
| `[Range]` | Numeric value within range |
| `[EmailAddress]` | Valid email format |
| `[Phone]` | Valid phone number format |
| `[Url]` | Valid URL format |
| `[CreditCard]` | Valid credit card number |
| `[RegularExpression]` | Matches regex pattern |
| `[Compare]` | Compares two properties |
| `[MinLength]` / `[MaxLength]` | Collection or string length |
| `[Length]` | Min and max length in one attribute |

## Validating Different Parameter Types

The new validation system works across all parameter binding sources:

### Request Body

```csharp
app.MapPost("/orders", (OrderRequest order) => 
    Results.Created($"/orders/{order.Id}", order));
```

### Query Parameters

```csharp
app.MapGet("/products", (
    [Range(1, 100)] int pageSize,
    [Range(1, int.MaxValue)] int page) =>
    Results.Ok($"Page {page}, Size {pageSize}"));
```

### Route Parameters

```csharp
app.MapGet("/users/{id}", (
    [Range(1, int.MaxValue, ErrorMessage = "Invalid user ID")] int id) =>
    Results.Ok($"User {id}"));
```

### Headers

```csharp
app.MapGet("/secure", (
    [Required][FromHeader(Name = "X-Api-Key")] string apiKey) =>
    Results.Ok("Authenticated"));
```

## Creating Custom Validation Attributes

For validation logic that goes beyond the built-in attributes, you can create custom validators by extending `ValidationAttribute`:

```csharp
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public class FutureDateAttribute : ValidationAttribute
{
    public override bool IsValid(object? value)
    {
        if (value is not DateTime date)
            return false;

        return date > DateTime.Today;
    }

    public override string FormatErrorMessage(string name)
    {
        return $"{name} must be a future date.";
    }
}

public class BookingRequest
{
    [Required]
    public string CustomerName { get; set; } = string.Empty;

    [Required]
    [FutureDate(ErrorMessage = "Booking date must be in the future")]
    public DateTime BookingDate { get; set; }
}
```

Another example for business days only:

```csharp
[AttributeUsage(AttributeTargets.Property)]
public class BusinessDayAttribute : ValidationAttribute
{
    protected override ValidationResult? IsValid(
        object? value, 
        ValidationContext validationContext)
    {
        if (value is not DateTime date)
            return new ValidationResult("Invalid date format");

        if (date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
        {
            return new ValidationResult(
                "Delivery must be scheduled on a business day (Monday-Friday)");
        }

        return ValidationResult.Success;
    }
}
```

## Complex Validation with IValidatableObject

When validation rules depend on multiple properties or require access to services, implement the `IValidatableObject` interface:

```csharp
public class OrderRequest : IValidatableObject
{
    [Required]
    public string ProductId { get; set; } = string.Empty;

    [Required]
    [Range(1, 100, ErrorMessage = "Quantity must be between 1 and 100")]
    public int Quantity { get; set; }

    [Required]
    [Range(0.01, double.MaxValue)]
    public decimal UnitPrice { get; set; }

    public string? DiscountCode { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        // Cross-property validation: order total limit
        var total = Quantity * UnitPrice;
        if (total > 10_000m)
        {
            yield return new ValidationResult(
                "Order total cannot exceed £10,000. Please contact sales for large orders.",
                new[] { nameof(Quantity), nameof(UnitPrice) });
        }

        // Conditional validation: discount code format
        if (!string.IsNullOrEmpty(DiscountCode) && !DiscountCode.StartsWith("PROMO-"))
        {
            yield return new ValidationResult(
                "Discount code must start with 'PROMO-'",
                new[] { nameof(DiscountCode) });
        }
    }
}
```

## Disabling Validation for Specific Endpoints

Sometimes you need to bypass validation for certain endpoints, such as internal APIs or partial updates. Use `DisableValidation()`:

```csharp
app.MapPost("/internal/import", (RawDataRequest request) =>
{
    // Validation is skipped for this endpoint
    return Results.Ok("Data imported");
})
.DisableValidation();
```

## Customising Error Responses

You can customise how validation errors are formatted by implementing `IProblemDetailsService`:

```csharp
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Instance = context.HttpContext.Request.Path;
        context.ProblemDetails.Extensions["traceId"] = 
            context.HttpContext.TraceIdentifier;
    };
});
```

## Complete Example: Product API

Here's a complete example bringing together all the validation features:

```csharp
using System.ComponentModel.DataAnnotations;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddValidation();
var app = builder.Build();

// Create product with full validation
app.MapPost("/api/products", (CreateProductRequest request) =>
{
    var product = new Product(
        Guid.NewGuid(),
        request.Name,
        request.Description,
        request.Price,
        request.Category);

    return Results.Created($"/api/products/{product.Id}", product);
});

// Get products with validated query parameters
app.MapGet("/api/products", (
    [Range(1, 50)] int pageSize = 10,
    [Range(1, int.MaxValue)] int page = 1,
    string? category = null) =>
{
    return Results.Ok(new { page, pageSize, category });
});

// Internal endpoint without validation
app.MapPost("/api/products/bulk-import", (List<Product> products) =>
{
    return Results.Ok($"Imported {products.Count} products");
})
.DisableValidation();

app.Run();

// Models
public record Product(Guid Id, string Name, string? Description, decimal Price, string Category);

public class CreateProductRequest : IValidatableObject
{
    [Required(ErrorMessage = "Product name is required")]
    [StringLength(100, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; set; }

    [Required]
    [Range(0.01, 99999.99, ErrorMessage = "Price must be between £0.01 and £99,999.99")]
    public decimal Price { get; set; }

    [Required]
    [RegularExpression("^(Electronics|Clothing|Food|Books|Other)$",
        ErrorMessage = "Invalid category")]
    public string Category { get; set; } = string.Empty;

    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        // Food items must be under £100
        if (Category == "Food" && Price > 100)
        {
            yield return new ValidationResult(
                "Food items cannot exceed £100",
                new[] { nameof(Price) });
        }
    }
}
```

## When to Use FluentValidation Instead

While the built-in validation covers most scenarios, consider FluentValidation when you need:

- Complex conditional validation rules
- Async validation (e.g., checking database uniqueness)
- Reusable validation rules across multiple models
- More expressive validation DSL
- Validation that requires dependency injection

## Best Practices

### Keep Validation Close to Models

Define validation attributes directly on your request models. This makes the validation rules discoverable and keeps them with the data they validate.

### Use Meaningful Error Messages

Always provide clear, user-friendly error messages:

```csharp
// Good
[Range(1, 100, ErrorMessage = "Quantity must be between 1 and 100 items")]

// Bad
[Range(1, 100)]  // Generic message: "The field must be between 1 and 100"
```

### Validate Early, Fail Fast

Let the framework handle validation before your business logic runs. Don't duplicate validation checks inside endpoints.

### Consider Localisation

For multilingual applications, use resource files for error messages:

```csharp
[Required(ErrorMessageResourceType = typeof(ValidationMessages),
          ErrorMessageResourceName = "NameRequired")]
```

## Conclusion

.NET 10's built-in Minimal API validation is a welcome addition that brings feature parity with MVC controllers. With just two lines of configuration, you get automatic validation using the familiar DataAnnotations system, complete with standardised error responses.

Key takeaways:

- Add `builder.Services.AddValidation()` to enable validation
- Add the `InterceptorsNamespaces` configuration to your `.csproj`
- Use standard DataAnnotations attributes on your models
- Create custom attributes for specialised validation
- Implement `IValidatableObject` for cross-property validation
- Use `DisableValidation()` when needed

This native support eliminates the need for external packages in most scenarios, making Minimal APIs an even more attractive choice for building modern web services.
