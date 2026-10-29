#!/usr/bin/env bash
# Smoke-test staging custom host: unauthenticated requests must appear gated (401 or 403).
# Authorized checks are not run here (runners may see edge 403 even with valid credentials).
#
# Usage: smoke-staging-custom-host.sh <base-url>
#
# Env:
#   SMOKE_PATHS  space-separated paths (default "/ /aboutus/ /blog/")
set -euo pipefail

usage() { echo "usage: $0 <base-url>" >&2; exit 64; }
if [ $# -ne 1 ]; then usage; fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
exec node "$SCRIPT_DIR/verify-staging-gate.mjs" "$1"
