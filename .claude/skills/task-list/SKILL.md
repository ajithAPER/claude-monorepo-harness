---
name: task-list
description: Show project status grouped by task state, highlight blockers, suggest next task. Use when the user asks "what tasks", "show tasks", "project status", "what should I work on", etc.
user-invocable: true
---

# List Tasks and Project Status

## Steps

1. Read `tasks/INDEX.md` for the current summary. If it seems stale, regenerate:
   ```bash
   bash scripts/task-index.sh
   ```

2. Read `context/state.md` for current focus context.

3. Present tasks grouped by status:

### Active (in progress)
List all tasks in `tasks/active/` with their title, priority, and product.

### Blocked (waiting on dependencies)
List all tasks in `tasks/blocked/` with:
- Their title and priority
- Which tasks they depend on (with current status of those dependencies)
- What needs to happen for them to unblock

### Backlog (ready to start)
List all tasks in `tasks/backlog/` sorted by priority (high → medium → low).

### Done (completed)
Count of completed tasks. Only list recent ones (last 5) unless user asks for all.

4. Suggest the **next task to work on**: the highest-priority task in `tasks/backlog/` that has no unmet dependencies.

5. Report any issues found:
   - Tasks in `blocked/` whose dependencies are actually all in `done/` (should be unblocked)
   - Tasks in `active/` with no recent Work Log entries (potentially stale)
