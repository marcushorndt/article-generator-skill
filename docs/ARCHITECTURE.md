## Project architecture

This project is a **small, framework-free Node + static HTML toolchain** for writing, editing, and exporting short-form articles.

The core design principle is: **Markdown files on disk are the single source of truth** (no database).

### Two-repo layout (hard boundary)

One working folder contains **two git repos**:

- **Infra repo (this repo)**: tooling + UI + local server. Safe to publish.
- **Content repo (`content/`)**: author data and drafts. Private. It is **git-ignored** by the infra repo.

The app reads/writes files under `content/`:

- `content/BRAIN.md`
- `content/brainstorms/*.md`
- `content/drafts/*.md`
- `content/published/*.md`
- `content/images/**` (per-article image folders)
- `content/sources/**` (reusable “selfies” / source pics)

### High-level component map

- **View (UI)**: `export.html`
  - Runs as:
    - **Static** (`file://`): copy-only, loads drafts from `drafts-data.js`.
    - **Server** (`http://localhost:4321`): edit + save + status moves + image studio.
- **Controller (API)**: `server.js`
  - Tiny Node `http` server exposing JSON endpoints and serving static files.
- **Model (storage)**: Markdown files under `content/` (plus images).
- **Tooling**: `tools/*.js`, `bootstrap.sh`, `Makefile`

### Data flow (the “single source of truth” loop)

1. **Create/modify content** in `content/{brainstorms,drafts,published}/*.md`.
2. **Edit/export in the UI**:
   - Static mode reads `drafts-data.js`.
   - Server mode reads files live from disk and can write changes back.
3. **(Optional) Rebuild static snapshot** with `npm run build-export` (writes `drafts-data.js`).

### Runtime modes

#### Static export mode (no server)

- Open `export.html` directly (double-click).
- Drafts are loaded from the generated snapshot `drafts-data.js`.
- Intended use: **preview + copy** into a publishing editor.
- Limitations:
  - No saving back to files
  - No status changes (moving files between folders)
  - No image generation / ingestion

Snapshot generation:

- `tools/build-export-data.js` reads `content/{brainstorms,drafts,published}/*.md` and writes:
  - `drafts-data.js` as `window.DRAFTS = { "drafts/NN-slug.md": "<md>", ... }`
- It runs automatically on install via `package.json` `postinstall`.

#### Server mode (edit + save)

- Run `npm run serve` (starts `server.js`).
- Open `http://localhost:4321/` (serves `export.html`).

What changes vs static mode:

- Drafts are loaded live from disk via `GET /api/drafts`.
- Changes persist to disk via `POST /api/save`.
- Status changes **move the file** between folders via `POST /api/status`.
- Image “studio” is enabled (`/api/images`, `/api/image/generate`, `/api/image/ingest`).

API surface (as implemented in `server.js`):

- `GET /api/drafts`
  - Returns an object of `{ "drafts/foo.md": "<file contents>", ... }` across:
    - `content/brainstorms/`, `content/drafts/`, `content/published/`
- `POST /api/save` `{ path, content }`
  - Writes verbatim to `content/<path>`
- `POST /api/status` `{ path, status, content }`
  - Writes to the status folder and removes the old file if the folder changed
- `GET /api/images?article=&image_folder=`
  - Lists image files for the article + reusable `content/sources/` files
- `POST /api/image/generate`
  - Optional: ContentMaschine-backed image generation (see below)
- `POST /api/image/ingest`
  - Accepts a data URL, writes it into the article’s images folder (filename collision-safe)

Important constraint:

- The server is designed for **local use** (no auth). It uses path guards (`safePath`, ROOT checks),
  but it should not be exposed publicly.

### Content model (Markdown + frontmatter)

Each article file is Markdown with YAML-like frontmatter. The schema lives in:

- `templates/article-frontmatter.md`

Key fields the tooling relies on:

- `status`: `brainstorm | draft | published` (drives which folder the file belongs to)
- `image_folder`: relative path to the image folder (usually `../images/<topic>`)
- `featured_image`: filename of the chosen cover image

The body begins after the copy marker:

`<!-- ↓↓↓ COPY FROM HERE INTO YOUR EDITOR ↓↓↓ -->`

The export page enforces “paste-safe” formatting for WYSIWYG editors:

- Body headings start at `##` (no `#` in body)
- Basic Markdown only (`**`/`*`, lists, `>` quotes, `---`, links)
- No tables / raw HTML / footnotes

### Optional image generation (ContentMaschine)

This is **optional**. Without a key, drafting/editing/export still works; only generation is disabled.

Implementation:

- Shared client: `tools/cm-lib.js` (used by the CLI and `server.js`)
- CLI: `tools/cm-image.js`
- Key storage: `~/.config/contentmaschine/credentials` (chmod `600`) written by `tools/set-key.js`

Enforced generator settings (hard-coded in `cm-lib.js`):

- model: `pro`
- aspect ratio: `16:9`
- resolution: `2048`

### Entry points & “where to look first”

- **Local server**: `server.js` (API + static serving)
- **UI**: `export.html` (Quill editor, Turndown for HTML→MD on save, image studio)
- **Initialize content/**: `tools/init-content.js` (skeleton or `git clone` into `content/`)
- **Build static snapshot**: `tools/build-export-data.js` → `drafts-data.js`
- **Image integration**: `tools/cm-lib.js`, `tools/cm-image.js`, `tools/set-key.js`
- **New machine**: `bootstrap.sh` (install + init content + build snapshot)

### Quick command map

```bash
# New machine (installs deps, sets up content/, builds drafts-data.js)
./bootstrap.sh

# Or step-by-step
npm install
npm run init
npm run build-export
npm run serve
```

