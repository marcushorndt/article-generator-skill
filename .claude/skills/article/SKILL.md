---
name: article
description: "Short-form article writing system. Use when the author wants to turn a brainstorm into a new article draft, revise an existing draft, or extend the writing brain (BRAIN.md) via 'memorize this / remember this approach'. Triggers: 'new article', 'write the next post', 'make a draft from this brainstorm', 'memorize this approach/finding'."
---

# /article — short-form article writing system

Generates short-form articles that build on everything written so far: voice, stance,
structure. The "brain" of the system is `BRAIN.md`; the existing articles in `drafts/`
are the living style reference. Output is provider-agnostic Markdown that pastes into
any WYSIWYG editor (Substack, Ghost, Medium, …) via `export.html`.

> **Interaction language follows the author, not the content.** Reply in whatever
> language the author is writing to you in — don't let the German article content pull
> the conversation into German on its own. The author may direct the work in English
> (or any language) while the article prose stays in the publication's language (here:
> German). The two are independent: match the author's language for the conversation,
> keep the prose in the publication's language.

## Workspace

```
content/            # the author's data — separate (private) git repo
  BRAIN.md          #   writing brain: voice, stance, structure, memorized approaches
  brainstorms/      #   input: raw brainstorms for new articles
  drafts/           #   generated + existing articles (NN-slug.md)
  published/        #   final articles
  images/<topic>/   #   cover-image candidates per article/topic
  sources/          #   reusable profile pictures (selfies) for AI generation
templates/article-frontmatter.md   # infra (this repo)
tools/cm-lib.js     # ContentMaschine client (shared by CLI + server)
tools/cm-image.js   # CLI: generate/vary a cover image
tools/build-export-data.js
server.js           # local edit/save + in-app image generator
export.html
```

The **infrastructure** (skill, tools, server, export page, templates) is one git repo;
the **content** (everything under `content/`) is a second, private repo. The tool reads
and writes the article files under `content/` — when this doc says `drafts/NN-slug.md`,
the file on disk is `content/drafts/NN-slug.md`. **Never** change the wording of existing
articles unless the author explicitly asks.

## Detect the mode

1. **New draft** — the author drops a brainstorm in `brainstorms/` or gives it in chat.
   → see "Create a draft".
2. **Revise** — the author wants to change an existing draft. → edit precisely, adjust
   frontmatter `status` if needed, check the voice against BRAIN.md.
3. **Feed the brain** — the author says "memorize this" / "remember this approach/
   finding". → see "Extend BRAIN.md".

## Create a draft

1. **Read BRAIN.md fully.** Voice, stance, audience, structure pattern, do's/don'ts,
   recurring themes AND the "📌 Memorized" section — the latter takes priority because
   it holds the author's deliberate decisions.
2. **Read 2–3 existing drafts** (newest first) as a concrete style reference — how real
   sentences sound, paragraph lengths, transitions.
3. **Take in the brainstorm** (file in `brainstorms/` or chat input). Gather the core
   idea, raw material, quotes, examples.
4. **Plan promise-backward** (decide before writing):
   - `promise` — the one promise to the reader
   - `core_message` — the single thesis
   - `hook` — the first line that lands with no run-up
   - `cta` — where the article leads the reader at the end
   - `audience`
5. **Write** — strictly in the author's voice (informal "du", confessional, short
   sentences & fragments, anaphora, Bold = thesis / Italic = inner voice). Follow the
   structure pattern from BRAIN.md: hook → problem escalation → confession/turn → root
   cause → reframe/vision → resonant closing line → CTA. Match length to comparable
   drafts (from a ~120-word impulse to a ~1500-word essay).
6. **Write the file**: `drafts/NN-slug.md` with frontmatter from
   `templates/article-frontmatter.md` (fill every field, `status: draft`,
   `created` = today). NN = next free number. Right after the closing `---` of the
   frontmatter, add the copy marker:
   `<!-- ↓↓↓ COPY FROM HERE INTO YOUR EDITOR ↓↓↓ -->`
   Format the body by the **editor rules** (see below).
