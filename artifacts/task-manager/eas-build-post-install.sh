#!/usr/bin/env bash
set -e

echo "[eas-build-post-install] Running ensure-local-modules..."
node scripts/ensure-local-modules.js
echo "[eas-build-post-install] Done."
