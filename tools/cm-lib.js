// cm-lib.js — shared ContentMaschine client used by the CLI (cm-image.js) and the
// local server (server.js). One implementation for: load creds, upload a source
// image (cached), text-to-image generate, image-to-image vary, poll a job, download.
//
// Enforced for cover images: model "pro" (Nano Banana Pro), aspect ratio 16:9,
// resolution 2048. The API key is read user-level, never from the repo.
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_BASE = 'https://contentmaschine.ai/api/v1';
const HOST = 'https://contentmaschine.ai';
const CACHE = path.join(os.homedir(), '.config', 'contentmaschine', 'uploads.json');

const ENFORCED = { model: 'pro', aspect_ratio: '16:9', resolution: '2048' };

const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadCreds() {
  if (process.env.CONTENTMASCHINE_API_KEY) {
    return { key: process.env.CONTENTMASCHINE_API_KEY, base: process.env.CONTENTMASCHINE_BASE_URL || DEFAULT_BASE };
  }
  const f = path.join(os.homedir(), '.config', 'contentmaschine', 'credentials');
  if (!fs.existsSync(f)) throw new Error('no API key (set $CONTENTMASCHINE_API_KEY or create ' + f + ')');
  const txt = fs.readFileSync(f, 'utf8');
  const key = (txt.match(/^CONTENTMASCHINE_API_KEY=(.*)$/m) || [])[1];
  const base = (txt.match(/^CONTENTMASCHINE_BASE_URL=(.*)$/m) || [])[1] || DEFAULT_BASE;
  if (!key) throw new Error('CONTENTMASCHINE_API_KEY not found in ' + f);
  return { key: key.trim(), base: base.trim() };
}

function mimeOf(p) {
  const e = path.extname(p).toLowerCase();
  return e === '.png' ? 'image/png' : (e === '.webp' ? 'image/webp' : (e === '.gif' ? 'image/gif' : 'image/jpeg'));
}
const loadCache = () => { try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch (e) { return {}; } };
const saveCache = o => { try { fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(o, null, 2)); } catch (e) {} };

// Resolve --article / image_folder to an images/ folder (explicit folder, direct
// name, prefix match, draft frontmatter, or create).
function resolveImageDir(root, article, imageFolder) {
  const imagesRoot = path.join(root, 'images');
  fs.mkdirSync(imagesRoot, { recursive: true });
  if (imageFolder) {
    const p = path.resolve(root, imageFolder);
    if (p.startsWith(root)) { fs.mkdirSync(p, { recursive: true }); return p; }
  }
  article = String(article || '').trim();
  if (article) {
    if (fs.existsSync(path.join(imagesRoot, article))) return path.join(imagesRoot, article);
    const byPrefix = fs.readdirSync(imagesRoot).find(d => d.startsWith(article.split('-')[0]));
    if (byPrefix) return path.join(imagesRoot, byPrefix);
    for (const dir of ['drafts', 'published', 'brainstorms']) {
      const dd = path.join(root, dir);
      if (!fs.existsSync(dd)) continue;
      const f = fs.readdirSync(dd).find(f => f.startsWith(article.split('-')[0]) && f.endsWith('.md'));
      if (f) {
        const m = fs.readFileSync(path.join(dd, f), 'utf8').match(/^image_folder:\s*"?(.*?)"?\s*$/m);
        if (m && m[1]) { const p = path.resolve(dd, m[1]); fs.mkdirSync(p, { recursive: true }); return p; }
      }
    }
  }
  const p = path.join(imagesRoot, article || 'untitled');
  fs.mkdirSync(p, { recursive: true });
  return p;
}

async function uploadImage(filePath, creds, log) {
  if (!fs.existsSync(filePath)) throw new Error('image not found: ' + filePath);
  const st = fs.statSync(filePath);
  const cacheKey = path.resolve(filePath) + '::' + st.mtimeMs + '::' + st.size;
  const cache = loadCache();
  if (cache[cacheKey]) { log && log('reusing uploaded image (' + cache[cacheKey] + ')'); return cache[cacheKey]; }
  log && log('uploading ' + path.basename(filePath) + ' …');
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(filePath)], { type: mimeOf(filePath) }), path.basename(filePath));
  const r = await fetch(creds.base + '/files/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + creds.key }, body: fd });
  if (!r.ok) throw new Error('upload failed (' + r.status + '): ' + (await r.text()));
  const uuid = (await r.json()).data.file_uuid;
  cache[cacheKey] = uuid; saveCache(cache);
  return uuid;
}

// Text-to-image (no source). Returns job_id.
async function generate(prompt, creds, log) {
  const body = { prompt, model: ENFORCED.model, aspect_ratio: ENFORCED.aspect_ratio, options: { resolution: ENFORCED.resolution } };
  log && log('generate  model=' + ENFORCED.model + ' ar=' + ENFORCED.aspect_ratio);
  const r = await fetch(creds.base + '/images/generate', { method: 'POST', headers: { Authorization: 'Bearer ' + creds.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('generate failed (' + r.status + '): ' + (await r.text()));
  const d = (await r.json()).data;
  log && log('job ' + d.job_id + ' (~' + d.estimated_credits + ' credits)');
  return d.job_id;
}

// Image-to-image (source + prompt). Returns job_id.
async function vary(fileUuid, prompt, variability, creds, log) {
  const body = { file_uuid: fileUuid, prompt, model: ENFORCED.model, aspect_ratio: ENFORCED.aspect_ratio, variability, options: { resolution: ENFORCED.resolution } };
  log && log('vary  model=' + ENFORCED.model + ' ar=' + ENFORCED.aspect_ratio + ' variability=' + variability);
  const r = await fetch(creds.base + '/images/vary', { method: 'POST', headers: { Authorization: 'Bearer ' + creds.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('vary failed (' + r.status + '): ' + (await r.text()));
  const d = (await r.json()).data;
  log && log('job ' + d.job_id + ' (~' + d.estimated_credits + ' credits)');
  return d.job_id;
}

async function pollJob(jobId, creds, onTick) {
  for (let i = 0; i < 120; i++) {
    const r = await fetch(creds.base + '/jobs/' + jobId, { headers: { Authorization: 'Bearer ' + creds.key } });
    const d = (await r.json()).data;
    if (d.status === 'completed') return d.result;
    if (d.status === 'failed' || d.status === 'cancelled') throw new Error('job ' + d.status + ': ' + JSON.stringify(d.error));
    onTick && onTick(d.status);
    await sleep(2500);
  }
  throw new Error('timed out polling job ' + jobId);
}

async function downloadResult(result, destDir, outName, creds) {
  const url = result.download_url.startsWith('http') ? result.download_url : (HOST + result.download_url);
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + creds.key } });
  if (!r.ok) throw new Error('download failed (' + r.status + ')');
  const ct = r.headers.get('content-type') || 'image/png';
  const ext = ct.includes('jpeg') ? 'jpg' : (ct.includes('webp') ? 'webp' : 'png');
  const name = outName || ('cm-pro-' + Date.now() + '.' + ext);
  const dest = path.join(destDir, name);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  return dest;
}

module.exports = { ENFORCED, loadCreds, mimeOf, resolveImageDir, uploadImage, generate, vary, pollJob, downloadResult };
