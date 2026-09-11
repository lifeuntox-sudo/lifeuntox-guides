#!/usr/bin/env node
'use strict';
// Lints a guide against the Lifeuntox design system (CLAUDE.md §8).
//
//   npm run check -- <slug>          one guide
//   npm run check -- --all           every guide in content/
//   add --no-net to skip link checks and HTML validation (offline)
//
// FAIL = must fix before publishing (exit code 1). WARN = look at it.
const fs = require('fs');
const path = require('path');
const { CONTENT_DIR, SITE_DIR } = require('./lib/config');
const { parseFrontmatter } = require('./lib/frontmatter');
const { renderArticle, textOf } = require('./lib/markdown');

const CATS = ['Water', 'Kitchen', 'Home', 'Personal care', 'Family', 'Food'];
const COLOURED = new Set(['inside', 'insight', 'warn', 'promo', 'buy', 'cta']);
const HEDGES = /\b(might|perhaps|maybe|could be|may be|possibly|arguably|somewhat|seems? to|it is thought)\b/gi;
const JARGON = /\b(leverage|leveraging|optimi[sz]e|optimi[sz]ing|synergy|synerg(ies|istic)|utili[sz]e|holistic|paradigm|ecosystem|game.?changer|unlock(?:ing)? (?:the|your) potential)\b/gi;
const FIRST_PERSON = /\b(I|I'm|I’m|I've|I’ve|I'd|I’d|I'll|I’ll|me|my|mine|myself)\b/g;
const FORCED_NEG = /\bnot (un|in|im|il|ir)[a-z]{3,}\b/gi;
const CAPS_HEADER = /^[A-Z0-9 ,.!'"-]{12,}$/;

// ---------- readability ----------
function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}
function readability(sentencesText) {
  let words = 0, sents = 0, syl = 0;
  for (const s of sentencesText) {
    const parts = s.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/).filter(p => p.trim());
    sents += Math.max(1, parts.length);
    for (const w of s.split(/\s+/).filter(Boolean)) { words++; syl += syllables(w); }
  }
  if (!words || !sents) return { grade: 0, words, sents };
  const grade = 0.39 * (words / sents) + 11.8 * (syl / words) - 15.59;
  return { grade: Math.round(grade * 10) / 10, words, sents };
}

// ---------- net checks ----------
async function headOk(url) {
  const opts = { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; LifeuntoxLinkCheck/1.0)' }, signal: AbortSignal.timeout(12000) };
  try {
    let r = await fetch(url, { ...opts, method: 'HEAD' });
    if (r.status === 405 || r.status === 403 || r.status === 404) r = await fetch(url, { ...opts, method: 'GET' });
    return { ok: r.ok, status: r.status };
  } catch (e) { return { ok: false, status: e.name === 'TimeoutError' ? 'timeout' : e.message }; }
}
async function validateHtml(html) {
  try {
    const r = await fetch('https://validator.w3.org/nu/?out=json', {
      method: 'POST', headers: { 'content-type': 'text/html; charset=utf-8', 'user-agent': 'LifeuntoxCheck/1.0' }, body: html, signal: AbortSignal.timeout(30000)
    });
    const j = await r.json();
    return (j.messages || []).filter(m => m.type === 'error').map(m => `line ${m.lastLine}: ${m.message}`);
  } catch (e) { return [`validator unreachable: ${e.message}`]; }
}

