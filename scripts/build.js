#!/usr/bin/env node
'use strict';
// Renders /site from templates + content + guides.json.
//
//   npm run build
//
// Order: guide pages first (from content/*.md), then build-index fills each
// guide's `text` in guides.json from the built page, then the directory page.
//
// Data precedence: for a guide that has a content file, its frontmatter is the
// source of truth for the editorial fields (SYNC_FIELDS) and is copied into
// guides.json on every build. `reads` and `text` live only in guides.json.
const fs = require('fs');
const path = require('path');
const { SITE_DIR, CONTENT_DIR, TEMPLATES_DIR, PARTNER_PLACEMENTS, loadEnv, siteUrl } = require('./lib/config');
const { parseFrontmatter } = require('./lib/frontmatter');
const { renderArticle, inline, esc, escAttr } = require('./lib/markdown');
const guidesDb = require('./lib/guides');
const { buildIndex } = require('./build-index');
const { deriveCover } = require('./lib/images');

const SYNC_FIELDS = ['code', 'title', 'sub', 'cat', 'added', 'badge', 'color', 'cover', 'keywords', 'tags', 'desc'];
const LIGHT = ['#7cb342', '#c9a227', '#d9a441']; // placeholder colours that need dark text
const WORDS_PER_MINUTE = 220;
const DEFAULT_GATE_TITLE = 'Get the rest of this guide, free';
const DEFAULT_DISCLOSURE = 'This guide is for education only and is not medical advice. Some links are affiliate links; they never change what we recommend.';

function fill(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (!(k in vars)) throw new Error(`Template placeholder {{${k}}} has no value`);
    return vars[k];
  });
}
// Where the gate posts the email. Default: the site's own Netlify function,
// which subscribes via the Beehiiv API. BEEHIIV_FORM_ACTION overrides it when
// it holds an https URL; anything else (for example a pasted embed snippet)
// is ignored with a warning so it can never break the page script.
const SUBSCRIBE_FUNCTION = '/.netlify/functions/subscribe';
let warnedForm = false;
function formAction() {
  const v = (process.env.BEEHIIV_FORM_ACTION || '').trim();
  if (/^https:\/\/[^\s"'<>]+$/i.test(v)) return v;
  if (v && !warnedForm) { console.warn(`warning: BEEHIIV_FORM_ACTION is not a URL; the gate posts to ${SUBSCRIBE_FUNCTION} instead.`); warnedForm = true; }
  return SUBSCRIBE_FUNCTION;
}
const fmtDate = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const jsonForScript = o => JSON.stringify(o).replace(/<\//g, '<\\/');

function coverHTML(g) {
  const d = deriveCover(g.cover);
  if (d) return `<div class="book has-cover" aria-hidden="true"><img src="${escAttr(d.full)}" srcset="${escAttr(d.small)} ${d.smallWidth}w, ${escAttr(d.full)} ${d.width}w" sizes="200px" width="${d.width}" height="${d.height}" alt="" fetchpriority="high" decoding="async"></div>`;
  if (g.cover) return `<div class="book has-cover" aria-hidden="true"><img src="${escAttr(g.cover)}" alt=""></div>`;
  const light = LIGHT.includes(String(g.color).toLowerCase());
  return `<div class="book${light ? ' light' : ''}" aria-hidden="true"><div class="face" style="--c:${escAttr(g.color || '#1a4a1a')}">
      <div class="brand">Lifeuntox</div>${g.badge ? `<div class="badge">${esc(g.badge)}</div>` : ''}
      <div class="kicker">Free guide</div><div class="t">${esc(g.title)}</div>
      <div class="s">${esc(g.sub)}</div>
    </div></div>`;
}

// Four related guides: frontmatter `related` wins; otherwise same topic by
// reads, then the most-read guides from other topics.
function moreGuides(fm, guides, pages) {
  let list;
  if (Array.isArray(fm.related) && fm.related.length) {
    list = fm.related.map(s => guides.find(g => g.slug === s)).filter(Boolean);
  } else {
    const others = guides.filter(g => g.slug !== fm.slug);
    const mine = new Set((fm.tags || []).map(t => String(t).toLowerCase()));
    const shared = g => (g.tags || []).filter(t => mine.has(String(t).toLowerCase())).length;
    list = others.sort((a, b) => shared(b) - shared(a) || (b.cat === fm.cat) - (a.cat === fm.cat) || (b.reads || 0) - (a.reads || 0));
  }
  return list.slice(0, 4).map(g => {
    const href = pages.has(g.slug) ? `guide-${g.slug}.html` : `index.html?code=${encodeURIComponent(g.code)}`;
    const d = deriveCover(g.cover);
    const mini = d
      ? `<div class="mini has-cover"><img src="${escAttr(d.small)}" width="${d.smallWidth}" height="${d.smallHeight}" alt="" loading="lazy" decoding="async"></div>`
      : g.cover
      ? `<div class="mini has-cover"><img src="${escAttr(g.cover)}" alt="" loading="lazy"></div>`
      : `<div class="mini" style="--c:${escAttr(g.color)}">${esc(g.title)}</div>`;
    return `<li><a href="${href}">${mini}<h3>${esc(g.title)}</h3></a></li>`;
  }).join('\n      ');
}

function loadDocs() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md')).sort().map(file => {
    const src = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    const { data: fm, body } = parseFrontmatter(src);
    const slug = file.replace(/\.md$/, '');
    if (fm.slug && fm.slug !== slug) throw new Error(`${file}: frontmatter slug "${fm.slug}" does not match the file name`);
    fm.slug = slug;
    for (const k of ['title', 'sub', 'cat', 'added', 'desc']) if (!fm[k]) throw new Error(`${file}: frontmatter is missing "${k}"`);
    return { slug, fm, body, file };
  });
}

