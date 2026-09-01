export async function onRequestGet(context) {
  const { env } = context;

  if (!env.DB) {
    return new Response(JSON.stringify({
      humans: 0,
      bots: 0,
      views: 0,
      tgClicks: 0,
      conversion: 0,
      sources: {},
      devices: {},
      events: [],
      chatInquiries: [],
      quizSubmissions: [],
      topicAnalytics: []
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    // 1. Fetch recent events from D1 SQL database
    const rows = await env.DB.prepare(
      "SELECT id, event_type, visitor_id, source, device, metadata, created_at " +
      "FROM analytics_events ORDER BY id DESC LIMIT 300"
    ).all();

    const allEvents = rows.results || [];

    let humans = 0;
    let bots = 0;
    let pageViews = 0;
    let tgClicks = 0;
    const sourcesMap = {};
    const devicesMap = {};
    const formattedEvents = [];
    const chatInquiries = [];
    const quizSubmissions = [];
    const topicCounts = {};

    const countedVisitors = new Set();

    function categorizeTopic(text) {
      if (!text) return '💬 Загальний запит';
      const q = text.toLowerCase();
      if (q.includes('тривог') || q.includes('панік') || q.includes('страх') || q.includes('стрес') || q.includes('напруг') || q.includes('боюсь')) return '🌊 Тривожність та страхи';
      if (q.includes('вигоран') || q.includes('втом') || q.includes('апаті') || q.includes('немає сил') || q.includes('виснаж') || q.includes('депрес')) return '🔋 Вигорання та втома';
      if (q.includes('стосунк') || q.includes('кордон') || q.includes('партнер') || q.includes('розрив') || q.includes('конфлікт') || q.includes('самотн') || q.includes('сказати ні')) return '💔 Стосунки та кордони';
      if (q.includes('самооцінк') || q.includes('критик') || q.includes('провин') || q.includes('невпевнен') || q.includes('самозван') || q.includes('не вірю')) return '🪞 Самооцінка та критик';
      if (q.includes('сон') || q.includes('сни') || q.includes('символ') || q.includes('образ') || q.includes('символдрам') || q.includes('метод')) return '🌿 Сни та символдрама';
      if (q.includes('криз') || q.includes('невизначен') || q.includes('сенс') || q.includes('застряг')) return '🧭 Кризовий стан та сенси';
      if (q.includes('цін') || q.includes('кошту') || q.includes('вартість') || q.includes('оплат') || q.includes('запис') || q.includes('формат') || q.includes('зустріч')) return '💰 Вартість, формат та запис';
      return '💬 Інші психологічні теми';
    }

    allEvents.forEach(row => {
      let meta = {};
      try { meta = JSON.parse(row.metadata || '{}'); } catch(e) {}

      const isBot = meta.isBot || false;
      if (isBot) {
        bots++;
      } else {
        if (row.visitor_id && !countedVisitors.has(row.visitor_id)) {
          countedVisitors.add(row.visitor_id);
          humans++;
        }
        if (row.source) {
          sourcesMap[row.source] = (sourcesMap[row.source] || 0) + 1;
        }
        if (row.device) {
          devicesMap[row.device] = (devicesMap[row.device] || 0) + 1;
        }
      }

      if (row.event_type === 'page_view') pageViews++;
      if (row.event_type === 'tg_click' || row.event_type === 'booking_click') tgClicks++;

      let actionTitle = 'Перегляд сайту';
      if (row.event_type === 'tg_click') actionTitle = 'Клік у Telegram 💬';
      if (row.event_type === 'booking_click') actionTitle = 'Запис на час 📅';
      if (row.event_type === 'quiz_completed') actionTitle = 'Пройдено опитування стану 🧭';
      if (row.event_type === 'instagram_click') actionTitle = 'Перехід в Instagram 📸';
      if (row.event_type === 'audio_play') actionTitle = 'Прослуховування аудіо 🎙️';
      if (row.event_type === 'chat_open') actionTitle = 'Чат з AI-асистентом 🤖';
      if (row.event_type === 'chat_message') actionTitle = 'Питання в AI-чат 💬';

      const raw = meta.rawMeta || {};
      const cityStr = meta.city ? `${meta.city}, ${meta.country || 'UA'}` : 'Україна';
      const timeStr = meta.time || row.created_at?.substring(11, 19) || '--:--';
      const dateStr = meta.date || row.created_at?.substring(0, 10) || '';

      // Process Chat Messages
      if (row.event_type === 'chat_message') {
        const question = raw.question || raw.message || meta.question || meta.message || '';
        const reply = raw.reply || meta.reply || '';
        const topic = raw.topic || categorizeTopic(question);
        
        if (question) {
          chatInquiries.push({
            id: row.id,
            question: question,
            reply: reply,
            topic: topic,
            city: cityStr,
            device: row.device || 'Мобільний',
            time: timeStr,
            date: dateStr
          });

          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        }
      }

      // Process Quiz Submissions
      if (row.event_type === 'quiz_completed') {
        const focus = raw.focus || meta.focus || '';
        const symptom = raw.symptom || meta.symptom || '';
        const experience = raw.experience || meta.experience || '';
        const goal = raw.goal || meta.goal || '';

        if (focus || symptom) {
          quizSubmissions.push({
            id: row.id,
            focus: focus || 'Не вказано',
            symptom: symptom || 'Не вказано',
            experience: experience || 'Не вказано',
            goal: goal || 'Не вказано',
            city: cityStr,
            device: row.device || 'Мобільний',
            time: timeStr,
            date: dateStr
          });

          const quizTopic = categorizeTopic(focus);
          topicCounts[quizTopic] = (topicCounts[quizTopic] || 0) + 1;
        }
      }

      formattedEvents.push({
        id: row.id,
        type: isBot ? 'bot' : 'human',
        source: row.source || 'Прямий перехід',
        device: row.device || 'Мобільний',
        action: actionTitle,
        city: cityStr,
        time: timeStr,
        date: dateStr
      });
    });

    // Build Topic Analytics breakdown
    const totalTopicQueries = Object.values(topicCounts).reduce((a, b) => a + b, 0);
    const topicAnalytics = Object.keys(topicCounts).map(t => ({
      topic: t,
      count: topicCounts[t],
      percentage: totalTopicQueries > 0 ? Math.round((topicCounts[t] / totalTopicQueries) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    let registeredClients = [];
    try {
      const usersQuery = await env.DB.prepare(
        "SELECT id, name, email, picture, phone, telegram, preferred_format, therapy_goal, created_at, updated_at " +
        "FROM users ORDER BY id DESC LIMIT 100"
      ).all();
      registeredClients = usersQuery.results || [];
    } catch(e) {}

    const humanCount = Math.max(humans, countedVisitors.size);
    const convRate = humanCount > 0 ? ((tgClicks / humanCount) * 100).toFixed(1) : '0';

    return new Response(JSON.stringify({
      success: true,
      humans: humanCount,
      bots: bots,
      views: pageViews || humanCount,
      tgClicks: tgClicks,
      conversion: convRate,
      sources: sourcesMap,
      devices: devicesMap,
      events: formattedEvents,
      chatInquiries: chatInquiries,
      quizSubmissions: quizSubmissions,
      topicAnalytics: topicAnalytics,
      registeredClients: registeredClients,
      totalChats: chatInquiries.length,
      totalQuizzes: quizSubmissions.length,
      totalClients: registeredClients.length
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
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

