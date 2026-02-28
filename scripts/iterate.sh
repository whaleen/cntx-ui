#!/bin/bash
# iterate.sh - Build cntx-ui and test in a target repo
# Usage: ./scripts/iterate.sh [target-repo-path]
# Example: ./scripts/iterate.sh /Users/josh/Projects/_nothingdao/den

set -e

CNTX_UI_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-}"

echo "=== cntx-ui iterate ==="

# Step 1: Build
echo ""
echo "--- Building cntx-ui ---"
cd "$CNTX_UI_DIR"
npm run build 2>&1 | tail -3
VERSION=$(node -e "console.log(require('./package.json').version)")
echo "Built: v${VERSION}"

# Step 2: Verify global link
LINKED=$(which cntx-ui 2>/dev/null || echo "NOT FOUND")
echo "Global: ${LINKED}"
GLOBAL_VERSION=$(cntx-ui version 2>/dev/null || echo "NOT INSTALLED")
echo "Version: ${GLOBAL_VERSION}"

if [ -z "$TARGET" ]; then
  echo ""
  echo "No target repo specified. Build complete."
  echo "Usage: ./scripts/iterate.sh /path/to/repo"
  exit 0
fi

# Step 3: Clean init in target
echo ""
echo "--- Testing in: ${TARGET} ---"

if [ ! -d "$TARGET" ]; then
  echo "ERROR: ${TARGET} does not exist"
  exit 1
fi

cd "$TARGET"

# Clean previous init
if [ -d ".cntx" ]; then
  echo "Removing existing .cntx/"
  rm -rf .cntx
fi
if [ -f ".mcp.json" ]; then
  echo "Removing existing .mcp.json"
  rm -f .mcp.json
fi

# Init
echo ""
echo "--- Running cntx-ui init ---"
cntx-ui init

# Verify
echo ""
echo "--- Verification ---"

PASS=0
FAIL=0

check() {
  if [ -e "$1" ]; then
    echo "  OK: $1"
    PASS=$((PASS + 1))
  else
    echo "  MISSING: $1"
    FAIL=$((FAIL + 1))
  fi
}

check ".cntx"
check ".cntx/config.json"
check ".mcp.json"
check ".cntxignore"
check ".cntx/agent-config.yaml"
check ".cntx/agent-instructions.md"
check ".cntx/agent-rules"
check ".cntx/agent-rules/core"
check ".cntx/agent-rules/capabilities"

echo ""
echo "--- cntx-ui status ---"
cntx-ui status 2>&1 || echo "STATUS COMMAND FAILED"

echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
