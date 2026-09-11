#!/usr/bin/env node
'use strict';
// Generates cover options for a guide with Kie.ai (Nano Banana Pro), saves
// them as site/assets/covers/<slug>-1.png, -2.png, -3.png at exactly 1200×1600,
// and sets `cover` (frontmatter + guides.json) to -1 so you can swap.
//
//   npm run cover -- <slug>
//   npm run cover -- <slug> --count 3 --resolution 2K --note "less shadow, warmer green"
//   npm run cover -- <slug> --dry-run        print the prompt, call nothing
//   npm run cover -- <slug> --no-logo        skip the wordmark reference upload
//   npm run cover -- <slug> --no-style       skip the house-style reference (templates/cover-reference.png)
//
// API (docs.kie.ai, read 2026-09-11):
//   POST https://api.kie.ai/api/v1/jobs/createTask   { model:"nano-banana-pro", input:{ prompt, image_input[], aspect_ratio, resolution, output_format } }
//   GET  https://api.kie.ai/api/v1/jobs/recordInfo?taskId=…   data.state ∈ waiting|queuing|generating|success|fail; data.resultJson → {"resultUrls":[…]}
//   POST https://kieai.redpandaai.co/api/file-base64-upload   { base64Data, uploadPath, fileName } → data.fileUrl (temporary, ~24h)
// Env: KIE_API_KEY
const fs = require('fs');
const path = require('path');
const { CONTENT_DIR, COVERS_DIR, SITE_DIR, TEMPLATES_DIR, loadEnv } = require('./lib/config');
const { parseFrontmatter, setFrontmatterField } = require('./lib/frontmatter');
const guidesDb = require('./lib/guides');
const png = require('./lib/png');

const API = 'https://api.kie.ai/api/v1';
// Documented host first; the older host is kept as a fallback because the docs list both.
const UPLOAD_APIS = ['https://api.kie.ai/api/file-base64-upload', 'https://kieai.redpandaai.co/api/file-base64-upload'];
const MODEL = 'nano-banana-pro';
// The approved cover (chicken guide, option 2) that every new cover must match in style.
const STYLE_REFERENCE = path.join(TEMPLATES_DIR, 'cover-reference.png');
const TARGET = { width: 1200, height: 1600 };
const POLL_MS = 5000;
const TIMEOUT_MS = 8 * 60 * 1000;

const GENERIC_SUBJECT = {
  'Water': 'a clear glass of water on a light stone counter',
  'Kitchen': 'a stainless steel skillet on a wooden board',
  'Home': 'a folded linen towel and a small potted plant on a wooden shelf',
  'Personal care': 'an unlabelled amber glass bottle beside a sprig of eucalyptus',
  'Family': 'a wooden baby toy on a soft cream blanket',
  'Food': 'fresh produce on a wooden board'
};

function args() {
  const a = process.argv.slice(2); const o = { count: 3, resolution: '2K', logo: true, style: true, dryRun: false, note: '' };
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--count') o.count = Math.max(1, Math.min(6, parseInt(a[++i], 10) || 3));
    else if (k === '--resolution') o.resolution = String(a[++i] || '2K').toUpperCase();
    else if (k === '--note') o.note = a[++i] || '';
    else if (k === '--no-logo') o.logo = false;
    else if (k === '--no-style') o.style = false;
    else if (k === '--dry-run') o.dryRun = true;
    else if (!k.startsWith('--') && !o.slug) o.slug = k;
  }
  return o;
}

