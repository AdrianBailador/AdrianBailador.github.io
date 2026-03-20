/**
 * Cloudflare Worker — Blog AI Assistant proxy
 *
 * Secrets (set via `wrangler secret put GEMINI_API_KEY`):
 *   GEMINI_API_KEY  — your Google Gemini API key
 *
 * Deploy:
 *   npx wrangler deploy
 */

const ALLOWED_ORIGINS = [
  "https://adrianbailador.github.io",
  "http://localhost:4321",
  "http://localhost:4322",
];

function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(body, status, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(request), "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: getCorsHeaders(request) });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, request);
    }

    const { query, posts } = body;
    if (!query || !Array.isArray(posts)) {
      return json({ error: "Missing query or posts" }, 400, request);
    }

    const prompt =
      `You are a helpful assistant for Adrián Bailador's .NET and C# developer blog.\n` +
      `The user is looking for blog posts. Recommend the most relevant ones based on their query.\n\n` +
      `Available posts:\n` +
      posts.map(p => `- "${p.titulo}": ${p.resumen} → https://adrianbailador.github.io${p.url}`).join("\n") +
      `\n\nUser query: "${query}"\n\n` +
      `Be concise and friendly. Include the full URL of the recommended post(s) as plain text (no markdown, no parentheses around URLs).`;

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 512,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        return json({ error: data?.error?.message || `Groq error ${res.status}` }, 502, request);
      }

      const answer = data?.choices?.[0]?.message?.content ?? "No response received.";
      return json({ answer }, 200, request);

    } catch (err) {
      return json({ error: "Upstream error: " + err.message }, 502, request);
    }
  },
};
