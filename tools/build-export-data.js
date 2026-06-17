#!/usr/bin/env node
// Snapshots drafts/*.md into drafts-data.js so export.html can offer a dropdown +
// ?draft= parameter offline (file:// can't fetch, but CAN load a <script src>).
// Run after creating/changing drafts:
//   node tools/build-export-data.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const content = path.join(root, 'content');         // articles live in the content/ repo
const DIRS = ['brainstorms', 'drafts', 'published'];
const out = {};
for (const d of DIRS) {
  const dir = path.join(content, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
    out[d + '/' + f] = fs.readFileSync(path.join(dir, f), 'utf8');
  }
}
fs.writeFileSync(path.join(root, 'drafts-data.js'),
  'window.DRAFTS = ' + JSON.stringify(out) + ';\n');
console.log('drafts-data.js: ' + Object.keys(out).length + ' files embedded.');
