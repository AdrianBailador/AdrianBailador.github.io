---
title: "Rest API in C#"
summary: "In C#, there are two main options for creating APIs: SOAP (Simple Object Access Protocol) and REST (Representational State Transfer)."
date: "May 03 2024"
draft: false
tags:
- C#
- .NET
- Rest Api
- SOAP
---

### 1. **What is an API?**

An API, or Application Programming Interface, serves as the entry point into a project from external sources. Whether you're developing or consuming APIs, they act as connectors between different software components. In a microservices architecture, APIs play a pivotal role in enabling communication between various modules or projects.

### 2. **Types of API in C#**

In C#, there are two main options for creating APIs: SOAP (Simple Object Access Protocol) and REST (Representational State Transfer).

#### 2.1 **Differences between SOAP and REST**

- **Protocol:** SOAP is a protocol, while REST is an architectural style operating on the HTTP protocol.
  
- **Development:** SOAP services typically require more development time for both clients and servers. In contrast, REST operates over the HTTP protocol, making API development faster.

- **State Handling:** SOAP can maintain state between requests, while REST treats each request independently. SOAP services are considered more secure due to XML-based (.wsdl) communication.

### 3. **Creating an API in C#**

When creating APIs, it's crucial to design endpoints with CRUD operations in mind.

#### 3.1 **What is CRUD?**
CRUD stands for Create (POST), Read (GET), Update (PUT), and Delete (DELETE). These HTTP methods cover the majority of actions in API interactions.

In C#, the entry point is defined in the controllers. Ensure the `Startup.cs` class includes the service adding controllers:

```csharp
public void ConfigureServices(IServiceCollection services) 
{ 
    services.AddControllers(); 
}
```

And in the `Configure` method, specify to look for these endpoints in the controllers:

```csharp
app.UseEndpoints(endpoints => 
{ 
    endpoints.MapGet("/", async context => 
    { 
        await context.Response.WriteAsync("Hello World!"); 
    }); 
    endpoints.MapControllers(); 
});
```

#### 3.2 **Creating endpoints**

In C#, endpoints are created in controllers. For example, consider an `ExampleController`:

```csharp
[ApiController] 
public class ExampleController : Controller 
{ 
    // Methods  
}
```

- **Creating a GET endpoint in C#**

A GET endpoint is used for reading. Define a method with the `[HttpGet]` attribute:

```csharp
[HttpGet("name/{id}")] 
public string ReadName(int id) 
{ 
    return id switch 
    { 
        1 => "Adri", 
        2 => "Codú", 
        _ => throw new System.NotImplementedException() 
    }; 
}
```

- **Creating a POST endpoint in C#**

A POST endpoint for updating data. Define the route with `[HttpPost]`:

```csharp
[HttpPost("insertemployee")] 
public int InsertEmployee(Employee employee) 
{ 
    // Code to insert employee into the database 
    return 1; 
}
```

Configure Postman to send requests with the appropriate HTTP method, URL, headers, and JSON body.

### Others

It's common to include the controller name as part of the URL. Use the `[Route("[Controller]")]` decorator in the controller class:

```csharp
[ApiController] 
[Route("[Controller]")] 
public class ExampleController : Controller 
{ 
    // Methods  
}
```

### Conclusion

In today's work environment, understanding APIs is crucial, whether working with microservices or consuming/providing API services. Recognizing the differences between SOAP and REST is essential for effective design. APIs facilitate development by reducing code complexity, aiding in testing, and streamlining bug fixes.