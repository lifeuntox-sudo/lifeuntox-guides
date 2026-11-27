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

// Sponsor placements. true = every built page carries the NOTOXCHEF header
// lockup, the :::promo card and the :::cta block (with their banner images).
// false = all of them are left out; guides keep their :::promo and :::cta
// blocks in Markdown so they are ready to switch back on with one rebuild.
const PARTNER_PLACEMENTS = false;

// Untox app placements (guides with `placements: untox`). One place for every guide:
//   calendar: the date tile in the first box (:::promo): month, day and a short note.
//             Left out automatically once the day after `date` has passed, or set it to null.
//   promoFlag / ctaFlag: the pill labels on the top edge of each box.
//   spotsLeft: replaces {{UNTOX_SPOTS}} anywhere in a guide's Markdown. Read it from
//             untox.app/founding and update it before every rebuild during the launch.
//   url: the default button link. note: the fine print under the second box's button.
const UNTOX = {
  calendar: { date: '2026-12-01', note: 'Closes 7 am PT' },
  promoFlag: "You're invited",
  ctaFlag: 'Private Founding Beta',
  spotsLeft: '486',
  url: 'https://untox.app/founding',
  note: 'Untox is built by the Lifeuntox team. The private beta is iPhone only.'
};

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

module.exports = { ROOT, SITE_DIR, CONTENT_DIR, TEMPLATES_DIR, COVERS_DIR, DEFAULT_SITE_URL, PARTNER_PLACEMENTS, UNTOX, loadEnv, siteUrl };