7. **Suggest a cover image**: name/create the matching `images/<topic>/` folder, list
   candidates, set `image_folder`/`featured_image` if known.
8. **Report briefly**: title, promise, chosen hook, open points, and the reminder to
   set the cover image manually in the editor.
9. **Refresh the export snapshot**: run `node tools/build-export-data.js` so the new
   draft shows up in `export.html`.

## Editor rules (paste-ready body)

The body is copied 1:1 into a WYSIWYG editor. For every generated draft, strictly keep:

- **Headings start at `##` (H2).** Never `#` (H1) in the body — title and subtitle go
  into the editor's own fields (= `title`/`subtitle` in the frontmatter). Don't go
  deeper than `###`.
- **Paste-safe syntax only:** `**bold**`, `*italic*`, `-`/`1.` lists, `>` quote,
  `---` divider, `[text](url)` links. **No** Markdown editors choke on: no tables, no
  raw HTML (except the copy marker), no footnotes, no nested bold/italic.
- **No images via Markdown.** `![](…)` is NOT embedded by editors. The cover image goes
  into the editor's own field, inline images via the editor UI. In the draft, note
  images at most as an `![](url)` reference — the author sets them manually from
  `images/<topic>/`.
- **The copy marker** separates machine frontmatter from paste-ready text: everything
  BELOW the marker is what belongs in the editor.

### Export page

`export.html` (double-click) renders the selected draft, shows title/subtitle to copy,
the image as a reminder, and a "Copy body as rich text" button (pastes 1:1 into a
WYSIWYG editor). Deep link: `export.html?draft=NN`. After creating/changing a draft,
run `node tools/build-export-data.js` so the draft appears in the dropdown.

## Cover image with the author (ContentMaschine)

Two ways to make a 16:9 cover — **in the app** (recommended; no chat needed) or the CLI.
Both enforce model `pro` (Nano Banana Pro), aspect ratio `16:9`, resolution 2048, and
save into the article's `images/<topic>/` folder.

**In the export page (`npm run serve` → http://localhost:4321/):** the Image panel has a
generator. Write a prompt, optionally pick a **source image** (a selfie from `sources/`,
an existing article image, or upload a new selfie — uploads are saved to `sources/` for
reuse), set variability, and click **Generate 16:9**. With a source it's image-to-image
(`vary`, the author's likeness comes from that photo); with no source it's text-to-image
(`generate`). Results appear in the gallery below — **Copy** pastes into any editor,
**Set featured** writes `featured_image`/`image_folder` into the draft frontmatter.

**CLI / `make image`** — same engine, for scripted runs:
```
node tools/cm-image.js --prompt "<scene prompt>" --article <NN|slug> [--image <selfie>] [--variability 1-5]
```
With `--image` it's image-to-image; without, text-to-image.

When the author asks for a cover in chat, **propose a prompt** that fits the article's
topic and voice, then point them at the app generator (or run the CLI if they prefer).

The API key is read from `~/.config/contentmaschine/credentials` (user-level, **not** in
the repo). Endpoint reference: README → "ContentMaschine image API".

## Extend BRAIN.md ("memorize this")

When the author wants to pin down a finding/stance/phrasing:

1. State it concisely and generally (applicable to future articles, not just the
   current one).
2. File it in `BRAIN.md`: thematic points into the matching section (1–7); deliberate
   "from now on" decisions additionally under **📌 Memorized** as `- [YYYY-MM-DD] …`.
3. Confirm what was saved and where.

This growing brain is the core of the system: it makes every new draft more consistent
with everything written before.

## Principles

- Voice beats schema. When in doubt it sounds like the author, not like a template.
- No AI/coaching filler (see language don'ts in BRAIN.md).
- Promise-backward: promise + thesis first, prose second.
- Existing articles are reference, not a quarry to overwrite.
