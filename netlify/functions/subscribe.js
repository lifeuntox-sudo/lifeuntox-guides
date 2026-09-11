'use strict';
// The email gate posts here: { email, slug }. Creates (or returns) the
// subscriber in Beehiiv via API v2, tagged with utm_source=guides so the
// source of every gate signup is visible in Beehiiv. Double opt-in follows the
// publication's own setting. Env: BEEHIIV_API_KEY, BEEHIIV_PUB_ID.
const { json, parseBody, allowedOrigin, beehiiv, cleanSlug, referrer, EMAIL_RE } = require('./lib/beehiiv');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method' });
  if (!allowedOrigin(event)) return json(403, { ok: false, error: 'origin' });
  const body = parseBody(event);
  if (!body) return json(400, { ok: false, error: 'json' });

  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return json(400, { ok: false, error: 'email' });
  const slug = cleanSlug(body.slug);

  try {
    const r = await beehiiv('/subscriptions', {
      email,
      reactivate_existing: false,
      send_welcome_email: true,
      utm_source: 'guides',
      utm_medium: 'gate',
      utm_campaign: slug || 'library',
      referring_site: referrer(event)
    });
    if (!r.ok) {
      console.error('beehiiv subscribe failed', r.status, JSON.stringify(r.data));
      return json(502, { ok: false, error: 'beehiiv' });
    }
    const status = r.data && r.data.data && r.data.data.status;
    return json(200, { ok: true, status });
  } catch (e) {
    console.error('subscribe error', e);
    return json(500, { ok: false, error: 'server' });
  }
};
