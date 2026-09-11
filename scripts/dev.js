#!/usr/bin/env node
'use strict';
// Local preview: builds, serves /site, rebuilds when content, templates or
// guides.json change, and runs netlify/functions/*.js at /.netlify/functions/<name>
// so the phone opt-in can be tested end to end without the Netlify CLI.
//
//   npm run dev            → http://localhost:8888
//   PORT=3000 npm run dev
const http = require('http');
const fs = require('fs');
const path = require('path');
const { ROOT, SITE_DIR, CONTENT_DIR, TEMPLATES_DIR, loadEnv } = require('./lib/config');
const { build } = require('./build');

loadEnv();
const PORT = Number(process.env.PORT) || 8888;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml'
};

function rebuild() {
  try { build(); } catch (e) { console.error('build failed:', e.message); }
}

async function runFunction(name, req, res, url) {
  const file = path.join(ROOT, 'netlify', 'functions', name + '.js');
  if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('No such function: ' + name); }
  let body = ''; for await (const chunk of req) body += chunk;
  delete require.cache[require.resolve(file)];
  try {
    const out = await require(file).handler({
      httpMethod: req.method, headers: req.headers, path: url.pathname,
      queryStringParameters: Object.fromEntries(url.searchParams), body
    }, {});
    res.writeHead(out.statusCode || 200, { 'content-type': 'application/json', ...(out.headers || {}) });
    res.end(out.body || '');
  } catch (e) {
    console.error(`function ${name} threw:`, e);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(SITE_DIR, p));
  if (!file.startsWith(SITE_DIR)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found: ' + p); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

rebuild();
http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/.netlify/functions/')) return runFunction(url.pathname.split('/').pop().replace(/[^\w-]/g, ''), req, res, url);
  serveStatic(req, res, url);
}).listen(PORT, () => console.log(`\nLifeuntox guides → http://localhost:${PORT}\n(serving site/, functions at /.netlify/functions/*, rebuilding on change)\n`));

let timer;
for (const dir of [CONTENT_DIR, TEMPLATES_DIR]) {
  if (fs.existsSync(dir)) fs.watch(dir, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(rebuild, 150); });
}
fs.watch(path.join(ROOT, 'guides.json'), () => { clearTimeout(timer); timer = setTimeout(rebuild, 150); });
