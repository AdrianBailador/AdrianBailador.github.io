---
title: "Detecting Missing Migrations in EF Core: A Guide for .NET Developers"
summary: "Avoid database drift and deployment surprises by learning how to detect and prevent missing migrations in Entity Framework Core. Includes automated checks, runtime guards, and CI-friendly scripts."
date: "2025-07-12"
tags: [".NET", "Entity Framework Core", "Migrations", "Database", "Architecture", "Clean Code", "DevOps"]
---

![Detecting Missing Migrations in .NET – by Adrián Bailador Panero](DetectingMissingMigrations.png)

Entity Framework Core has streamlined how we evolve databases using the **Code-First** approach. But in real-world projects—especially with fast development cycles or multiple team members—it’s common to forget to generate a migration after modifying the model.

This silent oversight can cause confusing issues at runtime or during deployment. In this article, we'll explore how to **detect missing migrations in EF Core**, ensure consistency between your model and database, and prevent these problems before they escalate.

---

## What Is a "Missing Migration"?

A **missing migration** occurs when you've changed your C# entity model but haven't added a corresponding migration using the EF CLI or Package Manager Console.

This leads to situations like:

* Your database doesn't reflect recent model changes.
* `Update-Database` applies no updates despite code changes.
* A newly added migration includes a large batch of unexpected changes.
* Production crashes due to schema mismatches.

---

## How to Detect Missing Migrations in EF Core

There are several techniques to detect whether you've forgotten to add a migration. Let's go through each with concrete examples in .NET and CLI.

---

### 1. Try to Add a Migration Safely (The Quickest Check)

```bash
dotnet ef migrations add DetectChanges --no-build
```

* If EF Core creates an **empty migration**, your model matches the current snapshot.
* If it includes operations, you likely forgot to generate a migration earlier.

Clean up afterwards:

```bash
dotnet ef migrations remove
```

---

### 2. Compare the Current Model with the Snapshot in Code

```csharp
using var context = new AppDbContext();
var services = context.GetInfrastructure();

var modelDiffer = services.GetRequiredService<IMigrationsModelDiffer>();
var migrationsAssembly = services.GetRequiredService<IMigrationsAssembly>();

var currentModel = services.GetRequiredService<IModel>();
var snapshotModel = migrationsAssembly.ModelSnapshot?.Model;

var diffs = modelDiffer.GetDifferences(
    snapshotModel?.GetRelationalModel(),
    currentModel.GetRelationalModel());

if (diffs.Any())
{
    Console.WriteLine("⚠️ Model changes not captured in a migration.");
}
else
{
    Console.WriteLine("✅ Your model matches the last migration snapshot.");
}
```

> ⚠️ These are internal EF Core services. Use carefully if upgrading EF versions. ⚠️

---

### 3. Check for Pending Migrations at Runtime

```csharp
var pending = context.Database.GetPendingMigrations();
if (pending.Any())
{
    Console.WriteLine("⚠️ Pending migrations: " + string.Join(", ", pending));
}
```

> Note: This only detects migrations **not yet applied**, not **missing migrations**.

---

### 4. Automate Detection in CI/CD Pipelines

Add a temporary migration and check if it generates operations.

```powershell
$migrationName = "__AutoCheck"
dotnet ef migrations add $migrationName --no-build

$hasChanges = Select-String -Path ".\Migrations\$migrationName.cs" -Pattern "migrationBuilder\."

if ($hasChanges) {
    Write-Host "Uncommitted model changes detected."
    dotnet ef migrations remove
    exit 1
} else {
    dotnet ef migrations remove
    Write-Host "No missing migrations."
}
```

---

### 5. Manually Inspect the Snapshot File

Open `Migrations/YourDbContextModelSnapshot.cs` and check if it reflects your latest model.

---

### 6. Prevent Startup If Migrations Are Missing

```csharp
public static class MigrationValidator
{
    public static void EnsureUpToDate(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var pending = context.Database.GetPendingMigrations();
        if (pending.Any())
        {
            throw new InvalidOperationException("⚠️ Pending migrations: " + string.Join(", ", pending));
        }
    }
}
```

Use it in `Program.cs`:

```csharp
MigrationValidator.EnsureUpToDate(app.Services);
```

---

## Supporting Multiple DbContexts

If you use more than one `DbContext`, update your CLI and scripts like this:

```bash
dotnet ef migrations add AutoCheck --context OrdersDbContext --no-build
```

Automated PowerShell loop:

```powershell
$contexts = @("AppDbContext", "OrdersDbContext")
foreach ($ctx in $contexts) {
    dotnet ef migrations add __Check__$ctx --context $ctx --no-build
    # inspect the migration file...
    dotnet ef migrations remove --context $ctx --no-build
}
```

Runtime validation:

```csharp
public static void EnsureAllDbContextsAreUpToDate(IServiceProvider services)
{
    Validate<AppDbContext>(services);
    Validate<OrdersDbContext>(services);
}
```

---

## Quick Comparison

| Method                            | Detects Missing Migrations | Detects Unapplied Migrations | Best For           |
| --------------------------------- | -------------------------- | ---------------------------- | ------------------ |
| `dotnet ef migrations add`        | ✅                          | ❌                            | Local development  |
| `Database.GetPendingMigrations()` | ❌                          | ✅                            | Runtime validation |
| Programmatic snapshot diff        | ✅                          | ❌                            | Tests, automation  |
| CI script with fake migration     | ✅                          | ❌                            | Pipelines          |
| Manual snapshot check             | ✅                          | ❌                            | Code reviews       |

---

## Final Thoughts

A missing migration can easily go unnoticed—until your app crashes, your CI fails, or your production database is out of sync.

By using the strategies above and integrating them into your daily workflow and pipelines, you can ensure your model, migrations, and database schema remain in harmony.

---

