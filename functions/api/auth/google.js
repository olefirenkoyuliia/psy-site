export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
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

    const googleId = userData.sub || userData.id || userData.google_id || '';
    const email = (userData.email || '').toLowerCase().trim();
    const name = userData.name || `${userData.given_name || ''} ${userData.family_name || ''}`.trim() || 'Користувач';
    const firstName = userData.given_name || name.split(' ')[0] || '';
    const lastName = userData.family_name || name.split(' ').slice(1).join(' ') || '';
    const picture = userData.picture || userData.avatar || '';

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required for authentication' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    let finalUser = {
      id: 1,
      google_id: googleId,
      email: email,
      name: name,
      first_name: firstName,
      last_name: lastName,
      picture: picture,
      phone: '',
      telegram: '',
      preferred_format: 'Google Meet',
      therapy_goal: '',
      notes: ''
    };

    if (env.DB) {
      // 1. Check if user already exists by email or google_id
      const existing = await env.DB.prepare(
        "SELECT * FROM users WHERE email = ? OR google_id = ?"
      ).bind(email, googleId).first();

      if (existing) {
        // Update picture if missing
        if (picture && (!existing.picture || existing.picture.includes('googleusercontent.com'))) {
          await env.DB.prepare(
            "UPDATE users SET picture = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(picture, existing.id).run();
        }

        finalUser = {
          ...existing,
          picture: picture || existing.picture
        };
      } else {
        // Insert new user from Google SSO
        const insertRes = await env.DB.prepare(
          "INSERT INTO users (google_id, email, name, first_name, last_name, picture, preferred_format) " +
          "VALUES (?, ?, ?, ?, ?, ?, 'Google Meet')"
        ).bind(googleId, email, name, firstName, lastName, picture).run();

        const newId = insertRes.meta?.last_row_id || 1;
        finalUser = {
          id: newId,
          google_id: googleId,
          email: email,
          name: name,
          first_name: firstName,
          last_name: lastName,
          picture: picture,
          phone: '',
          telegram: '',
          preferred_format: 'Google Meet',
          therapy_goal: '',
          notes: ''
        };
      }
    }

    return new Response(JSON.stringify({
      success: true,
      user: finalUser,
      message: 'Успішний вхід через Google SSO'
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
