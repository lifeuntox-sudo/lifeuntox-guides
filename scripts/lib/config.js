'use strict';
// Shared paths and environment loading for every script in /scripts.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SITE_DIR = path.join(ROOT, 'site');
const CONTENT_DIR = path.join(ROOT, 'content');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const COVERS_DIR = path.join(SITE_DIR, 'assets', 'covers');
const DEFAULT_SITE_URL = 'https://guides.lifeuntox.com';

// Sponsor placements. false = the NOTOXCHEF header lockup, :::promo card,
// :::cta block and the Partners footer column are left out of every built page.
// Guides keep their :::promo and :::cta blocks in Markdown so they are ready
// to switch back on. Set to true and rebuild to show them again.
const PARTNER_PLACEMENTS = false;

// Reads .env (if present) into process.env without overriding values already set.
function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  if (typeof process.loadEnvFile === 'function') { process.loadEnvFile(file); return; }
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

// Absolute site origin, no trailing slash. Netlify exposes URL (production) and
// DEPLOY_PRIME_URL (deploy previews); SITE_URL overrides both.
function siteUrl() {
  const u = process.env.SITE_URL || process.env.DEPLOY_PRIME_URL || process.env.URL || DEFAULT_SITE_URL;
  return u.replace(/\/+$/, '');
}

module.exports = { ROOT, SITE_DIR, CONTENT_DIR, TEMPLATES_DIR, COVERS_DIR, DEFAULT_SITE_URL, PARTNER_PLACEMENTS, loadEnv, siteUrl };
