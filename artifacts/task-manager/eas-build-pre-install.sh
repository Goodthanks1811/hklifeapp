#!/usr/bin/env bash
set -e

# Remove root pnpm workspace files so EAS uses the npm lockfile
# in this project directory instead of pnpm from the monorepo root
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ../..)"
rm -f "$ROOT/pnpm-lock.yaml" "$ROOT/pnpm-workspace.yaml"
echo "Pre-install: removed root pnpm workspace files — will use npm"
