#!/usr/bin/env bash
# Manage git worktrees for parallel agent execution.
# Usage:
#   git-worktree.sh add TASK-ID      Create worktree + branch for a task
#   git-worktree.sh list             List active worktrees with task info
#   git-worktree.sh remove TASK-ID   Remove a task's worktree
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TASKS_ROOT="$REPO_ROOT/tasks"
WORKTREES_DIR="$REPO_ROOT/.worktrees"
TASK_ID_PATTERN='^TASK-[0-9a-f]{8}-[0-9a-f]{4}$'

usage() {
  echo "Usage:" >&2
  echo "  $0 add TASK-ID [--base REF] [--dir PATH]  Create worktree for task" >&2
  echo "  $0 list                                    List active worktrees" >&2
  echo "  $0 remove TASK-ID                          Remove task worktree" >&2
  exit 1
}

if [ $# -lt 1 ]; then
  usage
fi

COMMAND="$1"

# Check git version for hook sharing
check_git_version() {
  local GIT_VERSION
  GIT_VERSION=$(git --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
  local GIT_MAJOR GIT_MINOR
  GIT_MAJOR=$(echo "$GIT_VERSION" | cut -d. -f1)
  GIT_MINOR=$(echo "$GIT_VERSION" | cut -d. -f2)
  if [ "$GIT_MAJOR" -lt 2 ] || { [ "$GIT_MAJOR" -eq 2 ] && [ "$GIT_MINOR" -lt 35 ]; }; then
    echo "WARNING: Git $GIT_VERSION detected. Hook sharing across worktrees" >&2
    echo "requires Git >= 2.35. Hooks may not run in this worktree." >&2
  fi
}

case "$COMMAND" in
  add)
    if [ $# -lt 2 ]; then
      echo "Usage: $0 add TASK-ID [--base REF] [--dir PATH]" >&2
      exit 1
    fi
    TASK_ID="$2"
    shift 2  # past "add" and TASK_ID

    CUSTOM_BASE=""
    CUSTOM_DIR=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --base)
          [ $# -lt 2 ] && { echo "Error: --base requires a REF argument" >&2; exit 1; }
          CUSTOM_BASE="$2"
          shift 2
          ;;
        --dir)
          [ $# -lt 2 ] && { echo "Error: --dir requires a PATH argument" >&2; exit 1; }
          CUSTOM_DIR="$2"
          shift 2
          ;;
        *) echo "Error: Unknown option: $1" >&2; exit 1 ;;
      esac
    done

    if ! echo "$TASK_ID" | grep -qE "$TASK_ID_PATTERN"; then
      echo "Error: '$TASK_ID' doesn't match task ID format (TASK-{8hex}-{4hex})" >&2
      exit 1
    fi

    # Validate task file exists
    TASK_FILE=$(find "$TASKS_ROOT" -name "${TASK_ID}.md" -type f 2>/dev/null | head -1)
    if [ -z "$TASK_FILE" ]; then
      echo "Error: Task file ${TASK_ID}.md not found under ${TASKS_ROOT}/" >&2
      exit 1
    fi

    BRANCH_NAME="task/${TASK_ID}"
    WORKTREE_PATH="${CUSTOM_DIR:-$WORKTREES_DIR}/$TASK_ID"

    if [ -d "$WORKTREE_PATH" ]; then
      echo "Error: Worktree already exists at $WORKTREE_PATH" >&2
      exit 1
    fi

    # Check if branch already exists
    if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH_NAME" 2>/dev/null; then
      echo "Error: Branch '$BRANCH_NAME' already exists." >&2
      echo "  Use an existing worktree or remove the branch first." >&2
      exit 1
    fi

    # Determine base ref
    if [ -n "$CUSTOM_BASE" ]; then
      # Validate and resolve custom base
      echo "Using custom base: $CUSTOM_BASE"
      git -C "$REPO_ROOT" fetch origin "$CUSTOM_BASE" 2>/dev/null || true
      if git -C "$REPO_ROOT" rev-parse --verify "origin/${CUSTOM_BASE}" >/dev/null 2>&1; then
        BASE_REF="origin/${CUSTOM_BASE}"
      elif git -C "$REPO_ROOT" rev-parse --verify "${CUSTOM_BASE}" >/dev/null 2>&1; then
        BASE_REF="$CUSTOM_BASE"
      else
        echo "Error: Base ref '$CUSTOM_BASE' not found locally or on origin" >&2
        exit 1
      fi
    else
      # Original logic: fetch and use origin/main
      echo "Fetching latest main..."
      git -C "$REPO_ROOT" fetch origin main 2>/dev/null || {
        echo "Warning: Could not fetch origin/main. Using local main." >&2
      }
      if git -C "$REPO_ROOT" rev-parse --verify origin/main >/dev/null 2>&1; then
        BASE_REF="origin/main"
      else
        BASE_REF="main"
      fi
    fi

    mkdir -p "${CUSTOM_DIR:-$WORKTREES_DIR}"

    # Create worktree with new branch
    git -C "$REPO_ROOT" worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$BASE_REF"

    check_git_version

    echo ""
    echo "Created worktree:"
    echo "  Path:   $WORKTREE_PATH"
    echo "  Branch: $BRANCH_NAME"
    echo "  Task:   $TASK_ID"
    echo ""
    echo "To work in this worktree:"
    echo "  cd $WORKTREE_PATH"
    ;;

  list)
    echo "Active worktrees:"
    echo ""

    git -C "$REPO_ROOT" worktree list --porcelain | while IFS= read -r line; do
      if echo "$line" | grep -q "^worktree "; then
        WT_PATH=$(echo "$line" | sed 's/^worktree //')
      fi
      if echo "$line" | grep -q "^branch "; then
        WT_BRANCH=$(echo "$line" | sed 's|^branch refs/heads/||')

        # Extract task ID if task branch
        if echo "$WT_BRANCH" | grep -qE "^task/TASK-[0-9a-f]{8}-[0-9a-f]{4}$"; then
          WT_TASK_ID=$(echo "$WT_BRANCH" | sed 's|^task/||')
          TASK_FILE=$(find "$TASKS_ROOT" -name "${WT_TASK_ID}.md" -type f 2>/dev/null | head -1)
          if [ -n "$TASK_FILE" ]; then
            TASK_STATUS=$(basename "$(dirname "$TASK_FILE")")
            TASK_TITLE=$(grep "^title:" "$TASK_FILE" 2>/dev/null | sed 's/^title: *//' | head -1)
            printf "  %-50s %s [%s] %s\n" "$WT_PATH" "$WT_BRANCH" "$TASK_STATUS" "$TASK_TITLE"
          else
            printf "  %-50s %s [task file missing]\n" "$WT_PATH" "$WT_BRANCH"
          fi
        else
          printf "  %-50s %s\n" "$WT_PATH" "$WT_BRANCH"
        fi
      fi
    done
    ;;

  remove)
    if [ $# -lt 2 ]; then
      echo "Usage: $0 remove TASK-ID" >&2
      exit 1
    fi
    TASK_ID="$2"

    if ! echo "$TASK_ID" | grep -qE "$TASK_ID_PATTERN"; then
      echo "Error: '$TASK_ID' doesn't match task ID format (TASK-{8hex}-{4hex})" >&2
      exit 1
    fi

    BRANCH_NAME="task/${TASK_ID}"
    WORKTREE_PATH="$WORKTREES_DIR/$TASK_ID"

    if [ ! -d "$WORKTREE_PATH" ]; then
      echo "Error: No worktree found at $WORKTREE_PATH" >&2
      exit 1
    fi

    # Remove worktree
    git -C "$REPO_ROOT" worktree remove "$WORKTREE_PATH"
    echo "Removed worktree: $WORKTREE_PATH"

    # Delete the branch
    if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH_NAME" 2>/dev/null; then
      git -C "$REPO_ROOT" branch -d "$BRANCH_NAME" 2>/dev/null || {
        echo "Warning: Branch '$BRANCH_NAME' has unmerged changes." >&2
        echo "  Delete with: git branch -D $BRANCH_NAME" >&2
      }
    fi
    ;;

  *)
    usage
    ;;
esac
