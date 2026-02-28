#!/bin/bash
# bump.sh - Bump patch version, build, and prepare for publish
# Usage: ./scripts/bump.sh [patch|minor|major]
# Default: patch
#
# Does everything except `npm publish` (which requires 2FA).
# After this script, just run: npm publish

set -e

BUMP_TYPE="${1:-patch}"
CNTX_UI_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$CNTX_UI_DIR"

# Read current version
CURRENT=$(node -e "console.log(require('./package.json').version)")
echo "Current version: ${CURRENT}"

# Bump version (npm version updates package.json and creates git tag)
NEW=$(npm version "$BUMP_TYPE" --no-git-tag-version)
echo "New version: ${NEW}"

# Build
echo "Building..."
npm run build 2>&1 | tail -3

# Verify
echo "Verifying..."
BUILT_VERSION=$(cntx-ui version)
echo "Built version: ${BUILT_VERSION}"

# Build web too
echo "Building web UI..."
cd web && npm run build 2>&1 | tail -3 && cd ..

echo ""
echo "Ready to publish. Run:"
echo "  cd ${CNTX_UI_DIR}"
echo "  npm publish"
echo ""
echo "Then commit and push:"
echo "  git add package.json package-lock.json"
echo "  git commit -m 'version ${NEW}'"
echo "  git push"
