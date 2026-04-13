---
name: commit-tasks
description: Commit only task, contract, and context files after planning. Use when the user says "commit tasks", "commit the plan", "save tasks", etc.
user-invocable: true
---

# Commit Task Files

Commits planning artifacts (task files, contracts, context updates) without touching source code.

## Steps

1. **Discover changes**: Run `git status --short` to see all modified/untracked files.

2. **Filter to task paths**: Identify changes under `tasks/`, `contracts/`, and `context/` only.

3. **Warn on non-task changes**: If files outside these directories have also been modified, warn the user:
   > "The following non-task files also have changes and will NOT be included in this commit: ..."
   Do not silently ignore them.

4. **Stage task paths**: Run:
   ```bash
   git add tasks/ contracts/ context/
   ```
   Only stage paths that actually have changes.

5. **Build commit message**: Read the frontmatter of any new task files to extract IDs and titles. Build a summary like:
   - `chore(tasks): plan <feature description>`
   - Include task IDs in the commit body

6. **Commit**: Delegate to the existing commit script:
   ```bash
   bash scripts/git-commit.sh chore tasks "plan <description>"
   ```
   Where `<description>` summarizes the planned feature (e.g., "plan auth middleware rewrite").

7. **Report**: Show the user what was committed and suggest next steps:
   - `/push` to push to remote
   - `pnpm run task:execute -- TASK-ID` to start execution
