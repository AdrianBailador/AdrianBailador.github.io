import type { Site, Page, Links, Socials } from "@types"

// Global
export const SITE: Site = {
  TITLE: ".NET | C# | Azure | JS",
  DESCRIPTION: "Welcome to my portfolio and blog about software engineering, coding and technology. Talk about .NET, C#, Azure, Visual Studio, and a bit of Next.js.",
  AUTHOR: "Adrian Bailador Panero",
}

// Work Page
//export const WORK: Page = {
//  TITLE: "Work",
//  DESCRIPTION: "Places I have worked.",
//}

// Blog Page
export const BLOG: Page = {
  TITLE: "Blog",
  DESCRIPTION: "Writing on topics I am passionate about.",
}

// Projects Page 
export const PROJECTS: Page = {
  TITLE: "Projects",
  DESCRIPTION: "Recent projects I have worked on.",
}

// Search Page
export const SEARCH: Page = {
  TITLE: "Search",
  DESCRIPTION: "Search all posts and projects by keyword.",
}

// Links
export const LINKS: Links = [
  { 
    TEXT: "Home", 
    HREF: "/", 
  },
  //{ 
  //  TEXT: "Work", 
  //  HREF: "/work", 
  //},
  { 
    TEXT: "Blog", 
    HREF: "/blog", 
  },
  { 
    TEXT: "Projects", 
    HREF: "/projects", 
  },
]

// Socials
export const SOCIALS: Socials = [
  { 
    NAME: "Email",
    ICON: "email", 
    TEXT: "abailador.dev@gmail.com",
    HREF: "mailto:abailador.dev@gmail.com",
  },
  { 
    NAME: "Github",
    ICON: "github",
    TEXT: "adrianbailador-dev",
    HREF: "https://github.com/AdrianBailador"
  },
  { 
    NAME: "LinkedIn",
    ICON: "linkedin",
    TEXT: "adrianbailador-dev",
    HREF: "https://linkedin.com/in/adrianbailadorpanero",
  },
  { 
    NAME: "Twitter",
    ICON: "twitter-x",
    TEXT: "adrianbailador-dev",
    HREF: "https://x.com/DotNetDevABP",
  },
  { 
    NAME: "Medium",
    ICON: "medium",
    TEXT: "adrianbailador-dev",
    HREF: "https://medium.com/@adrianbailador",
  },
  { 
    NAME: "Dev.to",
    ICON: "devto",
    TEXT: "adrianbailador-dev",
    HREF: "https://dev.to/adrianbailador",
  },
]

