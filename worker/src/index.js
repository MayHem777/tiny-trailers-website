// Tiny Trailers contact form handler.
// POST /api/contact (multipart or urlencoded form data) from https://www.tinytrailers.com.au
// → Turnstile siteverify → validation → email to info@ via Resend.
// Replies with JSON { ok: true } or { ok: false, error: "<code>" }; the page maps codes to messages.
// No dependencies, no build step.

const SUBJECT = 'New quote enquiry — Tiny Trailers website';
const MAX_BODY = 20000; // bytes; a real enquiry is well under 5 KB

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowed = list(env.ALLOWED_ORIGINS);
    const origin = request.headers.get('Origin') || '';
    const cors = allowed.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
      : { Vary: 'Origin' };

    if (url.pathname !== '/api/contact') return json({ ok: false, error: 'not_found' }, 404, cors);

    if (request.method === 'OPTIONS') {
      if (!allowed.includes(origin)) return new Response(null, { status: 403, headers: cors });
      return new Response(null, {
        status: 204,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Max-Age': '86400' },
      });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'method' }, 405, { ...cors, Allow: 'POST, OPTIONS' });
    }

    // Only the site's own pages may post. Browsers always send Origin on a cross-origin POST.
    if (!allowed.includes(origin)) return json({ ok: false, error: 'origin' }, 403, cors);

    const len = Number(request.headers.get('Content-Length') || 0);
    if (len > MAX_BODY) return json({ ok: false, error: 'too_large' }, 413, cors);

    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ ok: false, error: 'bad_request' }, 400, cors);
    }
    const f = (k, max) => clean(form.get(k), max);

    // Honeypot: hidden from people, filled by bots.
    if (f('_honey', 500)) return json({ ok: false, error: 'rejected' }, 400, cors);

    const token = f('cf-turnstile-response', 4096);
    if (!token) return json({ ok: false, error: 'captcha' }, 400, cors);
    const ts = await verifyTurnstile(env, token, request.headers.get('CF-Connecting-IP'));
    if (!ts.ok) {
      console.log('turnstile failed', JSON.stringify(ts.detail));
      return json({ ok: false, error: 'captcha' }, 400, cors);
    }

    const e = {
      name: f('name', 100),
      phone: f('phone', 30),
      email: f('email', 200),
      trailer: f('trailer', 100),
      size: f('size', 100),
      message: f('message', 5000, true),
    };
    const problem = validate(e);
    if (problem) return json({ ok: false, error: problem }, 400, cors);

    const sent = await sendEmail(env, e);
    if (!sent.ok) {
      console.log('resend failed', sent.status, sent.body);
      return json({ ok: false, error: 'send_failed' }, 502, cors);
    }
    return json({ ok: true }, 200, cors);
  },
};

export function validate(e) {
  if (!e.name) return 'name';
  if (isJunk(e.name) || isJunk(e.message)) return 'junk';
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(e.email)) return 'email';
  if (e.phone && !isAuPhone(e.phone)) return 'phone';
  return '';
}

// Same rule as the page: 10 digits starting 0, or +61/61 without the 0; prefix 2, 3, 4, 7 or 8.
export function isAuPhone(raw) {
  const d = raw.replace(/[\s().-]/g, '');
  return /^(?:\+?61|0)[23478]\d{8}$/.test(d);
}

// A name or message that is one long run of letters/digits with no spaces is a bot,
// e.g. "kJhGfDsAqWeRtYuI". Short single words ("Mitch", "Hi") are fine.
export function isJunk(s) {
  return !!s && !/\s/.test(s) && /^[A-Za-z0-9]{15,}$/.test(s);
}

async function verifyTurnstile(env, token, ip) {
  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET || '');
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  let r;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    r = await res.json();
  } catch (err) {
    return { ok: false, detail: String(err) };
  }
  const hosts = list(env.TURNSTILE_HOSTNAMES);
  const hostOk = !hosts.length || hosts.includes(r.hostname);
  return { ok: r.success === true && hostOk, detail: { codes: r['error-codes'], hostname: r.hostname } };
}

async function sendEmail(env, e) {
  const rows = [
    ['Name', e.name],
    ['Phone', e.phone],
    ['Email', e.email],
    ['Trailer type', e.trailer],
    ['Size', e.size],
    ['Message', e.message],
  ];
  const text =
    rows.map(([k, v]) => (k === 'Message' ? `\n${k}:\n${v || '—'}` : `${k}: ${v || '—'}`)).join('\n') +
    '\n\nSent from the contact form on www.tinytrailers.com.au. Reply to this email to answer the enquirer.\n';
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#222">' +
    '<h2 style="margin:0 0 12px;font-size:18px">New quote enquiry</h2>' +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    rows
      .map(
        ([k, v]) =>
          `<tr><td style="vertical-align:top;font-weight:bold;white-space:nowrap">${k}</td>` +
          `<td style="white-space:pre-wrap">${esc(v) || '—'}</td></tr>`,
      )
      .join('') +
    '</table><p style="color:#777;font-size:12px;margin-top:16px">Sent from the contact form on ' +
    'www.tinytrailers.com.au. Reply to this email to answer the enquirer.</p></div>';

  let res;
  try {
    res = await fetch(env.RESEND_API_URL || 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [env.MAIL_TO],
        reply_to: e.email,
        subject: SUBJECT,
        text,
        html,
      }),
    });
  } catch (err) {
    return { ok: false, status: 0, body: String(err) };
  }
  return { ok: res.ok, status: res.status, body: res.ok ? '' : (await res.text()).slice(0, 500) };
}

function clean(v, max, multiline = false) {
  if (typeof v !== 'string') return '';
  let s = v.replace(multiline ? /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, ' ');
  s = s.trim();
  return s.length > max ? s.slice(0, max) : s;
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function list(v) {
  return String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function json(obj, status, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}
