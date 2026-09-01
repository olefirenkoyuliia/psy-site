import { decryptText } from '../_crypto.js';

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').toLowerCase().trim();
  const googleId = url.searchParams.get('google_id') || url.searchParams.get('googleId') || '';
  const id = url.searchParams.get('id') || '';

  if (!email && !googleId && !id) {
    return new Response(JSON.stringify({ error: 'Missing user identification parameter (email, google_id, or id)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    let user = null;
    if (email) {
      user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    } else if (googleId) {
      user = await env.DB.prepare("SELECT * FROM users WHERE google_id = ?").bind(googleId).first();
    } else if (id) {
      user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    }

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const decryptedUser = {
      ...user,
      phone: await decryptText(user.phone, env.ENCRYPTION_SECRET),
      telegram: await decryptText(user.telegram, env.ENCRYPTION_SECRET),
      therapy_goal: await decryptText(user.therapy_goal, env.ENCRYPTION_SECRET),
      notes: await decryptText(user.notes, env.ENCRYPTION_SECRET)
    };

    return new Response(JSON.stringify({
      success: true,
      user: decryptedUser
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
