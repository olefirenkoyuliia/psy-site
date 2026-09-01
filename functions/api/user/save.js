export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const email = (data.email || '').toLowerCase().trim();
    const googleId = data.google_id || data.googleId || '';

    if (!email && !googleId) {
      return new Response(JSON.stringify({ error: 'Missing user email or google_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const name = (data.name || '').trim();
    const phone = (data.phone || '').trim();
    const telegram = (data.telegram || '').trim().replace(/^@/, '');
    const preferredFormat = data.preferred_format || 'Google Meet';
    const therapyGoal = (data.therapy_goal || '').trim();
    const notes = (data.notes || '').trim();

    if (!env.DB) {
      return new Response(JSON.stringify({
        success: true,
        user: { ...data, updated_at: new Date().toISOString() },
        message: 'Дані оновлено локально'
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Update in D1
    await env.DB.prepare(
      "UPDATE users SET " +
      "name = COALESCE(NULLIF(?, ''), name), " +
      "phone = ?, " +
      "telegram = ?, " +
      "preferred_format = ?, " +
      "therapy_goal = ?, " +
      "notes = ?, " +
      "updated_at = CURRENT_TIMESTAMP " +
      "WHERE email = ? OR google_id = ?"
    ).bind(
      name,
      phone,
      telegram,
      preferredFormat,
      therapyGoal,
      notes,
      email,
      googleId
    ).run();

    // Fetch updated record
    const updatedUser = await env.DB.prepare(
      "SELECT * FROM users WHERE email = ? OR google_id = ?"
    ).bind(email, googleId).first();

    return new Response(JSON.stringify({
      success: true,
      user: updatedUser,
      message: 'Особисті дані успішно збережено'
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
