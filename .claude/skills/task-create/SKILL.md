---
name: task-create
description: Create a new task file with unique ID and full template. Use when the user says "create a task", "new task", "add task", etc.
user-invocable: true
---

# Create a New Task

## Steps

1. Generate a unique task ID:
   ```bash
   TASK_ID=$(bash scripts/task-id.sh)
   ```

2. Ask for or infer from context:
   - **title** (required)
   - **priority**: high | medium | low (default: medium)
   - **type**: feature | bug | research | spike | infrastructure (default: feature)
   - **product**: which product this belongs to (default: harness)
   - **depends_on**: list of `[[TASK-id]]` wikilinks (default: empty)
   - **blocks**: list of `[[TASK-id]]` wikilinks (default: empty)
   - **tags**: list of tags (default: empty)
   - **session_estimate**: number of sessions (default: 1)

3. Determine initial directory:
   - If `depends_on` is empty → `tasks/backlog/`
   - If `depends_on` has entries, check if ALL referenced tasks are in `tasks/done/`:
     - If yes → `tasks/backlog/`
     - If no → `tasks/blocked/`

4. Create the task file at `tasks/{status}/{TASK_ID}.md` using this template:

```markdown
---
id: {TASK_ID}
title: {title}
status: {backlog or blocked}
priority: {priority}
type: {type}
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
product: {product}
depends_on:
{each as "  - \"[[TASK-id]]\""}
blocks:
{each as "  - \"[[TASK-id]]\""}
tags: [{comma-separated}]
session_estimate: {session_estimate}
---

# {title}

## Objective
{Ask user or leave as TODO}

## Scope
### Owns (files this task may create/modify)
- {paths or TBD}

### Reads (files this task depends on but must NOT modify)
- {paths or TBD}

## Contracts
### Consumes (interfaces/APIs this task expects to exist)
{describe or N/A}

### Publishes (interfaces/APIs this task will produce)
{describe or N/A}

## Acceptance Criteria
### Automated (must pass, machine-verifiable)
- [ ] {criteria}

### Judgment (requires review)
- [ ] {criteria}

## Constraints
{list or none}

## Context
{key decisions, prior art, gotchas}

## Delivery
- **pr_base**: main
- **pr_strategy**: direct
- **commit_plan**:
  1. {describe first logical commit}
  2. {describe second logical commit}

## Work Log
<!-- Agents append session notes here -->
<!-- Format: ### YYYY-MM-DD HH:MM — agent-name -->
```

5. If this task lists `blocks`, update those referenced task files to add this task ID to their `depends_on` if not already present.

6. Regenerate the index:
   ```bash
   bash scripts/task-index.sh
   ```

7. Report the created task ID and its location.
