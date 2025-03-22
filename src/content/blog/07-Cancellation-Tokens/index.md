---
title: "CancellationToken in .NET: What Are They and Why Should You Use Them?"
summary: "If you work with .NET and asynchronous tasks, you've probably encountered the need to cancel an ongoing operation. This is where Cancellation Tokens (CancellationToken) come into play, a crucial tool for improving performance and responsiveness in your applications. When dealing with long-running tasks like database queries, HTTP requests, or CPU-intensive processes, it’s important to be able to stop them if they’re no longer necessary. This prevents wasting resources and makes your application more efficient."
date: "March 22 2025"
draft: false
tags:
- .Net
- C#
- .Net Core
---



### 🛑 **CancellationToken in .NET: What Are They and Why Should You Use Them?**  

If you work with .NET and asynchronous tasks, you've probably encountered the need to cancel an ongoing operation. This is where **Cancellation Tokens** (`CancellationToken`) come into play, a crucial tool for improving performance and responsiveness in your applications.  

When dealing with long-running tasks like database queries, HTTP requests, or CPU-intensive processes, it’s important to be able to **stop them if they’re no longer necessary**. This prevents wasting resources and makes your application more efficient.  



## 🚀 **Why Are Cancellation Tokens Important?**  

🔹 **Avoid unnecessary work** → If a task is no longer needed, you can cancel it and free up resources.  
🔹 **Enhance user experience** → Applications respond faster to changes, like when a user closes a tab while something is loading.  
🔹 **Optimise performance** → They save memory and CPU by preventing unnecessary code execution.  
🔹 **Native integration with .NET** → They work seamlessly with `async/await` and are present in many .NET APIs.  

---

## 🛠 **How Does a `CancellationToken` Work?**  

The `CancellationToken` is generated from a `CancellationTokenSource`, which is responsible for signalling: **"Stop! There's no need to continue executing this task."**  

Here’s a practical example:  

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        using CancellationTokenSource cts = new(); // Create the token source
        CancellationToken token = cts.Token; // Get the token

        Task task = DoWorkAsync(token);

        // Simulate cancellation after 2 seconds
        await Task.Delay(2000);
        cts.Cancel();

        try
        {
            await task;
        }
        catch (OperationCanceledException)
        {
            Console.WriteLine("The operation was cancelled.");
        }
    }

    static async Task DoWorkAsync(CancellationToken token)
    {
        for (int i = 0; i < 10; i++)
        {
            token.ThrowIfCancellationRequested(); // Throws an exception if the token has been cancelled
            Console.WriteLine($"Executing {i + 1}/10...");
            await Task.Delay(1000, token); // Pass the token to allow cancellation
        }
    }
}
```

🔹 In this code, we start a task and cancel it after **2 seconds**.  
🔹 If the task was still running, it will stop immediately, and we’ll catch the exception.  



## 🔑 **Key Methods You Should Know**  

🔹 **`cts.Cancel()`** → Marks the token as cancelled.  
🔹 **`token.ThrowIfCancellationRequested()`** → Throws an exception if the token has been cancelled, halting execution.  
🔹 **`Task.Delay(ms, token)`** → If the token is cancelled before the `Delay` finishes, the wait is interrupted.  

---

## 🌍 **Usage in ASP.NET Core**  

In web applications, `CancellationToken` is especially useful for cancelling HTTP requests when the client **closes the page or cancels the request**.  

```csharp
[HttpGet("long-operation")]
public async Task<IActionResult> LongOperation(CancellationToken cancellationToken)
{
    try
    {
        await Task.Delay(5000, cancellationToken);
        return Ok("Operation completed");
    }
    catch (OperationCanceledException)
    {
        return StatusCode(499, "Client cancelled the request"); // Code 499: Request Cancelled
    }
}
```

💡 If the user closes the tab before **5 seconds**, the task will stop immediately and no further resources will be consumed.  



## ✅ **Conclusion: Use `CancellationToken` to Make Your Code More Efficient**  

`CancellationToken` isn’t just another tool in .NET, it’s an intelligent way to **save resources, improve user experience, and make your code more professional**.  

✔ **Avoid unnecessary tasks** that consume memory and CPU.  
✔ **Respond faster** to events like request cancellations.  
✔ **It’s easy to use** and integrates seamlessly with `async/await`.  



## 📝 **Best Practices When Using `CancellationToken`**  

1. **Always check `token.IsCancellationRequested` before performing expensive operations**: This way, you can avoid executing unnecessary code if the task has already been cancelled.  
2. **Avoid catching `OperationCanceledException` unless necessary**: It’s recommended to catch this exception only if you have a specific reason to do so, as handling it can be costly.  
3. **Use `linkedTokenSource` when you need to combine multiple cancellation tokens**: If you’re working with multiple cancellation sources (e.g., several tasks that can be cancelled for different reasons), `CancellationTokenSource.CreateLinkedTokenSource` is a great option.  





