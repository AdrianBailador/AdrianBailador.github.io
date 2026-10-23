---
title: "Database Indexing in .NET with EF Core – Boost Your Query Performance"
summary: "Learn how to improve query performance in your .NET applications using database indexing with Entity Framework Core. Includes examples with Fluent API, Data Annotations, migrations, and a benchmark."
date: "2025-08-18"
tags: [".NET", "EF Core", "database", "Indexing", "performance", "C#", "SQLite"]
---

![Implementing Database Indexing in EF Core – by Adrián Bailador Panero](DatabaseIndexing.png)

---

Imagine this: your API takes **500 ms** to fetch a single user record.
With a simple index, that same query can drop to **5 ms**.

That’s the power of **database indexing** — one of the simplest yet most effective ways to supercharge your queries.

In this guide, we’ll explore **how to create and manage indexes in Entity Framework Core**, when to use them, when not to, the difference between clustered and non-clustered indexes, and we’ll run a couple of benchmarks to see the impact in action.

---

## 🔍 What is a Database Index?

A database index is like a “fast lookup table” for your data.
Instead of scanning every row, the database can jump straight to the matching records.

**Benefits:**

* Faster lookups (`WHERE`, `JOIN`, `ORDER BY`)
* More efficient queries under heavy load

**Trade-offs:**

* Slower inserts/updates due to index maintenance
* Additional storage usage

---

## 📑 Clustered vs Non-Clustered Indexes

In SQL Server (and many relational databases), you’ll find two main types of indexes:

* **Clustered index** – defines the **physical order of data** in the table. Each table can have only one clustered index (often on the primary key).
* **Non-clustered index** – a separate structure that points back to the data. You can have multiple non-clustered indexes per table.

👉 In most cases, EF Core will create a clustered index automatically on the primary key.
The indexes you define with Fluent API or Data Annotations are typically **non-clustered**.

---

## 🖼 How an Index Works – Visual Overview

```
Table: Users
+----+----------+----------+
| Id | Email    | Name     |
+----+----------+----------+
| 1  | a@ex.com | Alice    |
| 2  | b@ex.com | Bob      |
| 3  | c@ex.com | Charlie  |
+----+----------+----------+

Index on Email:
a@ex.com --> Row 1
b@ex.com --> Row 2
c@ex.com --> Row 3
```

Instead of scanning the entire `Users` table, the database jumps directly to the row using the index pointer.

---

## 📦 Setting Up EF Core

```bash
dotnet add package Microsoft.EntityFrameworkCore
dotnet add package Microsoft.EntityFrameworkCore.Design
```

---

## 🛠 Creating Indexes in EF Core

### Fluent API

```csharp
using Microsoft.EntityFrameworkCore;

class AppDbContext : DbContext
{
    public DbSet<User> Users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(u => new { u.LastName, u.FirstName });
    }
}

class User
{
    public int Id { get; set; }
    public string Email { get; set; }
    public string FirstName { get; set; }
    public string LastName { get; set; }
}
```

---

### Data Annotations

```csharp
using Microsoft.EntityFrameworkCore;

[Index(nameof(Email), IsUnique = true)]
[Index(nameof(LastName), nameof(FirstName))]
class User
{
    public int Id { get; set; }
    public string Email { get; set; }
    public string FirstName { get; set; }
    public string LastName { get; set; }
}
```

---

## 🚀 Applying the Index

```bash
dotnet ef migrations add AddIndexes
dotnet ef database update
```

---

## ⚡ Benchmark 1 – Lookup Query

Let’s measure query performance with and without an index on `Email`.

```csharp
var emailToFind = "user50000@example.com";

var sw = Stopwatch.StartNew();
var user = await context.Users
    .AsNoTracking()
    .FirstOrDefaultAsync(u => u.Email == emailToFind);
sw.Stop();

Console.WriteLine($"Query time: {sw.ElapsedMilliseconds} ms");
```

**Example results:**

| Scenario      | Time (ms) |
| ------------- | --------- |
| Without index | 180–220   |
| With index    | 2–5       |

---

## ⚡ Benchmark 2 – ORDER BY Query

Indexes can also dramatically speed up sorting operations:

```csharp
var sw = Stopwatch.StartNew();
var users = await context.Users
    .AsNoTracking()
    .OrderBy(u => u.Email)
    .Take(10)
    .ToListAsync();
sw.Stop();

Console.WriteLine($"OrderBy query time: {sw.ElapsedMilliseconds} ms");
```

**Example results:**

| Scenario      | Time (ms) |
| ------------- | --------- |
| Without index | 400–500   |
| With index    | 10–20     |

---

## 📌 Special Note on SQLite

This guide uses **SQLite** for simplicity, and it does support indexes.
However, keep in mind:

* No **filtered indexes**
* No **include columns**
* Limited advanced indexing strategies compared to SQL Server or PostgreSQL

👉 The basics (unique, multi-column, normal indexes) work perfectly fine.

---

## 🚫 When NOT to Index

While indexes improve reads, they aren’t always a good idea.

Avoid indexing:

* Columns with **low selectivity** (e.g., `IsActive` boolean).
* Columns that are **frequently updated** (index maintenance can slow down writes).
* Tables with **very small row counts** (the index overhead may outweigh benefits).

---

## ✅ Conclusion

Indexes are a must-have tool for improving query performance, but they require thoughtful use.
With EF Core, you can easily define them in code and keep them in sync via migrations.

**Key takeaways:**

* Use indexes for frequently queried columns.
* Understand the difference between clustered and non-clustered indexes.
* Avoid over-indexing.
* Always measure performance impact.

---

📖 **Further reading:**

* [EF Core – Indexes](https://learn.microsoft.com/ef/core/modeling/indexes)
* [SQL Server Index Design Guide](https://learn.microsoft.com/sql/relational-databases/sql-server-index-design-guide)

---




