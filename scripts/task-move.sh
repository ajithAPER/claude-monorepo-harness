#!/usr/bin/env bash
# Move a task file between status directories and auto-unblock downstream tasks.
# Usage: task-move.sh TASK-ID STATUS
# Example: task-move.sh TASK-69cb044c-1a3f done
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TASKS_ROOT="$REPO_ROOT/tasks"
VALID_STATUSES="backlog active blocked done"

if [ $# -lt 2 ]; then
  echo "Usage: $0 TASK-ID STATUS" >&2
  echo "  STATUS: $VALID_STATUSES" >&2
  exit 1
fi

TASK_ID="$1"
NEW_STATUS="$2"

# Validate status
if ! echo "$VALID_STATUSES" | grep -qw "$NEW_STATUS"; then
  echo "Error: Invalid status '$NEW_STATUS'. Must be one of: $VALID_STATUSES" >&2
  exit 1
fi

# Find current location
CURRENT_PATH=$(find "$TASKS_ROOT" -name "${TASK_ID}.md" -type f 2>/dev/null | head -1)
if [ -z "$CURRENT_PATH" ]; then
  echo "Error: ${TASK_ID}.md not found under ${TASKS_ROOT}/" >&2
  exit 1
fi

NEW_DIR="${TASKS_ROOT}/${NEW_STATUS}"
NEW_PATH="${NEW_DIR}/${TASK_ID}.md"

# No-op if already there
if [ "$CURRENT_PATH" = "$NEW_PATH" ]; then
  echo "${TASK_ID} is already in ${NEW_STATUS}/"
  exit 0
fi

# Ensure target directory exists
mkdir -p "$NEW_DIR"

# Update frontmatter status field in-place
if [[ "$(uname)" == "Darwin" ]]; then
  sed -i '' "s/^status: .*/status: ${NEW_STATUS}/" "$CURRENT_PATH"
else
  sed -i "s/^status: .*/status: ${NEW_STATUS}/" "$CURRENT_PATH"
fi

# Update the updated date
TODAY=$(date +%Y-%m-%d)
if [[ "$(uname)" == "Darwin" ]]; then
  sed -i '' "s/^updated: .*/updated: ${TODAY}/" "$CURRENT_PATH"
else
  sed -i "s/^updated: .*/updated: ${TODAY}/" "$CURRENT_PATH"
fi

# Move file (git mv if in a git repo, plain mv otherwise)
if git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  git -C "$REPO_ROOT" mv "$CURRENT_PATH" "$NEW_PATH"
else
  mv "$CURRENT_PATH" "$NEW_PATH"
fi

OLD_DIR=$(basename "$(dirname "$CURRENT_PATH")")
echo "Moved ${TASK_ID}: ${OLD_DIR}/ -> ${NEW_STATUS}/"

# Auto-unblock downstream tasks when moving to done
if [ "$NEW_STATUS" = "done" ]; then
  # Find all tasks that reference this task ID in depends_on
  DEPENDENTS=$(grep -rl "\[\[${TASK_ID}\]\]" "$TASKS_ROOT"/blocked/ 2>/dev/null || true)

  for DEP_FILE in $DEPENDENTS; do
    [ -z "$DEP_FILE" ] && continue

    # Check if ALL depends_on for this task are now in done/
    ALL_DONE=true
    # Extract all TASK IDs from depends_on lines
    DEPS=$(grep -oE 'TASK-[0-9a-f]{8}-[0-9a-f]{4}' "$DEP_FILE" | sort -u)

    # We need to check only depends_on entries, not blocks entries
    # Read the frontmatter and extract depends_on section
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
            # Check if this dependency is in done/
            if [ ! -f "$TASKS_ROOT/done/${DEP_ID}.md" ]; then
              ALL_DONE=false
              break
            fi
          fi
        else
          # End of depends_on list
          break
        fi
      fi
    done < "$DEP_FILE"

    if $ALL_DONE; then
      DEP_TASK_ID=$(basename "$DEP_FILE" .md)
      echo "Auto-unblocking ${DEP_TASK_ID} (all dependencies met)"
      # Recursively call self to move the unblocked task
      "$0" "$DEP_TASK_ID" "backlog"
    fi
  done
fi
