#!/usr/bin/env bash
# Push current branch to origin with safety checks.
# Usage:
#   git-push.sh              Push current branch
#   git-push.sh --force      Force-push (blocked on protected branches)
# Protected branches: main, master, release/* (configurable below)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Protected branch patterns — force-push is blocked on these
PROTECTED_PATTERNS="^(main|master|release/.*)$"

FORCE=false
if [ "${1:-}" = "--force" ]; then
  FORCE=true
fi

# Get current branch
BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ -z "$BRANCH" ] || [ "$BRANCH" = "HEAD" ]; then
  echo "Error: Not on any branch (detached HEAD?)." >&2
  exit 1
fi

# Block force-push on protected branches
if $FORCE && echo "$BRANCH" | grep -qE "$PROTECTED_PATTERNS"; then
  echo "Error: Force-push to protected branch '$BRANCH' is not allowed." >&2
  echo "  Protected branches: main, master, release/*" >&2
  exit 1
fi

# Check if there are commits to push
LOCAL_REF=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null)
REMOTE_REF=$(git -C "$REPO_ROOT" rev-parse "origin/$BRANCH" 2>/dev/null || echo "")

if [ -n "$REMOTE_REF" ] && [ "$LOCAL_REF" = "$REMOTE_REF" ] && ! $FORCE; then
  echo "Branch '$BRANCH' is up to date with origin. Nothing to push."
  exit 0
fi

# Check if remote tracking exists
HAS_UPSTREAM=$(git -C "$REPO_ROOT" config "branch.$BRANCH.remote" 2>/dev/null || echo "")

# Build push command
PUSH_ARGS=()
if [ -z "$HAS_UPSTREAM" ]; then
  PUSH_ARGS+=("--set-upstream")
  echo "Setting upstream: origin/$BRANCH"
fi

if $FORCE; then
  PUSH_ARGS+=("--force-with-lease")
  echo "Force-pushing with lease (safer than --force)..."
fi

# Push
git -C "$REPO_ROOT" push "${PUSH_ARGS[@]}" origin "$BRANCH"

# Report
AHEAD=$(git -C "$REPO_ROOT" rev-list --count "origin/$BRANCH..HEAD" 2>/dev/null || echo "0")
echo ""
echo "Pushed: $BRANCH → origin/$BRANCH"
if [ "$AHEAD" != "0" ]; then
  echo "  Still $AHEAD commit(s) ahead (push may have partially failed)."
fi
