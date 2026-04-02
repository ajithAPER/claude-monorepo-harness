#!/usr/bin/env bash
# Pluggable platform adapter for hosting-specific operations (PRs, issues).
# Detects the Git hosting platform from remote URL and available CLIs.
#
# Usage as standalone:
#   git-platform.sh detect                Show detected platform + CLI
#   git-platform.sh pr-url [BASE_BRANCH]  Print URL to create a PR manually
#
# Usage as library (sourced by other scripts):
#   source scripts/git-platform.sh
#   platform_detect          → sets PLATFORM_NAME, PLATFORM_CLI, PLATFORM_WEB_URL
#   platform_pr_url [base]   → prints URL to open a PR in browser
#   platform_create_pr TITLE BODY [--draft]  → creates PR if CLI available
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Platform Detection ---

PLATFORM_NAME=""
PLATFORM_CLI=""
PLATFORM_WEB_URL=""

platform_detect() {
  local REMOTE_URL
  REMOTE_URL=$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null || echo "")

  if [ -z "$REMOTE_URL" ]; then
    PLATFORM_NAME="unknown"
    return
  fi

  # Normalize SSH URLs to HTTPS-like format for parsing
  local NORMALIZED
  NORMALIZED=$(echo "$REMOTE_URL" | sed -E 's|git@([^:]+):|https://\1/|' | sed 's|\.git$||')

  # Detect platform from hostname
  if echo "$NORMALIZED" | grep -q "github.com"; then
    PLATFORM_NAME="github"
    PLATFORM_CLI=$(command -v gh 2>/dev/null || echo "")
  elif echo "$NORMALIZED" | grep -q "gitlab.com\|gitlab\."; then
    PLATFORM_NAME="gitlab"
    PLATFORM_CLI=$(command -v glab 2>/dev/null || echo "")
  elif echo "$NORMALIZED" | grep -q "bitbucket.org\|bitbucket\."; then
    PLATFORM_NAME="bitbucket"
    PLATFORM_CLI=""  # No standard Bitbucket CLI
  elif echo "$NORMALIZED" | grep -q "dev.azure.com\|visualstudio.com"; then
    PLATFORM_NAME="azure"
    PLATFORM_CLI=$(command -v az 2>/dev/null || echo "")
  elif echo "$NORMALIZED" | grep -q "codeberg.org"; then
    PLATFORM_NAME="codeberg"
    PLATFORM_CLI=""
  else
    PLATFORM_NAME="generic"
    PLATFORM_CLI=""
  fi

  PLATFORM_WEB_URL="$NORMALIZED"
}

# --- PR URL Generation ---

platform_pr_url() {
  local BASE_BRANCH="${1:-main}"
  local BRANCH
  BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)

  platform_detect

  case "$PLATFORM_NAME" in
    github)
      echo "${PLATFORM_WEB_URL}/compare/${BASE_BRANCH}...${BRANCH}?expand=1"
      ;;
    gitlab)
      echo "${PLATFORM_WEB_URL}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${BRANCH}&merge_request%5Btarget_branch%5D=${BASE_BRANCH}"
      ;;
    bitbucket)
      echo "${PLATFORM_WEB_URL}/pull-requests/new?source=${BRANCH}&dest=${BASE_BRANCH}"
      ;;
    azure)
      echo "${PLATFORM_WEB_URL}/pullrequestcreate?sourceRef=${BRANCH}&targetRef=${BASE_BRANCH}"
      ;;
    codeberg)
      echo "${PLATFORM_WEB_URL}/compare/${BASE_BRANCH}...${BRANCH}"
      ;;
    *)
      echo "(Could not generate PR URL for platform: $PLATFORM_NAME)"
      ;;
  esac
}

# --- PR Creation ---

platform_create_pr() {
  local TITLE="$1"
  local BODY="$2"
  local DRAFT="${3:-}"
  local BASE_BRANCH="${4:-main}"

  platform_detect

  if [ -z "$PLATFORM_CLI" ]; then
    echo "No CLI available for $PLATFORM_NAME." >&2
    echo "" >&2
    echo "Create a PR manually:" >&2
    echo "  $(platform_pr_url "$BASE_BRANCH")" >&2
    echo "" >&2
    echo "Title: $TITLE" >&2
    echo "" >&2
    echo "Body:" >&2
    echo "$BODY" >&2
    return 1
  fi

  case "$PLATFORM_NAME" in
    github)
      local GH_ARGS=("pr" "create" "--title" "$TITLE" "--body" "$BODY" "--base" "$BASE_BRANCH")
      if [ "$DRAFT" = "--draft" ]; then
        GH_ARGS+=("--draft")
      fi
      gh "${GH_ARGS[@]}"
      ;;
    gitlab)
      local GLAB_ARGS=("mr" "create" "--title" "$TITLE" "--description" "$BODY" "--target-branch" "$BASE_BRANCH")
      if [ "$DRAFT" = "--draft" ]; then
        GLAB_ARGS+=("--draft")
      fi
      glab "${GLAB_ARGS[@]}"
      ;;
    *)
      echo "CLI-based PR creation not supported for $PLATFORM_NAME." >&2
      echo "Create manually: $(platform_pr_url "$BASE_BRANCH")" >&2
      return 1
      ;;
  esac
}

# --- CLI Entry Point ---

# Only run CLI commands when executed directly (not sourced)
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  COMMAND="${1:-detect}"

  case "$COMMAND" in
    detect)
      platform_detect
      echo "Platform: $PLATFORM_NAME"
      if [ -n "$PLATFORM_CLI" ]; then
        echo "CLI:      $PLATFORM_CLI"
      else
        echo "CLI:      (none available)"
      fi
      if [ -n "$PLATFORM_WEB_URL" ]; then
        echo "URL:      $PLATFORM_WEB_URL"
      fi
      ;;
    pr-url)
      platform_pr_url "${2:-main}"
      ;;
    *)
      echo "Usage:" >&2
      echo "  $0 detect              Show detected platform" >&2
      echo "  $0 pr-url [BASE]       Print PR creation URL" >&2
      exit 1
      ;;
  esac
fi
