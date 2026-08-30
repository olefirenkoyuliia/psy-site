export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { data, token, audioBase64 } = body;

    if (!data) {
      return new Response(JSON.stringify({ error: 'Missing data payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const dataStr = JSON.stringify(data, null, 2);

    // 1. Write directly to Cloudflare D1 SQL Database (0ms instant execution)
    let d1Status = 'skipped';
    if (env.DB) {
      try {
        await env.DB.prepare(
          "INSERT INTO site_data (key, data, updated_at) VALUES ('main', ?, CURRENT_TIMESTAMP) " +
          "ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP"
        ).bind(dataStr).run();
        d1Status = 'success';
      } catch (e) {
        console.error('D1 write error:', e);
        d1Status = 'error: ' + e.message;
      }
    }

    // 2. Commit to GitHub repository in background as versioned backup
    const ghToken = token || env.GITHUB_TOKEN;
    const owner = env.REPO_OWNER || 'olefirenkoyuliia';
    const repo = env.REPO_NAME || 'psy-site';

    let githubCommitStatus = 'skipped';
    if (ghToken) {
      try {
        const utf8Bytes = new TextEncoder().encode(dataStr);
        let bin = '';
        for (let i = 0; i < utf8Bytes.length; i++) bin += String.fromCharCode(utf8Bytes[i]);
        const encoded = btoa(bin);

        const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data.json?t=${Date.now()}`;
        let sha = null;
        try {
          const getRes = await fetch(getUrl, {
            headers: { 'Authorization': `Bearer ${ghToken}`, 'User-Agent': 'Cloudflare-Worker' },
            cache: 'no-store'
          });
          if (getRes.ok) {
            const fileData = await getRes.json();
            sha = fileData.sha;
          }
        } catch (e) {}

        const putBody = { message: 'Update website data via Cloudflare D1 & Node API', content: encoded, branch: 'main' };
        if (sha) putBody.sha = sha;

        const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/data.json`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${ghToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Cloudflare-Worker'
          },
          body: JSON.stringify(putBody)
        });

        if (putRes.ok) {
          githubCommitStatus = 'success';
        } else {
          const errJson = await putRes.json().catch(() => ({}));
          githubCommitStatus = 'error: ' + (errJson.message || putRes.status);
        }
      } catch (e) {
        githubCommitStatus = 'error: ' + e.message;
      }

      // If audio included, push to audio/greeting.mp3
      if (audioBase64) {
        try {
          const rawAudioBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
          const audioUrl = `https://api.github.com/repos/${owner}/${repo}/contents/audio/greeting.mp3?t=${Date.now()}`;
          let audioSha = null;
          try {
            const aGet = await fetch(audioUrl, {
              headers: { 'Authorization': `Bearer ${ghToken}`, 'User-Agent': 'Cloudflare-Worker' },
              cache: 'no-store'
            });
            if (aGet.ok) {
              const aData = await aGet.json();
              audioSha = aData.sha;
            }
          } catch(e) {}

          const aPutBody = { message: 'Update greeting.mp3 via Cloudflare D1 & Node API', content: rawAudioBase64, branch: 'main' };
          if (audioSha) aPutBody.sha = audioSha;

          await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/audio/greeting.mp3`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${ghToken}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Cloudflare-Worker'
            },
            body: JSON.stringify(aPutBody)
          });
        } catch(e) {}
      }
    }

    return new Response(JSON.stringify({ success: true, d1Status, githubCommitStatus }), {
      headers: {
        'Content-Type': 'application/json',
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
