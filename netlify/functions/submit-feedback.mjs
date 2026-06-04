function getFeedbackWebhook() {
  return process.env.FEEDBACK_WEBHOOK_URL || process.env.SLACK_FEEDBACK_WEBHOOK || '';
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function uploadScreenshot(base64) {
  if (!base64 || typeof base64 !== 'string') return null;

  const match = base64.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) return null;

  const buffer = Buffer.from(match[1], 'base64');
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('time', '72h');
  form.append('fileToUpload', blob, 'cpfsi-feedback.jpg');

  const hosts = [
    'https://litterbox.catbox.moe/resources/internals/api.php',
    'https://catbox.moe/user/api.php'
  ];

  for (const host of hosts) {
    try {
      const response = await fetch(host, { method: 'POST', body: form });
      if (!response.ok) continue;
      const url = (await response.text()).trim();
      if (url.startsWith('http')) return url;
    } catch (err) {
      /* try next host */
    }
  }

  return null;
}

async function postToFeedbackWebhook(payload) {
  const webhook = getFeedbackWebhook();
  if (!webhook) {
    throw new Error('FEEDBACK_WEBHOOK_URL is not configured.');
  }
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const text = await response.text().catch(function () {
      return '';
    });
    throw new Error('Webhook failed (' + response.status + '): ' + text);
  }
}

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json();
    const {
      version = 'unknown',
      name,
      comment,
      friendly = 'Selected item',
      technical = '',
      selector = '',
      page = '',
      url = '',
      screenshotBase64 = null
    } = body;

    if (!name || !comment) {
      return new Response(JSON.stringify({ ok: false, error: 'Name and comment are required.' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const screenshotUrl = await uploadScreenshot(screenshotBase64);

    const outbound = {
      type: 'cpfsi_prototype_feedback',
      version,
      name,
      comment,
      selected: friendly,
      technical,
      selector,
      page,
      url,
      screenshotUrl: screenshotUrl || null,
      submittedAt: new Date().toISOString()
    };

    await postToFeedbackWebhook(outbound);

    return new Response(
      JSON.stringify({ ok: true, screenshotUrl: screenshotUrl || null }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message || 'Server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
};
