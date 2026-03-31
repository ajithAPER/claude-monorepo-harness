---
name: task-update
description: Update a task's status, move between directories, or edit fields. Use when the user says "update task", "move task", "complete task", "block task", "start task", etc.
user-invocable: true
---

# Update a Task

## Steps

1. Identify the task by ID, partial ID match, or description search. Use:
   ```bash
   find tasks/ -name "TASK-*.md" -type f
   ```
   Or search by content:
   ```bash
   grep -rl "title: .*{search term}" tasks/
   ```

2. Read the current task file to understand its state.

3. Determine what needs updating. Common operations:

### Start working on a task
- Move from `backlog/` → `active/`
- Run: `bash scripts/task-move.sh {TASK_ID} active`

### Complete a task
- Verify acceptance criteria are met
- Append a Work Log entry summarizing what was done
- Move from `active/` → `done/`
- Run: `bash scripts/task-move.sh {TASK_ID} done`
- The script auto-unblocks downstream tasks

### Block a task
- Move to `blocked/`
- Run: `bash scripts/task-move.sh {TASK_ID} blocked`
- Add explanation in the Work Log

### Send back to backlog
- Move to `backlog/`
- Run: `bash scripts/task-move.sh {TASK_ID} backlog`

### Edit fields
- Update YAML frontmatter fields (title, priority, tags, etc.)
- Update the `updated:` date
- Edit body sections (Objective, Scope, Contracts, etc.)

4. After any status change, regenerate the index:
   ```bash
   bash scripts/task-index.sh
   ```

5. After any changes, validate links:
   ```bash
   bash scripts/task-validate-links.sh
   ```

6. Report what was changed.

## Work Log Format

When appending to the Work Log, use:
```markdown
### {YYYY-MM-DD HH:MM} — {agent or user name}
{Summary of work done, decisions made, blockers encountered}
```
