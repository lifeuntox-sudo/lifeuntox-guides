'use strict';
// Renders guide Markdown (plus the ::: blocks from the design system) to the
// exact HTML the article template expects. Zero dependencies on purpose: the
// output must match the hand-built mockup and stay predictable.
//
// Blocks:
//   :::inside ... :::            contents-in-numbers box
//   :::insight Title ... :::     soft-yellow finding
//   :::warn Title ... :::        red warning box
//   :::checks A | B | C          one-line verified-attribute pills
//   :::buy ... :::               where to buy
//   :::promo ... :::             NOTOXCHEF placement 1 (last line "[label](url)" = button)
//   :::table ... :::             wraps a Markdown table
//   :::protocol ... :::          numbered action steps (no wrapper element)
//   :::cta Title ... :::         NOTOXCHEF placement 2 (last line "[label](url)" = button)
//   :::gate Title                marker: everything after it sits behind the email gate
//   ![alt](assets/banners/x.jpg) a line holding only an image. Inside :::promo or
//                                :::cta it is the banner ad, linked to the button URL.

const { PARTNER_PLACEMENTS } = require('./config');
const { imageSize } = require('./images');
const LOGO = imageSize('assets/notoxchef-logo.png') || { width: 512, height: 512 };   // the NOTOXCHEF logo shown in the promo mark
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => esc(s).replace(/"/g, '&quot;');

const INLINE = /\\([\\*_\[\]`#])|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*([^*\s](?:[^*]*?[^*\s])?)\*/g;

function link(text, url) {
  const external = /^https?:\/\//i.test(url);
  return `<a href="${escAttr(url)}"${external ? ' rel="noopener"' : ''}>${inline(text)}</a>`;
}

function inline(src) {
  const re = new RegExp(INLINE.source, 'g');
  let out = '', last = 0, m;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    if (m[1] !== undefined) out += esc(m[1]);
    else if (m[2] !== undefined) out += link(m[2], m[3]);
    else if (m[4] !== undefined) out += '<strong>' + inline(m[4]) + '</strong>';
    else out += '<em>' + inline(m[5]) + '</em>';
    last = re.lastIndex;
  }
  return out + esc(src.slice(last));
}

const isFence = l => /^:::/.test(l);
const isHeading = l => /^#{1,6}\s/.test(l);
const isListItem = l => /^\s*(?:[-*+]|\d+[.)])\s+/.test(l);
const isTableRow = l => /^\s*\|/.test(l);
const isRawHtml = l => /^<[a-zA-Z!\/]/.test(l);
const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;

function parseBlocks(lines) {
  const nodes = []; let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^:::(\w+)(?:[ \t]+(.*))?$/))) {
      const name = m[1], arg = (m[2] || '').trim();
      if (name === 'gate') { nodes.push({ type: 'gate', title: arg, line: i + 1 }); i++; continue; }
      if (name === 'checks') {
        nodes.push({ type: 'block', name, arg, items: arg.split('|').map(s => s.trim()).filter(Boolean), line: i + 1 });
        i++; continue;
      }
      const start = i; const inner = []; i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) inner.push(lines[i++]);
      if (i >= lines.length) throw new Error(`Unclosed :::${name} block opened on line ${start + 1}`);
      i++;
      nodes.push({ type: 'block', name, arg, children: parseBlocks(inner), line: start + 1 });
      continue;
    }
    if ((m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/))) { nodes.push({ type: 'heading', level: m[1].length, text: m[2], line: i + 1 }); i++; continue; }
    if (isListItem(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line); const items = [];
      while (i < lines.length && lines[i].trim()) {
        const im = lines[i].match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
        if (im) items.push(im[1]);
        else items[items.length - 1] += ' ' + lines[i].trim();
        i++;
      }
      nodes.push({ type: 'list', ordered, items, line: i + 1 }); continue;
    }
    if (isTableRow(line)) {
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(lines[i++]);
      const cells = r => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      const body = rows.slice(1).filter(r => !/^\s*\|?\s*:?-{2,}/.test(r)).map(cells);
      nodes.push({ type: 'table', head: cells(rows[0]), rows: body, line: i + 1 }); continue;
    }
    if ((m = line.match(IMAGE_LINE))) { nodes.push({ type: 'image', alt: m[1], src: m[2], line: i + 1 }); i++; continue; }
    if (/^<!--.*-->\s*$/.test(line)) {   // one-line HTML comment (scaffold notes): never swallows the next line
      nodes.push({ type: 'html', raw: line, line: i + 1 }); i++; continue;
    }
    if (isRawHtml(line)) {
      const raw = []; const start = i;
      while (i < lines.length && lines[i].trim() && !(i > start && (isFence(lines[i]) || isHeading(lines[i])))) raw.push(lines[i++]);
      nodes.push({ type: 'html', raw: raw.join('\n'), line: start + 1 }); continue;
    }
    const para = []; const start = i;
    while (i < lines.length && lines[i].trim() && !isFence(lines[i]) && !isHeading(lines[i]) && !isTableRow(lines[i]) && !isListItem(lines[i]) && !IMAGE_LINE.test(lines[i])) para.push(lines[i++].trim());
    nodes.push({ type: 'para', text: para.join(' '), line: start + 1 });
  }
  return nodes;
}

function renderNodes(nodes, ctx) { return nodes.map(n => renderNode(n, ctx)).filter(Boolean).join('\n'); }

function renderNode(n, ctx) {
  switch (n.type) {
    case 'heading':
      if (n.level === 2) ctx.lastH2 = n.text;
      return `<h${n.level}>${inline(n.text)}</h${n.level}>`;
    case 'para': return `<p>${inline(n.text)}</p>`;
    case 'list': {
      const tag = n.ordered ? 'ol' : 'ul';
      const cls = /^sources$/i.test(ctx.lastH2 || '') ? ' class="sources"' : '';
      return `<${tag}${cls}>\n${n.items.map(i => `<li>${inline(i)}</li>`).join('\n')}\n</${tag}>`;
    }
    case 'table':
      return `<table>\n<thead><tr>${n.head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead>\n<tbody>\n` +
        n.rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('\n') + `\n</tbody>\n</table>`;
    case 'html': return n.raw;
    case 'image': return imageTag(n);
    case 'gate': return '';
    case 'block': return renderBlock(n, ctx);
  }
  return '';
}

// <img> with its real width and height (read from the file under site/) so the
// page never shifts while the banner loads. Site-relative paths only.
function imageTag(n, extra = '') {
  const d = imageSize(n.src);
  const size = d ? ` width="${d.width}" height="${d.height}"` : '';
  return `<img src="${escAttr(n.src)}" alt="${escAttr(n.alt)}"${size} loading="lazy" decoding="async"${extra}>`;
}

// The banner ad of a promo/cta block: its image nodes, linked to the button URL.
function splitBanner(children, href) {
  const images = children.filter(c => c.type === 'image');
  const rest = children.filter(c => c.type !== 'image');
  const ad = images.map(img => `<a class="ad" href="${escAttr(href)}" rel="noopener">${imageTag(img)}</a>`).join('\n');
  return { rest, ad };
}

// A block whose only child is one paragraph renders it inline (no <p>), matching the mockup.
function body(children, ctx) {
  if (children.length === 1 && children[0].type === 'para') return inline(children[0].text);
  return renderNodes(children, ctx);
}

// If the block ends with a standalone "[label](url)" paragraph, that becomes the button.
function splitButton(children) {
  const last = children[children.length - 1];
  const m = last && last.type === 'para' && last.text.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
  return m ? { rest: children.slice(0, -1), label: m[1], url: m[2] } : { rest: children };
}

function renderBlock(n, ctx) {
  const c = n.children || [];
  switch (n.name) {
    case 'inside': return `<div class="inside"><b>Inside:</b> ${body(c, ctx)}</div>`;
    case 'warn': return `<div class="warn"><b>${inline(n.arg)}</b> ${body(c, ctx)}</div>`;
    case 'insight': return `<div class="insight"><b>${inline(n.arg)}</b> ${body(c, ctx)}</div>`;
    case 'checks': return `<div class="checks">${n.items.map(i => `<span>${inline(i)}</span>`).join('')}</div>`;
    case 'buy': return `<div class="buy"><b>Where to buy:</b> ${body(c, ctx)}</div>`;
    case 'promo': {
      if (ctx.partner === false) return '';
      const { rest: afterButton, label, url } = splitButton(c);
      const href = url || ctx.partner1 || 'https://notoxchef.com';
      const { rest, ad } = splitBanner(afterButton, href);
      const mark = ad
        ? `<div class="mark"><img src="assets/notoxchef-logo.png" alt="NOTOXCHEF" width="${LOGO.width}" height="${LOGO.height}" loading="lazy" decoding="async"><small>Official partner of Lifeuntox</small></div>`
        : `<div class="mark">NOTOXCHEF<small>Official partner</small></div>`;
      return `<div class="promo${ad ? ' has-ad' : ''}">\n${ad ? ad + '\n' : ''}${mark}\n${renderNodes(rest, ctx)}\n` +
        `<a class="btn btn-solid" href="${escAttr(href)}" rel="noopener">${inline(label || 'Shop NOTOXCHEF')}</a>\n</div>`;
    }
    case 'cta': {
      if (ctx.partner === false) return '';
      const { rest: afterButton, label, url } = splitButton(c);
      const href = url || ctx.partner2 || 'https://notoxchef.com';
      const { rest, ad } = splitBanner(afterButton, href);
      return `<div class="cta${ad ? ' has-ad' : ''}">\n${ad ? ad + '\n' : ''}${n.arg ? `<h3>${inline(n.arg)}</h3>\n` : ''}${renderNodes(rest, ctx)}\n` +
        `<a class="btn" href="${escAttr(href)}" rel="noopener">${inline(label || 'Shop NOTOXCHEF cookware')}</a>\n` +
        `<small>Lifeuntox earns a commission on partner sales. It never changes what we recommend.</small>\n</div>`;
    }
    case 'table':
    case 'protocol': return renderNodes(c, ctx);
    default: return `<div class="${escAttr(n.name)}">${n.arg ? `<b>${inline(n.arg)}</b> ` : ''}${body(c, ctx)}</div>`;
  }
}

const textOf = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

// Renders a guide body. Returns the HTML before and after the gate, the gate
// title, the sequence of top-level blocks (for check-guide), and a word count.
function renderArticle(md, fm = {}) {
  const nodes = parseBlocks(md.split(/\r?\n/));
  const gi = nodes.findIndex(n => n.type === 'gate');
  const ctx = { lastH2: null, partner: PARTNER_PLACEMENTS, partner1: fm.partner_product_1, partner2: fm.partner_product_2 };
  const pre = renderNodes(gi < 0 ? nodes : nodes.slice(0, gi), ctx);
  const post = gi < 0 ? '' : renderNodes(nodes.slice(gi + 1), ctx);
  const text = textOf(pre + ' ' + post);
  return {
    pre, post, nodes,
    hasGate: gi >= 0,
    gateTitle: gi >= 0 ? nodes[gi].title : '',
    text,
    words: text ? text.split(' ').length : 0
  };
}

module.exports = { renderArticle, parseBlocks, inline, esc, escAttr, textOf };
