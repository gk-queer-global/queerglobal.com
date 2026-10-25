#!/usr/bin/env bash
# Attach a custom hostname to a Cloudflare Pages project and make sure the
# matching DNS record exists. Safe to run on every deploy: both steps are
# create-if-missing.
#
# Usage: cf-pages-domain.sh <pages-project> <hostname>
#
# Env:
#   CLOUDFLARE_API_TOKEN   token with Account > Cloudflare Pages: Edit and Zone > DNS: Edit (required)
#   CLOUDFLARE_ACCOUNT_ID  account id (required)
#   CLOUDFLARE_ZONE_ID     zone id that owns <hostname> (required)
#   CLOUDFLARE_API_URL     API base (default https://api.cloudflare.com/client/v4)
set -euo pipefail

usage() { echo "usage: $0 <pages-project> <hostname>" >&2; exit 64; }
if [ $# -ne 2 ]; then usage; fi
PROJECT=$1
HOST=$2
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"
: "${CLOUDFLARE_ZONE_ID:?CLOUDFLARE_ZONE_ID is required}"
API=${CLOUDFLARE_API_URL:-https://api.cloudflare.com/client/v4}

cf() {
  local method=$1 path=$2 data=${3:-} resp
  if [ -n "$data" ]; then
    resp=$(curl -sS -X "$method" "$API$path" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" --data "$data")
  else
    resp=$(curl -sS -X "$method" "$API$path" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
  fi
  printf '%s' "$resp"
}

ok() { [ "$(jq -r '.success' <<<"$1")" = "true" ]; }

project=$(cf GET "/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT")
if ! ok "$project"; then
  echo "read pages project \"$PROJECT\" failed: $(jq -c '.errors' <<<"$project")" >&2
  exit 1
fi
TARGET=$(jq -r '.result.subdomain // empty' <<<"$project")
if [ -z "$TARGET" ] || [ "$TARGET" = "null" ]; then
  echo "read pages project \"$PROJECT\" succeeded but API returned no subdomain; cannot determine CNAME target" >&2
  exit 1
fi
echo "pages project $PROJECT: subdomain $TARGET"

# 1. Pages custom domain
domains=$(cf GET "/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT/domains")
ok "$domains" || { echo "list pages domains failed: $(jq -c '.errors' <<<"$domains")" >&2; exit 1; }
if jq -e --arg h "$HOST" '.result[] | select(.name == $h)' <<<"$domains" >/dev/null; then
  echo "pages domain $HOST: present"
else
  resp=$(cf POST "/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT/domains" "$(jq -cn --arg h "$HOST" '{name:$h}')")
  ok "$resp" || { echo "add pages domain failed: $(jq -c '.errors' <<<"$resp")" >&2; exit 1; }
  echo "pages domain $HOST: added"
fi

# 2. DNS CNAME -> project subdomain from Pages API (proxied)
records=$(cf GET "/zones/$CLOUDFLARE_ZONE_ID/dns_records?name=$HOST")
ok "$records" || { echo "list dns records failed: $(jq -c '.errors' <<<"$records")" >&2; exit 1; }
existing=$(jq -r '.result[0] // empty | "\(.id) \(.type) \(.content)"' <<<"$records")
if [ -z "$existing" ]; then
  resp=$(cf POST "/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
    "$(jq -cn --arg h "$HOST" --arg t "$TARGET" '{type:"CNAME", name:$h, content:$t, proxied:true, ttl:1, comment:"managed by cf-pages-domain.sh"}')")
  ok "$resp" || { echo "create dns record failed: $(jq -c '.errors' <<<"$resp")" >&2; exit 1; }
  echo "dns $HOST: CNAME $TARGET created"
else
  read -r _id type content <<<"$existing"
  if [ "$type" = CNAME ] && [ "$content" = "$TARGET" ]; then
    echo "dns $HOST: CNAME $TARGET present"
  else
    echo "dns $HOST exists as $type $content; refusing to overwrite" >&2
    exit 1
  fi
fi
