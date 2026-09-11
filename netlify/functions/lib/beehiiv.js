'use strict';
// Shared helpers for the Netlify functions. Beehiiv API v2 only; the API key
// never leaves the server. Env: BEEHIIV_API_KEY, BEEHIIV_PUB_ID.

const API = 'https://api.beehiiv.com/v2';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) };
}

function parseBody(event) {
  try { return JSON.parse(event.body || '{}') || {}; } catch (e) { return null; }
}

// Browser requests must come from this site (or a local preview). Requests
// without an Origin header (curl, server to server) are allowed through.
function allowedOrigin(event) {
  const origin = event.headers && (event.headers.origin || event.headers.Origin);
  if (!origin) return true;
  const allowed = [process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL, process.env.SITE_URL]
    .filter(Boolean).map(u => u.replace(/\/+$/, ''));
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return allowed.includes(origin.replace(/\/+$/, ''));
}

// POST /publications/{id}<path>. Returns { ok, status, data }.
async function beehiiv(path, payload) {
  const { BEEHIIV_API_KEY, BEEHIIV_PUB_ID } = process.env;
  if (!BEEHIIV_API_KEY || !BEEHIIV_PUB_ID) throw new Error('BEEHIIV_API_KEY and BEEHIIV_PUB_ID must be set');
  const r = await fetch(`${API}/publications/${BEEHIIV_PUB_ID}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload)
  });
  let data = null;
  try { data = await r.json(); } catch (e) { /* empty body */ }
  return { ok: r.ok, status: r.status, data };
}

// GET /publications/{id}<path>. Returns { ok, status, data }.
async function beehiivGet(path) {
  const { BEEHIIV_API_KEY, BEEHIIV_PUB_ID } = process.env;
  const r = await fetch(`${API}/publications/${BEEHIIV_PUB_ID}${path}`, {
    headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}`, Accept: 'application/json' }
  });
  let data = null;
  try { data = await r.json(); } catch (e) { /* empty body */ }
  return { ok: r.ok, status: r.status, data };
}

function cleanSlug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80); }

function referrer(event) {
  const h = event.headers || {};
  const ref = h.referer || h.Referer || h.origin || h.Origin || '';
  return /^https?:\/\//.test(ref) ? ref.slice(0, 500) : undefined;
}

module.exports = { json, parseBody, allowedOrigin, beehiiv, beehiivGet, cleanSlug, referrer, EMAIL_RE };
