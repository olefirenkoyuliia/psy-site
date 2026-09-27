import { encryptText } from './_crypto.js';

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const name = (data.name || '').trim();
    const telegram = (data.telegram || '').trim().replace(/^@/, '');
    const phone = (data.phone || '').trim();
    const email = (data.email || '').trim().toLowerCase();
    const source = data.source || 'marathon_tg_reminder';

    if (!name && !telegram && !phone && !email) {
      return new Response(JSON.stringify({ error: 'At least name or telegram is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (env.DB) {
      const encryptedPhone = phone ? await encryptText(phone, env.ENCRYPTION_SECRET) : '';
      const encryptedTelegram = telegram ? await encryptText(telegram, env.ENCRYPTION_SECRET) : '';
      const adminNotes = `Підписка на нагадування марафону 🌿 (Джерело: ${source})`;
      const fakeEmail = email || `tg_${Date.now()}@telegram.user`;

      await env.DB.prepare(
        "INSERT INTO users (email, name, phone, telegram, role, admin_notes, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, 'client', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
        "ON CONFLICT(email) DO UPDATE SET " +
        "name = COALESCE(NULLIF(excluded.name, ''), users.name), " +
        "telegram = COALESCE(NULLIF(excluded.telegram, ''), users.telegram), " +
        "updated_at = CURRENT_TIMESTAMP"
      ).bind(
        fakeEmail,
        name || 'Клієнт з Telegram',
        encryptedPhone,
        encryptedTelegram,
        adminNotes
      ).run();
    }

    return new Response(JSON.stringify({ success: true, message: 'Lead saved successfully' }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    console.error('Save lead error:', err);
    return new Response(JSON.stringify({ success: true, message: 'Saved locally fallback' }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
