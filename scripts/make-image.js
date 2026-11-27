#!/usr/bin/env node
'use strict';
// Generates in-article photographs for a guide with Kie.ai (Nano Banana Pro) from
// a spec in images/<slug>.json and saves them as JPEGs under
// site/assets/guides/<slug>-<name>-<n>.jpg (1200 px wide).
//
//   npm run image -- <slug>                    every image in the spec, 1 option each
//   npm run image -- <slug> --only cookies --count 2
//   npm run image -- <slug> --dry-run          print the prompts, call nothing
//
// A guide shows one with a line holding only
//   ![alt text](assets/guides/<slug>-<name>-1.jpg)
// outside :::promo / :::cta; it renders full width in the article column.
//
// Spec: { "style": "...shared direction...", "images": [ { "name": "cookies", "aspect": "3:2", "prompt": "..." } ] }
// Never ask for real brand packaging or logos: describe products as unbranded.
// API: same endpoints as make-cover.js and make-banner.js (docs.kie.ai). Env: KIE_API_KEY.
const fs = require('fs');
const path = require('path');
const { ROOT, SITE_DIR, loadEnv } = require('./lib/config');
const png = require('./lib/png');
const jpeg = require('./lib/jpeg');

const API = 'https://api.kie.ai/api/v1';
const MODEL = 'nano-banana-pro';
const OUT_DIR = path.join(SITE_DIR, 'assets', 'guides');
const SPEC_DIR = path.join(ROOT, 'images');
const WIDTH = 1200;
const QUALITY = 84;
const POLL_MS = 5000;
const TIMEOUT_MS = 8 * 60 * 1000;
const RATIOS = { '3:2': [3, 2], '4:3': [4, 3], '16:9': [16, 9], '1:1': [1, 1], '2:3': [2, 3], '4:5': [4, 5] };

function args() {
  const a = process.argv.slice(2); const o = { count: 1, only: null, dryRun: false, resolution: '2K' };
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--count') o.count = Math.max(1, Math.min(4, parseInt(a[++i], 10) || 1));
    else if (k === '--only') o.only = String(a[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (k === '--resolution') o.resolution = String(a[++i] || '2K').toUpperCase();
    else if (k === '--dry-run') o.dryRun = true;
    else if (!k.startsWith('--') && !o.slug) o.slug = k;
  }
  return o;
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

async function main() {
  loadEnv();
  const o = args();
  if (!o.slug) { console.error('usage: npm run image -- <slug> [--only name,name] [--count 1] [--dry-run]'); process.exit(1); }
  const specFile = path.join(SPEC_DIR, `${o.slug}.json`);
  if (!fs.existsSync(specFile)) { console.error(`no spec: images/${o.slug}.json`); process.exit(1); }
  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  const images = (spec.images || []).filter(im => !o.only || o.only.includes(im.name));
  if (!images.length) { console.error('no images selected'); process.exit(1); }
  if (!o.dryRun && !process.env.KIE_API_KEY) { console.error('KIE_API_KEY is not set (put it in .env)'); process.exit(1); }

  const jobs = [];
  for (const im of images) {
    const aspect = RATIOS[im.aspect] ? im.aspect : '3:2';
    const prompt = [spec.style, im.prompt, 'No logos, no brand names, no readable packaging text, no watermarks. No people, no hands, no faces.'].filter(Boolean).join('\n');
    console.log(`\n${im.name} (${aspect}):\n${'-'.repeat(60)}\n${prompt}\n${'-'.repeat(60)}`);
    if (o.dryRun) continue;
    for (let n = 1; n <= o.count; n++) {
      const data = await api('/jobs/createTask', { method: 'POST', body: JSON.stringify({ model: MODEL, input: { prompt, aspect_ratio: aspect, resolution: o.resolution, output_format: 'png' } }) });
      jobs.push({ im, aspect, n, taskId: data.taskId });
    }
  }
  if (o.dryRun) return;
  const results = await Promise.allSettled(jobs.map(j => waitForTask(j.taskId, `${j.im.name}-${j.n}`).then(r => ({ ...j, ...r }))));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('');
  for (const res of results) {
    if (res.status !== 'fulfilled') { console.error('  ' + res.reason.message); continue; }
    const r = res.value;
    const resp = await fetch(r.url, { signal: AbortSignal.timeout(120000) });
    if (!resp.ok) { console.error(`  ${r.im.name}-${r.n}: download failed HTTP ${resp.status}`); continue; }
    let img = png.decode(Buffer.from(await resp.arrayBuffer()));
    const [w, h] = RATIOS[r.aspect];
    const from = `${img.width}×${img.height}`;
    img = png.resize(img, WIDTH, Math.round(WIDTH * h / w));
    const name = `${o.slug}-${r.im.name}-${r.n}.jpg`;
    const jpg = jpeg.encode(img, QUALITY);
    fs.writeFileSync(path.join(OUT_DIR, name), jpg);
    console.log(`  site/assets/guides/${name}  ${(jpg.length / 1024).toFixed(0)} KB  (from ${from}${r.credits != null ? ', ' + r.credits + ' credits' : ''})`);
  }
}

main().catch(e => { console.error('make-image failed:', e.message); process.exit(1); });
