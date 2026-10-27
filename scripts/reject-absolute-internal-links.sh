#!/usr/bin/env bash
# Fail when published HTML links to queerglobal.com with an absolute http(s) URL.
#
# Usage: reject-absolute-internal-links.sh [site-root]
#
# Scans *.html under site-root (default "."), excluding scripts/tests/fixtures.
set -euo pipefail

ROOT=${1:-.}
PATTERN='https?://(www\.)?queerglobal\.com'

log() { printf '%s\n' "$*" >&2; }

root_abs=$(cd "$ROOT" && pwd)
repo_abs=$(pwd)
find_args=(-type f -name '*.html' -not -path '*/.git/*')
if [ "$root_abs" = "$repo_abs" ]; then
  find_args+=(-not -path '*/scripts/tests/fixtures/*')
fi

mapfile -t files < <(find "$ROOT" "${find_args[@]}" | sort)

if [ ${#files[@]} -eq 0 ]; then
  log "no HTML files to scan under $ROOT"
  exit 0
fi

set +e
matches=$(grep -E -Hn "$PATTERN" "${files[@]}")
status=$?
set -e

if [ "$status" -eq 0 ]; then
  log '::error::HTML must not use absolute http(s) links to queerglobal.com; use root-relative paths instead.'
  printf '%s\n' "$matches" >&2
  exit 1
fi
if [ "$status" -gt 1 ]; then
  log "::error::grep failed while scanning HTML (exit $status)"
  exit "$status"
fi

log "ok: no absolute queerglobal.com links in ${#files[@]} HTML file(s)"
