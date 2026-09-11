'use strict';
// Minimal YAML frontmatter reader/writer. Supports the subset the guides use:
//   key: value            strings, numbers, booleans, "quoted", 'quoted'
//   key: [a, b, "c, d"]   inline lists
//   key:                  block lists
//     - item
//   # comments, and trailing "  # comments" after a value

function splitList(s) {
  const out = []; let cur = '', q = null;
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; }
    else if (ch === '"' || ch === "'") { q = ch; cur += ch; }
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

function stripComment(v) {
  v = v.trim();
  if (v[0] === '"' || v[0] === "'") { const end = v.indexOf(v[0], 1); return end > 0 ? v.slice(0, end + 1) : v; }
  const i = v.search(/\s#/);
  return i >= 0 ? v.slice(0, i).trim() : v;
}

function parseValue(v) {
  v = v.trim();
  if (v === '' || v === '~' || v === 'null') return '';
  if ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'"))) return v.slice(1, -1);
  if (v[0] === '[' && v.endsWith(']')) return splitList(v.slice(1, -1)).map(parseValue);
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

// Returns { data, body }. Throws if the file has no frontmatter block.
function parseFrontmatter(src) {
  const m = src.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/);
  if (!m) throw new Error('No frontmatter block (--- ... ---) found');
  const data = {}; let key = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || /^\s*#/.test(raw)) continue;
    const item = raw.match(/^\s+-\s+(.*)$/);
    if (item && key !== null) {
      if (!Array.isArray(data[key])) data[key] = [];
      data[key].push(parseValue(stripComment(item[1])));
      continue;
    }
    const kv = raw.match(/^([A-Za-z_][\w-]*):(?:\s+(.*))?$/);
    if (kv) { key = kv[1]; data[key] = parseValue(stripComment(kv[2] || '')); }
  }
  return { data, body: m[2] };
}

function quoteIfNeeded(v) {
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  if (s === '' || /^[#&*!|>'"%@`{[\]}]/.test(s) || /:\s|\s#/.test(s) || /^(true|false|null|~|-?\d+(\.\d+)?)$/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}

// Replaces (or appends) one top-level key in a Markdown file's frontmatter,
// keeping every other line, comment and ordering intact.
function setFrontmatterField(src, key, value) {
  const m = src.match(/^(﻿?---\r?\n)([\s\S]*?)(\r?\n---[ \t]*\r?\n?)([\s\S]*)$/);
  if (!m) throw new Error('No frontmatter block found');
  const rendered = Array.isArray(value) ? '[' + value.map(quoteIfNeeded).join(', ') + ']' : quoteIfNeeded(value);
  const lines = m[2].split(/\r?\n/);
  const re = new RegExp('^(' + key + ':)(\\s*)([^#]*?)(\\s*#.*)?$');
  let done = false;
  const out = lines.map(l => {
    const mm = l.match(re);
    if (!mm || done) return l;
    done = true;
    const pad = mm[2] && mm[2].length ? mm[2] : ' ';
    return mm[1] + pad + rendered + (mm[4] || '');
  });
  if (!done) out.push(key + ': ' + rendered);
  return m[1] + out.join('\n') + m[3] + m[4];
}

module.exports = { parseFrontmatter, setFrontmatterField, quoteIfNeeded };
