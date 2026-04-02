#!/usr/bin/env bash
# Complete a branch: squash-merge to main, cleanup, optional task lifecycle.
# Usage:
#   git-finish.sh [--yes] [--no-task-update]
# Options:
#   --yes              Skip confirmation prompts
#   --no-task-update   Don't move task to done or update index
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TASKS_ROOT="$REPO_ROOT/tasks"

AUTO_YES=false
SKIP_TASK_UPDATE=false

# Parse flags
while [ $# -gt 0 ]; do
  case "$1" in
    --yes) AUTO_YES=true ;;
    --no-task-update) SKIP_TASK_UPDATE=true ;;
    *)
      echo "Usage: $0 [--yes] [--no-task-update]" >&2
      exit 1
      ;;
  esac
  shift
done

# Get current branch
BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ -z "$BRANCH" ] || [ "$BRANCH" = "HEAD" ]; then
  echo "Error: Not on any branch." >&2
  exit 1
fi

if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  echo "Error: Already on $BRANCH. Switch to a feature branch first." >&2
  exit 1
fi

# Detect task branch
TASK_ID=""
IS_TASK_BRANCH=false
if echo "$BRANCH" | grep -qE "^task/TASK-[0-9a-f]{8}-[0-9a-f]{4}$"; then
  IS_TASK_BRANCH=true
  TASK_ID=$(echo "$BRANCH" | sed 's|^task/||')
fi

# Ensure clean working tree
if ! git -C "$REPO_ROOT" diff --quiet 2>/dev/null || ! git -C "$REPO_ROOT" diff --cached --quiet 2>/dev/null; then
  echo "Error: Working tree has uncommitted changes. Commit or stash first." >&2
  exit 1
fi

# Show what we're about to do
echo "Finishing branch: $BRANCH"
if $IS_TASK_BRANCH; then
  echo "Task: $TASK_ID"
fi
echo ""

# Confirm unless --yes
if ! $AUTO_YES; then
  echo "This will:"
  echo "  1. Rebase onto latest main"
  echo "  2. Switch to main"
  echo "  3. Squash-merge all commits from $BRANCH"
  echo "  4. Delete branch $BRANCH"
  if $IS_TASK_BRANCH && ! $SKIP_TASK_UPDATE; then
    echo "  5. Move task $TASK_ID to done/"
    echo "  6. Regenerate task index"
  fi
  echo ""
  printf "Continue? [y/N] "
  read -r CONFIRM
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Aborted."
    exit 0
  fi
fi

# Step 1: Sync with main
echo ""
echo "Step 1: Syncing with main..."
git -C "$REPO_ROOT" fetch origin main 2>/dev/null || true

if git -C "$REPO_ROOT" rev-parse --verify origin/main >/dev/null 2>&1; then
  BASE_REF="origin/main"
else
  BASE_REF="main"
fi

if ! git -C "$REPO_ROOT" rebase "$BASE_REF"; then
  echo "ERROR: Rebase failed. Resolve conflicts and try again." >&2
  git -C "$REPO_ROOT" rebase --abort 2>/dev/null || true
  exit 1
fi

# Step 2: Build commit message from task metadata
COMMIT_TYPE="chore"
COMMIT_SCOPE=""
COMMIT_DESC="merge $BRANCH"
COMMIT_FOOTER=""

if $IS_TASK_BRANCH; then
  TASK_FILE=$(find "$TASKS_ROOT" -name "${TASK_ID}.md" -type f 2>/dev/null | head -1)
  if [ -n "$TASK_FILE" ]; then
    # Extract type from frontmatter
    TASK_TYPE=$(grep "^type:" "$TASK_FILE" 2>/dev/null | sed 's/^type: *//' | head -1)
    case "$TASK_TYPE" in
      feature) COMMIT_TYPE="feat" ;;
      bug) COMMIT_TYPE="fix" ;;
      research|docs) COMMIT_TYPE="docs" ;;
      refactor) COMMIT_TYPE="refactor" ;;
      test) COMMIT_TYPE="test" ;;
      infrastructure) COMMIT_TYPE="ci" ;;
      *) COMMIT_TYPE="chore" ;;
    esac

    # Extract product as scope
    TASK_PRODUCT=$(grep "^product:" "$TASK_FILE" 2>/dev/null | sed 's/^product: *//' | head -1)
    if [ -n "$TASK_PRODUCT" ] && [ "$TASK_PRODUCT" != "null" ]; then
      COMMIT_SCOPE="$TASK_PRODUCT"
    fi

    # Extract title as description
    TASK_TITLE=$(grep "^title:" "$TASK_FILE" 2>/dev/null | sed 's/^title: *//' | head -1)
    if [ -n "$TASK_TITLE" ]; then
      # Truncate to 72 chars minus prefix length
      COMMIT_DESC="$TASK_TITLE"
    fi

    COMMIT_FOOTER="Task: $TASK_ID"
  fi
fi

# Build message
if [ -n "$COMMIT_SCOPE" ]; then
  COMMIT_HEADER="${COMMIT_TYPE}(${COMMIT_SCOPE}): ${COMMIT_DESC}"
else
  COMMIT_HEADER="${COMMIT_TYPE}: ${COMMIT_DESC}"
fi

# Truncate header to 72 chars
COMMIT_HEADER=$(echo "$COMMIT_HEADER" | cut -c1-72)

if [ -n "$COMMIT_FOOTER" ]; then
  FULL_MSG="${COMMIT_HEADER}

${COMMIT_FOOTER}"
else
  FULL_MSG="$COMMIT_HEADER"
fi

# Step 3: Switch to main and squash-merge
echo "Step 2: Squash-merging to main..."
git -C "$REPO_ROOT" checkout main
git -C "$REPO_ROOT" merge --squash "$BRANCH"
git -C "$REPO_ROOT" commit -m "$FULL_MSG"
echo "  Committed: $COMMIT_HEADER"

# Step 4: Delete branch
echo "Step 3: Cleaning up branch..."
git -C "$REPO_ROOT" branch -d "$BRANCH"
echo "  Deleted: $BRANCH"

# Step 5: Task lifecycle
if $IS_TASK_BRANCH && ! $SKIP_TASK_UPDATE; then
  echo "Step 4: Updating task lifecycle..."

  if [ -x "$SCRIPT_DIR/task-move.sh" ]; then
    bash "$SCRIPT_DIR/task-move.sh" "$TASK_ID" done
  else
    echo "  Warning: task-move.sh not found. Move task manually." >&2
  fi

  if [ -x "$SCRIPT_DIR/task-index.sh" ]; then
    bash "$SCRIPT_DIR/task-index.sh" >/dev/null
    echo "  Regenerated task index."
  fi

  echo ""
  echo "Remember to commit the task file changes:"
  echo "  git add tasks/ && git commit -m \"chore: complete $TASK_ID\""
fi

echo ""
echo "Done. Branch $BRANCH has been squash-merged to main."
