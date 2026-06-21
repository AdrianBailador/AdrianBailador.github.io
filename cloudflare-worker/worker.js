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

function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + "…";
}

function pickRelevantPosts(posts, query, limit) {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);

  const scored = posts.map(p => {
    const haystack = `${p.titulo} ${p.resumen}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    return { post: p, score };
  });

  const matched = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  // Vague or non-matching query: fall back to a sample of the catalog
  // instead of sending everything.
  const chosen = matched.length > 0 ? matched : scored;

  return chosen.slice(0, limit).map(s => s.post);
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

    // The full catalog grows with every new post/project and can blow past the
    // model's tokens-per-minute limit if sent whole on every request. Score
    // posts by simple keyword overlap with the query and only send the most
    // relevant ones (falling back to a slice of everything for vague queries).
    const relevantPosts = pickRelevantPosts(posts, query, 12);

    const prompt =
      `You are a helpful assistant for Adrián Bailador's .NET and C# developer blog.\n` +
      `The user is looking for blog posts. Recommend the most relevant ones based on their query.\n\n` +
      `Available posts:\n` +
      relevantPosts.map(p => `- "${p.titulo}": ${truncate(p.resumen, 160)} → https://adrianbailador.github.io${p.url}`).join("\n") +
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
          model: "openai/gpt-oss-20b",
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
