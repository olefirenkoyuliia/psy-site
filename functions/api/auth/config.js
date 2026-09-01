export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  let clientId = env.GOOGLE_CLIENT_ID || '';

  if (env.DB && !clientId) {
    try {
      const row = await env.DB.prepare("SELECT data FROM site_data WHERE key = 'google_client_id'").first();
      if (row && row.data) clientId = row.data;
    } catch(e) {}
  }

  return new Response(JSON.stringify({
    success: true,
    clientId: clientId || ''
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store'
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const clientId = (data.clientId || '').trim();

    if (env.DB && clientId) {
      await env.DB.prepare(
        "INSERT INTO site_data (key, data, updated_at) VALUES ('google_client_id', ?, CURRENT_TIMESTAMP) " +
        "ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP"
      ).bind(clientId).run();
    }

    return new Response(JSON.stringify({ success: true, message: 'Google Client ID saved', clientId }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store'
      }
    });
  } catch(err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
