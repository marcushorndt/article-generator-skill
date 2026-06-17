# Article Generator Skill

A writing system that gets better with every article. Each new draft builds on the
voice, stance, and structure of the previous ones — driven by `BRAIN.md`. Ships with
a `/article` Claude Code skill and a provider-agnostic export page for pasting
finished drafts into any WYSIWYG editor (Substack, Ghost, Medium, WordPress, …).

> The system itself is language-agnostic. The author's data (drafts, brainstorms,
> images, and the `BRAIN.md` voice guide) lives in a **separate private repo** under
> `content/` — see [Two-repo layout](#two-repo-layout). This repo is infrastructure only.

## Two-repo layout

One working folder, two git repos:

- **This repo (infrastructure)** — the skill, `tools/`, `server.js`, `export.html`,
  `templates/`, docs. Safe to publish (e.g. on GitHub).
- **`content/` (private)** — `BRAIN.md`, `brainstorms/`, `drafts/`, `published/`,
  `images/`, `sources/`. Its own git repo; `content/` is git-ignored here so the two
  never mix. Keep it on a private remote.

The app reads and writes the article files under `content/`. After cloning the infra
repo on a new machine, clone your content repo into `content/` (and run `npm run set-key`).

## Setup

```
npm install        # fetches Quill + Turndown; postinstall builds the export snapshot
npm run set-key    # optional: store your ContentMaschine key (once per machine)
```

`set-key` writes the key user-level to `~/.config/contentmaschine/credentials`
(chmod 600) — **never** into the repo. It's per-machine: clone on another computer and
just run `npm run set-key` there (or `make set-key KEY=sk-cm-…`, or set
`$CONTENTMASCHINE_API_KEY`). Without a key, the editor and gallery work normally and only
image generation is disabled (the app says so). See
[ContentMaschine image API](#contentmaschine-image-api-optional).

Two ways to use the export page:

- **Static (copy only):** double-click `export.html`. Reads drafts from the generated
  `drafts-data.js`; pick / preview / copy. Re-run `npm run build-export` after changing
  drafts so they show up. No saving.
- **Server (edit + save):** `npm run serve`, then open <http://localhost:4321/>. Drafts
  load live from disk and **Save to file** writes your inline edits back to
  `drafts/<name>.md`. No database — the markdown files are the store.

`node_modules/` and the generated `drafts-data.js` are git-ignored.

## Folder structure

| Path                          | Contents                                                          |
|-------------------------------|-------------------------------------------------------------------|
| `content/` *(private repo)*   | All author data (below). Git-ignored by this repo.                |
| `content/BRAIN.md`            | The writing brain: voice, stance, structure, memorized approaches.|
| `content/brainstorms/`        | Raw brainstorms for new articles (input).                         |
| `content/drafts/`             | Generated drafts + existing reference articles (`NN-slug.md`).    |
| `content/published/`          | Final, published articles.                                        |
| `content/images/<topic>/`     | Cover-image candidates per article/topic.                         |
| `content/sources/`            | Reusable profile/source pictures (selfies) for AI generation.     |
| `templates/`                  | Frontmatter template for articles.                                |
| `tools/cm-lib.js`             | ContentMaschine client shared by the CLI and the server.          |
| `tools/cm-image.js`           | CLI to generate/vary a cover image.                               |
| `tools/build-export-data.js`  | Snapshots `content/drafts/` into `drafts-data.js` for the page.   |
| `server.js`                   | Local edit/save server + in-app image generator.                  |
| `export.html`                 | Local page: render a draft, edit it, generate images, copy out.   |
| `.claude/skills/article/`     | The `/article` skill (open this folder as your workspace).        |

## Workflow

1. **Drop a brainstorm** as a file in `brainstorms/` (or paste it in chat).
2. **Run `/article`** — it reads `BRAIN.md` + existing drafts as style reference,
   plans promise-backward, and writes a new draft into `drafts/`.
3. **Feed the brain** — "memorize this" / "remember this approach" appends to
   `BRAIN.md`, so every future article benefits.

The `/article` skill (`.claude/skills/article/SKILL.md`) drives all three steps.

## Frontmatter

Every article (brainstorm & draft) carries frontmatter — see
`templates/article-frontmatter.md`. Required for good drafts: `promise`,
`core_message`, `hook`, `audience`. Images are linked via `image_folder`
(→ `images/<topic>/`) and `featured_image`.

## Exporting to your editor

Pick a draft → fix it up → copy into your publishing editor (Substack, Ghost, Medium…):

1. **Dropdown** selects a draft (newest first); it renders instantly.
2. **Title** & **subtitle** are editable in place (click, edit, blur) and copy into your
   editor's own fields.
3. **Body** is an inline rich-text editor (Quill) — fix typos/wording, then **"Copy body
   as rich text"** pastes into the WYSIWYG editor with formatting intact.
4. **Image**: "Copy image" on the thumbnail and paste (the editor uploads it). First
   image = cover/featured. Editors don't embed image URLs.
5. **Save to file** (server mode) writes your edits back to `drafts/<name>.md` — the
   body is converted back to Markdown in your draft's existing style.
6. **Generate images** (server mode) — see the next section.

Deep link: `export.html?draft=04` (or `?draft=patholog`).

## Generating cover images in the app (server mode)

Run `npm run serve` and open <http://localhost:4321/>. The **Image** panel of each draft
is a small studio backed by [ContentMaschine](#contentmaschine-image-api-optional):

1. **Prompt** — describe the cover scene.
2. **Source** (optional) — pick a selfie from `sources/`, an existing image of this
   article, or **upload a selfie** (it's saved to `sources/` for reuse). With a source
   it's image-to-image (your likeness carries over); with none it's text-to-image.
3. **Variability** (1–5, image-to-image only) and **Generate 16:9** — enforced model
   `pro` (Nano Banana Pro), 16:9, 2048px. The job runs server-side (~1–3 min).
4. The result drops into the **gallery** below; **Copy** pastes it into your editor,
   **Set featured** writes `featured_image`/`image_folder` into the draft.

Everything is saved into the article's `images/<topic>/` folder — the markdown files and
folders remain the single source of truth (no database). Same engine on the CLI:
`make image PROMPT="…" ARTICLE=04 [IMAGE=sources/me.jpg]`.

## Editor rules baked into every draft

- Body starts at `##` (H2) — never `#`; title/subtitle go into the editor's own fields.
- Paste-safe Markdown only: `**bold**`, `*italic*`, lists, `>` quote, `---` divider,
  `[text](url)`. No tables, no raw HTML, no footnotes.
- A copy marker `<!-- ↓↓↓ COPY FROM HERE INTO YOUR EDITOR ↓↓↓ -->` separates the
  machine frontmatter from the paste-ready body.

## ContentMaschine image API (optional)

For generating / editing cover and inline images. Reference for what's available.

**Auth.** HTTP Bearer: `Authorization: Bearer sk-cm-…`. The key is **not** stored in
this repo — it lives user-level at `~/.config/contentmaschine/credentials`
(perms `600`), with `CONTENTMASCHINE_API_KEY` and `CONTENTMASCHINE_BASE_URL`. Load it
into the env, e.g. `export $(grep -v '^#' ~/.config/contentmaschine/credentials | xargs)`.

**Base URL.** `https://contentmaschine.ai/api/v1` (downloads: `https://contentmaschine.ai{download_url}`).

**Endpoints.**

| Method & path | Purpose |
|---|---|
| `POST /files/upload` | **Upload a user image** (multipart, field `file`; PNG/JPEG/WebP/GIF, ≤25 MB) → `data.file_uuid` |
| `POST /images/vary` | **Image edit / image-to-image** — transform an uploaded image by prompt (async) |
| `POST /images/generate` | Text-to-image (async) |
| `POST /images/fuse` | Combine 2–10 images with a prompt |
| `POST /images/remove-background` | AI background removal (sync) |
| `POST /images/upscale` + `GET /images/upscale-status` | Upscale |
| `POST /images/describe` | Caption/describe an image |
| `GET /jobs/{job_id}` | Poll an async job |
| `GET /models`, `GET /gallery`, `GET /gallery/{uuid}` | List models / your generations |

**Upload → edit (the two you asked for).**

1. `POST /files/upload` (multipart `file`) → `{ data: { file_uuid, mime_type, width, height, size_bytes } }`.
2. `POST /images/vary` with the source uuid:
   ```jsonc
   {
     "file_uuid": "<uuid from upload>",   // required
     "prompt": "Same composition, but at sunset",  // required: edit direction
     "model": "standard",        // standard | pro | flux | seedream | seedream5
     "aspect_ratio": "16:9",     // 1:1 16:9 9:16 4:3 3:4 3:2 2:3 (omit = keep source)
     "variability": 1,           // 1 (subtle) … 5 (experimental)
     "options": { "resolution": 2048 }   // model-specific (pro: 1024|2048|4096)
   }
   ```
   → `202 { data: { job_id, generation_uuid, status: "pending", estimated_credits } }`.
3. Poll `GET /jobs/{job_id}` until `data.status === "completed"`, then download
   `data.result.download_url` with the Bearer token.

`POST /images/generate` works the same (async + poll) but takes only `prompt`
(+ `model`, `aspect_ratio`, `options` like `seed`, `quality`). `remove-background`
is synchronous and returns a `download_url` directly.
