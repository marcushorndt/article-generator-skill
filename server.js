#!/usr/bin/env node
// Tiny local server for the export/edit page. The markdown files are the store (no DB).
// Files live in three folders that mirror status: brainstorms/ | drafts/ | published/.
//   GET  /api/drafts   -> { "drafts/NN-slug.md": "<content>", ... } across all folders
//   POST /api/save     -> { path, content }          writes that file verbatim
//   POST /api/status   -> { path, status, content }   writes into the status folder,
//                         removes the old file if it moved; returns the new path
//   GET  /api/images   -> ?article=&image_folder=  list a draft's images + source pics
//   POST /api/image/generate -> { article, image_folder, prompt, variability,
//                         source | sourceData+sourceName }  ContentMaschine: vary if a
//                         source image is given, else text-to-image generate; saved local
// Run:  npm run serve   then open  http://localhost:4321/
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
let cm = null; try { cm = require('./tools/cm-lib'); } catch (e) {}   // optional image feature

const ROOT = __dirname;                                              // infra (this repo)
const CONTENT = path.join(ROOT, 'content');                          // articles + images (separate repo)
const DIRS = ['brainstorms', 'drafts', 'published'];
const SOURCES = 'sources';                                           // reusable profile/source pics
const PORT = process.env.PORT || 4321;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif'
};
const IMG_RE = /\.(png|jpe?g|webp|gif)$/i;
// list image files in a folder as { name, url } (url = server path under ROOT)
function listImages(absDir) {
  if (!absDir || !fs.existsSync(absDir)) return [];
  const rel = path.relative(ROOT, absDir).split(path.sep).join('/');
  return fs.readdirSync(absDir).filter(f => IMG_RE.test(f)).sort()
    .map(f => ({ name: f, url: '/' + rel + '/' + encodeURIComponent(f) }));
}

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}
function statusToDir(s) { return s === 'published' ? 'published' : (s === 'brainstorm' ? 'brainstorms' : 'drafts'); }
// accept only "<allowed-dir>/<NN-slug>.md"
function safePath(p) {
  if (typeof p !== 'string') return null;
  const parts = p.split('/');
  if (parts.length !== 2) return null;
  if (DIRS.indexOf(parts[0]) < 0) return null;
  if (!/^[\w.-]+\.md$/.test(parts[1])) return null;
  return parts[0] + '/' + parts[1];
}
function readBody(req, cb) {
  let body = '';
  req.on('data', c => { body += c; if (body.length > 5e6) req.destroy(); });
  req.on('end', () => { try { cb(JSON.parse(body)); } catch (e) { cb(null); } });
}

