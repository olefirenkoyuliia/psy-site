export async function onRequestGet(context) {
  const { request, env } = context;

  // 1. Query Cloudflare D1 SQL Database (Tier 1: 1-3ms edge response)
  if (env.DB) {
    try {
      const row = await env.DB.prepare("SELECT data FROM site_data WHERE key = 'main'").first();
      if (row && row.data) {
        return new Response(row.data, {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    } catch (e) {
      console.error('D1 read error:', e);
    }
  }

  // 2. Try fetching from origin / local static data.json
  try {
    const url = new URL(request.url);
    const localUrl = new URL('/data.json', url.origin);
    const res = await (env.ASSETS ? env.ASSETS.fetch(localUrl) : fetch(localUrl));
    if (res.ok) {
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  } catch (e) {}

  // 3. Fallback: fetch from GitHub Git DB
  try {
    const ghRes = await fetch('https://api.github.com/repos/olefirenkoyuliia/psy-site/contents/data.json', {
      headers: { 'User-Agent': 'Cloudflare-Worker' }
    });
    if (ghRes.ok) {
      const json = await ghRes.json();
      const bytes = Uint8Array.from(atob(json.content.replace(/\s/g, '')), c => c.charCodeAt(0));
      const dataStr = new TextDecoder().decode(bytes);
      return new Response(dataStr, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  } catch (e) {}

  return new Response(JSON.stringify({ error: 'Data not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
