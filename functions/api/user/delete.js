export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json().catch(() => ({}));
    const email = (data.email || '').toLowerCase().trim();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email обов’язковий для видалення даних' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (!env.DB) {
      return new Response(JSON.stringify({ success: true, message: 'Дані успішно очищено' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // GDPR Right to be Forgotten: Delete all records associated with this client
    await env.DB.prepare("DELETE FROM users WHERE LOWER(email) = ?").bind(email).run();
    await env.DB.prepare("DELETE FROM client_inquiries WHERE LOWER(client_email) = ?").bind(email).run();
    await env.DB.prepare("DELETE FROM appointments WHERE LOWER(client_email) = ?").bind(email).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Усі ваші персональні дані, профіль та історію звернень безповоротно видалено з сервера.'
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
