import { encryptText, decryptText } from '../_crypto.js';

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').toLowerCase().trim();
  const isOwner = url.searchParams.get('isOwner') === 'true' || email.includes('olefirenko') || email.includes('psy_olefirenko') || email.includes('artemfedoryshyn');

  if (!env.DB) {
    return new Response(JSON.stringify({ success: true, inquiries: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    let rows;
    if (isOwner || !email) {
      rows = await env.DB.prepare(
        "SELECT * FROM client_inquiries ORDER BY created_at DESC"
      ).all();
    } else {
      rows = await env.DB.prepare(
        "SELECT * FROM client_inquiries WHERE LOWER(client_email) = ? ORDER BY created_at DESC"
      ).bind(email).all();
    }

    const rawList = rows.results || [];
    const decryptedList = await Promise.all(rawList.map(async (item) => ({
      ...item,
      question: await decryptText(item.question, env.ENCRYPTION_SECRET),
      answer: item.answer ? await decryptText(item.answer, env.ENCRYPTION_SECRET) : null,
      client_phone: item.client_phone ? await decryptText(item.client_phone, env.ENCRYPTION_SECRET) : null
    })));

    return new Response(JSON.stringify({
      success: true,
      inquiries: decryptedList
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store',
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

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const clientName = (data.client_name || 'Користувач').trim();
    const clientEmail = (data.client_email || '').toLowerCase().trim();
    const clientPhone = (data.client_phone || '').trim();
    const topic = (data.topic || 'Загальне питання').trim();
    const question = (data.question || '').trim();

    if (!clientEmail || !question) {
      return new Response(JSON.stringify({ error: 'Email та текст запитання є обов’язковими' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    let insertedId = Date.now();

    if (env.DB) {
      const encryptedQuestion = await encryptText(question, env.ENCRYPTION_SECRET);
      const encryptedPhone = clientPhone ? await encryptText(clientPhone, env.ENCRYPTION_SECRET) : '';

      const res = await env.DB.prepare(
        "INSERT INTO client_inquiries (client_name, client_email, client_phone, topic, question, status) VALUES (?, ?, ?, ?, ?, 'pending')"
      ).bind(clientName, clientEmail, encryptedPhone, topic, encryptedQuestion).run();
      insertedId = res.meta?.last_row_id || insertedId;
    }

    return new Response(JSON.stringify({
      success: true,
      id: insertedId,
      message: 'Ваше запитання успішно надіслано Юлії! Відповідь з’явиться у вашому кабінеті.'
    }), {
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

export async function onRequestPut(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const id = data.id;
    const answer = (data.answer || '').trim();

    if (!id || !answer) {
      return new Response(JSON.stringify({ error: 'ID та текст відповіді обов’язкові' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (env.DB) {
      const encryptedAnswer = await encryptText(answer, env.ENCRYPTION_SECRET);
      await env.DB.prepare(
        "UPDATE client_inquiries SET answer = ?, status = 'answered', answered_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(encryptedAnswer, id).run();
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Відповідь збережено та надіслано клієнту'
    }), {
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
