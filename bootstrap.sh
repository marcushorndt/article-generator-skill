#!/usr/bin/env bash
# bootstrap.sh — set up the article generator on a new machine.
# Run from the infra repo root after cloning it:
#
#   ./bootstrap.sh [content-repo-git-url]
#
# Resolves the content repo URL from: $1  →  $CONTENT_REPO  →  the default below.
# Pass "" (or set CONTENT_REPO=none) to scaffold an empty content/ skeleton instead.
set -euo pipefail
cd "$(dirname "$0")"

DEFAULT_CONTENT_REPO="https://git.marcushorndt.de/marcushorndt/article-generator-content.git"
CONTENT_REPO="${1:-${CONTENT_REPO:-$DEFAULT_CONTENT_REPO}}"

echo "▸ Installing dependencies…"
npm install

echo "▸ Setting up content/ …"
if [ "$CONTENT_REPO" = "none" ] || [ -z "$CONTENT_REPO" ]; then
  node tools/init-content.js                 # empty skeleton
else
  node tools/init-content.js "$CONTENT_REPO" # clone your private content repo
fi

echo "▸ Building export snapshot…"
npm run build-export

cat <<'EOF'

✓ Setup complete.

Next:
  npm run serve       # then open http://localhost:4321  — the editor + gallery work right away

Optional — AI cover-image generation:
  This uses ContentMaschine (https://contentmaschine.ai), a SEPARATE PAID service
  (pay-as-you-go credits). It is entirely optional — drafting, editing, the gallery,
  drag-and-drop image ingest, and export all work without it.
  If you have an account:  npm run set-key   (stores your API key on this machine)
EOF
