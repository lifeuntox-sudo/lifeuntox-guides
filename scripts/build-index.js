#!/usr/bin/env node
'use strict';
// Fills the `text` field of every guide in guides.json from its built page
// (site/guide-<slug>.html) so the directory search can find words that only
// appear inside a guide, and show a snippet. The gate/phone form chrome is
// excluded so "email" does not match every guide.
//
//   npm run index        (npm run build calls this automatically)
const fs = require('fs');
const path = require('path');
const { SITE_DIR } = require('./lib/config');
const guidesDb = require('./lib/guides');

function extractText(html) {
  const art = (html.match(/<article class="body">([\s\S]*?)<\/article>/) || [, ''])[1];
  return art
    .replace(/<!-- gate-ui -->[\s\S]*?<!-- \/gate-ui -->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

// Mutates `guides`; returns how many pages were indexed.
function buildIndex(guides, siteDir = SITE_DIR) {
  let n = 0;
  for (const g of guides) {
    const file = path.join(siteDir, `guide-${g.slug}.html`);
    if (!fs.existsSync(file)) { delete g.text; continue; }
    g.text = extractText(fs.readFileSync(file, 'utf8'));
    n++;
  }
  return n;
}

if (require.main === module) {
  const guides = guidesDb.load();
  const n = buildIndex(guides);
  guidesDb.save(guides);
  console.log(`indexed ${n} guide${n === 1 ? '' : 's'} into guides.json`);
}

module.exports = { buildIndex, extractText };
