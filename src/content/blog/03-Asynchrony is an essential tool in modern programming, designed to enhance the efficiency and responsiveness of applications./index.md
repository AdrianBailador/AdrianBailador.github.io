---
title: "Asynchrony in Programming with Async/Await"
summary: "Asynchrony is an essential tool in modern programming, designed to enhance the efficiency and responsiveness of applications."
date: "JAN 24 2024"
draft: false
tags:
- C#
- .NET
---


Asynchrony is an essential tool in modern programming, designed to enhance the efficiency and responsiveness of applications. By utilizing the async and await keywords in C#, we can manage asynchronous tasks more clearly and efficiently. Here are some key highlights:

## Importance of Asynchrony:
* **Efficiency in External Resources:** Asynchrony is crucial when working with time-consuming operations, such as accessing databases, making web service calls, or reading/writing files. It allows the application to continue its execution while waiting for the results of these operations.

* **Improved Responsiveness:** Avoiding locks in the user interface is essential to provide a smooth user experience. Asynchrony enables the execution of background tasks without impacting the responsiveness of the main interface.

## Examples of Async/Await in Common Scenarios:

**1. Console Application with Multiple Asynchronous Tasks:**

* The console application example demonstrates how to initiate and wait for multiple asynchronous tasks, which can be crucial for parallel processes without blocking execution.


```csharp
using System;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        Console.WriteLine("Start of the application.");

        Task task1 = ProcessAsync("Task 1");
        Task task2 = ProcessAsync("Task 2");

        await Task.WhenAll(task1, task2);

        Console.WriteLine("End of the application.");
    }

    static async Task ProcessAsync(string taskName)
    {
        Console.WriteLine($"Starting {taskName}");
        await Task.Delay(2000); // Simulating an asynchronous operation
        Console.WriteLine($"Finishing {taskName}");
    }
}

```


**2. ASP.NET Core Application with Asynchronous Controllers:**

* In the web context, the use of asynchronous methods in controllers allows more efficient handling of requests and responses, especially when accessing external resources.


```csharp
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

[ApiController]
[Route("[controller]")]
public class ExampleController : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetDataAsync()
    {
        // Simulating an asynchronous operation, such as accessing a database
        await Task.Delay(1000);

        var result = new { message = "Data obtained successfully" };
        return Ok(result);
    }
}

```


**3. Async/Await Usage with I/O Operations in WinForms:**

* In GUI applications, asynchronism is essential to avoid crashes when performing input/output operations. The file search example illustrates how to maintain fluidity in the interface while performing background tasks.


```csharp
using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;

public partial class MainForm : Form
{
    public MainForm()
    {
        InitializeComponent();
    }

    private async void btnSearch_Click(object sender, EventArgs e)
    {
        string search = txtSearch.Text;
        string path = "C://TestFolder";

        var filesWithContent = await FileSearcher.SearchInFilesAsync(path, search);

        // Update the interface with the results
        lstResults.Items.Clear();
        foreach (var file in filesWithContent)
        {
            lstResults.Items.Add(file);
        }
    }
}

```


```csharp
public static class FileSearcher
{
    public static async Task<List<string>> SearchInFilesAsync(string path, string search)
    {
        var result = new List<string>();
        foreach (var file in Directory.GetFiles(path))
        {
            if (await ExistsContentInFileAsync(file, search))
            {
                result.Add(file);
            }
        }
        return result;
    }

    private static async Task<bool> ExistsContentInFileAsync(string filePath, string search)
    {
        var content = await ReadFileAsync(filePath);
        return content.Contains(search);
    }

    private static async Task<string> ReadFileAsync(string filePath)
    {
        return await File.ReadAllTextAsync(filePath);
    }
}

```


**4. Application with Microservices:**
* Microservices are an architectural and organizational approach to software development, where software consists of small independent services communicating through well-defined APIs. Here's an example of how an application can be structured using microservices.


```csharp
// User Service
public class UserService
{
    public async Task<User> GetUserAsync(int userId)
    {
        // Logic to retrieve a user
    }
}

// Order Service
public class OrderService
{
    public async Task<Order> GetOrderAsync(int orderId)
    {
        // Logic to retrieve an order
    }
}

// Billing Service
public class BillingService
{
    public async Task<Invoice> GetInvoiceAsync(int invoiceId)
    {
        // Logic to retrieve an invoice
    }
}

```


In this example, each service handles a specific functionality of the application and can be developed, deployed, and scaled independently. This allows development teams to work more quickly and independently, speeding up the time to market for new features.

**Remember that using asynchrony is crucial to avoid UI locks and improve the responsiveness of your applications, especially in situations where external resources are accessed or time-consuming operations are performed.**