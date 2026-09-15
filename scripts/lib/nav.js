'use strict';
// Renders the shared header and footer from nav.json (the single source of
// truth, copied from the live Beehiiv site). Used by scripts/build.js.
const fs = require('fs');
const path = require('path');
const { ROOT, TEMPLATES_DIR, DEFAULT_SITE_URL } = require('./config');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Social icons: the same SVG paths Beehiiv renders on lifeuntox.com.
const ICONS = {
  x: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  facebook: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
  instagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
  tiktok: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2859 3333" aria-hidden="true" focusable="false"><path d="M2081 0c55 473 319 755 778 785v532c-266 26-499-61-770-225v995c0 1264-1378 1659-1932 753-356-583-138-1606 1004-1647v561c-87 14-180 36-265 65-254 86-398 247-358 531 77 544 1075 705 992-358V1h551z"/></svg>'
};

function loadNav() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'nav.json'), 'utf8'));
}

function loadCss() {
  return fs.readFileSync(path.join(TEMPLATES_DIR, 'nav.css'), 'utf8').trim();
}

// External = absolute http(s) URL on another host than the guide site.
function isExternal(href, siteUrl) {
  if (!/^https?:\/\//i.test(href)) return false;
  try { return new URL(href).host !== new URL(siteUrl || DEFAULT_SITE_URL).host; } catch (e) { return true; }
}

function a(link, siteUrl, extraClass, extraAttrs) {
  const attrs = [`href="${esc(link.href)}"`];
  if (extraClass) attrs.push(`class="${esc(extraClass)}"`);
  if (link.current) attrs.push('aria-current="page"');
  if (isExternal(link.href, siteUrl)) attrs.push('rel="noopener"');
  if (extraAttrs) attrs.push(extraAttrs);
  return `<a ${attrs.join(' ')}>`;
}

function iconSvg(name) {
  if (!name) return '';
  if (ICONS[name]) return ICONS[name];
  const file = path.join(TEMPLATES_DIR, 'icons', `${name}.svg`);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
}

function renderHeader(nav, siteUrl) {
  const links = nav.primary.map(l => `${a(l, siteUrl)}${esc(l.label)}</a>`).join('\n      ');
  const cta = nav.cta ? `${a(nav.cta, siteUrl, 'hcta')}${iconSvg(nav.cta.icon)}${esc(nav.cta.label)}</a>` : '';
  const logo = nav.logo;
  return `<header class="site-header">
  <div class="hwrap">
    ${a(logo, siteUrl, 'hlogo', `aria-label="${esc(logo.alt)} home"`)}<img src="${esc(logo.src)}" alt="${esc(logo.alt)}"${logo.width ? ` width="${logo.width}" height="${logo.height}"` : ''} fetchpriority="high"></a>
    <nav class="hnav" aria-label="Main">
      ${links}
      ${cta}
    </nav>
  </div>
</header>`;
}

function renderFooter(nav, siteUrl) {
  const f = nav.footer;
  const c = f.cta || {};
  const cols = (f.columns || []).map(col => `<div class="fcol"><h3>${esc(col.title)}</h3><ul>${col.links.map(l => `<li>${a(l, siteUrl)}${esc(l.label)}</a></li>`).join('')}</ul></div>`).join('\n      ');
  const social = (f.social || []).map(s => `<li>${a(s, siteUrl, 's-' + s.icon, `aria-label="${esc(s.label)}"`)}${iconSvg(s.icon)}</a></li>`).join('');
  const logo = f.logo;
  return `<footer class="site-footer">
  <div class="fwrap">
    <div class="fcta">
      ${c.icon ? `<span class="fleaf">${iconSvg(c.icon)}</span>` : ''}
      <h2>${esc(c.heading)}</h2>
      <p class="fsub">${esc(c.sub)}</p>
      <form class="fform" action="${esc(c.action)}" method="post" data-subscribe>
        <label class="sr" for="footer-email">Email address</label>
        <input id="footer-email" type="email" name="email" placeholder="${esc(c.placeholder)}" required autocomplete="email">
        <input class="hp" type="text" name="website" id="footer-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button type="submit">${esc(c.label)}</button>
      </form>
      ${c.note ? `<p class="fnote">${esc(c.note)}</p>` : ''}
    </div>
    <div class="fcols">
      ${cols}
    </div>
    <div class="fbottom">
      ${logo ? `${a(logo, siteUrl, 'flogo', `aria-label="${esc(logo.alt)} home"`)}<img src="${esc(logo.src)}" alt="${esc(logo.alt)}" width="${logo.width || 300}" height="${logo.height || 62}" loading="lazy"></a>` : ''}
      <ul class="fsocial">${social}</ul>
    </div>
    ${f.legal ? `<p class="flegal">${esc(f.legal)}${f.copyright ? `<br>${esc(f.copyright)}` : ''}</p>` : ''}
  </div>
</footer>
<script>
/* Footer newsletter box: posts to the site's subscribe function (Beehiiv API, server-side). */
(function(){
  var f=document.querySelector('.site-footer form[data-subscribe]'); if(!f) return;
  f.addEventListener('submit', async function(e){
    e.preventDefault();
    var btn=f.querySelector('button'), input=f.querySelector('input'), email=input.value.trim(), label=btn.textContent;
    btn.disabled=true; btn.textContent='Joining…';
    try{
      var r=await fetch(f.action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,slug:'footer',website:(f.querySelector('input[name=website]')||{}).value||''})});
      var out=r.ok?await r.json():{ok:false};
      if(out.ok){ btn.textContent="You're in"; input.disabled=true; }
      else { btn.disabled=false; btn.textContent=label; }
    }catch(err){ btn.disabled=false; btn.textContent=label; }
  });
})();
</script>`;
}

module.exports = { loadNav, loadCss, renderHeader, renderFooter, isExternal };
