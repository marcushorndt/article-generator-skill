#!/usr/bin/env node
// cm-image.js — put yourself into an article cover image via ContentMaschine (CLI).
//
// With  --image: uploads a local source photo (cached) and runs an image-to-image
// edit (`vary`). Without --image: text-to-image (`generate`). Result is saved into
// the article's images/ folder.
//
// Enforced: model "pro" (Nano Banana Pro), aspect ratio 16:9, resolution 2048.
//
// Usage:
//   node tools/cm-image.js --prompt "<prompt>" --article <NN|slug> [--image <selfie>] [--variability 1-5] [--out name.png]
//
// The same engine powers the in-app generator (server.js). API key is read from
// $CONTENTMASCHINE_API_KEY or ~/.config/contentmaschine/credentials.
const path = require('path');
const cm = require('./cm-lib');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');     // articles + images live in the content/ repo

function die(msg) { console.error('cm-image: ' + msg); process.exit(1); }
const log = m => console.log('• ' + m);

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) { const key = k.slice(2); const v = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : 'true'; a[key] = v; }
  }
  return a;
}

(async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.prompt || !a.article) {
    console.log('Usage: node tools/cm-image.js --prompt "<prompt>" --article <NN|slug> [--image <selfie>] [--variability 1-5] [--out name.png]');
    console.log('Enforced: model "pro" (Nano Banana Pro), aspect ratio 16:9, resolution 2048.');
    console.log('With --image: image-to-image (you in the scene). Without: text-to-image.');
    process.exit(a.prompt || a.article || a.image ? 1 : 0);
  }
  const variability = Math.min(5, Math.max(1, parseInt(a.variability || '3', 10)));
  const creds = cm.loadCreds();
  const destDir = cm.resolveImageDir(CONTENT, String(a.article));
  let jobId;
  if (a.image && a.image !== 'true') {
    const fileUuid = await cm.uploadImage(a.image, creds, log);
    jobId = await cm.vary(fileUuid, a.prompt, variability, creds, log);
  } else {
    jobId = await cm.generate(a.prompt, creds, log);
  }
  const result = await cm.pollJob(jobId, creds, s => process.stdout.write('\r• ' + s + ' …   '));
  const dest = await cm.downloadResult(result, destDir, a.out, creds);
  console.log('\n✓ saved ' + path.relative(ROOT, dest));
  console.log('  set  featured_image: "' + path.basename(dest) + '"  in the matching draft frontmatter.');
})().catch(e => die(e.message || String(e)));
