// Saves an opted-in (not yet verified) mobile number to the subscriber's
// Beehiiv custom fields: { email, phone } → phone + sms_consent ("pending YYYY-MM-DD").
// Upserts the subscriber via API v2 so the phone step works even if the gate
// request has not finished yet. The number is re-checked here as E.164
// ("+" then 8 to 15 digits, first digit 1-9) so the browser rules cannot be bypassed.
//
// One number, one subscriber: the phone index (Netlify Blobs, see lib/phones.js)
// is claimed atomically before anything is written to Beehiiv. A number held by
// a different email is refused with { error: "phone_taken" } (HTTP 409). The
// same email may re-submit or change its number; the old number is released.
//
// Netlify Functions v2 format (Request → Response): needed for strongly
// consistent Blobs reads and conditional writes.
//
// Env: BEEHIIV_API_KEY, BEEHIIV_PUB_ID. Optional: BEEHIIV_PHONE_FIELD and
// BEEHIIV_SMS_CONSENT_FIELD to use different custom field names.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { allowedOrigin, beehiiv, beehiivGet, EMAIL_RE } = require('./lib/beehiiv.js');
const { phoneIndex, ready, phoneKey, emailKey } = require('./lib/phones.js');

const PHONE_FIELD = process.env.BEEHIIV_PHONE_FIELD || 'phone';
const CONSENT_FIELD = process.env.BEEHIIV_SMS_CONSENT_FIELD || 'sms_consent';
const E164_RE = /^\+[1-9]\d{7,14}$/;

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method' });
  const headers = Object.fromEntries(req.headers);
  if (!allowedOrigin({ headers })) return json(403, { ok: false, error: 'origin' });
  let body;
  try { body = await req.json(); } catch (e) { return json(400, { ok: false, error: 'json' }); }
  if (!body || typeof body !== 'object') return json(400, { ok: false, error: 'json' });

  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').replace(/[\s()-]/g, '');
  if (!E164_RE.test(phone)) return json(400, { ok: false, error: 'phone' });
  // North American numbers (+1): area code and exchange must start with 2-9.
  if (phone.startsWith('+1') && !/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(phone)) return json(400, { ok: false, error: 'phone' });
  if (!EMAIL_RE.test(email) || email.length > 254) return json(400, { ok: false, error: 'email' });

  const consent = 'pending ' + new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const pk = phoneKey(phone), ek = emailKey(email);
  let claimed = false;
  try {
    const index = phoneIndex();
    await ready(index);

    // 1. Claim the number, or confirm it is already ours.
    const holder = await index.get(pk);
    if (holder && holder.email && holder.email !== email) return json(409, { ok: false, error: 'phone_taken' });
    if (!holder) {
      claimed = await index.claim(pk, { email, at: now });
      if (!claimed) {
        const winner = await index.get(pk);
        if (!winner || winner.email !== email) return json(409, { ok: false, error: 'phone_taken' });
      }
    }

    // 2. Save to Beehiiv (the record of truth).
    const r = await beehiiv('/subscriptions', {
      email,
      reactivate_existing: true,
      send_welcome_email: false,
      utm_source: 'guides',
      utm_medium: 'sms-optin',
      custom_fields: [
        { name: PHONE_FIELD, value: phone },
        { name: CONSENT_FIELD, value: consent }
      ]
    });
    if (!r.ok) {
      console.error('beehiiv phone-save failed', r.status, JSON.stringify(r.data));
      if (claimed) await index.del(pk);
      return json(502, { ok: false, error: 'beehiiv' });
    }
    // Beehiiv silently ignores custom fields that do not exist, so read the
    // record back and only report success when both values are stored.
    const check = await beehiivGet(`/subscriptions/by_email/${encodeURIComponent(email)}?expand[]=custom_fields`);
    const fields = (check.ok && check.data && check.data.data && check.data.data.custom_fields) || [];
    // The read-back lists display names ("Phone Number"), so compare normalised keys.
    const key = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const stored = name => fields.find(f => key(f.name) === key(name));
    const missing = [PHONE_FIELD, CONSENT_FIELD].filter(n => !stored(n));
    if (missing.length || stored(PHONE_FIELD).value !== phone) {
      console.error(`phone-save: value not stored. Missing or unchanged custom fields: ${missing.join(', ') || PHONE_FIELD}. Create them in Beehiiv (Audience → Custom fields) or set BEEHIIV_PHONE_FIELD / BEEHIIV_SMS_CONSENT_FIELD.`);
      if (claimed) await index.del(pk);
      return json(502, { ok: false, error: 'field_missing', missing });
    }

    // 3. Reverse entry; release any number this email held before.
    const previous = await index.get(ek);
    if (previous && previous.phone && previous.phone !== phone) {
      const old = await index.get(phoneKey(previous.phone));
      if (old && old.email === email) await index.del(phoneKey(previous.phone));
    }
    await index.set(ek, { phone, at: now });
    return json(200, { ok: true });
  } catch (e) {
    console.error('phone-save error', e);
    return json(500, { ok: false, error: 'server' });
  }
};
