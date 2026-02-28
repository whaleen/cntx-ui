#!/bin/bash
# test-all-repos.sh - Test cntx-ui init across multiple repos
# Usage: ./scripts/test-all-repos.sh
# Runs cntx-ui init + status in each repo, reports pass/fail

set -e

CNTX_UI_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECTS="/Users/josh/Projects"

# Build first
echo "=== Building cntx-ui ==="
cd "$CNTX_UI_DIR"
npm run build 2>&1 | tail -3
echo ""

# Test repos - add/remove as needed
REPOS=(
  "_nothingdao/den"
  "_whaleen/tiles"
  "_whaleen/warehouse"
  "_nothingdao/shadcn-solana"
  "_whaleen/llmix"
  "_whaleen/ephemeral"
  "_nothingdao/earth"
  "_orthfx/divine-liturgy"
)

PASSED=0
FAILED=0
SKIPPED=0
RESULTS=""

for REPO in "${REPOS[@]}"; do
  FULL_PATH="${PROJECTS}/${REPO}"
  NAME=$(basename "$REPO")

  if [ ! -d "$FULL_PATH" ]; then
    RESULTS="${RESULTS}\n  SKIP: ${REPO} (not found)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "--- Testing: ${REPO} ---"
  cd "$FULL_PATH"

  # Clean
  rm -rf .cntx .mcp.json

  # Init
  if cntx-ui init 2>&1 | tail -5; then
    # Quick verify
    if [ -d ".cntx" ] && [ -f ".mcp.json" ] && [ -d ".cntx/agent-rules" ]; then
      # Status check
      if cntx-ui status 2>&1 | tail -3; then
        RESULTS="${RESULTS}\n  PASS: ${REPO}"
        PASSED=$((PASSED + 1))
      else
        RESULTS="${RESULTS}\n  FAIL: ${REPO} (status command failed)"
        FAILED=$((FAILED + 1))
      fi
    else
      RESULTS="${RESULTS}\n  FAIL: ${REPO} (incomplete init)"
      FAILED=$((FAILED + 1))
    fi
  else
    RESULTS="${RESULTS}\n  FAIL: ${REPO} (init failed)"
    FAILED=$((FAILED + 1))
  fi

  # Clean up after test
  rm -rf .cntx .mcp.json .cntxignore

  echo ""
done

echo "=== Summary ==="
echo -e "$RESULTS"
echo ""
echo "Passed: ${PASSED}  Failed: ${FAILED}  Skipped: ${SKIPPED}"
