import type { APIRoute } from "astro"
import { getCollection } from "astro:content"

export const GET: APIRoute = async () => {
  const posts = await getCollection("blog", p => !p.data.draft)
  const projects = await getCollection("projects", p => !p.data.draft)

  const items = [
    ...posts.map(p => ({
      titulo: p.data.title,
      resumen: p.data.summary,
      url: `/blog/${p.slug.toLowerCase()}`,
    })),
    ...projects.map(p => ({
      titulo: p.data.title,
      resumen: p.data.summary,
      url: `/projects/${p.slug.toLowerCase()}`,
    })),
  ].sort((a, b) => a.titulo.localeCompare(b.titulo))

  return new Response(JSON.stringify(items, null, 2), {
    headers: { "Content-Type": "application/json" },
  })
}
