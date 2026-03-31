#!/usr/bin/env bash
set -e

# Remove root pnpm workspace files so pnpm treats this as a standalone project
# and uses the pnpm-lock.yaml in this directory
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ../..)"
rm -f "$ROOT/pnpm-lock.yaml" "$ROOT/pnpm-workspace.yaml"
echo "Pre-install: removed root pnpm workspace files — using local pnpm-lock.yaml"
