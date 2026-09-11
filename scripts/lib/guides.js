'use strict';
// guides.json: the directory data. One object per guide, in display order.
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./config');

const FILE = path.join(ROOT, 'guides.json');

function load() {
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

// Pretty JSON with short string arrays (keywords) kept on one line.
function stringify(guides) {
  return JSON.stringify(guides, null, 2)
    .replace(/\[\n\s+((?:"(?:[^"\\]|\\.)*"(?:,\n\s+)?)+)\n\s+\]/g, (m, inner) => '[' + inner.replace(/,\n\s+/g, ', ') + ']');
}

function save(guides) {
  fs.writeFileSync(FILE, stringify(guides) + '\n');
}

module.exports = { FILE, load, save, stringify };