// ---------- the checks ----------
async function checkGuide(slug, net) {
  const out = []; const fail = (m, l) => out.push({ level: 'FAIL', m, l }); const warn = (m, l) => out.push({ level: 'WARN', m, l }); const ok = m => out.push({ level: 'ok', m });
  const file = path.join(CONTENT_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) { fail(`content/${slug}.md not found`); return out; }
  const src = fs.readFileSync(file, 'utf8');
  let fm, body;
  try { ({ data: fm, body } = parseFrontmatter(src)); } catch (e) { fail(e.message); return out; }
  const fmLines = src.indexOf(body) >= 0 ? src.slice(0, src.indexOf(body)).split('\n').length - 1 : 0;
  const L = n => (n ? n + fmLines : undefined);

  // frontmatter
  for (const k of ['slug', 'code', 'title', 'sub', 'cat', 'added', 'desc', 'keywords']) if (fm[k] == null || fm[k] === '' || (Array.isArray(fm[k]) && !fm[k].length)) fail(`frontmatter: "${k}" is missing`);
  if (fm.slug && fm.slug !== slug) fail(`frontmatter slug "${fm.slug}" does not match the file name`);
  if (fm.cat && !CATS.includes(fm.cat)) fail(`frontmatter: cat "${fm.cat}" is not one of ${CATS.join(' | ')}`);
  if (fm.code && String(fm.code) !== String(fm.code).toUpperCase()) warn('frontmatter: code should be uppercase');
  const descWords = String(fm.desc || '').split(/\s+/).filter(Boolean).length;
  if (fm.desc && (descWords < 20 || descWords > 45)) warn(`frontmatter: desc is ${descWords} words (aim for 25–40)`);
  if (fm.desc && /\[Add source\]|One-paragraph excerpt/i.test(fm.desc)) fail('frontmatter: desc is still the placeholder');
  for (const k of ['partner_product_1', 'partner_product_2']) {
    if (!fm[k]) warn(`frontmatter: ${k} not set (placement button falls back to the homepage)`);
    else if (/^https?:\/\/(www\.)?notoxchef\.com\/?$/i.test(fm[k])) warn(`frontmatter: ${k} is the NOTOXCHEF homepage; link a specific product`);
  }
  if (!fm.cover) warn('no cover yet (npm run cover -- ' + slug + ')');
  else if (!fs.existsSync(path.join(SITE_DIR, fm.cover))) fail(`cover file missing: site/${fm.cover}`);

  // body parse
  let art;
  try { art = renderArticle(body, fm); } catch (e) { fail(`markdown: ${e.message}`); return out; }
  const nodes = art.nodes;
  const lines = body.split(/\r?\n/);

  // scaffold leftovers
  lines.forEach((l, i) => { if (/<!--\s*TODO/i.test(l)) fail('scaffold TODO left in place', L(i + 1)); });
  if (/\[Add source\]/.test(body)) { lines.forEach((l, i) => { if (l.includes('[Add source]')) fail('[Add source] left in place', L(i + 1)); }); }

  // brand
  lines.forEach((l, i) => { if (/\b(LifeUntox|Life Untox|Lifeuntox\.com\b(?!\S))/.test(l) && /LifeUntox|Life Untox/.test(l)) fail('brand name misspelled (it is "Lifeuntox")', L(i + 1)); });
  lines.forEach((l, i) => { if (/[\u{1F525}]/u.test(l)) fail('fire emoji', L(i + 1)); });

  // editorial
  lines.forEach((l, i) => { if (l.includes('—') && !/^\s*(```|<)/.test(l)) fail('em dash (use a comma, full stop or colon)', L(i + 1)); });
  lines.forEach((l, i) => {
    if (/^\s*<!--/.test(l) || /^\s*:::/.test(l)) return;
    const clean = l.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '');
    const fp = clean.match(FIRST_PERSON); if (fp) fail(`first-person singular ("${fp[0]}")`, L(i + 1));
    if (/!/.test(clean.replace(/!\[/g, ''))) warn('exclamation mark', L(i + 1));
    const h = clean.match(HEDGES); if (h) warn(`hedging ("${h[0]}")`, L(i + 1));
    const j = clean.match(JARGON); if (j) warn(`jargon ("${j[0]}")`, L(i + 1));
    const n = clean.match(FORCED_NEG); if (n) warn(`forced negation ("${n[0]}")`, L(i + 1));
  });
  const whoFor = nodes.find(n => n.type === 'heading' && /who (this|it) is (not )?for/i.test(n.text));
  if (whoFor) fail('"who this is for" section is not allowed', L(whoFor.line));

  // structure: canonical order
  const seq = nodes.map(n => n.type === 'block' ? n.name : n.type === 'gate' ? 'gate' : n.type === 'heading' ? `h${n.level}` : n.type);
  const idx = name => seq.indexOf(name);
  const first = { inside: idx('inside'), warn: idx('warn'), promo: idx('promo'), gate: idx('gate'), table: idx('table'), protocol: idx('protocol'), cta: idx('cta') };
  const sourcesIdx = nodes.findIndex(n => n.type === 'heading' && n.level === 2 && /^sources$/i.test(n.text));
  const required = ['inside', 'warn', 'promo', 'gate', 'protocol', 'cta'];
  for (const r of required) if (first[r] < 0) fail(`missing block :::${r}`);
  if (sourcesIdx < 0) fail('missing "## Sources" section');
  const order = ['inside', 'warn', 'promo', 'gate', 'table', 'protocol', 'cta'].filter(k => first[k] >= 0).map(k => first[k]);
  const sorted = order.every((v, i) => i === 0 || v > order[i - 1]);
  if (!sorted) fail('blocks are out of the canonical order (inside → intro → warn → promo → first value → gate → rest → table → protocol → cta → Sources)');
  if (sourcesIdx >= 0 && first.cta >= 0 && sourcesIdx < first.cta) fail('"## Sources" must come after :::cta');
  if (first.inside > 0) { const before = seq.slice(0, first.inside).filter(s => s !== 'html'); if (before.length) warn(':::inside should be the first block'); }
  const introParas = first.warn > 0 ? seq.slice(first.inside + 1, first.warn).filter(s => s === 'para').length : 0;
  if (first.warn > 0 && (introParas < 3 || introParas > 5)) warn(`intro has ${introParas} paragraphs (design system: 3–5)`);

  // placements
  const promos = seq.filter(s => s === 'promo').length, ctas = seq.filter(s => s === 'cta').length;
  if (promos !== 1 || ctas !== 1) fail(`NOTOXCHEF placements: found ${promos} :::promo and ${ctas} :::cta (need exactly one of each)`);
  nodes.forEach(n => {
    if (n.type === 'para' && /NOTOXCHEF/.test(n.text)) warn('NOTOXCHEF mentioned outside the two placements', L(n.line));
    if (n.type === 'block' && n.name === 'cta' && n.arg && CAPS_HEADER.test(n.arg)) fail('ALL-CAPS header in the CTA', L(n.line));
  });

  // gate position
  if (first.promo >= 0 && first.gate >= 0) {
    const between = seq.slice(first.promo + 1, first.gate);
    const h3s = between.filter(s => s === 'h3').length, h2s = between.filter(s => s === 'h2').length;
    if (!(h3s >= 2 || (h3s === 0 && h2s >= 1))) fail(`gate comes before the first value (found ${h3s} numbered items and ${h2s} sections between :::promo and :::gate; need 2 items or 1 full section)`);
    const preWords = textOf(art.pre).split(/\s+/).filter(Boolean).length, allWords = art.words;
    const share = allWords ? preWords / allWords : 0;
    if (share > 0.5) warn(`${Math.round(share * 100)}% of the guide is before the gate (aim for about 30%)`);
  }

  // coloured blocks in a row
  let run = 0;
  nodes.forEach(n => {
    if (n.type === 'block' && COLOURED.has(n.name)) { run++; if (run === 4) warn('four coloured blocks in a row; cut boxes', L(n.line)); }
    else if (n.type === 'para' || n.type === 'heading') run = 0;
  });

  // length and readability (body copy = everything before Sources)
  const bodyNodes = sourcesIdx >= 0 ? nodes.slice(0, sourcesIdx) : nodes;
  // sentences: paragraphs and list items (for the reading grade); fragments: table cells and check pills (count as words only)
  const collect = (ns, acc = { sentences: [], fragments: [] }) => {
    for (const n of ns) {
      if (n.type === 'para') acc.sentences.push(n.text);
      else if (n.type === 'list') acc.sentences.push(...n.items);
      else if (n.type === 'table') acc.fragments.push(...n.head, ...n.rows.flat());
      else if (n.type === 'block' && n.items) acc.fragments.push(...n.items);
      else if (n.type === 'block' && n.children) collect(n.children, acc);
    }
    return acc;
  };
  const strip = t => t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const { sentences, fragments } = collect(bodyNodes);
  const prose = sentences.map(strip);
  const words = s => s.split(/\s+/).filter(Boolean).length;
  const wordCount = words(prose.join(' ')) + words(fragments.map(strip).join(' ')) + bodyNodes.filter(n => n.type === 'heading').reduce((a, n) => a + words(n.text), 0);
  if (wordCount < 1200 || wordCount > 2500) fail(`word count ${wordCount} (design system: 1,200–2,500)`); else ok(`word count ${wordCount}`);
  const r = readability(prose);
  if (r.grade > 9) fail(`Flesch-Kincaid grade ${r.grade} (fails above 9)`);
  else if (r.grade > 7) warn(`Flesch-Kincaid grade ${r.grade} (target 5–7)`);
  else ok(`Flesch-Kincaid grade ${r.grade}`);
  const longParas = bodyNodes.filter(n => n.type === 'para' && n.text.split(/(?<=[.!?])\s+/).length > 4);
  longParas.forEach(n => warn('paragraph has more than four sentences', L(n.line)));

  // sources
  if (sourcesIdx >= 0) {
    const list = nodes.slice(sourcesIdx + 1).find(n => n.type === 'list');
    if (!list || !list.items.length) fail('Sources list is empty');
    else {
      const linked = list.items.filter(i => /\]\(https?:\/\//.test(i)).length;
      if (linked < list.items.length) warn(`${list.items.length - linked} of ${list.items.length} sources have no link`);
      list.items.forEach(i => { const m = i.match(/\]\((https?:\/\/[^)]+)\)/); if (m && !/\.(gov|edu)(\/|$)|doi\.org|nih\.gov|pubmed|europa\.eu|who\.int|\.ac\.uk/i.test(m[1])) warn(`source is not .gov/.edu/peer-reviewed/regulatory: ${m[1]}`); });
    }
  }
  const numbered = bodyNodes.filter(n => n.type === 'para' && /\b\d{2,}(\.\d+)?%?\b/.test(n.text) && !/\]\(/.test(n.text));
  if (numbered.length) warn(`${numbered.length} paragraph${numbered.length === 1 ? '' : 's'} with a number but no inline source link`);

  // links + built page
  const links = [...new Set([...body.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(m => m[1]).concat([fm.partner_product_1, fm.partner_product_2].filter(u => /^https?:\/\//.test(u || ''))))];
  const built = path.join(SITE_DIR, `guide-${slug}.html`);
  if (!fs.existsSync(built)) warn('page not built yet (npm run build) so HTML validation and OG checks were skipped');
  else {
    const html = fs.readFileSync(built, 'utf8');
    if (!/<meta property="og:image" content="[^"]+"/.test(html)) fail('OG image missing');
    if (!/assets/partner-notoxchef.png/.test(html)) fail('partner lockup missing from the built page');
    if (!/assets\/lifeuntox-logo\.png/.test(html)) fail('logo missing from the built page');
    if (!/class="fine">[^<]*education/.test(html)) fail('footer disclosure missing from the built page');
    if (/JetBrains/.test(html)) fail('JetBrains Mono is loaded on the page');
    if (net) {
      const errs = await validateHtml(html);
      if (errs.length) errs.slice(0, 10).forEach(e => fail(`HTML validator: ${e}`)); else ok('HTML validates (W3C Nu validator)');
    }
  }
  if (net && links.length) {
    let bad = 0;
    for (let i = 0; i < links.length; i += 5) {
      const batch = links.slice(i, i + 5);
      const res = await Promise.all(batch.map(headOk));
      res.forEach((r, j) => { if (!r.ok) { bad++; fail(`link does not resolve (${r.status}): ${batch[j]}`); } });
    }
    if (!bad) ok(`${links.length} link${links.length === 1 ? '' : 's'} resolve`);
  } else if (!net) warn('--no-net: links and HTML validation not checked');
  return out;
}

async function main() {
  const a = process.argv.slice(2);
  const net = !a.includes('--no-net');
  const all = a.includes('--all');
  const slugs = all ? fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')) : a.filter(x => !x.startsWith('--'));
  if (!slugs.length) { console.error('usage: npm run check -- <slug> | --all   [--no-net]'); process.exit(1); }
  let fails = 0;
  for (const slug of slugs) {
    const res = await checkGuide(slug, net);
    const f = res.filter(r => r.level === 'FAIL').length, w = res.filter(r => r.level === 'WARN').length;
    fails += f;
    console.log(`\n${slug}: ${f ? f + ' FAIL' : 'no fails'}, ${w} warn`);
    for (const r of res) console.log(`  ${r.level === 'ok' ? ' ok ' : r.level}  ${r.m}${r.l ? `  (line ${r.l})` : ''}`);
  }
  process.exit(fails ? 1 : 0);
}

main().catch(e => { console.error('check failed:', e); process.exit(1); });
