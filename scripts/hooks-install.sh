#!/usr/bin/env bash
# Install or uninstall git hooks from scripts/hooks/ into the repo's .git/hooks/ directory.
# Usage: hooks-install.sh [--uninstall]
# Works with git worktrees (installs to the common git dir).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_SRC="$SCRIPT_DIR/hooks"
MANAGED_HEADER="# Managed by claude-monorepo-harness hooks-install.sh"

# Resolve .git/hooks — use git-common-dir for worktree support
GIT_COMMON_DIR=$(git -C "$REPO_ROOT" rev-parse --git-common-dir 2>/dev/null)
if [ -z "$GIT_COMMON_DIR" ] || [ "$GIT_COMMON_DIR" = ".git" ]; then
  HOOKS_DST="$REPO_ROOT/.git/hooks"
else
  HOOKS_DST="$GIT_COMMON_DIR/hooks"
fi

if [ ! -d "$HOOKS_SRC" ]; then
  echo "Error: Hook source directory not found: $HOOKS_SRC" >&2
  exit 1
fi

mkdir -p "$HOOKS_DST"

# --- Uninstall mode ---
if [ "${1:-}" = "--uninstall" ]; then
  echo "Uninstalling hooks..."
  for HOOK_FILE in "$HOOKS_SRC"/*; do
    HOOK_NAME=$(basename "$HOOK_FILE")
    TARGET="$HOOKS_DST/$HOOK_NAME"
    BACKUP="$HOOKS_DST/${HOOK_NAME}.pre-harness"

    if [ -f "$TARGET" ] && head -2 "$TARGET" | grep -q "$MANAGED_HEADER"; then
      rm "$TARGET"
      echo "  Removed: $HOOK_NAME"

      # Restore backup if it exists
      if [ -f "$BACKUP" ]; then
        mv "$BACKUP" "$TARGET"
        echo "  Restored backup: ${HOOK_NAME}.pre-harness → $HOOK_NAME"
      fi
    fi
  done
  echo "Done."
  exit 0
fi

# --- Install mode ---
echo "Installing hooks from $HOOKS_SRC → $HOOKS_DST"

INSTALLED=0
for HOOK_FILE in "$HOOKS_SRC"/*; do
  [ -f "$HOOK_FILE" ] || continue

  HOOK_NAME=$(basename "$HOOK_FILE")
  TARGET="$HOOKS_DST/$HOOK_NAME"

  # Check for existing foreign hooks
  if [ -f "$TARGET" ] && ! head -2 "$TARGET" | grep -q "$MANAGED_HEADER"; then
    BACKUP="$HOOKS_DST/${HOOK_NAME}.pre-harness"
    cp "$TARGET" "$BACKUP"
    echo "  Backed up existing $HOOK_NAME → ${HOOK_NAME}.pre-harness"
  fi

  # Copy hook
  cp "$HOOK_FILE" "$TARGET"
  chmod +x "$TARGET"
  INSTALLED=$((INSTALLED + 1))
  echo "  Installed: $HOOK_NAME"
done

echo ""
echo "Installed $INSTALLED hook(s)."

# Check git version for worktree hook sharing
GIT_VERSION=$(git --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
GIT_MAJOR=$(echo "$GIT_VERSION" | cut -d. -f1)
GIT_MINOR=$(echo "$GIT_VERSION" | cut -d. -f2)
if [ "$GIT_MAJOR" -lt 2 ] || { [ "$GIT_MAJOR" -eq 2 ] && [ "$GIT_MINOR" -lt 35 ]; }; then
  echo ""
  echo "WARNING: Git $GIT_VERSION detected. Hook sharing across worktrees" >&2
  echo "requires Git >= 2.35. Hooks may not run in worktrees." >&2
fi
