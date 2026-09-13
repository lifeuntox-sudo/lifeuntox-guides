'use strict';
// Per-IP rate limit for the functions, enforced in code so it works whether
// or not Netlify's edge rule is applied. Fixed window: `limit` requests per
// `windowSeconds` per IP per bucket. State lives in the Netlify Blobs store
// "ratelimit" (one key per bucket + IP, overwritten every window, so the store
// stays small). Off Netlify (local `npm run dev`) there is no store and the
// limiter allows everything.
//
// Usage in a Functions v2 handler:
//   const hit = await rateLimit(req, 'subscribe', 10, 60);
//   if (hit) return hit;   // a 429 Response
const ON_LAMBDA = !!(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);

let store = null;
function getRateStore() {
  if (store) return store;
  const { getStore } = require('@netlify/blobs');
  store = getStore({ name: 'ratelimit', consistency: 'strong' });
  return store;
}

function clientIp(req) {
  const h = req.headers;
  return (h.get('x-nf-client-connection-ip') || (h.get('x-forwarded-for') || '').split(',')[0] || 'unknown').trim();
}

async function rateLimit(req, bucket, limit, windowSeconds) {
  if (!ON_LAMBDA) return null;
  try {
    const s = getRateStore();
    const key = `${bucket}:${clientIp(req)}`;
    const now = Math.floor(Date.now() / 1000);
    const win = now - (now % windowSeconds);
    const cur = (await s.get(key, { type: 'json' })) || { w: 0, n: 0 };
    const n = cur.w === win ? cur.n + 1 : 1;
    await s.setJSON(key, { w: win, n });
    if (n > limit) {
      const retry = win + windowSeconds - now;
      return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'retry-after': String(Math.max(1, retry)) }
      });
    }
    return null;
  } catch (e) {
    // The limiter must never take the site down; log and allow.
    console.error('rate limiter unavailable', e && e.message);
    return null;
  }
}

module.exports = { rateLimit, clientIp };
