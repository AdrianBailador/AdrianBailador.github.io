---
title: "Claude Fable 5 for .NET: What Actually Changes in the API, and What It Costs"
summary: "Fable 5 is Anthropic's most capable model, priced above Opus 5, with thinking that can't be turned off and 30-day data retention as a hard requirement. Before deciding whether it belongs in a .NET stack, here's exactly what changes in the request shape — verified against Anthropic's live docs and the C# SDK's own source — and how to wire it up, both with the raw SDK and through Microsoft.Extensions.AI."
date: "2026-08-12"
tags: ["dotnet", "csharp", "ai", "anthropic", "claude", "llm", "microsoft-extensions-ai"]
draft: true
---

A couple of weeks after I wrote about [Microsoft.Extensions.AI and `IChatClient`](/blog/microsoft-extensions-ai-ichatclient), Anthropic shipped Claude Fable 5 — their most capable widely released model, sitting above Opus 5 in both price and API surface. It's not an Opus revision you drop in with a string swap: three of its request-shape rules are hard constraints, not tuning knobs, and getting them wrong is a 400, not a warning.

Before wiring anything into a .NET project, I wanted the actual contract, not the announcement blog post. Everything below is checked against Anthropic's current model docs and — for the C# specifics — the `anthropic-sdk-csharp` source itself, not just its README. I haven't run a head-to-head cost/quality comparison against Opus 5 or Sonnet 5 yet; that's a follow-up once I have a workload worth timing properly. This post is the API contract and the .NET integration path — what's actually true right now, not a verdict on whether it's worth the price for your workload.

## What's actually different about Fable 5

**Thinking is always on, and you can't turn it off.** Every other current Claude model lets you disable thinking or run it adaptively. Fable 5 doesn't have that switch — omit the `thinking` parameter and it thinks anyway; send `{"type": "disabled"}` and the API rejects it with a 400, at any effort level. You control *depth*, not *whether*, via `output_config.effort` (`low` through `max`).

**You never see the raw reasoning.** Fable 5 returns `thinking` blocks like every other current model, but the chain of thought itself is never exposed — `display: "summarized"` gives you a paraphrase, and the default (`"omitted"`) streams a `thinking` block with empty text. If your product surfaces reasoning to users for trust or debugging, that's a behavioral gap to design around, not a settings tweak.

**30-day data retention is mandatory.** Fable 5 isn't available under zero data retention. If your org is configured for ZDR, every request returns `400 invalid_request_error` — a message that reads like a payload problem but is actually an account-level setting, worth checking before you spend time debugging your JSON.

Context window is 1M tokens — the maximum *is* the default, no beta header needed. Max output is 128K, same as Opus 5.

### Pricing, checked against the live pricing page

| | Sonnet 5 | Opus 5 | Fable 5 |
|---|---|---|---|
| Input per MTok | $2 | $5 | $10 |
| Output per MTok | $10 | $25 | $50 |
| Context window | 1M | 1M (default & max) | 1M (default & max) |
| Max output | 128K | 128K | 128K |
| Thinking | Adaptive, on by default | On by default; can disable at effort ≤ `high` | Always on, cannot disable |
| Data retention | Standard org config | Standard org config | 30-day minimum required |

One correction against what I originally assumed: Sonnet 5's $2/$10 pricing was flagged internally as an introductory rate due to expire on 2026-08-31. Anthropic's current pricing page says explicitly that the scheduled increase to $3/$15 **will not happen** — $2/$10 is the standing rate. Worth knowing before you budget around a price hike that isn't coming.

Fable 5 is a straightforward 2x over Opus 5 on both input and output. That's the number to weigh against whatever the always-on thinking and longer turns buy you on a given task — which is exactly the comparison I want real numbers for before writing the "is it worth it" half of this.

## Calling it from C#

### Raw SDK

The official `Anthropic` NuGet package handles Fable 5 like any other model on the beta Messages path — the differences live in what you *don't* set. Skip `thinking` entirely (it runs adaptive by default), set `effort` for depth control, and always check `StopReason` before touching `response.Content`, because Fable 5's safety classifiers can decline a request outright.

The fallback shape below is copied from the SDK's own `examples/FallbacksExample/Program.cs` — including the `Messages::` alias, which exists because `Model` lives in `Anthropic.Models.Messages` while the beta call needs `Anthropic.Models.Beta.Messages` in scope, and the two collide:

```csharp
using Anthropic;
using Anthropic.Models.Beta;
using Anthropic.Models.Beta.Messages;
using Messages = Anthropic.Models.Messages;

AnthropicClient client = new();

BetaMessage response = await client.Beta.Messages.Create(new()
{
    Model = Messages::Model.ClaudeFable5,
    MaxTokens = 16000,
    OutputConfig = new BetaOutputConfig { Effort = Effort.High },
    Betas = [AnthropicBeta.ServerSideFallback2026_07_01],
    Fallbacks = new([new(Messages::Model.ClaudeOpus4_8)]),
    Messages =
    [
        new() { Role = Role.User, Content = "Refactor the DbContext lifetime across every endpoint in this project." }
    ],
});

if (response.StopReason == "refusal" && response.StopDetails is { } details)
{
    Console.WriteLine($"Declined — category: {details.Category}");
}
else
{
    foreach (var text in response.Content.Select(b => b.Value).OfType<BetaTextBlock>())
        Console.WriteLine(text.Text);
}
```

The `Fallbacks` line matters more than it looks. Fable 5's classifiers target research-biology and cybersecurity content specifically, but adjacent legitimate work — security tooling, life-sciences code — can trip a false positive. Without a fallback configured, that's a dead request; with it, a declined call is silently re-served by Opus 4.8 inside the same round trip, and `response.Model` tells you who actually answered.

### Through Microsoft.Extensions.AI

If you're already on the `IChatClient` abstraction from my last post, the SDK ships the bridge inline — no separate package beyond `Microsoft.Extensions.AI` (the concrete one, not `.Abstractions`) alongside the base `Anthropic` package. This snippet is the SDK's own `examples/ChatClientExample/Program.cs`, adjusted to target Fable 5:

```csharp
using Anthropic;
using Microsoft.Extensions.AI;

IChatClient chatClient = new AnthropicClient()
    .AsIChatClient("claude-fable-5")
    .AsBuilder()
    .UseFunctionInvocation()
    .Build();

var response = await chatClient.GetResponseAsync(
    "Refactor the DbContext lifetime across every endpoint in this project.");

Console.WriteLine(response);
```

Two things worth knowing before you reach for this in production code. First, `AsIChatClient` is declared *inside* the `Microsoft.Extensions.AI` namespace on purpose — as an extension method on `IAnthropicClient` — so it lights up the moment you have that `using` in scope, with the same DI registration and middleware pipeline as any other provider. Second, in the SDK source it currently sits behind `#pragma warning disable MEAI001` — the diagnostic Microsoft uses to mark experimental `Microsoft.Extensions.AI` surface area. It works, and it's the shape I'd reach for to keep call sites identical across Sonnet, Opus, and Fable, but treat it as pre-stable API: expect it to move before it's a `1.0` guarantee, and pin the SDK version if you depend on it.

## What's still open

The pricing and API-contract facts above are checked, not assumed. What isn't in this post yet is a real cost/quality comparison — how much extra Fable 5's always-on thinking and longer turns actually buy on a genuine .NET task versus Opus 5 at `xhigh` effort or Sonnet 5, on the same prompt, with real numbers. That's the piece worth running properly rather than guessing at, and it's next.
