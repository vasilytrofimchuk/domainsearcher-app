#!/bin/bash
# Publish https://domainsearcher.app/ — the site is served from the shared server, not from GitHub Pages
# (moved 2026-10-02). Run after the change is merged.
set -euo pipefail
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
HOST="${SITE_HOST:-appadmin@49.13.88.157}"
KEY="${SITE_KEY:-$HOME/.ssh/tracker-heroku-exit}"
DEST="/opt/selectic-heroku-exit/sites/domainsearcher.app/"
# The deploy workflow builds the site (with the bundled key) into the gh-pages branch; publish that.
git fetch -q origin gh-pages
git archive origin/gh-pages | ssh -i "$KEY" -o BatchMode=yes "$HOST" \
  "tar -x -C $DEST --exclude CNAME --exclude .gitignore --exclude README.md --exclude scripts"
echo "published: https://domainsearcher.app/"
