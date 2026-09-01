import { decryptText } from '../_crypto.js';

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.DB) {
    return new Response(JSON.stringify({ success: true, clients: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const rows = await env.DB.prepare(
      "SELECT id, google_id, email, name, first_name, last_name, picture, phone, telegram, preferred_format, therapy_goal, notes, admin_notes, role, created_at, updated_at " +
      "FROM users ORDER BY id DESC"
    ).all();

    const rawList = rows.results || [];
    const decryptedList = await Promise.all(rawList.map(async (c) => ({
      ...c,
      phone: await decryptText(c.phone, env.ENCRYPTION_SECRET),
      telegram: await decryptText(c.telegram, env.ENCRYPTION_SECRET),
      therapy_goal: await decryptText(c.therapy_goal, env.ENCRYPTION_SECRET),
      notes: await decryptText(c.notes, env.ENCRYPTION_SECRET)
    })));

    return new Response(JSON.stringify({
      success: true,
      clients: decryptedList
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

  if (!env.DB) {
    return new Response(JSON.stringify({ success: true, message: 'Updated locally' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const data = await request.json();
    const id = data.id;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Client ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const name = (data.name || '').trim();
    const phone = (data.phone || '').trim();
    const telegram = (data.telegram || '').trim().replace(/^@/, '');
    const preferredFormat = data.preferred_format || 'Google Meet';
    const therapyGoal = (data.therapy_goal || '').trim();
    const adminNotes = (data.admin_notes || '').trim();
    const role = data.role || 'client';

    await env.DB.prepare(
      "UPDATE users SET " +
      "name = COALESCE(NULLIF(?, ''), name), " +
      "phone = ?, " +
      "telegram = ?, " +
      "preferred_format = ?, " +
      "therapy_goal = ?, " +
      "admin_notes = ?, " +
      "role = ?, " +
      "updated_at = CURRENT_TIMESTAMP " +
      "WHERE id = ?"
    ).bind(
      name,
      phone,
      telegram,
      preferredFormat,
      therapyGoal,
      adminNotes,
      role,
      id
    ).run();

    const updated = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      client: updated,
      message: 'Дані клієнта успішно оновлено'
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

export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return new Response(JSON.stringify({ error: 'Client ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ success: true, message: 'Deleted locally' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Клієнта успішно видалено'
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
