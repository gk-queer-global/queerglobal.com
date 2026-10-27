#!/usr/bin/env bash
# Smoke-test a basic-auth gated static site (Cloudflare Pages middleware).
#
# Usage: smoke-basic-auth.sh <base-url>
#
# Env:
#   BASIC_AUTH_USER / BASIC_AUTH_PASS  credentials for authorized requests (required)
#   SMOKE_PATHS      space-separated paths (default "/ /aboutus/ /blog/")
set -euo pipefail

usage() { echo "usage: $0 <base-url>" >&2; exit 64; }
if [ $# -ne 1 ]; then usage; fi
BASE=${1%/}
: "${BASIC_AUTH_USER:?BASIC_AUTH_USER is required}"
: "${BASIC_AUTH_PASS:?BASIC_AUTH_PASS is required}"
PATHS=${SMOKE_PATHS:-"/ /aboutus/ /blog/"}

log() { printf '%s\n' "$*" >&2; }

check_status() {
  local url=$1 want=$2 auth=$3
  local code
  if [ -n "$auth" ]; then
    code=$(curl -sS -o /dev/null -w '%{http_code}' -u "$auth" --retry 5 --retry-delay 3 --retry-all-errors "$url")
  else
    code=$(curl -sS -o /dev/null -w '%{http_code}' --retry 5 --retry-delay 3 --retry-all-errors "$url")
  fi
  if [ "$code" != "$want" ]; then
    log "::error::expected HTTP $want for $url (got $code)"
    return 1
  fi
  log "ok HTTP $want $url"
}

auth="$BASIC_AUTH_USER:$BASIC_AUTH_PASS"
failed=0

for path in $PATHS; do
  url="$BASE$path"
  check_status "$url" 401 "" || failed=1
  check_status "$url" 200 "$auth" || failed=1
done

home_body=$(curl -sS -u "$auth" --retry 5 --retry-delay 3 --retry-all-errors "$BASE/")
if ! grep -qi '<html' <<<"$home_body"; then
  log "::error::authorized GET $BASE/ did not return HTML"
  failed=1
else
  log "ok authorized home page contains HTML"
fi

exit "$failed"
