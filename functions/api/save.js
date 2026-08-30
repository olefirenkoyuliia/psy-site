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

    // 1. Update Cloudflare KV immediately if bound (0ms instant global propagation)
    if (env.SITE_KV) {
      try {
        await env.SITE_KV.put('site_data', JSON.stringify(data));
      } catch (e) {
        console.error('KV write error:', e);
      }
    }

    // 2. Commit to GitHub repository
    const ghToken = token || env.GITHUB_TOKEN;
    const owner = env.REPO_OWNER || 'olefirenkoyuliia';
    const repo = env.REPO_NAME || 'psy-site';

    let githubCommitStatus = 'skipped';
    if (ghToken) {
      const dataStr = JSON.stringify(data, null, 2);
      const utf8Bytes = new TextEncoder().encode(dataStr);
      let bin = '';
      for (let i = 0; i < utf8Bytes.length; i++) bin += String.fromCharCode(utf8Bytes[i]);
      const encoded = btoa(bin);

      // Get current SHA
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

      // Put to GitHub
      const putBody = { message: 'Update website data via Cloudflare Node API', content: encoded, branch: 'main' };
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

      // If audio included, push to audio/greeting.mp3
      if (audioBase64) {
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

        const aPutBody = { message: 'Update greeting.mp3 via Cloudflare Node API', content: rawAudioBase64, branch: 'main' };
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
      }
    }

    return new Response(JSON.stringify({ success: true, githubCommitStatus }), {
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
