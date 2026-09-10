// Cloudflare Pages Function: /api/tiktok
// Dynamically serves live TikTok profile and video feed for @yulia_psychologist_

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const username = url.searchParams.get('user') || 'yulia_psychologist_';

  // 1. Try fetching creator oembed from TikTok
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${username}`;
    const tiktokRes = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    let creatorData = null;
    if (tiktokRes.ok) {
      creatorData = await tiktokRes.json();
    }

    const payload = {
      username: username,
      profileUrl: `https://www.tiktok.com/@${username}`,
      creatorHtml: creatorData?.html || `<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@${username}" data-unique-id="${username}" data-embed-from="oembed" data-embed-type="creator" style="max-width:780px; min-width:288px; width:100%;"><section><a target="_blank" href="https://www.tiktok.com/@${username}?refer=creator_embed">@${username}</a></section></blockquote>`,
      title: creatorData?.title || `Психолог Юлія Олефіренко (@${username})`,
      updatedAt: new Date().toISOString()
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      username: username,
      profileUrl: `https://www.tiktok.com/@${username}`,
      creatorHtml: `<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@${username}" data-unique-id="${username}" data-embed-from="oembed" data-embed-type="creator" style="max-width:780px; min-width:288px; width:100%;"><section><a target="_blank" href="https://www.tiktok.com/@${username}?refer=creator_embed">@${username}</a></section></blockquote>`,
      error: err.message
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
