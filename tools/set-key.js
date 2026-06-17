#!/usr/bin/env node
// set-key.js — store the ContentMaschine API key user-level (NOT in the repo).
//
// Writes ~/.config/contentmaschine/credentials (chmod 600). Run this once per machine
// (e.g. on a fresh install at a friend's computer). The app reads the key from there;
// without it, the editor and gallery still work and only generation is disabled.
//
// Usage:
//   node tools/set-key.js                 # prompts for the key (hidden)
//   node tools/set-key.js --key sk-cm-…   # non-interactive
//   CM_KEY=sk-cm-… node tools/set-key.js  # from env
//   node tools/set-key.js --base https://contentmaschine.ai/api/v1   # optional base URL
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const DEFAULT_BASE = 'https://contentmaschine.ai/api/v1';
const dir = path.join(os.homedir(), '.config', 'contentmaschine');
const file = path.join(dir, 'credentials');

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 ? process.argv[i + 1] : null;
}

function write(key, base) {
  key = String(key || '').trim();
  if (!/^sk-cm-/.test(key)) { console.error('set-key: that does not look like a ContentMaschine key (expected sk-cm-…).'); process.exit(1); }
  fs.mkdirSync(dir, { recursive: true });
  const body = '# ContentMaschine API — user-level credentials (NOT in any repo or project)\n'
    + 'CONTENTMASCHINE_API_KEY=' + key + '\n'
    + 'CONTENTMASCHINE_BASE_URL=' + (base || DEFAULT_BASE) + '\n';
  fs.writeFileSync(file, body, { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch (e) {}
  console.log('✓ saved key to ' + file + ' (chmod 600).');
  console.log('  Restart the server if it is running:  npm run serve');
}

const base = arg('base') || DEFAULT_BASE;
const fromFlag = arg('key') || process.env.CM_KEY;
if (fromFlag) { write(fromFlag, base); }
else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // best-effort masking of the typed key
  rl._writeToOutput = function (s) { if (rl.stdoutMuted && s !== '\r\n') rl.output.write('*'); else rl.output.write(s); };
  process.stdout.write('Paste your ContentMaschine API key (sk-cm-…): ');
  rl.stdoutMuted = true;
  rl.question('', function (answer) { rl.stdoutMuted = false; rl.output.write('\n'); rl.close(); write(answer, base); });
}
