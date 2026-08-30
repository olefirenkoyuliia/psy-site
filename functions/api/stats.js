export async function onRequestGet(context) {
  const { env } = context;

  if (!env.DB) {
    return new Response(JSON.stringify({
      humans: 0,
      bots: 0,
      views: 0,
      tgClicks: 0,
      conversion: 0,
      sources: {},
      devices: {},
      events: []
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    // 1. Fetch recent events from D1 SQL database
    const rows = await env.DB.prepare(
      "SELECT id, event_type, visitor_id, source, device, metadata, created_at " +
      "FROM analytics_events ORDER BY id DESC LIMIT 100"
    ).all();

    const allEvents = rows.results || [];

    let humans = 0;
    let bots = 0;
    let pageViews = 0;
    let tgClicks = 0;
    const sourcesMap = {};
    const devicesMap = {};
    const formattedEvents = [];

    const countedVisitors = new Set();

    allEvents.forEach(row => {
      let meta = {};
      try { meta = JSON.parse(row.metadata || '{}'); } catch(e) {}

      const isBot = meta.isBot || false;
      if (isBot) {
        bots++;
      } else {
        if (row.visitor_id && !countedVisitors.has(row.visitor_id)) {
          countedVisitors.add(row.visitor_id);
          humans++;
        }
        if (row.source) {
          sourcesMap[row.source] = (sourcesMap[row.source] || 0) + 1;
        }
        if (row.device) {
          devicesMap[row.device] = (devicesMap[row.device] || 0) + 1;
        }
      }

      if (row.event_type === 'page_view') pageViews++;
      if (row.event_type === 'tg_click' || row.event_type === 'booking_click') tgClicks++;

      let actionTitle = 'Перегляд сайту';
      if (row.event_type === 'tg_click') actionTitle = 'Клік у Telegram 💬';
      if (row.event_type === 'booking_click') actionTitle = 'Запис на час 📅';
      if (row.event_type === 'quiz_completed') actionTitle = 'Пройдено тест стану 🧭';
      if (row.event_type === 'instagram_click') actionTitle = 'Перехід в Instagram 📸';
      if (row.event_type === 'audio_play') actionTitle = 'Прослуховування аудіо 🎙️';
      if (row.event_type === 'chat_open') actionTitle = 'Чат з AI-асистентом 🤖';

      formattedEvents.push({
        id: row.id,
        type: isBot ? 'bot' : 'human',
        source: row.source || 'Прямий перехід',
        device: row.device || 'Мобільний',
        action: actionTitle,
        city: meta.city ? `${meta.city}, ${meta.country}` : 'Україна',
        time: meta.time || row.created_at?.substring(11, 19) || '--:--',
        date: meta.date || row.created_at?.substring(0, 10) || ''
      });
    });

    const humanCount = Math.max(humans, countedVisitors.size);
    const convRate = humanCount > 0 ? ((tgClicks / humanCount) * 100).toFixed(1) : '0';

    return new Response(JSON.stringify({
      success: true,
      humans: humanCount,
      bots: bots,
      views: pageViews || humanCount,
      tgClicks: tgClicks,
      conversion: convRate,
      sources: sourcesMap,
      devices: devicesMap,
      events: formattedEvents
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
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
