#!/usr/bin/env bash
# Create a properly named git branch from main.
# Usage:
#   git-branch.sh TASK-ID                     → task/TASK-{id}
#   git-branch.sh --type hotfix|chore|release NAME  → type/NAME
# Examples:
#   git-branch.sh TASK-69cd52fa-4e74
#   git-branch.sh --type hotfix fix-auth-crash
#   git-branch.sh --type chore update-deps
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TASKS_ROOT="$REPO_ROOT/tasks"

VALID_TYPES="hotfix chore release"
TASK_ID_PATTERN='^TASK-[0-9a-f]{8}-[0-9a-f]{4}$'

usage() {
  echo "Usage:" >&2
  echo "  $0 TASK-ID [--base REF]              Create task/TASK-{id} branch" >&2
  echo "  $0 --type hotfix|chore|release NAME  Create type/NAME branch" >&2
  exit 1
}

if [ $# -lt 1 ]; then
  usage
fi

# Parse arguments
CUSTOM_BASE=""
if [ "$1" = "--type" ]; then
  if [ $# -lt 3 ]; then
    usage
  fi
  BRANCH_TYPE="$2"
  BRANCH_NAME="$3"

  if ! echo "$VALID_TYPES" | grep -qw "$BRANCH_TYPE"; then
    echo "Error: Invalid branch type '$BRANCH_TYPE'. Must be one of: $VALID_TYPES" >&2
    exit 1
  fi

  FULL_BRANCH="${BRANCH_TYPE}/${BRANCH_NAME}"
else
  TASK_ID="$1"
  shift  # past TASK_ID

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

  FULL_BRANCH="task/${TASK_ID}"

  while [ $# -gt 0 ]; do
    case "$1" in
      --base)
        [ $# -lt 2 ] && { echo "Error: --base requires a REF argument" >&2; exit 1; }
        CUSTOM_BASE="$2"
        shift 2
        ;;
      *) echo "Error: Unknown option: $1" >&2; exit 1 ;;
    esac
  done
fi

# Check for clean working tree
if ! git -C "$REPO_ROOT" diff --quiet 2>/dev/null || ! git -C "$REPO_ROOT" diff --cached --quiet 2>/dev/null; then
  echo "Error: Working tree has uncommitted changes. Commit or stash first." >&2
  exit 1
fi

# Check if branch already exists
if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$FULL_BRANCH" 2>/dev/null; then
  echo "Error: Branch '$FULL_BRANCH' already exists." >&2
  echo "  Switch to it with: git checkout $FULL_BRANCH" >&2
  exit 1
fi

# Determine base ref
if [ -n "${CUSTOM_BASE:-}" ]; then
  echo "Using custom base: $CUSTOM_BASE"
  git -C "$REPO_ROOT" fetch origin "$CUSTOM_BASE" 2>/dev/null || true
  if git -C "$REPO_ROOT" rev-parse --verify "origin/${CUSTOM_BASE}" >/dev/null 2>&1; then
    BASE_REF="origin/${CUSTOM_BASE}"
  elif git -C "$REPO_ROOT" rev-parse --verify "${CUSTOM_BASE}" >/dev/null 2>&1; then
    BASE_REF="$CUSTOM_BASE"
  else
    echo "Error: Base ref '$CUSTOM_BASE' not found" >&2
    exit 1
  fi
else
  # Fetch latest main
  echo "Fetching latest main..."
  git -C "$REPO_ROOT" fetch origin main 2>/dev/null || {
    echo "Warning: Could not fetch origin/main. Creating branch from local main." >&2
  }
  # Determine base ref
  if git -C "$REPO_ROOT" rev-parse --verify origin/main >/dev/null 2>&1; then
    BASE_REF="origin/main"
  else
    BASE_REF="main"
  fi
fi

# Create and switch to branch
git -C "$REPO_ROOT" checkout -b "$FULL_BRANCH" "$BASE_REF"
echo ""
echo "Created branch: $FULL_BRANCH (from $BASE_REF)"
