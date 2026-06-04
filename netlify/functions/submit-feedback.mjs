function getSlackWebhook() {
  return process.env.SLACK_FEEDBACK_WEBHOOK || '';
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function slackEscape(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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

async function postToSlack(payload) {
  const webhook = getSlackWebhook();
  if (!webhook) {
    throw new Error('SLACK_FEEDBACK_WEBHOOK is not configured.');
  }
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  if (!response.ok || text !== 'ok') {
    throw new Error('Slack webhook failed: ' + text);
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

    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Prototype feedback (' + version + ')', emoji: true }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: '*From:*\n' + slackEscape(name) },
          { type: 'mrkdwn', text: '*Page:*\n' + slackEscape(page) }
        ]
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Selected:*\n' + slackEscape(friendly) }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Comment:*\n' + slackEscape(comment) }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Technical details*\n```' + slackEscape(technical) + '\n' + slackEscape(selector) + '```'
        }
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: '<' + url + '|Open page>' }]
      }
    ];

    const payload = {
      text:
        'CPFSI prototype feedback (' +
        version +
        ')\nFrom: ' +
        name +
        '\nPage: ' +
        page +
        '\nSelected: ' +
        friendly +
        '\nTechnical: ' +
        technical +
        '\nSelector: ' +
        selector +
        '\nURL: ' +
        url +
        (screenshotUrl ? '\nScreenshot: ' + screenshotUrl : '\nScreenshot: not attached') +
        '\n\nComment:\n' +
        comment,
      blocks
    };

    if (screenshotUrl) {
      payload.attachments = [
        {
          fallback: 'Screenshot of selected element',
          image_url: screenshotUrl,
          alt_text: friendly
        }
      ];
    }

    await postToSlack(payload);

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
