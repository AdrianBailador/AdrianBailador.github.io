---
title: "Software Architecture Fundamentals: Patterns, Styles, and Practices"
summary: "A free, opinionated walkthrough of the architectural styles, patterns, and practices that actually show up in production .NET codebases — from monoliths to event-driven systems."
date: "2026-11-23"
tags: ["architecture", "clean-architecture", "ddd", "software-design"]
lessons:
  - title: "Clean Architecture: Explained and Reviewed"
    repoUrl: "https://github.com/AdrianBailador/clean-architecture-dotnet10"
  - title: "Hexagonal Architecture: The Essentials"
  - title: "Domain-Centric (Onion) Architecture"
  - title: "MVC: What It Is and How It Works"
  - title: "The MVVM Pattern in 10 Minutes"
  - title: "Vertical Slice Architecture: An Honest Look"
  - title: "CQRS: Splitting Reads from Writes"
  - title: "Event-Driven Architecture Explained"
  - title: "Domain-Driven Design Without the Jargon"
  - title: "Test-Driven Development, Applied Honestly"
---

Architecture is the umbrella that shapes every other design decision in a system. Underneath it you'll find a few distinct layers that get talked about as if they were interchangeable, and they aren't:

- **Architectures and architectural styles** — monolith, microservices, hexagonal, clean, onion, event-driven, and so on. These describe how a system is split and where its boundaries sit.
- **Patterns** — CQRS, Event Sourcing, MVVM. These describe a specific recurring shape you apply inside or across those boundaries.
- **Practices** — Domain-Driven Design, Test-Driven Development. These aren't architectures at all, but they change how an architecture actually gets built and kept honest over time.

These categories aren't a settled taxonomy — people reasonably disagree about where Onion ends and Clean begins, or whether event-driven counts as an architecture or a style. Treat the grouping above as how this course organizes the material, not a definitive classification.

This course goes through all three layers, one lesson at a time. The goal isn't to crown a "best" architecture — it's that you can look at a real project and know which of these actually fits it, which ones are being cargo-culted, and how to combine them without creating an indirection factory nobody can navigate six months later.

Each lesson is short, opinionated, and paired with a companion repository you can clone and run — code, not just diagrams. Repositories are being published lesson by lesson; a lesson without one yet is marked below.

## 01. Clean Architecture: Explained and Reviewed

Clean Architecture's real contribution isn't the concentric-circles diagram — it's the Dependency Rule: source code dependencies only point inward, toward the domain, never outward toward frameworks or infrastructure. Everything else, the specific layer names, whether you call it "Application" or "UseCases", is naming, not substance.

It earns its complexity in systems with real domain logic worth protecting from framework churn: long-lived codebases, teams big enough that "where does this code go" needs an answer everyone agrees on. It's overkill for CRUD-shaped services with no meaningful business rules, where you'll spend more time mapping between layers than the mapping ever saves you.

