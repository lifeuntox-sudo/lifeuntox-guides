#!/usr/bin/env node
'use strict';
// Scaffolds a guide in the canonical section order and registers it in guides.json.
//
//   npm run new-guide -- "The Tap Water Filter Guide" --code WATER --cat Water
//   options: --sub "…" --slug tap-water-filter-guide --badge "Top 5 filters" --desc "…"
//            --keywords "filter, fluoride, pfas" --color "#2f6f9e" --subject "a clear glass of water"
//
// If guides.json already lists the slug (a placeholder card), its fields are
// reused and nothing is duplicated. Refuses to overwrite an existing content file.
const fs = require('fs');
const path = require('path');
const { CONTENT_DIR } = require('./lib/config');
const guidesDb = require('./lib/guides');
const { quoteIfNeeded } = require('./lib/frontmatter');

const CATS = ['Water', 'Kitchen', 'Home', 'Personal care', 'Family', 'Food'];

function slugify(title) {
  return String(title).toLowerCase().replace(/^the\s+/, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function args() {
  const a = process.argv.slice(2); const o = {};
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k.startsWith('--')) { o[k.slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; }
    else if (!o.title) o.title = k;
  }
  return o;
}

function today() { return new Date().toISOString().slice(0, 10); }

function frontmatter(g, subject) {
  const kw = (g.keywords && g.keywords.length ? g.keywords : []).map(quoteIfNeeded).join(', ');
  return `---
slug: ${g.slug}
code: ${g.code}            # comment word, searchable, never displayed
title: ${quoteIfNeeded(g.title)}
sub: ${quoteIfNeeded(g.sub)}
cat: ${g.cat}                # Water | Kitchen | Home | Personal care | Family | Food
added: ${g.added}
reads: ${g.reads || 0}
badge: ${quoteIfNeeded(g.badge || '')}
color: "${g.color}"         # placeholder book colour until a cover exists
cover: ""                # set by make-cover
cover_subject: ${quoteIfNeeded(subject)}   # the one photographic subject on the cover
keywords: [${kw}]
desc: ${quoteIfNeeded(g.desc)}
partner_product_1: https://notoxchef.com/    # placement 1 link: a specific product, not the homepage
partner_product_2: https://notoxchef.com/    # placement 2 link: a specific product, not the homepage
---
`;
}

function body(g) {
  return `
:::inside
<!-- TODO: one sentence, in numbers, of what the reader gets. -->
5 brands we checked ourselves, where to buy each one, and a 4-step test for anything not on this list.
:::

<!-- TODO INTRO: the problem in 3 to 5 short paragraphs, ending by naming the fix. Open with why it matters. -->
## The problem, in one plain sentence

Why this matters, in one sentence. Then the problem, plainly, with a specific number.

The second paragraph explains how the industry got here.

The third paragraph names the fix: the one thing the reader can look for.

:::warn The one thing to look for
<!-- TODO: the exact words to look for or avoid, then what to do about it. -->
If the label does not say "the exact words", assume the worst. Look for the exact words on the front of the pack, then do this.
:::

:::promo
<!-- TODO: one bridge sentence (this guide's problem → cookware), one sentence on what NOTOXCHEF sells and the standard it meets, then a specific product link. -->
Bridge sentence that connects this problem to the pan it is cooked in. NOTOXCHEF sells cookware with no PFAS coatings, tested to the Lifeuntox Standard.

[See the 10-inch skillet](https://notoxchef.com/)
:::

<!-- TODO FIRST VALUE: the first 2 items of the list, or the first full section, before the gate. -->
## The 5 brands

### 1. First brand
:::checks Verified attribute | Verified attribute | Verified attribute
Why this brand matters, then what we verified, with a number.

:::buy
Store names, and a link to [the brand's own page](https://example.com/).
:::

### 2. Second brand
:::checks Verified attribute | Verified attribute | Verified attribute
Why this brand matters, then what we verified, with a number.

:::buy
Store names, and a link to [the brand's own page](https://example.com/).
:::

:::gate Get the other 3 brands, free

### 3. Third brand
:::checks Verified attribute | Verified attribute | Verified attribute
Why this brand matters, then what we verified, with a number.

:::buy
Store names, and a link to [the brand's own page](https://example.com/).
:::

### 4. Fourth brand
:::checks Verified attribute | Verified attribute | Verified attribute
Why this brand matters, then what we verified, with a number.

:::buy
Store names, and a link to [the brand's own page](https://example.com/).
:::

### 5. Fifth brand
:::checks Verified attribute | Verified attribute | Verified attribute
Why this brand matters, then what we verified, with a number.

:::buy
Store names, and a link to [the brand's own page](https://example.com/).
:::

## Quick reference: where to shop

:::table
| Store | Clean brands available |
|---|---|
| Store one | Brand, Brand |
| Store two | Brand |
| Online direct | Brand, Brand |
:::

## How to check any brand yourself

:::protocol
Shopping somewhere that stocks none of these? Use this 4-step test this week.

1. **Look for the exact words on the pack.** What it means if they are missing.
2. **Check for a third-party stamp.** Which stamps count.
3. **Read the brand's website.** What an open company says, and what silence means.
4. **Test it at home.** One thing the reader can observe.
:::

:::cta You just chose better ${g.cat.toLowerCase() === 'food' ? 'food' : 'products'}. Cook with a better pan.
<!-- TODO: two sentences on the product and why it passes the Lifeuntox Standard. A real offer or code only if one exists. -->
Two sentences on the product and the standard it meets.

[See the 10-inch skillet](https://notoxchef.com/)
:::

## Sources

1. [Add source] Regulatory guidance (.gov) behind the main claim.
2. [Add source] Peer-reviewed study behind the main number.
`;
}

function main() {
  const o = args();
  if (!o.title || !o.code || !o.cat) {
    console.error('usage: npm run new-guide -- "Title" --code WORD --cat Topic [--sub "…"] [--slug x] [--badge "…"] [--desc "…"] [--keywords "a, b"] [--color "#hex"] [--subject "…"]');
    process.exit(1);
  }
  const cat = CATS.find(c => c.toLowerCase() === String(o.cat).toLowerCase());
  if (!cat) { console.error(`--cat must be one of: ${CATS.join(' | ')}`); process.exit(1); }
  const slug = slugify(o.slug || o.title);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) { console.error(`bad slug "${slug}"`); process.exit(1); }
  const file = path.join(CONTENT_DIR, `${slug}.md`);
  if (fs.existsSync(file)) { console.error(`content/${slug}.md already exists. Edit it, or pass --slug for a different one.`); process.exit(1); }

  const guides = guidesDb.load();
  const code = String(o.code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const clash = guides.find(g => g.code === code && g.slug !== slug);
  if (clash) console.warn(`warning: code ${code} is already used by "${clash.title}" (${clash.slug}). Comment-word search will match both.`);

  let g = guides.find(x => x.slug === slug);
  const existed = !!g;
  if (!g) { g = { slug, reads: 0, added: today(), cover: '' }; guides.push(g); }
  g.code = code;
  g.title = o.title;
  g.cat = cat;
  if (o.sub || !g.sub) g.sub = o.sub || 'One line on what the reader gets';
  if (o.badge !== undefined) g.badge = o.badge === true ? '' : o.badge; else if (g.badge == null) g.badge = '';
  if (o.desc || !g.desc) g.desc = o.desc || 'One-paragraph excerpt for the card, 25 to 40 words, that names the problem and the fix.';
  if (o.keywords) g.keywords = String(o.keywords).split(',').map(s => s.trim()).filter(Boolean);
  if (!g.keywords || !g.keywords.length) g.keywords = [slug.split('-')[0]];
  if (o.color) g.color = o.color; else if (!g.color) g.color = '#1a4a1a';
  if (!g.added) g.added = today();
  if (g.reads == null) g.reads = 0;
  g.cover = g.cover || '';
  const subject = o.subject || `one clean photographic subject for ${g.title.toLowerCase()}`;

  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  fs.writeFileSync(file, frontmatter(g, subject) + body(g));
  guidesDb.save(guides);

  console.log(`content/${slug}.md`);
  console.log(existed ? `(reused the existing guides.json entry for ${slug}; ${g.reads} reads kept)` : `(added ${slug} to guides.json)`);
  console.log(`\nNext: write the guide, then\n  npm run check -- ${slug}\n  npm run cover -- ${slug}\n  npm run build`);
}

main();
