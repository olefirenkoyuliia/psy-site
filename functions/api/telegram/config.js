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
  let botToken = env.TELEGRAM_BOT_TOKEN || '';
  let chatId = env.TELEGRAM_CHAT_ID || '';

  if (env.DB) {
    try {
      const row = await env.DB.prepare("SELECT data FROM site_data WHERE key = 'telegram_config'").first();
      if (row && row.data) {
        const parsed = JSON.parse(row.data);
        if (!botToken && parsed.botToken) botToken = parsed.botToken;
        if (!chatId && parsed.chatId) chatId = parsed.chatId;
      }
    } catch(e) {}
  }

  const maskedToken = botToken ? (botToken.slice(0, 6) + '...' + botToken.slice(-4)) : '';

  return new Response(JSON.stringify({
    success: true,
    configured: Boolean(botToken && chatId),
    chatId: chatId || '',
    maskedToken: maskedToken,
    hasToken: Boolean(botToken)
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
    const botToken = (data.botToken || '').trim();
    const chatId = (data.chatId || '').trim();

    if (!env.DB) {
      return new Response(JSON.stringify({ error: 'База даних недоступна' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    let existingConfig = {};
    try {
      const row = await env.DB.prepare("SELECT data FROM site_data WHERE key = 'telegram_config'").first();
      if (row && row.data) existingConfig = JSON.parse(row.data);
    } catch(e) {}

    const newConfig = {
      botToken: botToken || existingConfig.botToken || '',
      chatId: chatId || existingConfig.chatId || ''
    };

    await env.DB.prepare(
      "INSERT INTO site_data (key, data, updated_at) VALUES ('telegram_config', ?, CURRENT_TIMESTAMP) " +
      "ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP"
    ).bind(JSON.stringify(newConfig)).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Налаштування Telegram успішно збережено!',
      configured: Boolean(newConfig.botToken && newConfig.chatId),
      chatId: newConfig.chatId
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch(err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
