import { encryptText, decryptText } from '../_crypto.js';

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

    const encryptedGoal = therapyGoal ? await encryptText(therapyGoal, env.ENCRYPTION_SECRET) : '';
    const encryptedNotes = notes ? await encryptText(notes, env.ENCRYPTION_SECRET) : '';
    const encryptedPhone = phone ? await encryptText(phone, env.ENCRYPTION_SECRET) : '';
    const encryptedTg = telegram ? await encryptText(telegram, env.ENCRYPTION_SECRET) : '';

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
      encryptedPhone,
      encryptedTg,
      preferredFormat,
      encryptedGoal,
      encryptedNotes,
      email,
      googleId
    ).run();

    // Fetch updated record and decrypt for return
    const updatedUser = await env.DB.prepare(
      "SELECT * FROM users WHERE email = ? OR google_id = ?"
    ).bind(email, googleId).first();

    const returnUser = updatedUser ? {
      ...updatedUser,
      phone: await decryptText(updatedUser.phone, env.ENCRYPTION_SECRET),
      telegram: await decryptText(updatedUser.telegram, env.ENCRYPTION_SECRET),
      therapy_goal: await decryptText(updatedUser.therapy_goal, env.ENCRYPTION_SECRET),
      notes: await decryptText(updatedUser.notes, env.ENCRYPTION_SECRET)
    } : null;

    return new Response(JSON.stringify({
      success: true,
      user: returnUser,
      message: 'Особисті дані успішно збережено в зашифрованому вигляді'
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
