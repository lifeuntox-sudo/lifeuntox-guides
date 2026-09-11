'use strict';
// "Already a subscriber?" on the gate posts here: { email }. Looks the email
// up in Beehiiv and answers { ok:true, subscribed:true|false }. Only active or
// still-validating subscriptions count; the page unlocks on true.
const { json, parseBody, allowedOrigin, beehiivGet, EMAIL_RE } = require('./lib/beehiiv');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method' });
  if (!allowedOrigin(event)) return json(403, { ok: false, error: 'origin' });
  const body = parseBody(event);
  if (!body) return json(400, { ok: false, error: 'json' });
  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return json(400, { ok: false, error: 'email' });
  try {
    const r = await beehiivGet(`/subscriptions/by_email/${encodeURIComponent(email)}`);
    if (r.status === 404) return json(200, { ok: true, subscribed: false });
    if (!r.ok) { console.error('beehiiv lookup failed', r.status, JSON.stringify(r.data)); return json(502, { ok: false, error: 'beehiiv' }); }
    const status = r.data && r.data.data && r.data.data.status;
    return json(200, { ok: true, subscribed: status === 'active' || status === 'validating', status });
  } catch (e) {
    console.error('check-subscriber error', e);
    return json(500, { ok: false, error: 'server' });
  }
};
