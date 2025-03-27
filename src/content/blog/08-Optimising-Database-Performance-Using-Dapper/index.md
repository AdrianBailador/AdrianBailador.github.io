---
title: "Optimising Database Performance Using Dapper"
summary: "Dapper is a lightweight micro-ORM for .NET that offers high-speed data access while keeping things simple. Unlike full-fledged ORMs like Entity Framework, Dapper focuses on raw SQL execution with minimal overhead. If you're working on an application where performance matters, Dapper can be a great choice."
date: "March 27 2025"
draft: false
tags:
- .Net
- C#
- .Net Core
- SQL
- Dapper
- Database



---


In this article, we'll go over practical ways to get the best performance when using Dapper.



## 1. Write Efficient Queries
Since Dapper runs raw SQL, poorly written queries can slow things down. Here are some best practices:
- Select only the columns you need (`SELECT column1, column2 FROM Table` instead of `SELECT *`).
- Use indexes on frequently searched columns.
- Keep joins simple and denormalise where necessary.
- Use stored procedures for repetitive queries.
- Check performance with execution plans (`EXPLAIN` in MySQL/PostgreSQL, `SHOW EXECUTION PLAN` in SQL Server).

### Example:
```csharp
var sql = "SELECT Id, Name FROM Customers WHERE IsActive = @IsActive";
var customers = connection.Query<Customer>(sql, new { IsActive = true }).ToList();
```



## 2. Use Parameterised Queries
Always use parameterised queries to prevent SQL injection and improve efficiency:

```csharp
var sql = "SELECT * FROM Orders WHERE CustomerId = @CustomerId";
var orders = connection.Query<Order>(sql, new { CustomerId = 1 }).ToList();
```

Dapper automatically handles parameters, making your queries safer and faster.



## 3. Reduce Database Calls with `QueryMultiple`
If you need to run multiple queries at once, `QueryMultiple` can help reduce database round trips:

```csharp
var sql = "SELECT * FROM Customers; SELECT * FROM Orders";
using (var multi = connection.QueryMultiple(sql))
{
    var customers = multi.Read<Customer>().ToList();
    var orders = multi.Read<Order>().ToList();
}
```

This approach improves efficiency by fetching multiple result sets in a single request.


## 4. Reuse Connections Efficiently
Dapper relies on ADO.NET under the hood, which benefits from connection pooling. To get the most out of it:
- Reuse `IDbConnection` instances where possible.
- Open and close connections efficiently to avoid unnecessary resource usage.

Example:
```csharp
using (var connection = new SqlConnection(connectionString))
{
    var customers = connection.Query<Customer>("SELECT * FROM Customers").ToList();
}
```

Using `using` ensures connections are properly disposed of when no longer needed.



## 5. Optimise Bulk Inserts
Dapper isn't built for bulk inserts, but you can speed things up using `SqlBulkCopy` for large datasets:

```csharp
using (var bulkCopy = new SqlBulkCopy(connectionString))
{
    bulkCopy.DestinationTableName = "Customers";
    bulkCopy.WriteToServer(dataTable);
}
```

For smaller inserts, consider running multiple `INSERT` statements in a single query. If you're using SQL Server, **Table-Valued Parameters (TVPs)** can help:

```csharp
var dt = new DataTable();
dt.Columns.Add("Id", typeof(int));
dt.Columns.Add("Name", typeof(string));


using (var connection = new SqlConnection(connectionString))
{
    var parameters = new { Customers = dt.AsTableValuedParameter("CustomerType") };
    connection.Execute("INSERT INTO Customers (Id, Name) SELECT Id, Name FROM @Customers", parameters);
}
```


## 6. Use Asynchronous Queries
Using Dapper’s async methods (`QueryAsync`, `ExecuteAsync`) prevents blocking, making your application more scalable:

```csharp
var sql = "SELECT * FROM Customers WHERE IsActive = @IsActive";
var customers = await connection.QueryAsync<Customer>(sql, new { IsActive = true });
```

Async methods are especially useful in web applications handling many database requests simultaneously.



## 7. Simplify CRUD Operations with Dapper.Contrib
Dapper.Contrib adds helper methods for common CRUD operations. While it's convenient, it may add some overhead compared to raw SQL:

```csharp
using Dapper.Contrib.Extensions;
var customer = new Customer { Name = "John Doe" };
connection.Insert(customer);
```

If performance is critical, writing direct SQL queries is usually faster.



## 8. Dapper vs. Entity Framework
Dapper and Entity Framework serve different purposes:

| Feature          | Dapper  | Entity Framework |
|----------------|---------|----------------|
| Performance    | ⚡ Fast  | 🐢 Slower due to abstraction |
| Ease of Use    | Medium  | High (Auto Migrations, LINQ) |
| Flexibility    | High (Full SQL control) | Medium (ORM with some SQL support) |
| Best for       | High-performance apps, microservices | Complex data models, rapid development |

If raw performance is your top priority, go with Dapper. If you need advanced data modelling features, Entity Framework might be a better fit.



## Conclusion
Dapper dances gracefully between speed and simplicity. Crafting sharp queries, harnessing connection pooling, leveraging asynchronous operations, and fine-tuning bulk processes, all lead to peak performance in your .Enter the realm of NET applications, where best practices reign supreme. Navigate the chaos to construct a dynamic, adaptable, and swift system, all the while embracing simplicity and maintainability.

