#!/usr/bin/env bash
# Fail unless a Cloudflare Pages project already exists (never create one).
#
# Usage: ensure-pages-project.sh <pages-project>
#
# Env:
#   CLOUDFLARE_API_TOKEN   token with Account > Cloudflare Pages: Read (required)
#   CLOUDFLARE_ACCOUNT_ID  account id (required)
#   CLOUDFLARE_API_URL     API base (default https://api.cloudflare.com/client/v4)
set -euo pipefail

usage() { echo "usage: $0 <pages-project>" >&2; exit 64; }
if [ $# -ne 1 ]; then usage; fi
PROJECT=$1
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"
API=${CLOUDFLARE_API_URL:-https://api.cloudflare.com/client/v4}

resp=$(curl -sS -X GET "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json")

if [ "$(jq -r '.success' <<<"$resp")" != "true" ]; then
  code=$(jq -r '.errors[0].code // empty' <<<"$resp")
  if [ "$code" = "8000007" ] || jq -e '.errors[] | select(.message | test("not find|not found"; "i"))' <<<"$resp" >/dev/null 2>&1; then
    echo "::error::Cloudflare Pages project \"$PROJECT\" does not exist in account $CLOUDFLARE_ACCOUNT_ID. Create it in the dashboard before deploying; this workflow will not create projects." >&2
    exit 1
  fi
  echo "::error::Could not verify Pages project \"$PROJECT\": $(jq -c '.errors' <<<"$resp")" >&2
  exit 1
fi

name=$(jq -r '.result.name' <<<"$resp")
if [ "$name" != "$PROJECT" ]; then
  echo "::error::Pages project name mismatch (expected $PROJECT, got $name)" >&2
  exit 1
fi

echo "pages project $PROJECT: verified"
