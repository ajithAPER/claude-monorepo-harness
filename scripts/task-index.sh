#!/usr/bin/env bash
# Regenerate tasks/INDEX.md from task files.
# Scans all TASK-*.md files, extracts frontmatter, generates a markdown summary.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TASKS_ROOT="$REPO_ROOT/tasks"
INDEX_FILE="$TASKS_ROOT/INDEX.md"

# Count tasks per status
count_tasks() {
  local dir="$1"
  if [ -d "$TASKS_ROOT/$dir" ]; then
    find "$TASKS_ROOT/$dir" -name "TASK-*.md" -type f 2>/dev/null | wc -l | tr -d ' '
  else
    echo "0"
  fi
}

ACTIVE_COUNT=$(count_tasks "active")
BACKLOG_COUNT=$(count_tasks "backlog")
BLOCKED_COUNT=$(count_tasks "blocked")
DONE_COUNT=$(count_tasks "done")
TOTAL=$((ACTIVE_COUNT + BACKLOG_COUNT + BLOCKED_COUNT + DONE_COUNT))

# Start building INDEX.md
{
  echo "# Task Index"
  echo ""
  echo "Generated: $(date +%Y-%m-%d' '%H:%M)"
  echo ""
  echo "## Summary"
  echo ""
  echo "| Status | Count |"
  echo "|--------|-------|"
  echo "| Active | $ACTIVE_COUNT |"
  echo "| Backlog | $BACKLOG_COUNT |"
  echo "| Blocked | $BLOCKED_COUNT |"
  echo "| Done | $DONE_COUNT |"
  echo "| **Total** | **$TOTAL** |"
  echo ""

  # Generate task table for each status
  for STATUS in active blocked backlog done; do
    STATUS_DIR="$TASKS_ROOT/$STATUS"
    [ ! -d "$STATUS_DIR" ] && continue

    TASK_FILES=$(find "$STATUS_DIR" -name "TASK-*.md" -type f 2>/dev/null | sort || true)
    [ -z "$TASK_FILES" ] && continue

    STATUS_UPPER=$(echo "$STATUS" | tr '[:lower:]' '[:upper:]' | head -c1)$(echo "$STATUS" | tail -c+2)
    echo "## $STATUS_UPPER"
    echo ""
    echo "| ID | Title | Priority | Type | Product | Depends On |"
    echo "|----|-------|----------|------|---------|------------|"

    while IFS= read -r TASK_FILE; do
      [ -z "$TASK_FILE" ] && continue
      TASK_ID=$(basename "$TASK_FILE" .md)

      # Extract frontmatter fields
      TITLE=$(grep "^title:" "$TASK_FILE" 2>/dev/null | head -1 | sed 's/^title: *//')
      PRIORITY=$(grep "^priority:" "$TASK_FILE" 2>/dev/null | head -1 | sed 's/^priority: *//')
      TYPE=$(grep "^type:" "$TASK_FILE" 2>/dev/null | head -1 | sed 's/^type: *//' | sed 's/ *#.*//')
      PRODUCT=$(grep "^product:" "$TASK_FILE" 2>/dev/null | head -1 | sed 's/^product: *//')

      # Extract depends_on as comma-separated wikilinks
      DEPENDS=""
      IN_DEPENDS=false
      while IFS= read -r line; do
        if echo "$line" | grep -q "^depends_on:"; then
          IN_DEPENDS=true
          continue
        fi
        if $IN_DEPENDS; then
          if echo "$line" | grep -q "^  - "; then
            DEP=$(echo "$line" | grep -oE 'TASK-[0-9a-f]{8}-[0-9a-f]{4}')
            if [ -n "$DEP" ]; then
              [ -n "$DEPENDS" ] && DEPENDS="$DEPENDS, "
              DEPENDS="${DEPENDS}[[${DEP}]]"
            fi
          else
            break
          fi
        fi
      done < "$TASK_FILE"
      [ -z "$DEPENDS" ] && DEPENDS="—"

      echo "| [[${TASK_ID}]] | ${TITLE} | ${PRIORITY} | ${TYPE} | ${PRODUCT} | ${DEPENDS} |"
    done <<< "$TASK_FILES"

    echo ""
  done
} > "$INDEX_FILE"

echo "INDEX.md regenerated: $TOTAL tasks ($ACTIVE_COUNT active, $BACKLOG_COUNT backlog, $BLOCKED_COUNT blocked, $DONE_COUNT done)"
