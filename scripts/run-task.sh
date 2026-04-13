#!/usr/bin/env bash
# Launch a task in a worktree (or current dir) and run the orchestrator agent.
# Usage: run-task.sh TASK-ID [--dir PATH] [--skip-branchout] [--dry-run]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Allow test override of TASKS_ROOT
TASKS_ROOT="${TASKS_ROOT_OVERRIDE:-$REPO_ROOT/tasks}"
WORKTREES_DIR="$REPO_ROOT/.worktrees"
TASK_ID_PATTERN='^TASK-[0-9a-f]{8}-[0-9a-f]{4}$'

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[run-task]${RESET} $*"; }
success() { echo -e "${GREEN}[run-task]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[run-task]${RESET} $*" >&2; }
error()   { echo -e "${RED}[run-task] Error:${RESET} $*" >&2; }

usage() {
  echo "Usage: $0 TASK-ID [--dir PATH] [--skip-branchout] [--dry-run]" >&2
  echo "" >&2
  echo "  TASK-ID          Task ID matching TASK-{8hex}-{4hex}" >&2
  echo "  --dir PATH       Custom worktree directory (default: \$REPO_ROOT/.worktrees)" >&2
  echo "  --skip-branchout Skip worktree creation; run orchestrator on current branch" >&2
  echo "  --dry-run        Validate and show what would happen, then exit" >&2
  exit 1
}