function syncGuides(docs, guides) {
  for (const d of docs) {
    let g = guides.find(x => x.slug === d.slug);
    if (!g) { g = { slug: d.slug, reads: Number(d.fm.reads) || 0 }; guides.push(g); }
    for (const k of SYNC_FIELDS) if (k in d.fm) g[k] = d.fm[k];
    if (g.reads == null) g.reads = 0;
  }
}

function renderGuide(d, guides, pages, tpl, SITE_URL, footer) {
  const g = guides.find(x => x.slug === d.slug);
  const fm = d.fm;
  const art = renderArticle(d.body, fm);
  const readMin = Math.max(1, Math.round(art.words / WORDS_PER_MINUTE));
  const updated = fm.updated || fm.added;
  const pageUrl = `${SITE_URL}/guide-${d.slug}.html`;
  const derived = deriveCover(g.cover);
  const ogImage = derived ? `${SITE_URL}/${derived.full}` : g.cover ? `${SITE_URL}/${g.cover}` : `${SITE_URL}/assets/lifeuntox-logo.png`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: fm.title,
    alternativeHeadline: fm.sub,
    description: fm.desc,
    image: [ogImage],
    datePublished: fm.added,
    dateModified: updated,
    wordCount: art.words,
    author: { '@type': 'Organization', name: 'The Lifeuntox Team', url: 'https://lifeuntox.com' },
    publisher: { '@type': 'Organization', name: 'Lifeuntox', logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/lifeuntox-logo.png` } },
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl }
  };

  let page = tpl;
  if (!PARTNER_PLACEMENTS) page = page.replace(/\s*<!-- partner:start -->[\s\S]*?<!-- partner:end -->/g, '');
  const more = moreGuides(fm, guides, pages);
  if (!more) page = page.replace(/<!-- more:start -->[\s\S]*?<!-- more:end -->/, '');
  if (!art.hasGate) {
    // No :::gate marker: drop the gate UI and the locked wrapper.
    page = page.replace(/<!-- gate:start -->[\s\S]*?<!-- gate:end -->/, '{{ARTICLE_POST}}');
  }
  const html = fill(page, {
    PAGE_TITLE: esc(`${fm.title}: ${fm.sub} · Lifeuntox`),
    META_DESC: escAttr(fm.desc),
    CANONICAL: escAttr(pageUrl),
    OG_IMAGE: escAttr(ogImage),
    JSON_LD: jsonForScript(jsonld),
    TITLE: esc(fm.title),
    DECK: inline(fm.deck || fm.sub),
    CAT: esc(fm.cat),
    UPDATED: fmtDate(updated),
    READ_MIN: String(readMin),
    COVER: coverHTML(g),
    ARTICLE_PRE: art.pre,
    GATE_TITLE: esc(art.gateTitle || DEFAULT_GATE_TITLE),
    ARTICLE_POST: art.post,
    DISCLOSURE: inline(fm.disclosure || DEFAULT_DISCLOSURE),
    MORE_GUIDES: more,
    FOOTER: footer,
    FORM_ACTION: jsonForScript(formAction()),
    SLUG_JSON: jsonForScript(d.slug),
    SHARE_EMAIL: escAttr(`mailto:?subject=${encodeURIComponent(fm.title + ' · Lifeuntox')}&body=${encodeURIComponent(pageUrl)}`),
    SHARE_FB: escAttr(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`)
  });
  fs.writeFileSync(path.join(SITE_DIR, `guide-${d.slug}.html`), html);
  return { slug: d.slug, words: art.words, readMin };
}

