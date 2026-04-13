#!/usr/bin/env bash
# Rebase a task branch onto a new base after its parent PR merges.
# Usage: git-restack.sh TASK-ID [--onto REF]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TASKS_ROOT="$REPO_ROOT/tasks"
TASK_ID_PATTERN='^TASK-[0-9a-f]{8}-[0-9a-f]{4}$'

usage() {
  echo "Usage: $0 TASK-ID [--onto REF]" >&2
  echo "" >&2
  echo "  TASK-ID     Task ID matching TASK-{8hex}-{4hex}" >&2
  echo "  --onto REF  New base ref (default: main)" >&2
  exit 1
}

if [ $# -lt 1 ]; then
  usage
fi

TASK_ID="$1"
shift

ONTO_REF=""
while [ $# -gt 0 ]; do
  case "$1" in
    --onto)
      [ $# -lt 2 ] && { echo "Error: --onto requires a REF argument" >&2; exit 1; }
      ONTO_REF="$2"
      shift 2
      ;;
    *) echo "Error: Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Validate TASK-ID
if ! echo "$TASK_ID" | grep -qE "$TASK_ID_PATTERN"; then
  echo "Error: '$TASK_ID' doesn't match task ID format" >&2
  exit 1
fi

# Find task file
TASK_FILE=$(find "$TASKS_ROOT" -name "${TASK_ID}.md" -type f 2>/dev/null | head -1)
if [ -z "$TASK_FILE" ]; then
  echo "Error: Task file ${TASK_ID}.md not found" >&2
  exit 1
fi

# Read pr_base from ## Delivery section
OLD_BASE=""
IN_DELIVERY=false
while IFS= read -r line; do
  if echo "$line" | grep -q "^## Delivery"; then
    IN_DELIVERY=true
    continue
  fi
  if $IN_DELIVERY; then
    if echo "$line" | grep -q "^## "; then
      break
    fi
    if echo "$line" | grep -q "pr_base:"; then
      OLD_BASE=$(echo "$line" | sed 's/.*pr_base: *//' | sed 's/ *$//')
      break
    fi
  fi
done < "$TASK_FILE"

if [ -z "$OLD_BASE" ]; then
  echo "Error: No pr_base found in task file's Delivery section" >&2
  exit 1
fi

BRANCH_NAME="task/${TASK_ID}"
NEW_BASE="${ONTO_REF:-main}"

# Verify branch exists
if ! git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH_NAME" 2>/dev/null; then
  echo "Error: Branch '$BRANCH_NAME' does not exist" >&2
  exit 1
fi

# Fetch latest refs
echo "Fetching latest..."
git -C "$REPO_ROOT" fetch origin 2>/dev/null || true

# Determine old base ref for rebase
if git -C "$REPO_ROOT" rev-parse --verify "origin/${OLD_BASE}" >/dev/null 2>&1; then
  OLD_BASE_REF="origin/${OLD_BASE}"
elif git -C "$REPO_ROOT" rev-parse --verify "${OLD_BASE}" >/dev/null 2>&1; then
  OLD_BASE_REF="$OLD_BASE"
else
  echo "Error: Old base ref '$OLD_BASE' not found" >&2
  exit 1
fi

# Determine new base ref
if git -C "$REPO_ROOT" rev-parse --verify "origin/${NEW_BASE}" >/dev/null 2>&1; then
  NEW_BASE_REF="origin/${NEW_BASE}"
elif git -C "$REPO_ROOT" rev-parse --verify "${NEW_BASE}" >/dev/null 2>&1; then
  NEW_BASE_REF="$NEW_BASE"
else
  echo "Error: New base ref '$NEW_BASE' not found" >&2
  exit 1
fi

echo "Restacking $BRANCH_NAME:"
echo "  Old base: $OLD_BASE_REF"
echo "  New base: $NEW_BASE_REF"
echo ""

# Rebase
git -C "$REPO_ROOT" rebase --onto "$NEW_BASE_REF" "$OLD_BASE_REF" "$BRANCH_NAME"

# Update the task file's pr_base
sed -i '' "s/pr_base: *${OLD_BASE}/pr_base: ${NEW_BASE}/" "$TASK_FILE"

echo ""
echo "Restacked successfully!"
echo "  Branch:   $BRANCH_NAME"
echo "  New base: $NEW_BASE"
echo ""
echo "Next steps:"
echo "  git push --force-with-lease origin $BRANCH_NAME"
echo "  (Review the rebase result before force-pushing)"
