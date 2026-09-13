'use strict';
// Phone → email index so one mobile number can belong to only one subscriber.
// Beehiiv stays the record of truth (the number lives in the subscriber's
// custom fields); this index only answers "who already holds this number?",
// which Beehiiv's API cannot. It lives in Netlify Blobs (store "phones") on
// the deployed site. In local `npm run dev` (no Netlify runtime), a JSON file
// under .netlify/ stands in so the behaviour can be tested.
//
// Keys: the E.164 number ("+447700900123") → { email, at }, and
//       "email:<address>" → { phone, at } for the reverse lookup.
// Rebuild from Beehiiv at any time with: npm run phone-index
const fs = require('fs');
const path = require('path');

const STORE = 'phones';
// True inside a deployed Netlify function (AWS Lambda runtime). There the
// Blobs store is mandatory: no silent fallback, so duplicates can never slip through.
const ON_LAMBDA = !!(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);

// Lambda-compatible handlers must hand the event to @netlify/blobs once per
// invocation so it can find the Blobs context. Call at the top of the handler.
function connect(event) {
  try {
    const { connectLambda } = require('@netlify/blobs');
    if (event && typeof connectLambda === 'function') connectLambda(event);
  } catch (e) {
    if (ON_LAMBDA) throw e;
  }
}

function fileStore() {
  const file = path.join(__dirname, '..', '..', '..', '.netlify', 'blobs-local', STORE + '.json');
  const read = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return {}; } };
  const write = d => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(d, null, 2)); };
  return {
    kind: 'file',
    async get(k) { return read()[k] || null; },
    async set(k, v) { const d = read(); d[k] = v; write(d); },
    async del(k) { const d = read(); delete d[k]; write(d); },
    async list() { return Object.keys(read()); }
  };
}

function blobStore() {
  const { getStore } = require('@netlify/blobs');
  const opts = { name: STORE, consistency: 'strong' };
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_AUTH_TOKEN) { opts.siteID = process.env.NETLIFY_SITE_ID; opts.token = process.env.NETLIFY_AUTH_TOKEN; }
  const s = getStore(opts);
  return {
    kind: 'blobs',
    async get(k) { return s.get(k, { type: 'json' }); },
    async set(k, v) { return s.setJSON(k, v); },
    async del(k) { return s.delete(k); },
    async list() { const r = await s.list(); return r.blobs.map(b => b.key); }
  };
}

let cached = null;
function phoneIndex() {
  if (cached) return cached;
  if (ON_LAMBDA) { cached = blobStore(); return cached; }
  try { cached = blobStore(); } catch (e) { cached = fileStore(); }
  return cached;
}

// Probes the store once. Off Netlify, an unreachable Blobs store falls back to
// the local file; on Netlify it throws so the caller answers 500, not "ok".
async function ready(index) {
  try { await index.get('__probe__'); return true; } catch (e) {
    if (!ON_LAMBDA && index.kind === 'blobs') { cached = fileStore(); return true; }
    throw e;
  }
}

module.exports = { phoneIndex, ready, connect, STORE, ON_LAMBDA };
