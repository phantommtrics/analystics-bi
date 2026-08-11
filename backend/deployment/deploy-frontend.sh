#!/usr/bin/env bash
# Build frontend and rsync dist/ to the server web root.
# Usage: bash backend/deployment/deploy-frontend.sh [user@host]
# Default remote path: /var/www/web-prixbi

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REMOTE="${1:-}"
REMOTE_PATH="/var/www/web-prixbi"

echo "==> Building frontend (on this machine — do not run npm build on small VPS)"
cd "$ROOT/frontend"
npm ci
npm run build

if [[ -z "$REMOTE" ]]; then
  echo ""
  echo "Build complete: $ROOT/frontend/dist"
  echo "Upload manually:"
  echo "  rsync -av --delete dist/ user@server:$REMOTE_PATH/"
  exit 0
fi

echo "==> Uploading to $REMOTE:$REMOTE_PATH"
rsync -av --delete dist/ "$REMOTE:$REMOTE_PATH/"

echo "==> Done. Verify: curl -s -o /dev/null -w '%{http_code}\n' https://sandbox-prixbi.phantommetrics.gm/"
