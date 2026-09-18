// Newsletter signup and the "already a subscriber?" check, one endpoint:
//   { email, slug }          → creates (or returns) the subscriber in Beehiiv via API v2,
//                              tagged utm_source=guides so the source is visible in Beehiiv.
//                              Double opt-in follows the publication's own setting.
//   { email, check: true }   → { ok:true, subscribed:true|false }; only active or
//                              still-validating subscriptions count.
// Both modes share one Netlify rate limit (the Free plan allows two code-based
// rules per project; phone-save uses the other). Env: BEEHIIV_API_KEY, BEEHIIV_PUB_ID,
// BEEHIIV_AUTOMATION_IDS (comma-separated aut_… ids; every automation listed must
// carry the "Add by API" trigger in Beehiiv, or Beehiiv ignores it). Subscribers
// created through the API do not fire Beehiiv's "signup" trigger, so this is how
// guide-site signups enter the onboarding automations.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { jsonResponse: json, readJson, isBot, allowedOrigin, beehiiv, beehiivGet, cleanSlug, referrer, EMAIL_RE } = require('./lib/beehiiv.js');
const { rateLimit } = require('./lib/ratelimit.js');

// Automations to enrol every new subscriber in (see the note above).
const AUTOMATION_IDS = String(process.env.BEEHIIV_AUTOMATION_IDS || '').split(',').map(s => s.trim()).filter(s => /^aut_[0-9a-f-]{36}$/.test(s));

export const config = {
  path: '/.netlify/functions/subscribe',
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method' });
  if (!allowedOrigin({ headers: req.headers })) return json(403, { ok: false, error: 'origin' });
  const limited = await rateLimit(req, 'subscribe', 10, 60);
  if (limited) return limited;
  const body = await readJson(req);
  if (!body) return json(400, { ok: false, error: 'json' });

  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return json(400, { ok: false, error: 'email' });
  if (isBot(body)) return json(200, body.check ? { ok: true, subscribed: false } : { ok: true, status: 'pending' });

  try {
    if (body.check === true) {
      const r = await beehiivGet(`/subscriptions/by_email/${encodeURIComponent(email)}`);
      if (r.status === 404) return json(200, { ok: true, subscribed: false });
      if (!r.ok) { console.error('beehiiv lookup failed', r.status, JSON.stringify(r.data)); return json(502, { ok: false, error: 'beehiiv' }); }
      const status = r.data && r.data.data && r.data.data.status;
      return json(200, { ok: true, subscribed: status === 'active' || status === 'validating' });
    }

    const slug = cleanSlug(body.slug);
    const r = await beehiiv('/subscriptions', {
      email,
      reactivate_existing: false,
      send_welcome_email: true,
      utm_source: 'guides',
      utm_medium: 'gate',
      utm_campaign: slug || 'library',
      referring_site: referrer({ headers: req.headers }),
      ...(AUTOMATION_IDS.length ? { automation_ids: AUTOMATION_IDS } : {})
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
