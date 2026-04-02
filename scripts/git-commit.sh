#!/usr/bin/env bash
# Create a Conventional Commit with optional task ID footer.
# Usage:
#   git-commit.sh TYPE [SCOPE] DESCRIPTION   Non-interactive
#   git-commit.sh --all TYPE SCOPE DESC       Stage tracked changes first
# Examples:
#   git-commit.sh feat code-memory "add graph query API"
#   git-commit.sh fix "resolve race condition in task-move"
#   git-commit.sh --all chore deps "update vitest to v3"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

VALID_TYPES="feat fix docs style refactor test chore ci perf build"
STAGE_ALL=false

usage() {
  echo "Usage:" >&2
  echo "  $0 TYPE DESCRIPTION                    Commit without scope" >&2
  echo "  $0 TYPE SCOPE DESCRIPTION              Commit with scope" >&2
  echo "  $0 --all TYPE [SCOPE] DESCRIPTION      Stage tracked changes first" >&2
  echo "" >&2
  echo "Types: $VALID_TYPES" >&2
  echo "" >&2
  echo "Examples:" >&2
  echo "  $0 feat code-memory \"add graph query API\"" >&2
  echo "  $0 fix \"resolve race condition\"" >&2
  echo "  $0 --all chore deps \"update vitest\"" >&2
  exit 1
}

if [ $# -lt 2 ]; then
  usage
fi

# Parse --all flag
if [ "$1" = "--all" ]; then
  STAGE_ALL=true
  shift
fi

if [ $# -lt 2 ]; then
  usage
fi

# Parse type, optional scope, description
TYPE="$1"
shift

if ! echo "$VALID_TYPES" | grep -qw "$TYPE"; then
  echo "Error: Invalid type '$TYPE'. Must be one of: $VALID_TYPES" >&2
  exit 1
fi

if [ $# -ge 2 ]; then
  SCOPE="$1"
  shift
  DESCRIPTION="$1"
else
  SCOPE=""
  DESCRIPTION="$1"
fi

# Validate description length
if [ ${#DESCRIPTION} -gt 72 ]; then
  echo "Error: Description too long (${#DESCRIPTION} chars). Max 72." >&2
  exit 1
fi

# Build commit message header
if [ -n "$SCOPE" ]; then
  HEADER="${TYPE}(${SCOPE}): ${DESCRIPTION}"
else
  HEADER="${TYPE}: ${DESCRIPTION}"
fi

# Detect task branch → add Task footer
BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
FOOTER=""
if echo "$BRANCH" | grep -qE "^task/TASK-[0-9a-f]{8}-[0-9a-f]{4}$"; then
  TASK_ID=$(echo "$BRANCH" | sed 's|^task/||')
  FOOTER="Task: $TASK_ID"
fi

# Build full message
if [ -n "$FOOTER" ]; then
  FULL_MSG="${HEADER}

${FOOTER}"
else
  FULL_MSG="$HEADER"
fi

# Stage all tracked changes if requested
if $STAGE_ALL; then
  git -C "$REPO_ROOT" add -u
  echo "Staged all tracked changes."
fi

# Check there are staged changes
if git -C "$REPO_ROOT" diff --cached --quiet; then
  echo "Error: No staged changes to commit." >&2
  echo "  Stage files with 'git add' or use --all to stage tracked changes." >&2
  exit 1
fi

# Commit
git -C "$REPO_ROOT" commit -m "$FULL_MSG"

echo ""
echo "Committed: $HEADER"
if [ -n "$FOOTER" ]; then
  echo "Footer:    $FOOTER"
fi
