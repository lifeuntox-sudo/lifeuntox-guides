'use strict';
// Minimal baseline JPEG encoder (4:4:4, standard Huffman tables) with no
// dependencies. Used by the build to derive small, fast cover images from
// the 1200×1600 PNGs that make-cover produces. Input: { width, height,
// channels (3|4), data } as produced by ./png.js. Output: Buffer.

const ZIGZAG = [0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63];

const LUMA_Q = [16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99];
const CHROMA_Q = [17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99];

const DC_LUMA_BITS = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const DC_LUMA_VALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const AC_LUMA_BITS = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d];
const AC_LUMA_VALS = [0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa];
const DC_CHROMA_BITS = [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const DC_CHROMA_VALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const AC_CHROMA_BITS = [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77];
const AC_CHROMA_VALS = [0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71, 0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0, 0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa];

// bits[i] = number of codes of length i+1 (16 entries). Returns { code, len } per symbol.
function buildHuffman(bits, vals) {
  const table = new Array(256);
  let code = 0, k = 0;
  for (let len = 1; len <= 16; len++) {
    for (let i = 0; i < bits[len - 1]; i++) { table[vals[k++]] = { code, len }; code++; }
    code <<= 1;
  }
  return table;
}

function scaledTable(base, quality) {
  const q = Math.max(1, Math.min(100, quality));
  const scale = q < 50 ? Math.floor(5000 / q) : 200 - q * 2;
  return base.map(v => Math.max(1, Math.min(255, Math.floor((v * scale + 50) / 100))));
}

// Precomputed cosine table for the float DCT.
const COS = new Float64Array(64);
for (let u = 0; u < 8; u++) for (let x = 0; x < 8; x++) COS[u * 8 + x] = Math.cos((2 * x + 1) * u * Math.PI / 16);
const C0 = 1 / Math.SQRT2;

function dct8x8(block, out) {
  const tmp = new Float64Array(64);
  for (let y = 0; y < 8; y++) for (let u = 0; u < 8; u++) {
    let s = 0; for (let x = 0; x < 8; x++) s += block[y * 8 + x] * COS[u * 8 + x];
    tmp[y * 8 + u] = s * (u === 0 ? C0 : 1) / 2;
  }
  for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) {
    let s = 0; for (let y = 0; y < 8; y++) s += tmp[y * 8 + u] * COS[v * 8 + y];
    out[v * 8 + u] = s * (v === 0 ? C0 : 1) / 2;
  }
}

class BitWriter {
  constructor() { this.bytes = []; this.acc = 0; this.n = 0; }
  write(code, len) {
    for (let i = len - 1; i >= 0; i--) {
      this.acc = (this.acc << 1) | ((code >> i) & 1); this.n++;
      if (this.n === 8) { this.bytes.push(this.acc); if (this.acc === 0xff) this.bytes.push(0); this.acc = 0; this.n = 0; }
    }
  }
  flush() { while (this.n) this.write(1, 1); }
}

function category(v) { let a = Math.abs(v), c = 0; while (a) { c++; a >>= 1; } return c; }
function bitsOf(v, cat) { return v >= 0 ? v : v + (1 << cat) - 1; }

function encode(img, quality = 82) {
  const { width, height, channels, data } = img;
  const qL = scaledTable(LUMA_Q, quality), qC = scaledTable(CHROMA_Q, quality);
  const dcL = buildHuffman(DC_LUMA_BITS, DC_LUMA_VALS), acL = buildHuffman(AC_LUMA_BITS, AC_LUMA_VALS);
  const dcC = buildHuffman(DC_CHROMA_BITS, DC_CHROMA_VALS), acC = buildHuffman(AC_CHROMA_BITS, AC_CHROMA_VALS);

  const w = new BitWriter();
  const block = new Float64Array(64), coef = new Float64Array(64), q = new Int32Array(64);
  const prevDC = [0, 0, 0];

  function encodeBlock(comp, qt, dcT, acT) {
    dct8x8(block, coef);
    for (let i = 0; i < 64; i++) q[i] = Math.round(coef[ZIGZAG[i]] / qt[ZIGZAG[i]]);
    const diff = q[0] - prevDC[comp]; prevDC[comp] = q[0];
    const dcat = category(diff); const h = dcT[dcat]; w.write(h.code, h.len); if (dcat) w.write(bitsOf(diff, dcat), dcat);
    let run = 0;
    for (let i = 1; i < 64; i++) {
      const v = q[i];
      if (v === 0) { run++; continue; }
      while (run > 15) { const z = acT[0xf0]; w.write(z.code, z.len); run -= 16; }
      const cat = category(v); const s = acT[(run << 4) | cat]; w.write(s.code, s.len); w.write(bitsOf(v, cat), cat); run = 0;
    }
    if (run) { const e = acT[0]; w.write(e.code, e.len); }
  }

  const Y = new Float64Array(64), Cb = new Float64Array(64), Cr = new Float64Array(64);
  for (let by = 0; by < height; by += 8) for (let bx = 0; bx < width; bx += 8) {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const px = Math.min(width - 1, bx + x), py = Math.min(height - 1, by + y);
      const p = (py * width + px) * channels;
      const r = data[p], g = data[p + 1], b = data[p + 2];
      const i = y * 8 + x;
      Y[i] = 0.299 * r + 0.587 * g + 0.114 * b - 128;
      Cb[i] = -0.168736 * r - 0.331264 * g + 0.5 * b;
      Cr[i] = 0.5 * r - 0.418688 * g - 0.081312 * b;
    }
    block.set(Y); encodeBlock(0, qL, dcL, acL);
    block.set(Cb); encodeBlock(1, qC, dcC, acC);
    block.set(Cr); encodeBlock(2, qC, dcC, acC);
  }
  w.flush();

  const out = [];
  const u16 = v => [(v >> 8) & 0xff, v & 0xff];
  out.push(0xff, 0xd8);                                                    // SOI
  out.push(0xff, 0xe0, ...u16(16), 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0); // APP0 JFIF
  const dqt = (id, t) => { out.push(0xff, 0xdb, ...u16(67), id); for (let i = 0; i < 64; i++) out.push(t[ZIGZAG[i]]); };
  dqt(0, qL); dqt(1, qC);
  out.push(0xff, 0xc0, ...u16(17), 8, ...u16(height), ...u16(width), 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1); // SOF0
  const dht = (cls, id, bits, vals) => { out.push(0xff, 0xc4, ...u16(3 + 16 + vals.length), (cls << 4) | id, ...bits, ...vals); };
  dht(0, 0, DC_LUMA_BITS, DC_LUMA_VALS); dht(1, 0, AC_LUMA_BITS, AC_LUMA_VALS);
  dht(0, 1, DC_CHROMA_BITS, DC_CHROMA_VALS); dht(1, 1, AC_CHROMA_BITS, AC_CHROMA_VALS);
  out.push(0xff, 0xda, ...u16(12), 3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 63, 0);   // SOS
  const head = Buffer.from(out);
  return Buffer.concat([head, Buffer.from(w.bytes), Buffer.from([0xff, 0xd9])]);
}

module.exports = { encode };
