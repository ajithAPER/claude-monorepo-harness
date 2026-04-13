#!/usr/bin/env bash
# Validate all [[TASK-id]] wikilinks and check dependency symmetry.
# Reports broken links and asymmetric depends_on/blocks relationships.
# References from done/ tasks to missing tasks are warnings, not errors.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TASKS_ROOT="$REPO_ROOT/tasks"
ERRORS=0
WARNINGS=0

echo "Validating task links..."

# Helper: determine status directory of a file
status_dir() {
  basename "$(dirname "$1")"
}

# 1. Check all [[TASK-*]] references resolve to existing files
# Build unique (source, ref) pairs using a temp file for dedup
SEEN_PAIRS_FILE=$(mktemp)
trap "rm -f '$SEEN_PAIRS_FILE'" EXIT

while IFS= read -r line; do
  # Line format: /path/to/TASK-xxx.md:[[TASK-yyy]]
  # Extract source file (everything before :[[)
  SRC_FILE="${line%%:\[\[*}"
  # Extract referenced TASK ID from the [[...]] bracket
  REF=$(echo "${line#*:}" | grep -oE 'TASK-[0-9a-f]{8}-[0-9a-f]{4}' | head -1)
  [ -z "$REF" ] && continue

  # Skip self-references
  SRC_ID=$(basename "$SRC_FILE" .md)
  [ "$REF" = "$SRC_ID" ] && continue

  # Deduplicate
  PAIR="${SRC_ID}:${REF}"
  if grep -qxF "$PAIR" "$SEEN_PAIRS_FILE" 2>/dev/null; then
    continue
  fi
  echo "$PAIR" >> "$SEEN_PAIRS_FILE"

  FOUND=$(find "$TASKS_ROOT" -name "${REF}.md" -type f 2>/dev/null | head -1)
  if [ -z "$FOUND" ]; then
    SRC_STATUS=$(status_dir "$SRC_FILE")
    if [ "$SRC_STATUS" = "done" ]; then
      echo "WARNING: [[${REF}]] referenced from done task ${SRC_ID} but no file found" >&2
      WARNINGS=$((WARNINGS + 1))
    else
      echo "BROKEN LINK: [[${REF}]] referenced from ${SRC_ID} but no file found" >&2
      ERRORS=$((ERRORS + 1))
    fi
  fi
done < <(grep -rHo '\[\[TASK-[0-9a-f]\{8\}-[0-9a-f]\{4\}\]\]' "$TASKS_ROOT" --include="*.md" 2>/dev/null || true)

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

# Summary
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo "All links valid. No issues found."
elif [ $ERRORS -eq 0 ]; then
  echo "${WARNINGS} warning(s), 0 errors. Links are valid (warnings are non-blocking)."
else
  echo "${ERRORS} error(s), ${WARNINGS} warning(s) found." >&2
  exit 1
fi
