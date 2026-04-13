---
name: plan-apply
description: Materialize an approved plan from `.plan/` into task files and contracts. Reuses the pre-generated task IDs from the plan — never regenerates them. Use when the user says "apply plan", "create tasks", "materialize", "approve plan", etc.
user-invocable: true
---

# Materialize Plan into Tasks

Creates task files and contracts from an approved plan session cache, reusing the pre-generated IDs.

## Steps

1. **Find the plan**: If a plan ID is provided (e.g. `/plan-apply PLAN-69cb170c-a1b2`), read `.plan/{PLAN-ID}.md`. Otherwise, find the most recent `.plan/PLAN-*.md` file with status `draft`. If none found, tell the user and suggest `/task-plan`.

2. **Verify plan is complete**: Check that the plan has at least one task section (`### TASK-{id}:`). If the plan looks incomplete (missing acceptance criteria, empty scopes), warn the user and ask for confirmation before proceeding.

3. **Create task files**: For each `### TASK-{id}: {title}` section in the plan:
   - Extract the task content (everything between the `### TASK-` heading and the next `### TASK-` heading or `## ` heading)
   - **Reuse the exact task ID from the plan** — do NOT call `scripts/task-id.sh`
   - Determine placement: if `depends_on` lists tasks NOT in this plan or not yet in `tasks/done/`, place in `tasks/blocked/`; otherwise `tasks/backlog/`
   - Write the task file to `tasks/{status}/{TASK-ID}.md` using the standard template format
   - The task content in the plan already uses the full template structure — transfer it directly

4. **Create contracts**: For each contract referenced in the plan's `## Contracts` section:
   - Create the contract file in `contracts/` following the format in `contracts/README.md`
   - Ensure both producer and consumer task files reference it

5. **Validate**:
   ```bash
   bash scripts/task-index.sh
   bash scripts/task-validate-links.sh
   ```

6. **Update context**: Update `context/state.md` with the new plan focus. Append architectural decisions to `context/decisions.md` if any were made during planning.

7. **Mark session complete**: Update the plan file's frontmatter status from `draft` to `materialized`.

8. **Report**: Show the user:
   - Plan ID and list of created task files with paths
   - Any validation warnings
   - Suggest next steps: `/commit-tasks` to commit, or `pnpm run task:execute -- TASK-ID` to start

## Resuming a Previous Session

If the user invokes `/plan-apply` and the plan file has status `materialized`, inform them that the plan was already applied and show the task IDs from the `task_ids` frontmatter field. If they want to re-plan, suggest running `/task-plan` again.
