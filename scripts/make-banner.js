#!/usr/bin/env node
'use strict';
// Generates partner banner ads with Kie.ai (Nano Banana Pro) from a campaign
// spec in banners/<campaign>.json and saves them as JPEGs under
// site/assets/banners/<campaign>-<format>-<n>.jpg at exact pixel sizes.
//
//   npm run banner -- thaw-max                 every format in the spec, 2 options each
//   npm run banner -- thaw-max --formats promo --count 1
//   npm run banner -- thaw-max --dry-run       print the prompts, call nothing
//
// Ads are square (1:1, 1200×1200): "promo" for the :::promo card and "cta" for
// the :::cta block, each with its own headline and button. A guide shows one by
// putting a line holding only
//   ![alt text](assets/banners/thaw-max-promo-1.jpg)
// inside the block; the page lays the square beside the copy. "wide" (21:9)
// exists for email headers and is not used on the site.
//
// Spec (banners/<campaign>.json): see banners/thaw-max.json. Text is rendered
// by the model, so every string must be short and spelled exactly as it should
// appear. Reference images are public URLs (the product photos on the store).
//
// API: same endpoints as make-cover.js (docs.kie.ai). Env: KIE_API_KEY.
const fs = require('fs');
const path = require('path');
const { ROOT, SITE_DIR, loadEnv } = require('./lib/config');
const png = require('./lib/png');
const jpeg = require('./lib/jpeg');

const API = 'https://api.kie.ai/api/v1';
const MODEL = 'nano-banana-pro';
const OUT_DIR = path.join(SITE_DIR, 'assets', 'banners');
const SPEC_DIR = path.join(ROOT, 'banners');
const QUALITY = 86;
const POLL_MS = 5000;
const TIMEOUT_MS = 8 * 60 * 1000;

// Output sizes. Squares show at 200px (promo) and 260px (CTA) beside the copy, full width on phones.
const SQUARE = 'The product photograph fills the top 52% of the image, edge to edge. The bottom 48% is a flat deep forest green (#1a4a1a) panel that holds all of the text, left-aligned, with generous margins.';
const FORMATS = {
  promo: { aspect: '1:1', width: 1200, height: 1200, layout: SQUARE },
  cta: { aspect: '1:1', width: 1200, height: 1200, layout: SQUARE },
  square: { aspect: '1:1', width: 1200, height: 1200, layout: SQUARE },
  wide: { aspect: '21:9', width: 1600, height: 686, layout: 'The product photograph fills the left 45% of the banner, edge to edge. The right 55% is a flat deep forest green (#1a4a1a) panel that holds all of the text, left-aligned, with generous margins.' }
};

function args() {
  const a = process.argv.slice(2); const o = { count: 2, formats: null, dryRun: false, resolution: '2K' };
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--count') o.count = Math.max(1, Math.min(4, parseInt(a[++i], 10) || 2));
    else if (k === '--formats') o.formats = String(a[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (k === '--resolution') o.resolution = String(a[++i] || '2K').toUpperCase();
    else if (k === '--dry-run') o.dryRun = true;
    else if (!k.startsWith('--') && !o.campaign) o.campaign = k;
  }
  return o;
}

function buildPrompt(spec, format, f) {
  const t = { ...spec.text, ...(spec.formats && spec.formats[format] ? spec.formats[format] : {}) };
  const refs = spec.refs || [];
  const lines = [
    `Digital advertising banner, ${f.aspect} aspect ratio, for the ${spec.brand} ${spec.product}. Clean, modern, editorial style, flat design, no gradients, no textures on the panel.`,
    f.layout,
    refs.length ? `Product photograph: ${spec.subject} Reproduce the product exactly as it appears in the reference image${refs.length > 1 ? 's' : ''}: same shape, same matte black finish, same shallow grooves, same rounded corners and corner hole. Natural window light, soft shadow.` : `Product photograph: ${spec.subject}`,
    'All text is in a bold geometric sans-serif typeface (League Spartan style), cream (#faf8f3) unless stated, crisp and perfectly legible, no text over the photograph. From top to bottom on the panel:',
    `1. A small kicker line: "${t.kicker}"`,
    `2. The headline, large, two lines at most: "${t.headline}"`,
    `3. The price block: "${t.price}" very large in gold (#a8871c); immediately to its right "${t.was}" about a third of the size in cream with a single clean strike-through line; then a small rounded gold (#a8871c) tag with white text "${t.save}".`,
    `4. One line: "${t.urgency}"`,
    `5. A rounded rectangle button in gold (#a8871c) with white text "${t.button}".`,
    `6. A small footer line in cream at 70% opacity: "${t.footer}"`,
    'Spell every word exactly as given, with no extra words, numbers, symbols, logos, badges or watermarks anywhere. No people, no hands, no faces.',
    spec.note ? `Direction: ${spec.note}` : ''
  ];
  return lines.filter(Boolean).join('\n');
}

async function api(pathname, init = {}) {
  const r = await fetch(`${API}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.KIE_API_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(60000)
  });
  const body = await r.json().catch(() => null);
  if (!r.ok || !body || body.code !== 200) throw new Error(`Kie.ai ${pathname} → HTTP ${r.status}: ${body ? (body.msg || JSON.stringify(body)) : 'no body'}`);
  return body.data;
}

async function createTask(prompt, spec, f, resolution) {
  const input = { prompt, aspect_ratio: f.aspect, resolution, output_format: 'png' };
  if (spec.refs && spec.refs.length) input.image_input = spec.refs;
  const data = await api('/jobs/createTask', { method: 'POST', body: JSON.stringify({ model: MODEL, input }) });
  if (!data || !data.taskId) throw new Error('createTask returned no taskId');
  return data.taskId;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForTask(taskId, label) {
  const start = Date.now(); let last = '';
  while (Date.now() - start < TIMEOUT_MS) {
    const d = await api(`/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);
    const state = d.state || '';
    if (state !== last) { process.stdout.write(`  ${label}: ${state}\n`); last = state; }
    if (state === 'success') {
      let urls = [];
      try { urls = JSON.parse(d.resultJson || '{}').resultUrls || []; } catch (e) { /* fallthrough */ }
      if (!urls.length) throw new Error(`${label}: success but no resultUrls`);
      return { url: urls[0], credits: d.creditsConsumed };
    }
    if (state === 'fail') throw new Error(`${label}: generation failed ${d.failCode || ''} ${d.failMsg || ''}`.trim());
    await sleep(POLL_MS);
  }
  throw new Error(`${label}: timed out (taskId ${taskId})`);
}

