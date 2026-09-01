export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

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
    
    // Support single appointment or array of multiple sessions (e.g. course of 10 meetings)
    const items = Array.isArray(data.appointments) ? data.appointments : [data];
    const createdList = [];

    for (const item of items) {
      const clientId = item.client_id || 0;
      const clientName = (item.client_name || '').trim();
      const clientEmail = (item.client_email || '').toLowerCase().trim();
      const sessionDate = (item.session_date || '').trim();
      const sessionTime = (item.session_time || '').trim();
      const durationMinutes = item.duration_minutes || 50;
      const therapistNotes = (item.therapist_notes || '').trim();
      
      // Generate clean unique room code
      const randomHex = Math.random().toString(36).substring(2, 8);
      const roomCode = item.room_code || `psy-olefirenko-${randomHex}`;
      const meetFormat = item.meet_format || 'google_meet';
      const googleMeetUrl = (item.google_meet_url || 'https://meet.google.com/new').trim();
      const meetUrl = meetFormat === 'google_meet' ? googleMeetUrl : `/meet.html?room=${roomCode}`;

      if (!clientName || !sessionDate || !sessionTime) continue;

      if (!env.DB) {
        createdList.push({
          id: Date.now() + Math.floor(Math.random() * 1000),
          client_id: clientId,
          client_name: clientName,
          client_email: clientEmail,
          session_date: sessionDate,
          session_time: sessionTime,
          duration_minutes: durationMinutes,
          meet_format: meetFormat,
          google_meet_url: googleMeetUrl,
          room_code: roomCode,
          meet_url: meetUrl,
          therapist_notes: therapistNotes,
          status: 'scheduled'
        });
      } else {
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
        const appRow = await env.DB.prepare("SELECT * FROM appointments WHERE id = ?").bind(newId).first();
        createdList.push({
          ...appRow,
          meet_format: meetFormat,
          google_meet_url: googleMeetUrl
        });
      }
    }

    if (createdList.length === 0) {
      return new Response(JSON.stringify({ error: 'Client name, session date and time are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      appointment: createdList[0] || null,
      appointments: createdList,
      count: createdList.length,
      message: createdList.length > 1 ? `Успішно призначено курс із ${createdList.length} сесій` : 'Сесію успішно призначено та додано до розкладу'
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
