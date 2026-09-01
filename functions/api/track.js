export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { event, visitorId, source, device, metadata } = body;

    const eventType = event || 'page_view';
    const userAgent = request.headers.get('user-agent') || '';
    const cfCountry = request.cf?.country || 'UA';
    const cfCity = request.cf?.city || 'Kyiv';

    // Detect if bot or human
    const isBot = /bot|spider|crawler|google|bing|yahoo|duckduck|baiduspider|yandex|facebookexternalhit/i.test(userAgent) ||
                  (request.cf?.botManagement?.score !== undefined && request.cf.botManagement.score < 30);

    const clientDevice = device || (/Mobile|Android|iPhone|iPad/i.test(userAgent) ? 'Мобільний' : 'Компʼютер');
    const clientSource = source || 'Прямий перехід';

    // Sanitize metadata to completely exclude Personally Identifiable Information (PII)
    const sanitizedMeta = {};
    if (metadata && typeof metadata === 'object') {
      if (metadata.topic) sanitizedMeta.topic = String(metadata.topic).substring(0, 50);
      if (metadata.focus) sanitizedMeta.focus = String(metadata.focus).substring(0, 50);
      if (metadata.category) sanitizedMeta.category = String(metadata.category).substring(0, 50);
    }

    const metaObj = {
      country: cfCountry,
      city: cfCity,
      isBot: isBot,
      rawMeta: sanitizedMeta,
      time: new Date().toLocaleTimeString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      date: new Date().toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv' })
    };

    if (env.DB) {
      await env.DB.prepare(
        "INSERT INTO analytics_events (event_type, visitor_id, source, device, metadata, created_at) " +
        "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
      ).bind(
        eventType,
        visitorId || 'anon',
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
