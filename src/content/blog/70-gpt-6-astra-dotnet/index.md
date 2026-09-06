---
title: "GPT-6 Astra for .NET: What Changes in the API, and Where the SDK Hasn't Caught Up"
summary: "OpenAI shipped GPT-6 Astra on September 3, 2026. Before wiring it into a .NET project, here's the actual API contract — context window, pricing, reasoning effort — checked against the live docs, plus what I found installing the real OpenAI NuGet package: one path is stable, one is still experimental, and the SDK's reasoning-effort enum is behind what the model itself supports."
date: "2026-09-06"
tags: ["dotnet", "csharp", "ai", "openai", "chatgpt", "llm", "microsoft-extensions-ai"]
draft: true
---

OpenAI released GPT-6 Astra on September 3, 2026 — described as a "new capability level" for computer use, browsing, coding, and long-running agentic work. It's rolling out in phases: first to a limited set of companies in OpenAI's Daybreak cybersecurity program, then to ChatGPT Plus/Pro/Business/Enterprise, the OpenAI API, Microsoft Foundry (Azure), and AWS Bedrock.

Announcement posts don't tell you what actually breaks when you point your .NET code at a new model ID. So I did what I did for [Claude Fable 5](/blog/67-claude-fable-5-dotnet-evaluation) a few weeks back: checked the model's real API contract against OpenAI's live docs, then installed the actual `OpenAI` NuGet package — version 2.13.0, whatever `dotnet add package OpenAI` gives you today — and inspected what it actually exposes, rather than trusting a blog post's code sample. The gap between the two turned out to be the most useful part of this post.

## Code