**Repository:** [clean-architecture-dotnet10](https://github.com/AdrianBailador/clean-architecture-dotnet10) — a .NET 10 order-placement API: `Domain` → `Application` → `Infrastructure` (EF Core) → `Api` (minimal APIs), 26 tests, CI on every push.

### The rule, enforced by a test, not a diagram

Most "Clean Architecture" repos enforce the Dependency Rule by convention and just hope nobody breaks it in a rushed PR. This one enforces it with a reflection test that fails the build the moment it's violated:

```csharp
[Fact]
public void Domain_does_not_reference_any_Entity_Framework_package()
{
    Assert.DoesNotContain(
        ReferencedAssemblyNames(DomainAssembly),
        name => name.StartsWith("Microsoft.EntityFrameworkCore"));
}
```

If someone adds `using Microsoft.EntityFrameworkCore;` to a class in `CleanArchitecture.Domain` six months from now because it was the path of least resistance, this test fails in CI — not in a code review nobody had time to do properly.

### Where the one business rule lives

This sample is built around one thing: a 10% loyalty discount on orders of $100 or more, and where it lives — exactly one place.

```csharp
public Money Total()
{
    var subtotal = Subtotal();
    return subtotal.Amount >= LoyaltyDiscountThreshold
        ? subtotal.ApplyDiscount(LoyaltyDiscountPercentage)
        : subtotal;
}
```

`PlaceOrderInteractor` in the Application layer calls `order.Total()`. It has no idea a discount exists. Neither does the EF Core repository, or the minimal API endpoint. That's the Dependency Rule paying off in a way a diagram never shows you: for this rule specifically, the only file that has to change is `Order.cs` — not every future business rule stays this contained, but the ones that genuinely belong to the domain usually do.

### What the repo doesn't hide: the EF Core gotcha

An early draft of this sample threw `No suitable constructor was found for the type 'OrderLine'` the first time it actually ran, not when it compiled. `OrderLine`'s only public constructor takes a `Money` parameter, and `Money` is mapped as an owned reference, not a scalar column — so EF Core can't bind it through a constructor the way it binds a `string` or an `int`. The fix is a private, EF-only parameterless constructor, so EF falls back to setting properties through their backing fields instead:

```csharp
private OrderLine()
{
    ProductName = string.Empty;
    UnitPrice = Money.Zero;
}
```

That's the kind of friction Clean Architecture is supposed to contain to one layer, and here it does: the fix lives entirely in `CleanArchitecture.Domain`'s `OrderLine.cs` and the mapping configuration in `CleanArchitecture.Infrastructure`. `PlaceOrderInteractor`, the tests that exercise it, and the API endpoint never had to change.

## 02. Hexagonal Architecture: The Essentials

Hexagonal Architecture (Ports and Adapters) and Clean Architecture are close enough cousins that people use the names interchangeably, and that's mostly fine — both enforce the same inward-pointing dependency rule. The distinct vocabulary Hexagonal brings is useful on its own: **ports** are interfaces that express what the application core needs (a repository, a clock, a payment gateway) — whether you place them in the domain or in an application/use-case layer is a design choice, not a rule — and **adapters** are the concrete implementations that plug into those ports from the outside.

The practical payoff shows up in testing: swap a database adapter for an in-memory one behind the same port, and your domain tests never touch infrastructure. The failure mode to watch for is defining ports that leak infrastructure concepts (an `IRepository` with `IQueryable` in its signature isn't a port, it's EF Core wearing a trench coat).

*Repository: coming soon.*

## 03. Domain-Centric (Onion) Architecture

Onion Architecture was one of the earlier formulations of "dependencies point inward," predating Clean Architecture by a few years. Picture concentric layers — Domain Model at the center, Domain Services around it, Application Services next, Infrastructure and UI on the outside — where each ring can only reference the rings inside it.

What it adds to the conversation that's worth keeping: the domain model shouldn't depend on infrastructure or framework concerns that shape how it's written. No `IRepository` interface sitting in the domain layer that's secretly shaped by a specific ORM. A genuinely neutral dependency doesn't break the rule by itself — the point isn't "zero NuGet packages," it's that nothing outside the domain gets to dictate its design.

That closes the trio: Clean, Hexagonal, and Onion are the same Dependency Rule described three times, each adding its own vocabulary. From here the course moves to patterns that live inside those layers, starting with the one everyone already thinks they know.

*Repository: coming soon.*

## 04. MVC: What It Is and How It Works

Model-View-Controller predates almost every pattern in this course, and most people who say they're using it in a web API are actually using a Controller-Service-Repository split with no real "View" in sight — which is fine, but it's not MVC. The pattern's actual claim is narrower: the Controller mediates input, the Model owns state and behavior, the View renders it, and none of the three should know the internals of the other two.

It's still the right default for anything with server-rendered pages or a tightly coupled UI layer. It stops being the right abstraction the moment your "business logic" starts leaking into controllers because there was never an explicit layer for it to live in instead.

*Repository: coming soon.*

## 05. The MVVM Pattern in 10 Minutes

Model-View-ViewModel's core idea is separating the View from presentation logic through a ViewModel that exposes state and commands the View binds to. The binding itself can be one-way or two-way depending on the platform — but two-way binding is what made MVVM the obvious default in WPF and MAUI, and it's also why the pattern is a poor fit for a stateless HTTP API that has no binding engine to exploit in the first place.

The pitfall worth naming: a "ViewModel" that quietly accumulates business logic because it's the only class that's easy to unit test. If your ViewModel is making HTTP calls or applying business rules instead of exposing state for the View, it's stopped being a ViewModel and become an undeclared service layer.

*Repository: coming soon.*

## 06. Vertical Slice Architecture: An Honest Look

Instead of slicing a codebase horizontally by technical layer (controllers, services, repositories), Vertical Slice Architecture slices it by feature: everything a single use case needs — request, handler, persistence call, response — lives together, often in one file. MediatR-style handlers are the most common way to see this in .NET.

The honest trade-off: you get low coupling between features and very little ceremony per use case, at the cost of duplication across slices that share similar logic. That duplication is often the right call — premature sharing between features that will diverge is how you end up with a shared abstraction nobody can safely change. It's the wrong call when the duplication really is identical logic that will need to change in lockstep.

*Repository: coming soon.*

## 07. CQRS: Splitting Reads from Writes

CQRS — Command Query Responsibility Segregation — separates the model that handles writes (commands that change state) from the model that handles reads (queries that return data), instead of making one entity do both jobs. The insight behind it: a write model worth its salt enforces invariants and business rules, while a good read model is denormalized and shaped exactly for what the UI needs. Forcing both through the same model is a compromise that serves neither well.

Separating the models doesn't by itself mean separate databases — that's a further decision, not a requirement of CQRS. Martin Fowler's warning on this is worth keeping in mind: CQRS is a pattern to reach for when the complexity it adds is actually earning its keep, not a default to apply everywhere out of habit.

In .NET this shows up as two things wearing one name. **Lightweight CQRS** — a single database, separate command and query handlers (MediatR-style) — is really just the handler-per-use-case organization Vertical Slice Architecture already gives you, with a vocabulary for it. **Full CQRS** — genuinely separate read and write stores, kept in sync via events and often paired with Event Sourcing — is infrastructure most line-of-business apps don't need. Default to the lightweight version. Reach for separate stores only when your read and write loads differ enough in scale or shape that one database can't serve both well.

*Repository: coming soon.*

## 08. Event-Driven Architecture Explained

Event-Driven Architecture inverts the usual request-response flow: instead of a caller asking a service to do something and waiting for a result, a service publishes a fact ("OrderPlaced") and anyone interested reacts to it, asynchronously, without the publisher knowing or caring who's listening. This is what actually decouples services at scale — not the network boundary, the fact that producers and consumers don't share a contract beyond the event shape.

The part that doesn't survive contact with production without deliberate design: eventual consistency, message ordering, and idempotent consumers (because "at least once" delivery is the realistic guarantee, not "exactly once"). Adopt this when you need independent deployability and genuine decoupling between bounded contexts — not because synchronous HTTP calls felt old-fashioned.

*Repository: coming soon.*

## 09. Domain-Driven Design Without the Jargon

Strip away the vocabulary (Aggregates, Bounded Contexts, Ubiquitous Language) and DDD is a practice with one core demand: the code should use the same words, and enforce the same rules, that the actual domain experts use when they talk about the problem. A `Shipment` that can transition from `Delivered` back to `Pending` is a DDD failure before it's a bug — the domain model allowed a state transition the real world doesn't.

DDD's tactical patterns (Aggregates as consistency boundaries, Value Objects for anything defined entirely by its attributes, Repositories per Aggregate root) are the part most teams adopt. The strategic side — Bounded Contexts, and the explicit acknowledgment that "Customer" means something different to Billing than it does to Support — is the part most teams skip, and it's usually the half that would have prevented the integration mess they're currently debugging.

*Repository: coming soon.*

## 10. Test-Driven Development, Applied Honestly

Test-Driven Development is a design discipline before it's a testing strategy: write a failing test for the behavior you want, write the minimum code to pass it, then refactor — red, green, refactor, repeated in minutes-long cycles, not hours. The tests that come out of that loop are a side effect; the actual product is a design that was never allowed to grow untested code in the first place.

Where TDD earns its keep: logic with real branching and edge cases — domain rules, calculations, state machines — where writing the test first forces you to name the behavior before you implement it. Where it's cargo cult: wiring code, DTOs, anything that's a thin pass-through to a framework, where writing the test first adds ceremony without adding design pressure. The failure mode worth naming: teams that measure TDD success by coverage percentage instead of whether the tests ever caught a regression — 100% coverage on trivial getters proves discipline, not safety.

*Repository: coming soon.*

---

New lessons and repositories are added incrementally. Subscribe below to get notified when the next one ships.
