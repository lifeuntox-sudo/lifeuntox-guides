#!/usr/bin/env node
'use strict';
// Rebuilds the phone → email index (Netlify Blobs store "phones") from Beehiiv,
// the record of truth. Use after importing numbers into Beehiiv by hand, or if
// the index is ever lost. Scans every subscription (about 100 per request).
//
//   NETLIFY_SITE_ID=46389cc1-d849-421c-a0ef-21223e9e5ec5 NETLIFY_AUTH_TOKEN=... node scripts/phone-index-rebuild.js
//   (get a token with: npx netlify-cli login, then npx netlify-cli api getCurrentUser — or create a
//    personal access token at app.netlify.com/user/applications)
//   add --dry-run to only report what would be written.
const { loadEnv } = require('./lib/config');
loadEnv();
const { phoneIndex, ready } = require('../netlify/functions/lib/phones');

const PHONE_FIELD = process.env.BEEHIIV_PHONE_FIELD || 'phone';
const key = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const dry = process.argv.includes('--dry-run');

async function* subscriptions() {
  const base = `https://api.beehiiv.com/v2/publications/${process.env.BEEHIIV_PUB_ID}/subscriptions`;
  let cursor = '';
  for (;;) {
    const url = `${base}?limit=100&expand[]=custom_fields${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.BEEHIIV_API_KEY}` } });
    if (!r.ok) throw new Error(`Beehiiv HTTP ${r.status}`);
    const j = await r.json();
    for (const s of j.data || []) yield s;
    cursor = j.next_cursor || (j.pagination && j.pagination.next_cursor) || '';
    if (!cursor || !(j.data || []).length) return;
  }
}

(async () => {
  if (!process.env.BEEHIIV_API_KEY || !process.env.BEEHIIV_PUB_ID) throw new Error('BEEHIIV_API_KEY and BEEHIIV_PUB_ID are required (.env)');
  const index = phoneIndex();
  await ready(index);
  console.log(`index store: ${index.kind}${dry ? ' (dry run)' : ''}`);
  const seen = new Map(); let scanned = 0, withPhone = 0, dupes = 0;
  for await (const s of subscriptions()) {
    scanned++;
    if (s.status !== 'active' && s.status !== 'validating') continue;
    const f = (s.custom_fields || []).find(c => key(c.name) === key(PHONE_FIELD));
    const phone = f && String(f.value || '').replace(/[\s()-]/g, '');
    if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) continue;
    withPhone++;
    const email = String(s.email).toLowerCase();
    if (seen.has(phone)) { dupes++; console.log(`  duplicate ${phone}: kept ${seen.get(phone)}, also on ${email} (created later or same time)`); continue; }
    seen.set(phone, email);
    if (!dry) { await index.set(phone, { email, at: new Date(s.created * 1000).toISOString() }); await index.set('email:' + email, { phone, at: new Date(s.created * 1000).toISOString() }); }
    if (scanned % 1000 === 0) console.log(`  scanned ${scanned}…`);
  }
  console.log(`scanned ${scanned} subscriptions, ${withPhone} with a phone, ${seen.size} unique numbers written, ${dupes} duplicates left for you to resolve in Beehiiv.`);
})().catch(e => { console.error('rebuild failed:', e.message); process.exit(1); });
