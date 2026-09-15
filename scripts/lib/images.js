'use strict';
// Derives fast display versions of a cover PNG at build time:
//   assets/covers/<name>.jpg       full size (1200×1600), used by the article header and Open Graph
//   assets/covers/<name>-600.jpg   600×800, used by the directory grid and "More free guides"
// Files are regenerated only when missing or older than the PNG. Both are
// gitignored; Netlify builds them from the committed PNG.
const fs = require('fs');
const path = require('path');
const { SITE_DIR } = require('./config');
const png = require('./png');
const jpeg = require('./jpeg');

const SMALL_WIDTH = 600;
const QUALITY_FULL = 84;
const QUALITY_SMALL = 82;

function fresh(out, src) {
  return fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs;
}

// cover: site-relative path of the PNG ("assets/covers/x-2.png"). Returns
// { full, small, width, height } with site-relative paths, or null if no PNG.
function deriveCover(cover) {
  if (!cover || !/\.png$/i.test(cover)) return null;
  const src = path.join(SITE_DIR, cover);
  if (!fs.existsSync(src)) return null;
  const base = cover.replace(/\.png$/i, '');
  const full = base + '.jpg', small = base + '-' + SMALL_WIDTH + '.jpg';
  const fullPath = path.join(SITE_DIR, full), smallPath = path.join(SITE_DIR, small);
  let dim = png.dimensions(fs.readFileSync(src));
  if (!fresh(fullPath, src) || !fresh(smallPath, src)) {
    const img = png.decode(fs.readFileSync(src));
    fs.writeFileSync(fullPath, jpeg.encode(img, QUALITY_FULL));
    const sh = Math.round(img.height * SMALL_WIDTH / img.width);
    fs.writeFileSync(smallPath, jpeg.encode(png.resize(img, SMALL_WIDTH, sh), QUALITY_SMALL));
    dim = { width: img.width, height: img.height };
    console.log(`  derived ${full} (${(fs.statSync(fullPath).size / 1024).toFixed(0)} KB) and ${small} (${(fs.statSync(smallPath).size / 1024).toFixed(0)} KB)`);
  }
  return { full, small, width: dim.width, height: dim.height, smallWidth: SMALL_WIDTH, smallHeight: Math.round(dim.height * SMALL_WIDTH / dim.width) };
}

// Width and height of a JPEG from its first SOF marker (baseline or progressive).
function jpegDimensions(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('not a JPEG');
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error('JPEG has no SOF marker');
}

// { width, height } of a site-relative image ("assets/banners/x.jpg"), or null
// if the file is missing or not a PNG/JPEG. Used to write width/height on <img>.
function imageSize(sitePath) {
  if (!sitePath || /^(https?:)?\/\//i.test(sitePath)) return null;
  const file = path.join(SITE_DIR, sitePath.replace(/^\/+/, ''));
  if (!fs.existsSync(file)) return null;
  try {
    const buf = fs.readFileSync(file);
    if (/\.png$/i.test(file)) return png.dimensions(buf);
    if (/\.jpe?g$/i.test(file)) return jpegDimensions(buf);
  } catch (e) { /* unreadable: no size attributes */ }
  return null;
}

module.exports = { deriveCover, imageSize, jpegDimensions, SMALL_WIDTH };
