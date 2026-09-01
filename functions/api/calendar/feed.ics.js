// Dynamic RFC 5545 iCalendar (.ics) Feed Generator for Google Calendar & Apple Calendar Sync
// Supports:
// - /api/calendar/feed?role=owner (All scheduled sessions for therapist Julia)
// - /api/calendar/feed?email=client@gmail.com (All sessions for a specific client)

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const role = url.searchParams.get('role');
  const email = (url.searchParams.get('email') || '').toLowerCase().trim();

  let appointments = [];

  try {
    if (env.DB) {
      if (role === 'owner') {
        const res = await env.DB.prepare(
          "SELECT * FROM appointments WHERE status != 'cancelled' ORDER BY session_date ASC, session_time ASC"
        ).all();
        appointments = res.results || [];
      } else if (email) {
        const res = await env.DB.prepare(
          "SELECT * FROM appointments WHERE LOWER(client_email) = ? AND status != 'cancelled' ORDER BY session_date ASC, session_time ASC"
        ).bind(email).all();
        appointments = res.results || [];
      } else {
        const res = await env.DB.prepare(
          "SELECT * FROM appointments WHERE status != 'cancelled' ORDER BY session_date ASC, session_time ASC LIMIT 50"
        ).all();
        appointments = res.results || [];
      }
    }
  } catch (err) {
    appointments = [];
  }

  const formatIcsDate = (dateStr, timeStr) => {
    try {
      const d = new Date(`${dateStr}T${timeStr}:00`);
      return d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    } catch(e) {
      return '';
    }
  };

  const formatIcsEndDate = (dateStr, timeStr, durationMins = 50) => {
    try {
      const d = new Date(`${dateStr}T${timeStr}:00`);
      const end = new Date(d.getTime() + (durationMins || 50) * 60000);
      return end.toISOString().replace(/-|:|\.\d\d\d/g, '');
    } catch(e) {
      return '';
    }
  };

  const nowIcs = new Date().toISOString().replace(/-|:|\.\d\d\d/g, '');
  const calName = role === 'owner' ? 'Психотерапія • Юлія Олефіренко' : 'Мої консультації • Юлія Олефіренко';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Yuliia Olefirenko//Psychotherapy Practice//UK',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    'X-WR-TIMEZONE:Europe/Kyiv',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M'
  ];

  for (const app of appointments) {
    if (!app.session_date || !app.session_time) continue;
    const startIso = formatIcsDate(app.session_date, app.session_time);
    const endIso = formatIcsEndDate(app.session_date, app.session_time, app.duration_minutes || 50);
    if (!startIso || !endIso) continue;

    const meetUrl = app.meet_url?.includes('http') ? app.meet_url : 'https://meet.google.com/new';
    const summary = role === 'owner' 
      ? `Психотерапія: ${app.client_name}`
      : `Консультація психотерапії з Юлією Олефіренко`;

    const description = [
      `Формат: Онлайн-сесія (${app.duration_minutes || 50} хв)`,
      `Пряме посилання Google Meet: ${meetUrl}`,
      app.therapist_notes ? `Нотатка: ${app.therapist_notes}` : '',
      `Особистий кабінет: https://olefirenko.pp.ua/cabinet.html`
    ].filter(Boolean).join('\\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:psy-appt-${app.id}@olefirenko.pp.ua`,
      `DTSTAMP:${nowIcs}`,
      `DTSTART:${startIso}`,
      `DTEND:${endIso}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${meetUrl}`,
      'CLASS:PRIVATE',
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      `ORGANIZER;CN=Юлія Олефіренко:mailto:olefirenkou@gmail.com`,
      app.client_email ? `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${app.client_name}:mailto:${app.client_email}` : '',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');

  const icsBody = lines.filter(Boolean).join('\r\n');

  return new Response(icsBody, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="calendar.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
