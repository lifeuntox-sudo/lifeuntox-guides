// Fills the `text` field of every guide in index.html from its guide-<slug>.html
// so the search box can find words that only appear inside a guide.
// Run:  node build-index.js   (then commit index.html)
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const slugs = [...html.matchAll(/slug:"([^"]+)"/g)].map(m => m[1]);
for (const slug of slugs) {
  const file = `guide-${slug}.html`;
  if (!fs.existsSync(file)) continue;
  const art = (fs.readFileSync(file, 'utf8').match(/<article class="body">([\s\S]*?)<\/article>/) || [,''])[1];
  const text = art.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().replace(/"/g, '\\"');
  const block = new RegExp(`(slug:"${slug}"[\\s\\S]*?)(,\\s*text:"[^"]*")?(\\s*\\})`);
  html = html.replace(block, (m, a, _t, c) => `${a},\n    text:"${text}"${c}`);
}
fs.writeFileSync('index.html', html);
console.log('indexed', slugs.length, 'guides');