function buildPrompt(fm, opts) {
  const subject = fm.cover_subject || GENERIC_SUBJECT[fm.cat] || 'a single clean object related to the topic';
  const refs = [];
  if (opts.logoUrl) refs.push('wordmark');
  if (opts.styleUrl) refs.push('style');
  const refNo = name => refs.indexOf(name) + 1;
  const lines = [
    'Product photograph of one photoreal 3D hardcover book standing upright on a plain pure white background, turned about 15 degrees to the left so a sliver of the spine shows on the left, soft studio lighting, a soft natural shadow beneath the book, no other objects, the book fills most of the frame.',
    opts.styleUrl
      ? `Reference image ${refNo('style')} is an approved Lifeuntox cover. Match it exactly in book angle, lighting, shadow, cover layout, typography, type sizes, colours and the split between the green panel and the photograph. Only the title, subtitle, badge text and the photographic subject change.`
      : '',
    'Front cover design, top to bottom:',
    opts.logoUrl
      ? `1. At the top, small and centred, the Lifeuntox wordmark exactly as shown in reference image ${refNo('wordmark')} (reproduce it faithfully in cream, do not redraw or restyle it).`
      : '1. At the top, small and centred, the word "Lifeuntox" as a clean modern wordmark in cream.',
    `2. The title "${String(fm.title).toUpperCase()}" very large, uppercase, in a bold geometric sans-serif typeface, cream on deep forest green (#1a4a1a).`,
    `3. Directly beneath the title, the subtitle "${fm.sub}" in a lighter weight of the same typeface, cream.`,
    `4. The lower half of the cover is one clean photographic subject: ${subject}, photographed cleanly with natural light.`,
    fm.badge ? `5. A small circular leaf-green (#7cb342) sticker in the top-right corner of the cover with the text "${fm.badge}" in white.` : '',
    'Palette strictly: deep forest green, cream, and one warm gold accent (#a8871c). Hardcover with a matte finish.',
    'No other logos, no people, no faces, no hands, no extra words, labels or numbers anywhere, no watermark. Spell every word exactly as given.',
    (opts.note || fm.cover_note) ? `Direction: ${[opts.note, fm.cover_note].filter(Boolean).join('. ')}.` : ''
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

async function uploadImage(file, fileName) {
  const b64 = fs.readFileSync(file).toString('base64');
  let lastErr = '';
  for (const endpoint of UPLOAD_APIS) {
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.KIE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data: `data:image/png;base64,${b64}`, uploadPath: 'lifeuntox', fileName }),
        signal: AbortSignal.timeout(60000)
      });
      const body = await r.json().catch(() => null);
      const url = body && body.data && (body.data.downloadUrl || body.data.fileUrl);
      if (r.ok && url) return url;
      lastErr = `HTTP ${r.status} ${body ? JSON.stringify(body).slice(0, 200) : ''} at ${endpoint}`;
    } catch (e) { lastErr = `${e.message} at ${endpoint}`; }
  }
  throw new Error(`upload of ${fileName} failed: ${lastErr}`);
}