# ── Argument parsing ──────────────────────────────────────────────────────────
if [ $# -lt 1 ]; then
  usage
fi

TASK_ID="$1"
shift

WORKTREE_DIR=""
SKIP_BRANCHOUT=false
DRY_RUN=false

while [ $# -gt 0 ]; do
  case "$1" in
    --dir)
      [ $# -lt 2 ] && { error "--dir requires a PATH argument"; exit 1; }
      WORKTREE_DIR="$2"
      shift 2
      ;;
    --skip-branchout)
      SKIP_BRANCHOUT=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      error "Unknown option: $1"
      usage
      ;;
  esac
done

# ── Step 1: Validate TASK-ID format ──────────────────────────────────────────
if ! echo "$TASK_ID" | grep -qE "$TASK_ID_PATTERN"; then
  error "'$TASK_ID' doesn't match task ID format (TASK-{8hex}-{4hex})"
  exit 1
fi

# ── Step 2: Find task file ────────────────────────────────────────────────────
TASK_FILE=$(find "$TASKS_ROOT" -name "${TASK_ID}.md" -type f 2>/dev/null | head -1)
if [ -z "$TASK_FILE" ]; then
  error "Task file ${TASK_ID}.md not found under ${TASKS_ROOT}/"
  exit 1
fi

# ── Step 3: Extract title and status from frontmatter ────────────────────────
TASK_TITLE=$(grep "^title:" "$TASK_FILE" | sed 's/^title: *//' | head -1)
TASK_STATUS=$(grep "^status:" "$TASK_FILE" | sed 's/^status: *//' | head -1)

# ── Step 4: Verify task is in backlog/ or active/ ────────────────────────────
TASK_DIR=$(basename "$(dirname "$TASK_FILE")")
if [ "$TASK_DIR" = "blocked" ]; then
  error "Task ${TASK_ID} is blocked. Resolve its dependencies before starting."
  exit 1
fi
if [ "$TASK_DIR" = "done" ]; then
  error "Task ${TASK_ID} is already done."
  exit 1
fi
if [ "$TASK_DIR" != "backlog" ] && [ "$TASK_DIR" != "active" ]; then
  error "Task ${TASK_ID} is in an unexpected directory: ${TASK_DIR}"
  exit 1
fi

# ── Step 5: Extract pr_base from ## Delivery section ─────────────────────────
PR_BASE=""
IN_DELIVERY=false
while IFS= read -r line; do
  if echo "$line" | grep -q "^## Delivery"; then
    IN_DELIVERY=true
    continue
  fi
  if $IN_DELIVERY; then
    # Stop at next section heading
    if echo "$line" | grep -q "^## "; then
      break
    fi
    # Match "pr_base: VALUE"
    if echo "$line" | grep -q "^pr_base:"; then
      PR_BASE=$(echo "$line" | sed 's/^pr_base: *//')
      break
    fi
  fi
done < "$TASK_FILE"

# Default pr_base to main if not found
if [ -z "$PR_BASE" ]; then
  PR_BASE="main"
fi

# ── Compute derived values ────────────────────────────────────────────────────
BRANCH_NAME="task/${TASK_ID}"
EFFECTIVE_WORKTREE_DIR="${WORKTREE_DIR:-$WORKTREES_DIR}"
WORKTREE_PATH="$EFFECTIVE_WORKTREE_DIR/$TASK_ID"

# ── Step 6+: Dry-run prints plan and exits ────────────────────────────────────
if $DRY_RUN; then
  echo ""
  info "Dry run — what would happen:"
  echo ""
  echo "  Task ID:    $TASK_ID"
  echo "  Title:      $TASK_TITLE"
  echo "  Status:     $TASK_DIR"
  echo "  pr_base:    $PR_BASE"
  echo ""
  if $SKIP_BRANCHOUT; then
    info "Mode: direct (--skip-branchout)"
    echo ""
    echo "  1. Move task to active:"
    echo "       bash scripts/task-move.sh $TASK_ID active"
    echo ""
    echo "  2. Launch Claude orchestrator:"
    echo "       claude --agent-file .claude/agents/orchestrator.md \\"
    echo "              -p \"Execute task $TASK_ID...\""
  else
    info "Mode: worktree"
    echo ""
    echo "  Branch:     $BRANCH_NAME"
    echo "  Worktree:   $WORKTREE_PATH"
    echo "  Base ref:   $PR_BASE"
    echo ""
    echo "  1. Create worktree:"
    echo "       git worktree add -b $BRANCH_NAME $WORKTREE_PATH <base>"
    echo ""
    echo "  2. Move task to active (in worktree) and commit:"
    echo "       bash $WORKTREE_PATH/scripts/task-move.sh $TASK_ID active"
    echo "       git -C $WORKTREE_PATH commit -m 'chore: start $TASK_ID'"
    echo ""
    echo "  3. Launch Claude orchestrator in worktree:"
    echo "       claude --agent-file .claude/agents/orchestrator.md \\"
    echo "              --cwd $WORKTREE_PATH \\"
    echo "              -p \"Execute task $TASK_ID...\""
  fi
  echo ""
  exit 0
fi

# ── Worktree mode (default) ───────────────────────────────────────────────────
if ! $SKIP_BRANCHOUT; then
  info "Creating worktree for $TASK_ID (base: $PR_BASE)..."

  # Build git-worktree.sh call
  WORKTREE_ARGS=("add" "$TASK_ID")
  if [ -n "$WORKTREE_DIR" ]; then
    WORKTREE_ARGS+=("--dir" "$WORKTREE_DIR")
  fi

  # Check if git-worktree.sh supports --base; if not, pass base via env or handle here
  # Since git-worktree.sh doesn't support --base yet, we create the worktree directly.
  # Determine base ref: prefer origin/<pr_base> if it exists, else local <pr_base>
  if git -C "$REPO_ROOT" rev-parse --verify "origin/${PR_BASE}" >/dev/null 2>&1; then
    BASE_REF="origin/${PR_BASE}"
  elif git -C "$REPO_ROOT" rev-parse --verify "${PR_BASE}" >/dev/null 2>&1; then
    BASE_REF="$PR_BASE"
  else
    warn "Base ref '$PR_BASE' not found locally or on origin. Falling back to origin/main."
    if git -C "$REPO_ROOT" rev-parse --verify "origin/main" >/dev/null 2>&1; then
      BASE_REF="origin/main"
    else
      BASE_REF="main"
    fi
  fi

  mkdir -p "$EFFECTIVE_WORKTREE_DIR"

  # Fetch the base ref
  info "Fetching ${PR_BASE}..."
  git -C "$REPO_ROOT" fetch origin "${PR_BASE}" 2>/dev/null || {
    warn "Could not fetch origin/${PR_BASE}. Using local ref."
  }

  git -C "$REPO_ROOT" worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$BASE_REF"
  success "Worktree created: $WORKTREE_PATH"

  # Move task to active inside the worktree and commit
  info "Moving $TASK_ID to active..."
  bash "$WORKTREE_PATH/scripts/task-move.sh" "$TASK_ID" active
  git -C "$WORKTREE_PATH" add tasks/
  git -C "$WORKTREE_PATH" commit -m "chore: start $TASK_ID"
  success "Task moved to active."

  # Launch Claude Code CLI in worktree
  info "Launching orchestrator for $TASK_ID..."
  claude \
    --agent-file .claude/agents/orchestrator.md \
    --cwd "$WORKTREE_PATH" \
    -p "Execute task $TASK_ID. Read the task file at tasks/active/${TASK_ID}.md and follow the orchestrator protocol."

# ── Direct mode (--skip-branchout) ───────────────────────────────────────────
else
  info "Direct mode — running on current branch."

  # Move task to active
  info "Moving $TASK_ID to active..."
  bash "$SCRIPT_DIR/task-move.sh" "$TASK_ID" active
  success "Task moved to active."

  # Launch Claude Code CLI in current directory
  info "Launching orchestrator for $TASK_ID..."
  claude \
    --agent-file .claude/agents/orchestrator.md \
    -p "Execute task $TASK_ID. Read the task file at tasks/active/${TASK_ID}.md and follow the orchestrator protocol."
fi
