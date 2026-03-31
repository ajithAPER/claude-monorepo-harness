#!/usr/bin/env bash
# Validate all [[TASK-id]] wikilinks and check dependency symmetry.
# Reports broken links and asymmetric depends_on/blocks relationships.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TASKS_ROOT="$REPO_ROOT/tasks"
ERRORS=0

echo "Validating task links..."

# 1. Check all [[TASK-*]] references resolve to existing files
REFS=$(grep -rhoE 'TASK-[0-9a-f]{8}-[0-9a-f]{4}' "$TASKS_ROOT" 2>/dev/null | sort -u || true)

for REF in $REFS; do
  FOUND=$(find "$TASKS_ROOT" -name "${REF}.md" -type f 2>/dev/null | head -1)
  if [ -z "$FOUND" ]; then
    echo "BROKEN LINK: [[${REF}]] referenced but no file found" >&2
    ERRORS=$((ERRORS + 1))
  fi
done

# 2. Check depends_on/blocks symmetry
TASK_FILES=$(find "$TASKS_ROOT" -name "TASK-*.md" -type f 2>/dev/null || true)

for FILE in $TASK_FILES; do
  [ -z "$FILE" ] && continue
  THIS_ID=$(basename "$FILE" .md)

  # Extract depends_on entries
  IN_DEPENDS=false
  while IFS= read -r line; do
    if echo "$line" | grep -q "^depends_on:"; then
      IN_DEPENDS=true
      continue
    fi
    if $IN_DEPENDS; then
      if echo "$line" | grep -q "^  - "; then
        DEP_ID=$(echo "$line" | grep -oE 'TASK-[0-9a-f]{8}-[0-9a-f]{4}')
        if [ -n "$DEP_ID" ]; then
          DEP_FILE=$(find "$TASKS_ROOT" -name "${DEP_ID}.md" -type f 2>/dev/null | head -1)
          if [ -n "$DEP_FILE" ] && ! grep -q "\[\[${THIS_ID}\]\]" "$DEP_FILE" 2>/dev/null; then
            echo "ASYMMETRIC: ${THIS_ID} depends_on [[${DEP_ID}]], but ${DEP_ID} does not list [[${THIS_ID}]] in blocks" >&2
            ERRORS=$((ERRORS + 1))
          fi
        fi
      else
        break
      fi
    fi
  done < "$FILE"

  # Extract blocks entries
  IN_BLOCKS=false
  while IFS= read -r line; do
    if echo "$line" | grep -q "^blocks:"; then
      IN_BLOCKS=true
      continue
    fi
    if $IN_BLOCKS; then
      if echo "$line" | grep -q "^  - "; then
        BLOCK_ID=$(echo "$line" | grep -oE 'TASK-[0-9a-f]{8}-[0-9a-f]{4}')
        if [ -n "$BLOCK_ID" ]; then
          BLOCK_FILE=$(find "$TASKS_ROOT" -name "${BLOCK_ID}.md" -type f 2>/dev/null | head -1)
          if [ -n "$BLOCK_FILE" ] && ! grep -q "\[\[${THIS_ID}\]\]" "$BLOCK_FILE" 2>/dev/null; then
            echo "ASYMMETRIC: ${THIS_ID} blocks [[${BLOCK_ID}]], but ${BLOCK_ID} does not list [[${THIS_ID}]] in depends_on" >&2
            ERRORS=$((ERRORS + 1))
          fi
        fi
      else
        break
      fi
    fi
  done < "$FILE"
done

if [ $ERRORS -eq 0 ]; then
  echo "All links valid. No issues found."
else
  echo "${ERRORS} issue(s) found." >&2
  exit 1
fi