async function download(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`download failed HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// Decode the PNG, resize to the exact format size, encode as JPEG.
function toJpeg(buf, f) {
  let img = png.decode(buf);
  const from = { width: img.width, height: img.height };
  if (img.width !== f.width || img.height !== f.height) img = png.resize(img, f.width, f.height);
  return { jpg: jpeg.encode(img, QUALITY), from };
}

async function main() {
  loadEnv();
  const o = args();
  if (!o.campaign) { console.error('usage: npm run banner -- <campaign> [--formats wide,cta,square] [--count 2] [--dry-run]'); process.exit(1); }
  const specFile = path.join(SPEC_DIR, `${o.campaign}.json`);
  if (!fs.existsSync(specFile)) { console.error(`no such campaign: banners/${o.campaign}.json`); process.exit(1); }
  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  const formats = (o.formats || Object.keys(spec.formats || FORMATS)).filter(k => FORMATS[k]);
  if (!formats.length) { console.error(`no valid formats (choose from ${Object.keys(FORMATS).join(', ')})`); process.exit(1); }
  if (!o.dryRun && !process.env.KIE_API_KEY) { console.error('KIE_API_KEY is not set (put it in .env)'); process.exit(1); }

  const jobs = [];
  for (const format of formats) {
    const f = FORMATS[format];
    const prompt = buildPrompt(spec, format, f);
    console.log(`\n${format} (${f.aspect} → ${f.width}×${f.height}, ${o.count} option${o.count === 1 ? '' : 's'}):\n${'-'.repeat(60)}\n${prompt}\n${'-'.repeat(60)}`);
    if (o.dryRun) continue;
    for (let n = 1; n <= o.count; n++) jobs.push({ format, f, n, taskId: await createTask(prompt, spec, f, o.resolution) });
  }
  if (o.dryRun) return;
  jobs.forEach(j => console.log(`  ${j.format}-${j.n}: task ${j.taskId}`));

  const results = await Promise.all(jobs.map(j => waitForTask(j.taskId, `${j.format}-${j.n}`).then(r => ({ ...j, ...r }))));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('');
  for (const r of results) {
    const raw = await download(r.url);
    const { jpg, from } = toJpeg(raw, r.f);
    const name = `${o.campaign}-${r.format}-${r.n}.jpg`;
    fs.writeFileSync(path.join(OUT_DIR, name), jpg);
    console.log(`  site/assets/banners/${name}  ${(jpg.length / 1024).toFixed(0)} KB  (from ${from.width}×${from.height}${r.credits != null ? ', ' + r.credits + ' credits' : ''})`);
  }
  console.log(`\nUse an ad in a guide with a line holding only:  ![alt text](assets/banners/${o.campaign}-promo-1.jpg)`);
}

main().catch(e => { console.error('make-banner failed:', e.message); process.exit(1); });