async function createTask(prompt, opts) {
  const input = { prompt, aspect_ratio: '3:4', resolution: opts.resolution, output_format: 'png' };
  const images = [opts.logoUrl, opts.styleUrl].filter(Boolean);   // order matches the prompt's reference numbering
  if (images.length) input.image_input = images;
  const data = await api('/jobs/createTask', { method: 'POST', body: JSON.stringify({ model: MODEL, input }) });
  if (!data || !data.taskId) throw new Error('createTask returned no taskId');
  return data.taskId;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForTask(taskId, label) {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < TIMEOUT_MS) {
    const d = await api(`/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);
    const state = d.state || '';
    if (state !== last) { process.stdout.write(`  ${label}: ${state}${d.progress ? ' ' + d.progress + '%' : ''}\n`); last = state; }
    if (state === 'success') {
      let urls = [];
      try { urls = JSON.parse(d.resultJson || '{}').resultUrls || []; } catch (e) { /* fallthrough */ }
      if (!urls.length) throw new Error(`${label}: success but no resultUrls (${d.resultJson})`);
      return { url: urls[0], credits: d.creditsConsumed, ms: d.costTime };
    }
    if (state === 'fail') throw new Error(`${label}: generation failed ${d.failCode || ''} ${d.failMsg || ''}`.trim());
    await sleep(POLL_MS);
  }
  throw new Error(`${label}: timed out after ${TIMEOUT_MS / 60000} minutes (taskId ${taskId})`);
}

async function download(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`download failed HTTP ${r.status} for ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

function toTargetSize(buf) {
  const dim = png.dimensions(buf);
  if (dim.width === TARGET.width && dim.height === TARGET.height) return { buf, from: dim, resized: false };
  const img = png.resize(png.decode(buf), TARGET.width, TARGET.height);
  return { buf: png.encode(img), from: dim, resized: true };
}

async function main() {
  loadEnv();
  const opts = args();
  if (!opts.slug) { console.error('usage: npm run cover -- <slug> [--count 3] [--resolution 1K|2K|4K] [--note "…"] [--no-logo] [--dry-run]'); process.exit(1); }
  const file = path.join(CONTENT_DIR, `${opts.slug}.md`);
  if (!fs.existsSync(file)) { console.error(`no such guide: content/${opts.slug}.md`); process.exit(1); }
  const src = fs.readFileSync(file, 'utf8');
  const { data: fm } = parseFrontmatter(src);
  fm.slug = opts.slug;

  if (!opts.dryRun && !process.env.KIE_API_KEY) { console.error('KIE_API_KEY is not set (put it in .env)'); process.exit(1); }

  const logoFile = path.join(SITE_DIR, 'assets', 'lifeuntox-logo.png');
  const useStyle = opts.style && fs.existsSync(STYLE_REFERENCE);
  if (opts.style && !useStyle) console.warn('warning: templates/cover-reference.png not found; generating without the house-style reference');
  if (opts.dryRun) {
    if (opts.logo) opts.logoUrl = '(uploaded at run time)';
    if (useStyle) opts.styleUrl = '(uploaded at run time)';
  } else {
    if (opts.logo) {
      try { opts.logoUrl = await uploadImage(logoFile, 'lifeuntox-logo.png'); console.log('wordmark reference uploaded'); }
      catch (e) { console.warn(`warning: ${e.message}; continuing without the wordmark reference`); }
    }
    if (useStyle) {
      try { opts.styleUrl = await uploadImage(STYLE_REFERENCE, 'cover-reference.png'); console.log('house-style reference uploaded'); }
      catch (e) { console.warn(`warning: ${e.message}; continuing without the house-style reference`); }
    }
  }

  const prompt = buildPrompt(fm, opts);
  console.log(`\nPrompt for ${opts.slug} (${opts.resolution}, 3:4, ${opts.count} option${opts.count === 1 ? '' : 's'}):\n${'-'.repeat(60)}\n${prompt}\n${'-'.repeat(60)}\n`);
  if (opts.dryRun) return;

  console.log(`creating ${opts.count} task${opts.count === 1 ? '' : 's'}…`);
  const tasks = [];
  for (let i = 1; i <= opts.count; i++) tasks.push({ n: i, taskId: await createTask(prompt, opts) });
  tasks.forEach(t => console.log(`  option ${t.n}: task ${t.taskId}`));

  const results = await Promise.all(tasks.map(t => waitForTask(t.taskId, `option ${t.n}`).then(r => ({ ...t, ...r }))));

  fs.mkdirSync(COVERS_DIR, { recursive: true });
  const written = [];
  for (const r of results) {
    const raw = await download(r.url);
    const { buf, from, resized } = toTargetSize(raw);
    const out = path.join(COVERS_DIR, `${opts.slug}-${r.n}.png`);
    fs.writeFileSync(out, buf);
    written.push({ n: r.n, out, size: buf.length, from, resized, credits: r.credits });
  }

  const cover = `assets/covers/${opts.slug}-1.png`;
  fs.writeFileSync(file, setFrontmatterField(src, 'cover', cover));
  const guides = guidesDb.load();
  const g = guides.find(x => x.slug === opts.slug);
  if (g) { g.cover = cover; guidesDb.save(guides); }

  console.log('');
  for (const w of written) {
    console.log(`  site/assets/covers/${opts.slug}-${w.n}.png  ${(w.size / 1024 / 1024).toFixed(2)} MB  (from ${w.from.width}×${w.from.height}${w.resized ? ', resized to 1200×1600' : ''}${w.credits != null ? ', ' + w.credits + ' credits' : ''})`);
  }
  console.log(`\ncover set to ${cover} in content/${opts.slug}.md and guides.json.`);
  console.log(`To use another option: change "cover" to -2 or -3, then npm run build.`);
}

main().catch(e => { console.error('make-cover failed:', e.message); process.exit(1); });
