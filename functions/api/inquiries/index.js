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

    return new Response(JSON.stringify({
      success: true,
      inquiries: rows.results || []
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
      const res = await env.DB.prepare(
        "INSERT INTO client_inquiries (client_name, client_email, client_phone, topic, question, status) VALUES (?, ?, ?, ?, ?, 'pending')"
      ).bind(clientName, clientEmail, clientPhone, topic, question).run();
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
      await env.DB.prepare(
        "UPDATE client_inquiries SET answer = ?, status = 'answered', answered_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(answer, id).run();
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