const server = http.createServer(function (req, res) {
  const u = url.parse(req.url, true);

  if (req.method === 'GET' && u.pathname === '/api/drafts') {
    const out = {};
    for (const d of DIRS) {
      const dir = path.join(CONTENT, d);
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
        out[d + '/' + f] = fs.readFileSync(path.join(dir, f), 'utf8');
      }
    }
    return send(res, 200, JSON.stringify(out), MIME['.json']);
  }

  if (req.method === 'POST' && u.pathname === '/api/save') {
    return readBody(req, function (data) {
      if (!data) return send(res, 400, 'bad json');
      const p = safePath(data.path);
      if (!p) return send(res, 400, 'bad path');
      if (typeof data.content !== 'string') return send(res, 400, 'no content');
      fs.writeFileSync(path.join(CONTENT, p), data.content, 'utf8');
      console.log('saved ' + p);
      return send(res, 200, JSON.stringify({ ok: true, path: p }), MIME['.json']);
    });
  }

  if (req.method === 'POST' && u.pathname === '/api/status') {
    return readBody(req, function (data) {
      if (!data) return send(res, 400, 'bad json');
      const p = safePath(data.path);
      if (!p) return send(res, 400, 'bad path');
      if (typeof data.content !== 'string') return send(res, 400, 'no content');
      const name = p.split('/')[1];
      const dir = statusToDir(data.status);
      const newPath = dir + '/' + name;
      fs.mkdirSync(path.join(CONTENT, dir), { recursive: true });
      fs.writeFileSync(path.join(CONTENT, newPath), data.content, 'utf8');
      if (newPath !== p) { try { fs.unlinkSync(path.join(CONTENT, p)); } catch (e) {} console.log('moved ' + p + ' -> ' + newPath); }
      else console.log('status set in ' + p);
      return send(res, 200, JSON.stringify({ ok: true, path: newPath }), MIME['.json']);
    });
  }

  // ---- Images: list a draft's images + reusable source pictures ----
  if (req.method === 'GET' && u.pathname === '/api/images') {
    if (!cm) return send(res, 200, JSON.stringify({ ok: false, available: false, files: [], sources: [] }), MIME['.json']);
    let dir;
    try { dir = cm.resolveImageDir(CONTENT, u.query.article || '', u.query.image_folder || ''); }
    catch (e) { return send(res, 200, JSON.stringify({ ok: false, files: [], sources: [] }), MIME['.json']); }
    const sourcesDir = path.join(CONTENT, SOURCES);
    let hasKey = true; try { cm.loadCreds(); } catch (e) { hasKey = false; }
    return send(res, 200, JSON.stringify({
      ok: true, available: hasKey,
      folder: path.relative(CONTENT, dir).split(path.sep).join('/'),   // e.g. "images/03" → frontmatter "../images/03"
      files: listImages(dir), sources: listImages(sourcesDir)
    }), MIME['.json']);
  }

  // ---- Generate a cover image (ContentMaschine). Held open until the job finishes. ----
  if (req.method === 'POST' && u.pathname === '/api/image/generate') {
    if (!cm) return send(res, 503, JSON.stringify({ ok: false, error: 'image tool not available' }), MIME['.json']);
    return readBody(req, async function (data) {
      if (!data || !data.prompt) return send(res, 400, JSON.stringify({ ok: false, error: 'prompt required' }), MIME['.json']);
      try {
        const creds = cm.loadCreds();
        const destDir = cm.resolveImageDir(CONTENT, data.article || '', data.image_folder || '');
        // Resolve a source image: uploaded data, or an existing path under ROOT.
        let sourcePath = null;
        if (data.sourceData && data.sourceName) {
          const m = String(data.sourceData).match(/^data:([^;]+);base64,(.*)$/);
          if (!m) throw new Error('bad sourceData');
          const safeName = path.basename(String(data.sourceName)).replace(/[^\w.-]/g, '_');
          fs.mkdirSync(path.join(CONTENT, SOURCES), { recursive: true });
          sourcePath = path.join(CONTENT, SOURCES, safeName);
          fs.writeFileSync(sourcePath, Buffer.from(m[2], 'base64'));
        } else if (data.source) {
          const abs = path.normalize(path.join(ROOT, decodeURIComponent(String(data.source).replace(/^\//, ''))));
          if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || !IMG_RE.test(abs)) throw new Error('bad source image');
          sourcePath = abs;
        }
        const variability = Math.min(5, Math.max(1, parseInt(data.variability || '3', 10)));
        let jobId;
        if (sourcePath) {
          const uuid = await cm.uploadImage(sourcePath, creds, m => console.log('cm: ' + m));
          jobId = await cm.vary(uuid, data.prompt, variability, creds, m => console.log('cm: ' + m));
        } else {
          jobId = await cm.generate(data.prompt, creds, m => console.log('cm: ' + m));
        }
        const result = await cm.pollJob(jobId, creds, s => process.stdout.write('\rcm: ' + s + ' …   '));
        const dest = await cm.downloadResult(result, destDir, null, creds);
        const rel = path.relative(ROOT, dest).split(path.sep).join('/');
        console.log('\ncm: saved ' + rel);
        return send(res, 200, JSON.stringify({ ok: true, file: { name: path.basename(dest), url: '/' + rel }, mode: sourcePath ? 'vary' : 'generate' }), MIME['.json']);
      } catch (e) {
        console.error('cm error:', e.message || e);
        return send(res, 500, JSON.stringify({ ok: false, error: String(e.message || e) }), MIME['.json']);
      }
    });
  }

  // ---- Ingest an external image (drag & drop) into the article's images/ folder ----
  if (req.method === 'POST' && u.pathname === '/api/image/ingest') {
    if (!cm) return send(res, 503, JSON.stringify({ ok: false, error: 'image tool not available' }), MIME['.json']);
    return readBody(req, function (data) {
      if (!data || !data.data) return send(res, 400, JSON.stringify({ ok: false, error: 'no image data' }), MIME['.json']);
      try {
        const m = String(data.data).match(/^data:(image\/[^;]+);base64,(.*)$/);
        if (!m) return send(res, 400, JSON.stringify({ ok: false, error: 'not an image' }), MIME['.json']);
        const destDir = cm.resolveImageDir(CONTENT, data.article || '', data.image_folder || '');
        const ext = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' }[m[1]] || '.png';
        let base = path.basename(String(data.name || 'dropped')).replace(/\.[^.]+$/, '').replace(/[^\w.-]/g, '_') || 'dropped';
        let name = base + ext, n = 1;
        while (fs.existsSync(path.join(destDir, name))) { name = base + '-' + (n++) + ext; }   // don't clobber
        fs.writeFileSync(path.join(destDir, name), Buffer.from(m[2], 'base64'));
        const rel = path.relative(ROOT, path.join(destDir, name)).split(path.sep).join('/');
        console.log('ingested ' + rel);
        return send(res, 200, JSON.stringify({ ok: true, file: { name, url: '/' + rel } }), MIME['.json']);
      } catch (e) {
        return send(res, 500, JSON.stringify({ ok: false, error: String(e.message || e) }), MIME['.json']);
      }
    });
  }

  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/export.html';
  const filePath = path.normalize(path.join(ROOT, p));
  if (!filePath.startsWith(ROOT)) return send(res, 403, 'forbidden');
  fs.readFile(filePath, function (err, buf) {
    if (err) return send(res, 404, 'not found');
    send(res, 200, buf, MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  });
});

server.listen(PORT, function () {
  console.log('Article export server  →  http://localhost:' + PORT + '/');
  console.log('Edit, save, and move between brainstorms/ drafts/ published/ by status. Ctrl+C to stop.');
});
