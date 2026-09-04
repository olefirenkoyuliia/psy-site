export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const { event, visitorId, source, device, metadata } = body;

    const eventType = event || 'page_view';
    const userAgent = request.headers.get('user-agent') || '';
    
    // Extract real client IP from Cloudflare headers
    const clientIp = request.headers.get('cf-connecting-ip') || 
                     request.headers.get('x-real-ip') || 
                     request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     '127.0.0.1';

    const cfCountry = request.cf?.country || 'UA';
    const cfCity = request.cf?.city || 'Kyiv';

    // Detect if bot or human
    const isBot = /bot|spider|crawler|google|bing|yahoo|duckduck|baiduspider|yandex|facebookexternalhit|telegrambot|twitterbot|discordbot|applebot|semrush|ahrefs|petalbot|headless/i.test(userAgent) ||
                  (request.cf?.botManagement?.score !== undefined && request.cf.botManagement.score < 30);

    const clientDevice = device || (/Mobile|Android|iPhone|iPad/i.test(userAgent) ? 'Мобільний' : 'Компʼютер');
    const clientSource = source || 'Прямий перехід';

    // Form stable unique visitor ID: prioritize browser visitorId from localStorage, fallback to client IP
    const effectiveVisitorId = (visitorId && visitorId !== 'anon') 
      ? visitorId 
      : `ip_${clientIp.replace(/[:.]/g, '_')}`;

    // Sanitize metadata
    const sanitizedMeta = {};
    if (metadata && typeof metadata === 'object') {
      if (metadata.topic) sanitizedMeta.topic = String(metadata.topic).substring(0, 50);
      if (metadata.focus) sanitizedMeta.focus = String(metadata.focus).substring(0, 50);
      if (metadata.category) sanitizedMeta.category = String(metadata.category).substring(0, 50);
      if (metadata.button) sanitizedMeta.button = String(metadata.button).substring(0, 50);
      if (metadata.path) sanitizedMeta.path = String(metadata.path).substring(0, 50);
    }

    const now = new Date();
    const metaObj = {
      country: cfCountry,
      city: cfCity,
      ip: clientIp,
      isBot: isBot,
      rawMeta: sanitizedMeta,
      time: now.toLocaleTimeString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      date: now.toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv' })
    };

    if (env.DB) {
      await env.DB.prepare(
        "INSERT INTO analytics_events (event_type, visitor_id, source, device, metadata, created_at) " +
        "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
      ).bind(
        eventType,
        effectiveVisitorId,
        clientSource,
        clientDevice,
        JSON.stringify(metaObj)
      ).run();
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
