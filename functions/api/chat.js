export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { messages, userMessage } = await request.json();

    let apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback: read encoded key from local data.json
      try {
        const url = new URL(request.url);
        const localRes = await fetch(new URL('/data.json', url.origin));
        if (localRes.ok) {
          const d = await localRes.json();
          if (d.geminiKey) {
            const bytes = Uint8Array.from(atob(d.geminiKey), c => c.charCodeAt(0));
            apiKey = new TextDecoder().decode(bytes);
          }
        }
      } catch(e) {}
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Gemini API key is not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const model = env.GEMINI_MODEL || 'gemini-3.6-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemInstruction = `Ти — віртуальний турботливий асистент практикуючої психологині Юлії Олефіренко.
Спеціалізація: Кататимно-імагінативна психотерапія (символдрама), Когнітивно-поведінкова терапія (КПТ), тілесні практики.
Консультації проходять онлайн (Zoom / Google Meet), тривалість 50 хвилин.
Вартість: перша консультація — 1000 грн, наступні сесії — 1200 грн. Оплата на рахунок ФОП.
Твоє завдання: тепло привітати клієнта, з емпатією відповісти на запитання щодо методу роботи або запропонувати записатися на консультацію через Telegram (@psy_olefirenkoyuliia). Відповідай виключно українською мовою, лаконічно (2-4 речення).`;

    const contents = [];
    if (messages && Array.isArray(messages)) {
      messages.forEach(m => {
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.text || m.content }]
        });
      });
    }
    if (userMessage) {
      contents.push({
        role: 'user',
        parts: [{ text: userMessage }]
      });
    }

    const payload = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: contents.length > 0 ? contents : [{ parts: [{ text: 'Привіт!' }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300
      }
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: err.error?.message || 'Gemini API error' }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const data = await res.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Доброго дня! Буду рада вам допомогти.';

    return new Response(JSON.stringify({ reply: replyText }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
