#!/usr/bin/env bash
# Rebase current branch onto the latest main.
# Usage: git-sync.sh [--stash]
# Options:
#   --stash   Auto-stash uncommitted changes before rebase, pop after
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

AUTO_STASH=false
if [ "${1:-}" = "--stash" ]; then
  AUTO_STASH=true
fi

# Get current branch
BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ -z "$BRANCH" ]; then
  echo "Error: Not on any branch (detached HEAD?)." >&2
  exit 1
fi

if [ "$BRANCH" = "main" ]; then
  echo "Already on main. Use 'git pull' to update." >&2
  exit 1
fi

# Auto-stash if requested
STASHED=false
if $AUTO_STASH; then
  STASH_RESULT=$(git -C "$REPO_ROOT" stash push -m "git-sync auto-stash" 2>&1)
  if echo "$STASH_RESULT" | grep -q "Saved working directory"; then
    STASHED=true
    echo "Stashed uncommitted changes."
  fi
fi

# Fetch latest main
echo "Fetching latest main..."
git -C "$REPO_ROOT" fetch origin main 2>/dev/null || {
  echo "Warning: Could not fetch origin/main. Rebasing onto local main." >&2
}

# Determine base ref
if git -C "$REPO_ROOT" rev-parse --verify origin/main >/dev/null 2>&1; then
  BASE_REF="origin/main"
else
  BASE_REF="main"
fi

# Rebase
echo "Rebasing $BRANCH onto $BASE_REF..."
if ! git -C "$REPO_ROOT" rebase "$BASE_REF"; then
  echo "" >&2
  echo "ERROR: Rebase failed due to conflicts." >&2
  echo "" >&2
  echo "To resolve:" >&2
  echo "  1. Fix conflicts in the listed files" >&2
  echo "  2. git add <resolved files>" >&2
  echo "  3. git rebase --continue" >&2
  echo "" >&2
  echo "To abort:" >&2
  echo "  git rebase --abort" >&2

  # Abort the failed rebase to leave tree clean
  git -C "$REPO_ROOT" rebase --abort 2>/dev/null || true

  # Restore stash if we stashed
  if $STASHED; then
    git -C "$REPO_ROOT" stash pop 2>/dev/null || true
    echo "Restored stashed changes."
  fi
  exit 1
fi

# Restore stash
if $STASHED; then
  if ! git -C "$REPO_ROOT" stash pop; then
    echo "WARNING: Could not restore stashed changes (conflicts with rebased code)." >&2
    echo "Your changes are still in the stash. Run 'git stash list' to find them." >&2
  else
    echo "Restored stashed changes."
  fi
fi

# Report status
AHEAD=$(git -C "$REPO_ROOT" rev-list --count "$BASE_REF..HEAD" 2>/dev/null || echo "?")
echo ""
echo "Synced: $BRANCH is now $AHEAD commit(s) ahead of main."
