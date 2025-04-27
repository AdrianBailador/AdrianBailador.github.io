---
title: "Create an API in .NET with MongoDB and Pagination"
summary: "Learn how to build a RESTful API using .NET and MongoDB, with a focus on implementing pagination to efficiently manage large datasets."
date: "2025-04-27"
tags: [".NET", "MongoDB", "Pagination"]
---

![MongoDB and .NET](mongo.png)

---

## Introduction

In this article, we’ll walk through the process of creating a **RESTful API** using **.NET** and **MongoDB**, with a focus on implementing **pagination**. Pagination is essential when working with large datasets, as it helps split data into smaller, manageable chunks, improving both performance and user experience.

If you're new to any of these concepts, don't worry! We’ll explain everything step by step.

---

## Why Use Pagination?

Pagination is a technique used to divide large datasets into pages, ensuring that not all the data is loaded at once. This is crucial when working with large amounts of data, as it improves performance and reduces the load time for the user.

In **MongoDB**, we achieve pagination using the `.Skip()` and `.Limit()` methods. The `.Skip()` method skips over records from previous pages, while `.Limit()` limits the number of records returned. By combining these two methods, we can display only a portion of the data per request.

---

## Prerequisites

Before we begin, make sure you have the following:

- **.NET SDK** (if you don’t have it, [download it here](https://dotnet.microsoft.com/download/dotnet)).
- **MongoDB** installed or access to **MongoDB Atlas** (the cloud service).
- A code editor like **Visual Studio Code**.

---

## Step 1: Create the Project

Let’s start by creating the **.NET** project. Open your terminal and run:

```bash
dotnet new webapi -n MongoPaginationApi
cd MongoPaginationApi
```

This will create a new web API project in the **MongoPaginationApi** folder.

---

## Step 2: Install MongoDB Driver

Next, we need to install the MongoDB driver so that we can connect to the MongoDB database. Run the following command:

```bash
dotnet add package MongoDB.Driver
```

---

## Step 3: Configure MongoDB

Now, let’s set up the connection to MongoDB. Open **appsettings.json** and add your MongoDB connection string:

```json
{
  "MongoDB": {
    "ConnectionString": "mongodb://localhost:27017",
    "DatabaseName": "ProductDb",
    "CollectionName": "Products"
  }
}
```

Replace `"localhost:27017"` with your MongoDB connection string if you're using MongoDB Atlas or another host.

---

## Step 4: Create the Product Model

Next, we need to create the **Product** model, which will define the structure of the data we’ll be working with. Create a file called **Product.cs** in the **Models** folder:

```csharp
public class Product
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Category { get; set; }
    public decimal Price { get; set; }
}
```

---

## Step 5: Create the Product Service

Now, we’ll create the service that will handle MongoDB interactions and implement pagination logic. Create a file called **ProductService.cs** in the **Services** folder:

```csharp
public class ProductService
{
    private readonly IMongoCollection<Product> _products;

    public ProductService(IConfiguration config)
    {
        var client = new MongoClient(config.GetValue<string>("MongoDB:ConnectionString"));
        var database = client.GetDatabase(config.GetValue<string>("MongoDB:DatabaseName"));
        _products = database.GetCollection<Product>(config.GetValue<string>("MongoDB:CollectionName"));
    }

    public List<Product> Get(int page, int pageSize)
    {
        return _products
            .Find(product => true)  // Filter can be added here
            .Skip((page - 1) * pageSize)  // Skip products from previous pages
            .Limit(pageSize)  // Limit the results to the page size
            .ToList();
    }

    public void Create(Product product)
    {
        _products.InsertOne(product);
    }
}
```

---

## Step 6: Create the Products Controller

We’ll now create a controller to handle API requests. Create a file called **ProductsController.cs** in the **Controllers** folder:

```csharp
[Route("api/[controller]")]
[ApiController]
public class ProductsController : ControllerBase
{
    private readonly ProductService _productService;

    public ProductsController(ProductService productService)
    {
        _productService = productService;
    }

    [HttpGet]
    public ActionResult<List<Product>> Get(int page = 1, int pageSize = 10)
    {
        var products = _productService.Get(page, pageSize);
        return Ok(products);
    }
}
```

This controller will expose a `GET` endpoint that accepts `page` and `pageSize` parameters and returns the paginated products.

---

## Step 7: Create the Seeder

To test the API, let’s create a **Seeder** that will insert 100 sample products into the database. Create a file called **Seeder.cs** in the **Services** folder:

```csharp
public class Seeder
{
    private readonly ProductService _productService;

    public Seeder(ProductService productService)
    {
        _productService = productService;
    }

    public void Seed()
    {
        var products = new List<Product>();
        for (int i = 1; i <= 100; i++)
        {
            products.Add(new Product { Name = $"Product {i}", Category = "Books", Price = new Random().Next(1, 100) });
        }

        foreach (var product in products)
        {
            _productService.Create(product);
        }
    }
}
```

Make sure to run the **Seeder** when the app starts. Open **Program.cs** and add this code to ensure the Seeder runs automatically:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<ProductService>();
builder.Services.AddSingleton<Seeder>();

var app = builder.Build();
var seeder = app.Services.GetRequiredService<Seeder>();
seeder.Seed();

app.MapControllers();
app.Run();
```

---

## Step 8: Verify the Results

There are two ways to check if the 100 products were successfully inserted:

1. **Swagger**: Open **http://localhost:5000/swagger** to access Swagger, a tool that lets you interact with your API. You can test pagination by setting the `page` and `pageSize` parameters in the request.
   
2. **MongoDB Compass**: Use **MongoDB Compass** to visually inspect the data in your database.

---

## Conclusion

We’ve successfully created a RESTful API in **.NET** that connects to **MongoDB** and uses **pagination** to handle large datasets. With this setup, you can continue to extend the API by adding more features such as filtering, searching, or authentication.

Feel free to check the complete source code on my [GitHub repository](https://github.com/AdrianBailador/MongoPaginationApi).

---


