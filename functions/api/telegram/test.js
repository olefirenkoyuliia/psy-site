export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json().catch(() => ({}));
    let botToken = (data.botToken || '').trim() || env.TELEGRAM_BOT_TOKEN;
    let chatId = (data.chatId || '').trim() || env.TELEGRAM_CHAT_ID;

    if ((!botToken || !chatId) && env.DB) {
      try {
        const row = await env.DB.prepare("SELECT data FROM site_data WHERE key = 'telegram_config'").first();
        if (row && row.data) {
          const parsed = JSON.parse(row.data);
          if (!botToken) botToken = parsed.botToken;
          if (!chatId) chatId = parsed.chatId;
        }
      } catch(e) {}
    }

    // Auto-clean token from accidental "bot" prefix, quotes, or spaces
    if (botToken) {
      botToken = botToken.replace(/^['"`]|['"`]$/g, '').trim();
      if (botToken.toLowerCase().startsWith('bot')) {
        botToken = botToken.slice(3).trim();
      }
    }

    if (chatId) {
      chatId = chatId.replace(/^['"`]|['"`]$/g, '').trim();
      chatId = chatId.replace(/^(https?:\/\/)?t\.me\//i, '');
    }

    if (!botToken || !chatId) {
      return new Response(JSON.stringify({
        error: 'Вкажіть Telegram Bot Token та Chat ID для тестування'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (!botToken.includes(':')) {
      return new Response(JSON.stringify({
        error: 'Невірний формат Bot Token. Токен повинен мати вигляд: 123456789:ABCdefGHIjklMNO (отримайте його в @BotFather)'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const testMessage = `🔔 *Тестове сповіщення з сайту психолога Юлії Олефіренко!*\n\n` +
      `✅ Тригер сповіщень у Telegram успішно підключено!\n\n` +
      `Тепер коли клієнт надсилатиме нове повідомлення в чаті кабінету, ви миттєво отримуватимете деталі та посилання для швидкої відповіді. ✨\n\n` +
      `⏱ _Час тесту: ${new Date().toLocaleTimeString('uk-UA')}_`;

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: testMessage,
        parse_mode: 'Markdown'
      })
    });

    const tgData = await tgRes.json();

    if (!tgRes.ok || !tgData.ok) {
      return new Response(JSON.stringify({
        error: `Помилка Telegram API: ${tgData.description || 'Не вдалося надіслати повідомлення'}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Тестове повідомлення успішно надіслано у ваш Telegram! Перевірте месенджер.'
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