The three examples below are runnable end to end in a companion repo: [gpt-6-astra-dotnet](https://github.com/AdrianBailador/gpt-6-astra-dotnet) — one mode per client shape (`chat`, `meai`, `responses`), same prompt, same reasoning effort, so the only thing that changes between runs is the code path.

## What's actually in the model

The model ID is `gpt-6-astra`. Context window is 1,050,000 tokens, with a max input of 922,000 and max output of 128,000. Input takes text and images; output is text only. Knowledge cutoff is April 30, 2026. It's reachable through Chat Completions, Responses, and Batch, with streaming, structured outputs, function calling, file search, image input, web search, and prompt caching all supported. Reasoning effort, per the API docs, takes five values: `low`, `medium`, `high`, `xhigh`, `max`.

### Pricing, per the live pricing page

| | Rate |
|---|---|
| Input | $10 / MTok |
| Cached input | $1 / MTok |
| Cache writes | $12.50 / MTok |
| Output | $50 / MTok |

Requests over 272K input tokens are billed at 2x the input/cache rate and 1.5x the output rate for the whole request — not just the overflow. Batch and Flex both run at 50% of standard rates. There's also a "fast mode" at roughly 2.5x the speed for about 2x the price.

## Calling it from .NET: two paths, one of them experimental

`dotnet add package OpenAI` currently installs 2.13.0. It exposes GPT-6 Astra through two different clients, and only one of them is safe to depend on without a warning suppression.

### The stable path: Chat Completions

`OpenAI.Chat.ChatClient` carries no experimental attribute — it's been the production path for a while, and GPT-6 Astra works through it like any other chat model:

```csharp
using OpenAI.Chat;

ChatClient client = new("gpt-6-astra", Environment.GetEnvironmentVariable("OPENAI_API_KEY"));

ChatCompletion completion = await client.CompleteChatAsync(
    [new UserChatMessage("Refactor the DbContext lifetime across every endpoint in this project.")],
    new ChatCompletionOptions
    {
        ReasoningEffortLevel = ChatReasoningEffortLevel.High,
    });

Console.WriteLine(completion.Content[0].Text);
```

And through `Microsoft.Extensions.AI` — a separate package, `Microsoft.Extensions.AI.OpenAI` — the bridge is just as unremarkable, which is the point if you're already standardized on `IChatClient` the way I described in [my Microsoft.Extensions.AI post](/blog/66-microsoft-extensions-ai-ichatclient):

```csharp
using OpenAI.Chat;
using Microsoft.Extensions.AI;

IChatClient client = new ChatClient("gpt-6-astra", Environment.GetEnvironmentVariable("OPENAI_API_KEY"))
    .AsIChatClient();

var response = await client.GetResponseAsync(
    "Refactor the DbContext lifetime across every endpoint in this project.");

Console.WriteLine(response);
```

`OpenAIClientExtensions.AsIChatClient(this ChatClient)` has no `[Experimental]` attribute on it either. This is the shape to reach for in production code today.

One packaging gotcha worth knowing before you add both: `Microsoft.Extensions.AI.OpenAI` 10.9.0 declares a dependency on `OpenAI >= 2.12.0 && < 2.13.0`. `dotnet add package OpenAI` on its own resolves to 2.13.0, one patch outside that range — add both packages the naive way and you'll get an `NU1608` warning about a version outside the dependency constraint. It still restores and builds, but it's worth pinning the `OpenAI` version explicitly if you want a clean restore log.

### The experimental path: Responses API

`OpenAI.Responses.ResponsesClient` — the whole class — is marked `[Experimental("OPENAI001")]`. That's not a stray warning on one method; try to construct it and the compiler stops you cold until you suppress the diagnostic:

```csharp
#pragma warning disable OPENAI001
using OpenAI.Responses;

ResponsesClient client = new(Environment.GetEnvironmentVariable("OPENAI_API_KEY"));

ResponseResult result = await client.CreateResponseAsync(
    "gpt-6-astra",
    "Plan a zero-downtime migration for a 200-table SQL Server database.",
    previousResponseId: null);

Console.WriteLine(result.GetOutputText());
```

For anything beyond the three-string convenience overload — tools, reasoning options, structured output — you build a `CreateResponseOptions` (not `ResponseCreationOptions`, which is what I'd have guessed from the docs' own prose before checking):

```csharp
ResponseResult result = await client.CreateResponseAsync(new CreateResponseOptions
{
    Model = "gpt-6-astra",
    InputItems = { ResponseItem.CreateUserMessageItem("Plan a zero-downtime migration for a 200-table SQL Server database.") },
    ReasoningOptions = new ResponseReasoningOptions
    {
        ReasoningEffortLevel = ResponseReasoningEffortLevel.High,
    },
});
```

The same `Microsoft.Extensions.AI.OpenAI` package also ships `AsIChatClient(this ResponsesClient, string)` — and that one is `[Experimental("OPENAI001")]` too, consistently.

## The gap: the SDK's reasoning levels stop at `High`

This is the part worth knowing before you plan around it. GPT-6 Astra's documented `reasoning.effort` values are `low`, `medium`, `high`, `xhigh`, `max`. But both convenience enums in the .NET SDK — `ChatReasoningEffortLevel` (Chat Completions) and `ResponseReasoningEffortLevel` (Responses) — currently expose only five static members each: `None`, `Minimal`, `Low`, `Medium`, `High`. No `XHigh`, no `Max`, on either one, as of 2.13.0.

Both types are extensible string wrappers rather than real C# enums — each has a public `string` constructor — so the underlying mechanism to send `xhigh` or `max` is almost certainly already there:

```csharp
ReasoningEffortLevel = new ChatReasoningEffortLevel("xhigh"),
```

I haven't fired that against a live GPT-6 Astra endpoint to confirm it round-trips cleanly — that's the one claim in this post that's inference from the SDK's own established pattern for these wrapper types, not a verified API response. If you try it before I follow up, I'd genuinely like to know whether the API accepts it as-is.

## What's still open

Everything above — the model's specs, the pricing table, the class names, the `[Experimental]` attributes — is checked against the live docs and the SDK's actual compiled surface, not the announcement post or someone else's blog snippet. What isn't here yet: a real task run through both `high` and a manually-constructed `xhigh`/`max` to see whether the extra effort is worth the 2x token cost on an actual .NET workload, the same follow-up I still owe from the Fable 5 post. That comparison is next, once GPT-6 Astra is out of phased rollout and reachable without a Daybreak invite.
