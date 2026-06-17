#!/usr/bin/env node
// init-content.js — set up the content/ working folder (the author's private data).
//
// The infra repo ships without content/ (it's a separate private repo). Run this once
// after cloning the infra repo on a new machine:
//
//   node tools/init-content.js                 # create an empty content/ skeleton
//   node tools/init-content.js <git-url>       # clone your private content repo into content/
//
// Idempotent: if content/ already has files, it does nothing.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const DIRS = ['brainstorms', 'drafts', 'published', 'images', 'sources'];
const url = process.argv[2];

if (fs.existsSync(CONTENT) && fs.readdirSync(CONTENT).filter(f => f !== '.DS_Store').length) {
  console.log('content/ already exists — nothing to do.');
  process.exit(0);
}

if (url) {
  console.log('Cloning content repo into content/ …');
  try { cp.execFileSync('git', ['clone', url, CONTENT], { stdio: 'inherit' }); }
  catch (e) { console.error('clone failed: ' + (e.message || e)); process.exit(1); }
  console.log('✓ content/ ready (cloned). Run:  npm run build-export  &&  npm run serve');
  process.exit(0);
}

// empty skeleton
fs.mkdirSync(CONTENT, { recursive: true });
for (const d of DIRS) {
  fs.mkdirSync(path.join(CONTENT, d), { recursive: true });
  fs.writeFileSync(path.join(CONTENT, d, '.gitkeep'), '');
}
const tpl = path.join(ROOT, 'templates', 'BRAIN.template.md');
const brain = path.join(CONTENT, 'BRAIN.md');
if (!fs.existsSync(brain)) fs.writeFileSync(brain, fs.existsSync(tpl) ? fs.readFileSync(tpl) : '# BRAIN.md\n');

console.log('✓ created content/ skeleton:');
console.log('  ' + DIRS.join('/  ') + '/   + BRAIN.md');
console.log('\nMake it your own private repo (recommended):');
console.log('  cd content && git init && git add -A && git commit -m "Initial content"');
console.log('  git remote add origin <your-private-repo-url> && git push -u origin main');
console.log('\nThen:  npm run build-export   (snapshot)   and   npm run serve   (edit page)');
