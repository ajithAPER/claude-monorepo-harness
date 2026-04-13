---
name: cascade-pr
description: Push branches and create stacked/cascading PRs for a task dependency chain. Use when the user says "cascade pr", "stacked pr", "push stack", etc.
user-invocable: true
---

# Cascade PR — Stacked Pull Requests

Creates stacked PRs where each dependent task's PR targets its parent's branch instead of main, keeping diffs minimal and reviewable.

## Steps

1. **Verify gh CLI**: Run `gh auth status`. If gh is not available or not authenticated, print manual instructions (branch names, base targets) and stop.

2. **Identify the stack**: Starting from the current task branch:
   - Read the task file to get `depends_on` and `pr_base` from the Delivery section
   - Walk up the dependency chain to find the root (a task with `pr_base: main`)
   - Walk down to find any tasks that depend on this one
   - Build the ordered stack: root → ... → current → ... → leaf

3. **Push all branches**: For each branch in the stack:
   ```bash
   git push -u origin "task/$TASK_ID"
   ```

4. **Create or update PRs** (bottom-up order, root first):
   For each task in the stack:
   - Read the task file for title, objective, acceptance criteria
   - Check if a PR already exists: `gh pr list --head "task/$TASK_ID" --json number`
   - If PR exists: `gh pr edit <number> --base "$PR_BASE"` (update base if needed)
   - If no PR: create one:
     ```bash
     gh pr create \
       --head "task/$TASK_ID" \
       --base "$PR_BASE" \
       --title "<type>(<scope>): <title>" \
       --body "## Summary
     <objective from task file>

     ## Stack
     <numbered list showing the full stack with arrows and status indicators>

     Task: [[TASK-ID]]

     ## Acceptance Criteria
     <from task file>"
     ```
   - **Ask user confirmation** before creating each PR (show title + body first)

5. **Report the stack**:
   ```
   PR Stack:
     #101  task/TASK-A → main          (ready for review)
     #102  task/TASK-B → task/TASK-A   (waiting on #101)
     #103  task/TASK-C → task/TASK-B   (waiting on #102)
   ```

6. **Restack after merge** (when invoked with `--restack` argument):
   For each child branch whose parent has been merged:
   - Run `bash scripts/git-restack.sh TASK-ID --onto main`
   - Update the PR base: `gh pr edit <number> --base main`
   - **Ask user confirmation** before force-pushing restacked branches
   - Push: `git push --force-with-lease origin "task/$TASK_ID"`

## Constraints

- Requires `gh` CLI — fail gracefully with manual instructions if not available
- Never force-push to protected branches (main, master, release/*)
- Always ask user confirmation before creating PRs or force-pushing
- PR titles follow Conventional Commits format
- Stack visualization uses arrows (→) and status indicators (ready/waiting/merged)
