export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').toLowerCase().trim();
  const isOwner = url.searchParams.get('isOwner') === 'true' || email.includes('olefirenko') || email.includes('psy_olefirenko') || email.includes('artemfedoryshyn');

  if (!env.DB) {
    return new Response(JSON.stringify({ success: true, appointments: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    let rows;
    if (isOwner || !email) {
      rows = await env.DB.prepare(
        "SELECT * FROM appointments ORDER BY session_date ASC, session_time ASC"
      ).all();
    } else {
      rows = await env.DB.prepare(
        "SELECT * FROM appointments WHERE client_email = ? ORDER BY session_date ASC, session_time ASC"
      ).bind(email).all();
    }

    return new Response(JSON.stringify({
      success: true,
      appointments: rows.results || []
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
    const clientId = data.client_id || 0;
    const clientName = (data.client_name || '').trim();
    const clientEmail = (data.client_email || '').toLowerCase().trim();
    const sessionDate = (data.session_date || '').trim();
    const sessionTime = (data.session_time || '').trim();
    const durationMinutes = data.duration_minutes || 50;
    const therapistNotes = (data.therapist_notes || '').trim();
    
    // Generate clean unique room code (e.g. psy-meet-xyz789)
    const randomHex = Math.random().toString(36).substring(2, 8);
    const roomCode = data.room_code || `psy-olefirenko-${randomHex}`;
    const meetUrl = `/meet.html?room=${roomCode}`;

    if (!clientName || !sessionDate || !sessionTime) {
      return new Response(JSON.stringify({ error: 'Client name, session date and time are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (!env.DB) {
      return new Response(JSON.stringify({
        success: true,
        appointment: { id: Date.now(), client_id: clientId, client_name: clientName, client_email: clientEmail, session_date: sessionDate, session_time: sessionTime, room_code: roomCode, meet_url: meetUrl, status: 'scheduled' },
        message: 'Зустріч призначено локально'
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const insertRes = await env.DB.prepare(
      "INSERT INTO appointments (client_id, client_name, client_email, session_date, session_time, duration_minutes, room_code, meet_url, therapist_notes, status) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')"
    ).bind(
      clientId,
      clientName,
      clientEmail,
      sessionDate,
      sessionTime,
      durationMinutes,
      roomCode,
      meetUrl,
      therapistNotes
    ).run();

    const newId = insertRes.meta?.last_row_id || 1;
    const appointment = await env.DB.prepare("SELECT * FROM appointments WHERE id = ?").bind(newId).first();

    return new Response(JSON.stringify({
      success: true,
      appointment: appointment,
      message: 'Сесію успішно призначено та додано до розкладу'
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

export async function onRequestPut(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const id = data.id;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Appointment ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (!env.DB) {
      return new Response(JSON.stringify({ success: true, message: 'Updated locally' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const status = data.status || 'scheduled';
    const therapistNotes = data.therapist_notes || '';

    await env.DB.prepare(
      "UPDATE appointments SET status = ?, therapist_notes = COALESCE(NULLIF(?, ''), therapist_notes), updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(status, therapistNotes, id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Статус зустрічі оновлено'
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
    return new Response(JSON.stringify({ error: 'Appointment ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (env.DB) {
    await env.DB.prepare("DELETE FROM appointments WHERE id = ?").bind(id).run();
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'Зустріч скасовано'
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
