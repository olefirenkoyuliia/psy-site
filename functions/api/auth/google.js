export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store'
  };

  try {
    const body = await request.json().catch(() => ({}));
    const { credential, profile } = body;

    let userData = profile || {};

    // If credential JWT is passed from Google One Tap / GIS, decode payload
    if (credential && !profile) {
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const decodedJson = decodeURIComponent(escape(atob(payloadBase64)));
          userData = JSON.parse(decodedJson);
        }
      } catch (e) {
        console.error('Error decoding JWT credential:', e);
      }
    }

    const googleId = userData.sub || userData.id || userData.google_id || `usr_${Date.now()}`;
    const email = (userData.email || '').toLowerCase().trim();
    const name = (userData.name || `${userData.given_name || userData.first_name || ''} ${userData.family_name || userData.last_name || ''}`).trim() || 'Користувач';
    const firstName = userData.first_name || userData.given_name || (name !== 'Користувач' ? name.split(' ')[0] : '') || 'Користувач';
    const lastName = userData.last_name || userData.family_name || (name !== 'Користувач' ? name.split(' ').slice(1).join(' ') : '') || '';
    const picture = userData.picture || userData.avatar || '';

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required for registration' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const isOwner = email.includes('olefirenko') || 
                    email.includes('psy_olefirenko') || 
                    email.includes('artemfedoryshyn') || 
                    email.startsWith('admin') ||
                    userData.role === 'owner';
    const assignedRole = isOwner ? 'owner' : (userData.role || 'client');

    let finalUser = {
      id: 1,
      google_id: googleId,
      email: email,
      name: name,
      first_name: firstName,
      last_name: lastName,
      picture: picture,
      role: assignedRole,
      phone: userData.phone || '',
      telegram: userData.telegram || '',
      preferred_format: userData.preferred_format || 'Платформа (Відеокімната)',
      therapy_goal: userData.therapy_goal || '',
      notes: userData.notes || '',
      admin_notes: userData.admin_notes || ''
    };

    if (env.DB) {
      // 1. Check if user already exists by email or google_id
      const existing = await env.DB.prepare(
        "SELECT * FROM users WHERE email = ? OR google_id = ?"
      ).bind(email, googleId).first();

      if (existing) {
        // Update picture and name if missing
        if (picture && (!existing.picture || existing.picture.includes('googleusercontent.com'))) {
          await env.DB.prepare(
            "UPDATE users SET picture = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(picture, existing.id).run();
        }

        finalUser = {
          ...existing,
          role: existing.role || assignedRole,
          picture: picture || existing.picture
        };
      } else {
        // Insert new user from Google SSO / Registration
        const insertRes = await env.DB.prepare(
          "INSERT INTO users (google_id, email, name, first_name, last_name, picture, preferred_format, role) " +
          "VALUES (?, ?, ?, ?, ?, ?, 'Платформа (Відеокімната)', ?)"
        ).bind(googleId, email, name, firstName, lastName, picture, assignedRole).run();

        const newId = insertRes.meta?.last_row_id || 1;
        finalUser = {
          id: newId,
          google_id: googleId,
          email: email,
          name: name,
          first_name: firstName,
          last_name: lastName,
          picture: picture,
          role: assignedRole,
          phone: '',
          telegram: '',
          preferred_format: 'Платформа (Відеокімната)',
          therapy_goal: '',
          notes: '',
          admin_notes: ''
        };
      }
    }

    return new Response(JSON.stringify({
      success: true,
      user: finalUser,
      message: 'Успішна реєстрація та вхід'
    }), {
      headers: corsHeaders
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

