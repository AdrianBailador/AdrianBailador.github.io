---
title: "9 Ways to Set the URLs for an ASP.NET Core App"
summary: "In this article, we’ll explore 9 ways to set the URLs for your ASP.NET Core app, with practical examples to help you decide which method suits your needs."
date: "JAN 20 2025"
draft: false
tags:
- .Net
- C#
- .Net Core
---

#### Introduction

In ASP.NET Core, configuring the URLs your application listens to is crucial for adapting to various environments—whether local, on a server, or within containers. By understanding the available methods, you can ensure flexibility, scalability, and proper functionality in different scenarios. In this article, we’ll explore 9 ways to set the URLs for your ASP.NET Core app, with practical examples to help you decide which method suits your needs.



### 1. `appsettings.json`
The `appsettings.json` file allows you to set URLs per environment by specifying them under the `urls` property. This approach is ideal for maintaining environment-specific configurations in a structured way.

**Example:**
```json
{
  "urls": "http://localhost:5000;https://localhost:5001"
}
```
**Advantages:**
- Easy to maintain and version.
- Works well with the configuration system in ASP.NET Core.





### 2. Environment Variables
Using the `ASPNETCORE_URLS` environment variable is particularly useful in dynamic deployments, such as containers or CI/CD pipelines. It overrides the settings in `appsettings.json`.

**Example:**
```bash
export ASPNETCORE_URLS="http://+:5000"
```
**Use Case:**
- Ideal for cloud or containerized applications where environment-specific variables are required.



### 3. Command Line Arguments
You can pass URLs directly as command line arguments when starting your application. This is useful for temporary changes or quick testing.

**Example:**
```bash
dotnet run --urls "http://localhost:5000"
```
**Advantages:**
- High priority over other methods.
- Great for one-off adjustments.





### 4. `UseUrls` in Code
You can configure URLs programmatically by calling `UseUrls` in your `Program.cs`. This method is straightforward but may be overridden by other configurations.

**Example:**
```csharp
var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://localhost:5000", "https://localhost:5001");
var app = builder.Build();
app.Run();
```
**Limitations:**
- Hardcoded URLs make it less flexible.



### 5. Kestrel Configuration
Kestrel offers advanced options for binding to specific IPs, ports, or protocols. This is especially useful for advanced setups, such as binding to multiple IPs or using HTTPS.

**Example:**
```csharp
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Listen(IPAddress.Any, 5000); // All interfaces
    serverOptions.Listen(IPAddress.Parse("192.168.1.10"), 6000); // Specific IP
});
```
**Use Case:**
- Advanced scenarios requiring granular control.


### 6. Docker Configuration
When running an ASP.NET Core app in Docker, you configure URLs using environment variables and container port mappings.

**Example:**
```yaml
services:
  myapp:
    build: .
    ports:
      - "8080:5000"
    environment:
      ASPNETCORE_URLS: "http://+:5000"
```
**Advantages:**
- Essential for containerized applications.

**Advanced Tip:** Ensure your Docker network configurations allow communication between containers when using multiple services.



### 7. Reverse Proxies (IIS, NGINX, Apache)
For production environments, it’s common to use reverse proxies to manage incoming traffic. Configure the reverse proxy to forward requests to your app, and ensure proper headers (`X-Forwarded-*`) are handled.

**Example (NGINX):**
```nginx
server {
    listen 80;
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```
**Use Case:**
- Recommended for production setups.


**Advanced Tip:** Ensure `ForwardedHeadersOptions` in your app is configured to handle headers from the proxy:
```csharp
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});
```



### 8. Visual Studio Launch Profiles
You can set URLs directly in the launch settings file (`launchSettings.json`) for development purposes.

**Example:**
```json
{
  "profiles": {
    "MyApp": {
      "commandName": "Project",
      "applicationUrl": "http://localhost:5000;https://localhost:5001"
    }
  }
}
```
**Advantages:**
- Convenient for local debugging.



### 9. Custom Middleware
For advanced scenarios, you can implement middleware to dynamically adjust the URLs or handle specific routing needs.

*Example:*
```csharp
app.Use(async (context, next) =>
{
    Console.WriteLine($"Request URL: {context.Request.Path}");
    await next();
});
```
**Use Case:**
- Special cases requiring dynamic logic.



### Conflicts and Precedence

When multiple methods are used simultaneously, the following precedence applies (highest to lowest):

1. Command line arguments.
2. Environment variables.
3. `appsettings.json`.
4. Defaults in code.

**Visual Guide:**
A flowchart or diagram showing precedence could help developers quickly understand the hierarchy. (Consider including visuals like this in presentations or additional content.)