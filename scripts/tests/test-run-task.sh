#!/usr/bin/env bash
# Tests for scripts/run-task.sh
# Run with: bash scripts/tests/test-run-task.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/run-task.sh"

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

assert_exit_nonzero() {
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    fail "$desc (expected non-zero exit)"
  else
    pass "$desc"
  fi
}

assert_exit_zero() {
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    pass "$desc"
  else
    fail "$desc (expected zero exit, got non-zero)"
  fi
}

assert_output_contains() {
  local desc="$1"
  local pattern="$2"
  shift 2
  local output
  output=$("$@" 2>&1 || true)
  if echo "$output" | grep -q "$pattern"; then
    pass "$desc"
  else
    fail "$desc (output did not contain '$pattern')"
    echo "    Got: $output" >&2
  fi
}

# ── Setup: create a temp fake task file ──────────────────────────────────────
TMP_TASKS="$(mktemp -d)"
mkdir -p "$TMP_TASKS/backlog" "$TMP_TASKS/active" "$TMP_TASKS/blocked" "$TMP_TASKS/done"

VALID_TASK_ID="TASK-deadbeef-cafe"
cat > "$TMP_TASKS/backlog/${VALID_TASK_ID}.md" <<'EOF'
---
id: TASK-deadbeef-cafe
title: Test task for run-task tests
status: backlog
priority: medium
type: feature
created: 2026-01-01
updated: 2026-01-01
product: test
depends_on:
blocks:
tags: [test]
session_estimate: 1
---

# Test task for run-task tests

## Objective
A test task.

## Delivery
pr_base: feature/some-base
EOF

BLOCKED_TASK_ID="TASK-b10cced1-0001"
cat > "$TMP_TASKS/blocked/${BLOCKED_TASK_ID}.md" <<'EOF'
---
id: TASK-b10cced1-0001
title: Blocked task
status: blocked
priority: low
type: feature
created: 2026-01-01
updated: 2026-01-01
product: test
depends_on:
  - "[[TASK-deadbeef-cafe]]"
blocks:
tags: [test]
session_estimate: 1
---
# Blocked task
EOF

DONE_TASK_ID="TASK-d0edd0ee-0001"
cat > "$TMP_TASKS/done/${DONE_TASK_ID}.md" <<'EOF'
---
id: TASK-d0edd0ee-0001
title: Done task
status: done
priority: low
type: feature
created: 2026-01-01
updated: 2026-01-01
product: test
depends_on:
blocks:
tags: [test]
session_estimate: 1
---
# Done task
EOF

NO_DELIVERY_TASK_ID="TASK-00de11ee-0002"
cat > "$TMP_TASKS/backlog/${NO_DELIVERY_TASK_ID}.md" <<'EOF'
---
id: TASK-00de11ee-0002
title: Task without delivery section
status: backlog
priority: low
type: feature
created: 2026-01-01
updated: 2026-01-01
product: test
depends_on:
blocks:
tags: [test]
session_estimate: 1
---
# Task without delivery section

## Objective
No delivery section here.
EOF

cleanup() {
  rm -rf "$TMP_TASKS"
}
trap cleanup EXIT

# Override TASKS_ROOT so script finds temp tasks
export TASKS_ROOT_OVERRIDE="$TMP_TASKS"

echo ""
echo "=== run-task.sh tests ==="
echo ""

# ── 1. Script exists and is executable ───────────────────────────────────────
echo "-- Existence & usage --"
if [ -f "$SCRIPT" ]; then
  pass "script exists at scripts/run-task.sh"
else
  fail "script exists at scripts/run-task.sh"
fi

if [ -x "$SCRIPT" ]; then
  pass "script is executable"
else
  fail "script is executable"
fi

# ── 2. No args → usage + exit 1 ──────────────────────────────────────────────
echo ""
echo "-- Argument validation --"
assert_exit_nonzero "no args → non-zero exit" "$SCRIPT"
assert_output_contains "no args → prints Usage" "Usage" "$SCRIPT"