function build() {
  loadEnv();
  const SITE_URL = siteUrl();
  const guides = guidesDb.load();
  const tplGuide = fs.readFileSync(path.join(TEMPLATES_DIR, 'guide.html'), 'utf8');
  const tplIndex = fs.readFileSync(path.join(TEMPLATES_DIR, 'index.html'), 'utf8');
  let footer = fs.readFileSync(path.join(TEMPLATES_DIR, 'footer.html'), 'utf8').trim();
  if (!PARTNER_PLACEMENTS) footer = footer.replace(/\s*<!-- partner:start -->[\s\S]*?<!-- partner:end -->/g, '');
  const docs = loadDocs();
  syncGuides(docs, guides);
  const pages = new Set(docs.map(d => d.slug));

  fs.mkdirSync(SITE_DIR, { recursive: true });
  // Remove built pages whose content file is gone, so a deleted guide disappears.
  for (const f of fs.readdirSync(SITE_DIR)) {
    const m = f.match(/^guide-(.+)\.html$/);
    if (m && !pages.has(m[1])) { fs.unlinkSync(path.join(SITE_DIR, f)); console.log(`  removed stale ${f}`); }
  }
  const built = docs.map(d => renderGuide(d, guides, pages, tplGuide, SITE_URL, footer));
  const indexed = buildIndex(guides, SITE_DIR);
  guidesDb.save(guides);
  // Publish the directory data at /guides.json (CORS + short cache via site/_headers).
  fs.copyFileSync(guidesDb.FILE, path.join(SITE_DIR, 'guides.json'));

  // Directory data: tags join the keyword pool for search; covers point at the derived JPEGs.
  const data = guides.map(g => {
    const d = deriveCover(g.cover);
    return { ...g, page: pages.has(g.slug), keywords: [...(g.keywords || []), ...(g.tags || [])], cover: d ? d.full : g.cover, coverSmall: d ? d.small : '' };
  });
  fs.writeFileSync(path.join(SITE_DIR, 'index.html'), fill(tplIndex, {
    GUIDES: jsonForScript(data),
    SITE_URL: escAttr(SITE_URL),
    FOOTER: footer
  }));

  for (const b of built) console.log(`  guide-${b.slug}.html  (${b.words} words, ${b.readMin} min)`);
  console.log(`built ${built.length} guide page${built.length === 1 ? '' : 's'} + index.html + guides.json (${guides.length} guides listed, ${indexed} indexed) → site/  [${SITE_URL}]`);
  return { built, guides };
}

if (require.main === module) {
  try { build(); } catch (e) { console.error('build failed:', e.message); process.exit(1); }
}

module.exports = { build, fill, fmtDate, coverHTML, moreGuides, loadDocs };
