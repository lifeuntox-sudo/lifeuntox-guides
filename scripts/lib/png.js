'use strict';
// Minimal PNG decode / resize / encode with no dependencies (Node's zlib only).
// Used by make-cover.js to bring generated covers to exactly 1200×1600.
// Supports non-interlaced 8-bit PNGs (grayscale, RGB, palette, with or without
// alpha), which covers what image models return. Output is 8-bit RGB (or RGBA
// when the source has transparency), Paeth-filtered, zlib level 9.
const zlib = require('zlib');

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readChunks(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('Not a PNG file');
  const chunks = []; let p = 8;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8);
    chunks.push({ type, data: buf.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
    if (type === 'IEND') break;
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// Returns { width, height, channels (3 or 4), data: Uint8Array }.
function decode(buf) {
  const chunks = readChunks(buf);
  const ihdr = chunks.find(c => c.type === 'IHDR').data;
  const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4);
  const depth = ihdr[8], colorType = ihdr[9], interlace = ihdr[12];
  if (depth !== 8) throw new Error(`Unsupported PNG bit depth ${depth}`);
  if (interlace) throw new Error('Interlaced PNGs are not supported');
  const plte = chunks.find(c => c.type === 'PLTE'); const trns = chunks.find(c => c.type === 'tRNS');
  const srcCh = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!srcCh) throw new Error(`Unsupported PNG colour type ${colorType}`);
  const raw = zlib.inflateSync(Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data)));
  const stride = width * srcCh;
  const px = new Uint8Array(stride * height);
  let prev = new Uint8Array(stride);
  for (let y = 0, o = 0; y < height; y++) {
    const f = raw[o++]; const line = raw.subarray(o, o + stride); o += stride;
    const cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= srcCh ? cur[i - srcCh] : 0, b = prev[i], c = i >= srcCh ? prev[i - srcCh] : 0;
      const x = line[i];
      cur[i] = f === 0 ? x : f === 1 ? x + a : f === 2 ? x + b : f === 3 ? x + ((a + b) >> 1) : x + paeth(a, b, c);
    }
    px.set(cur, y * stride); prev = cur;
  }
  const hasAlpha = colorType === 4 || colorType === 6 || (colorType === 3 && trns);
  const channels = hasAlpha ? 4 : 3;
  const out = new Uint8Array(width * height * channels);
  for (let i = 0, j = 0; i < width * height; i++, j += channels) {
    let r, g, b, a = 255;
    if (colorType === 2) { r = px[i * 3]; g = px[i * 3 + 1]; b = px[i * 3 + 2]; }
    else if (colorType === 6) { r = px[i * 4]; g = px[i * 4 + 1]; b = px[i * 4 + 2]; a = px[i * 4 + 3]; }
    else if (colorType === 0) { r = g = b = px[i]; }
    else if (colorType === 4) { r = g = b = px[i * 2]; a = px[i * 2 + 1]; }
    else { const k = px[i]; r = plte.data[k * 3]; g = plte.data[k * 3 + 1]; b = plte.data[k * 3 + 2]; if (trns && k < trns.data.length) a = trns.data[k]; }
    out[j] = r; out[j + 1] = g; out[j + 2] = b; if (channels === 4) out[j + 3] = a;
  }
  return { width, height, channels, data: out };
}

// Area-averaging resample (good for downscaling; bilinear-equivalent when upscaling).
function resize(img, dw, dh) {
  const { width: sw, height: sh, channels: ch, data } = img;
  const out = new Uint8Array(dw * dh * ch);
  const sx = sw / dw, sy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const y0 = y * sy, y1 = Math.min(sh, (y + 1) * sy);
    for (let x = 0; x < dw; x++) {
      const x0 = x * sx, x1 = Math.min(sw, (x + 1) * sx);
      const acc = new Float64Array(ch); let wsum = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const wy = Math.min(yy + 1, y1) - Math.max(yy, y0); if (wy <= 0) continue;
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const wx = Math.min(xx + 1, x1) - Math.max(xx, x0); if (wx <= 0) continue;
          const w = wx * wy, p = (yy * sw + xx) * ch;
          for (let c = 0; c < ch; c++) acc[c] += data[p + c] * w;
          wsum += w;
        }
      }
      const o = (y * dw + x) * ch;
      for (let c = 0; c < ch; c++) out[o + c] = Math.round(acc[c] / wsum);
    }
  }
  return { width: dw, height: dh, channels: ch, data: out };
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encode(img) {
  const { width, height, channels, data } = img;
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (stride + 1); raw[o] = 4; // Paeth
    for (let i = 0; i < stride; i++) {
      const p = y * stride + i;
      const a = i >= channels ? data[p - channels] : 0, b = y > 0 ? data[p - stride] : 0, c = y > 0 && i >= channels ? data[p - stride - channels] : 0;
      raw[o + 1 + i] = (data[p] - paeth(a, b, c)) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Reads a PNG's dimensions without decoding it.
function dimensions(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('Not a PNG file');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

module.exports = { decode, resize, encode, dimensions };
