export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const credential = formData.get('credential');

    if (!credential) {
      return Response.redirect(new URL('/cabinet.html?error=no_credential', request.url), 302);
    }

    let userData = {};
    try {
      const parts = credential.split('.');
      if (parts.length === 3) {
        const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const decodedJson = decodeURIComponent(escape(atob(payloadBase64)));
        userData = JSON.parse(decodedJson);
      }
    } catch (e) {
      console.error('Callback JWT decode error:', e);
    }

    const googleId = userData.sub || userData.id || `usr_${Date.now()}`;
    const email = (userData.email || '').toLowerCase().trim();
    const name = (userData.name || `${userData.given_name || ''} ${userData.family_name || ''}`).trim() || 'Користувач';
    const firstName = userData.given_name || (name !== 'Користувач' ? name.split(' ')[0] : '') || 'Користувач';
    const lastName = userData.family_name || (name !== 'Користувач' ? name.split(' ').slice(1).join(' ') : '') || '';
    const picture = userData.picture || '';

    if (!email) {
      return Response.redirect(new URL('/cabinet.html?error=no_email', request.url), 302);
    }

    const isOwner = email === 'olefirenkou@gmail.com' ||
                    email === 'olefirenkoyuliia@gmail.com' ||
                    email.includes('olefirenkou') ||
                    email.includes('olefirenko') || 
                    email.includes('psy_olefirenko') || 
                    email.includes('artemfedoryshyn') || 
                    email.startsWith('admin');
    const assignedRole = isOwner ? 'owner' : 'client';

    let finalUser = {
      id: 1,
      google_id: googleId,
      email: email,
      name: name,
      first_name: firstName,
      last_name: lastName,
      picture: picture,
      role: assignedRole,
      phone: '',
      telegram: '',
      preferred_format: 'Google Meet',
      therapy_goal: '',
      notes: ''
    };

    if (env.DB) {
      const existing = await env.DB.prepare(
        "SELECT * FROM users WHERE email = ? OR google_id = ?"
      ).bind(email, googleId).first();

      if (existing) {
        const newRole = isOwner ? 'owner' : (existing.role || assignedRole);
        await env.DB.prepare(
          "UPDATE users SET picture = COALESCE(?, picture), google_id = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(picture || existing.picture, googleId, newRole, existing.id).run();

        finalUser = {
          ...existing,
          google_id: googleId,
          role: newRole,
          picture: picture || existing.picture
        };
      } else {
        const insertRes = await env.DB.prepare(
          "INSERT INTO users (google_id, email, name, first_name, last_name, picture, preferred_format, role) " +
          "VALUES (?, ?, ?, ?, ?, ?, 'Google Meet', ?)"
        ).bind(googleId, email, name, firstName, lastName, picture, assignedRole).run();

        const newId = insertRes.meta?.last_row_id || 1;
        finalUser.id = newId;
      }
    }

    // Pass user payload safely to client
    const userJson = JSON.stringify(finalUser);
    const userEncoded = encodeURIComponent(userJson);
    return Response.redirect(new URL(`/cabinet.html?sso_user=${userEncoded}`, request.url), 302);

  } catch (err) {
    console.error('SSO Callback error:', err);
    return Response.redirect(new URL('/cabinet.html?error=auth_failed', request.url), 302);
  }
}

export async function onRequestGet(context) {
  const { request } = context;
  return Response.redirect(new URL('/cabinet.html', request.url), 302);
}
