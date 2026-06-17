# Changelog

All notable changes are documented here.
Format: [Keep a Changelog](https://keepachangelog.com); versioning: [SemVer](https://semver.org).
Pre-1.0 (`0.x`): minor versions may include breaking changes.

## [Unreleased]

### Added
- **In-app image generation.** The export page's Image panel is now a studio: write a
  prompt, optionally pick a **source image** (a selfie from `sources/`, an existing
  article image, or upload a new selfie — saved to `sources/` for reuse), set
  variability, and **Generate 16:9**. Results land in a **gallery** with **Copy** and
  **Set featured** (writes `featured_image`/`image_folder`). Backed by new server
  endpoints `GET /api/images` and `POST /api/image/generate` (image-to-image `vary`
  with a source, else text-to-image `generate`; model `pro`, 16:9, 2048).
- **`sources/`** folder for reusable profile/source pictures (selfies).
- **`tools/cm-lib.js`** — shared ContentMaschine client used by both the CLI
  (`cm-image.js`) and the server, now including the text-to-image `generate` path.
- **Gallery layout**: a large preview of the selected/featured cover on top, with a
  horizontally scrollable / drag-to-scroll strip of thumbnail slots below to pick the
  featured image. Live thumbnail preview next to the source dropdown.
- **`set-key`** (`npm run set-key` / `make set-key`) — store the ContentMaschine key
  user-level on a new machine. The app degrades gracefully without a key (editor +
  gallery work; generation is disabled with an in-app hint).
- The generator prompt + source selection are remembered per draft in `localStorage`.
- **Drag & drop** an external image onto the cover preview to ingest it into the
  article's `images/` folder and set it as the featured cover (`POST /api/image/ingest`,
  collision-safe filenames). Works without an API key.

### Changed
- `tools/cm-image.js` is now a thin CLI over `cm-lib.js`; `--image` is optional
  (omit it for text-to-image). `make image` no longer requires `IMAGE`.
- The generate form (prompt, source, variability, upload, button) is disabled while a
  job is running — one generation at a time.

## [0.2.0] — 2026-06-17

### Added
- **Status moves files.** A status chip in the export page (and `POST /api/status`) moves
  a draft between `brainstorms/ drafts/ published/` and updates its frontmatter.
- Title/subtitle **save on blur**; an **unsaved-changes guard** (`beforeunload` confirm).
- **ContentMaschine image integration** — `tools/cm-image.js`: uploads a photo of the
  author (cached) and runs an image-to-image edit (`vary`) to make a **16:9 cover image
  with the author in it**, model `pro` (Nano Banana Pro); saved into the article's
  `images/` folder. API documented in README; key stored user-level outside the repo.
- `Makefile` with `install` / `serve` / `build` / `image` targets.

### Changed
- Export page lists all three folders by `folder/name` path; the status control moved
  from the header into the meta chip.

## [0.1.0] — 2026-06-17

First working release.

### Added
- **`/article` skill** — generate short-form drafts from a brainstorm, written against
  `BRAIN.md`; revise drafts; extend the brain via "memorize this".
- **`BRAIN.md`** — the writing brain: voice, stance, audience, structure, do/don'ts,
  recurring themes, and a growing "Memorized" section.
- **Frontmatter template** (`templates/article-frontmatter.md`) and an English schema
  for drafts and brainstorms.
- **`export.html`** — provider-agnostic export page: pick a draft, edit title/subtitle
  and body inline (Quill), copy as rich text into any WYSIWYG editor (Substack, Ghost,
  Medium, …); copy cover image; status/meta panel; newest-first dropdown; `?draft=`.
- **Local save server** (`server.js`) — `npm run serve`; edit a draft and **Save to
  file** writes it back to `drafts/<name>.md`. No database; the markdown files are the
  store. Body converted back to Markdown (Turndown) in the draft's existing style.
- **`tools/build-export-data.js`** — snapshot `drafts/` into `drafts-data.js` for the
  static (`file://`) copy-only mode. Runs on `postinstall`.

### Notes
- The bundled article content is German (the "Der Alpha-Code" publication); the system
  is language-agnostic and the conversation language follows the author.

[Unreleased]: http://git.marcushorndt.de/marcushorndt/article-generator-skill/compare/v0.2.0...HEAD
[0.2.0]: http://git.marcushorndt.de/marcushorndt/article-generator-skill/releases/tag/v0.2.0
[0.1.0]: http://git.marcushorndt.de/marcushorndt/article-generator-skill/releases/tag/v0.1.0
