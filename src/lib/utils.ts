import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date) {
  return Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(date)
}

export function readingTime(html: string) {
  const noCode = html
    .replace(/```[\s\S]*?```/g, "")   // fenced code blocks
    .replace(/`[^`]*`/g, "")           // inline code
    .replace(/<[^>]+>/g, "")           // html tags
  const wordCount = noCode.trim().split(/\s+/).filter(Boolean).length
  const minutes = Math.ceil(wordCount / 238)
  return `${Math.max(1, minutes)} min read`
}
