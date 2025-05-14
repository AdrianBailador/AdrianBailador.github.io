---
title: "Installing Docker in .NET 8 and React Projects"
summary: "Installation and configuration of docker for Dotnet 8 and React, I have also added some commands that will help us."
date: "Feb 04 2024"
draft: false
tags:
- C#
- .NET
- React
- Docker
---

## **Step 1: Install Docker**
First we have to download and install Docker on our machine. We will download it from the official Docker website (https://www.docker.com/).

## **Step 2: Create the .NET and React Projects**
Create a new .NET 8 project and a new React project using the following commands in the terminal:


**Create .NET project**
```powershell
dotnet new web -o MyDotNetProject
```


**Create React project**
```powershell
npx create-react-app my-react-project
```

This will generate a .NET 8 project in a folder named MyDotNetProject and a React project in a folder named my-react-project.

## **Step 3: Create the Dockerfile**
In the root of each project, create a new file called Dockerfile with no extension. This file defines how Docker builds your applications.

**For .NET 8 application:**


```dockerfile
# Base image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["MyDotNetProject/MyDotNetProject.csproj", "MyDotNetProject/"]
RUN dotnet restore "MyDotNetProject/MyDotNetProject.csproj"
COPY . .
WORKDIR "/src/MyDotNetProject"
RUN dotnet build "MyDotNetProject.csproj" -c Release -o /app/build

# Publish stage
FROM build AS publish
RUN dotnet publish "MyDotNetProject.csproj" -c Release -o /app/publish

# Final stage
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MyDotNetProject.dll"]
```


**For React application:**


```dockerfile
# Base image
FROM node:14 AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Build the app
COPY . .
RUN npm run build

# Final image
FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## **Step 4: Build and Run the Docker Containers**
Build and run your .NET and React applications in Docker containers:

**For .NET project:**


```powershell
cd MyDotNetProject
docker build -t mydotnetproject .
docker run -p 8080:80 mydotnetproject
```

**For React project:**


```powershell
cd ../my-react-project
docker build -t myreactproject .
docker run -p 3000:80 myreactproject
```

Access your applications at http://localhost:8080 and http://localhost:3000 respectively.

# **Docker Commands You Might Need:**
## **Viewing Docker Containers**
To view all running Docker containers:


```powershell
docker ps
```

## **To view all containers (including non-running ones):**


```powershell
docker ps -a
```

## **Stopping a Docker Container**
Stop a Docker container using its ID or name:


```powershell
docker stop <container_ID_or_name>
```

## **Removing a Docker Container**
Remove a Docker container (after stopping it):


```powershell
docker rm <container_ID_or_name>
```

## **Viewing Docker Images**
View all Docker images on your machine:


```powershell
docker images
```

## **Removing a Docker Image**
Remove a Docker image:


```powershell
docker rmi <image_ID>
```

Make sure to stop containers before removing them.