# ── 3. Invalid TASK-ID format → error ────────────────────────────────────────
assert_exit_nonzero "bad format (no prefix) → non-zero exit" "$SCRIPT" "NOTASK-1234"
assert_exit_nonzero "bad format (too short hex) → non-zero exit" "$SCRIPT" "TASK-abc-def"
assert_exit_nonzero "bad format (uppercase hex) → non-zero exit" "$SCRIPT" "TASK-DEADBEEF-CAFE"

# ── 4. Valid TASK-ID format but file not found → error ───────────────────────
assert_exit_nonzero "valid format but missing file → non-zero exit" \
  "$SCRIPT" "TASK-00000000-0000" --dry-run

# ── 5. Blocked task → error ───────────────────────────────────────────────────
assert_exit_nonzero "blocked task → non-zero exit" \
  bash -c "TASKS_ROOT_OVERRIDE='$TMP_TASKS' '$SCRIPT' '$BLOCKED_TASK_ID' --dry-run"
assert_output_contains "blocked task → prints 'blocked'" "blocked" \
  bash -c "TASKS_ROOT_OVERRIDE='$TMP_TASKS' '$SCRIPT' '$BLOCKED_TASK_ID' --dry-run 2>&1; true"

# ── 6. Done task → error ─────────────────────────────────────────────────────
assert_exit_nonzero "done task → non-zero exit" \
  bash -c "TASKS_ROOT_OVERRIDE='$TMP_TASKS' '$SCRIPT' '$DONE_TASK_ID' --dry-run"

# ── 7. Valid backlog task with --dry-run → exits 0, shows plan ────────────────
echo ""
echo "-- Dry run mode --"
assert_exit_zero "valid backlog task --dry-run → zero exit" \
  bash -c "TASKS_ROOT_OVERRIDE='$TMP_TASKS' '$SCRIPT' '$VALID_TASK_ID' --dry-run"

assert_output_contains "dry-run shows TASK-ID" "$VALID_TASK_ID" \
  bash -c "TASKS_ROOT_OVERRIDE='$TMP_TASKS' '$SCRIPT' '$VALID_TASK_ID' --dry-run"

assert_output_contains "dry-run shows branch name" "task/${VALID_TASK_ID}" \
  bash -c "TASKS_ROOT_OVERRIDE='$TMP_TASKS' '$SCRIPT' '$VALID_TASK_ID' --dry-run"

assert_output_contains "dry-run shows worktree path" ".worktrees" \
  bash -c "TASKS_ROOT_OVERRIDE='$TMP_TASKS' '$SCRIPT' '$VALID_TASK_ID' --dry-run"

assert_output_contains "dry-run shows claude command" "claude" \
  bash -c "TASKS_ROOT_OVERRIDE='$TMP_TASKS' '$SCRIPT' '$VALID_TASK_ID' --dry-run"

# ── 8. pr_base extraction ─────────────────────────────────────────────────────
assert_output_contains "dry-run shows pr_base from Delivery section" "feature/some-base" \
  bash -c "TASKS_ROOT_OVERRIDE='$TMP_TASKS' '$SCRIPT' '$VALID_TASK_ID' --dry-run"

# ── 9. Task with no Delivery section → default pr_base = main ─────────────────
assert_output_contains "no Delivery section → defaults to main" "main" \
  bash -c "TASKS_ROOT_OVERRIDE='$TMP_TASKS' '$SCRIPT' '$NO_DELIVERY_TASK_ID' --dry-run"

# ── 10. --dir flag changes worktree path ──────────────────────────────────────
CUSTOM_DIR="$(mktemp -d)"
assert_output_contains "custom --dir appears in dry-run output" "$CUSTOM_DIR" \
  bash -c "TASKS_ROOT_OVERRIDE='$TMP_TASKS' '$SCRIPT' '$VALID_TASK_ID' --dir '$CUSTOM_DIR' --dry-run"
rm -rf "$CUSTOM_DIR"

# ── 11. --skip-branchout shows direct mode in dry-run ─────────────────────────
echo ""
echo "-- Skip branchout mode --"
assert_output_contains "--skip-branchout shows direct mode" "direct" \
  bash -c "TASKS_ROOT_OVERRIDE='$TMP_TASKS' '$SCRIPT' '$VALID_TASK_ID' --skip-branchout --dry-run"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
echo ""
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
