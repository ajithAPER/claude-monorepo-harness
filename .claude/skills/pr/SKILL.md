---
name: pr
description: Create a pull request / merge request using the available platform CLI, or provide manual instructions. Use when the user says "create PR", "open PR", "merge request", "create MR", etc.
user-invocable: true
---

# Create a Pull Request

## Steps

1. **Detect platform and CLI availability**

   ```bash
   bash scripts/git-platform.sh detect
   ```

   This reports: platform name (github, gitlab, bitbucket, etc.), CLI path, web URL.

2. **Ensure branch is pushed**

   ```bash
   git rev-parse --abbrev-ref HEAD
   git config "branch.$(git rev-parse --abbrev-ref HEAD).remote" 2>/dev/null || echo "none"
   ```

   If not pushed, push first:
   ```bash
   bash scripts/git-push.sh
   ```

3. **Extract task metadata** (if on a task branch)

   ```bash
   BRANCH=$(git rev-parse --abbrev-ref HEAD)
   ```

   If branch matches `task/TASK-{id}`:
   - Find and read the task file
   - Extract: title, type, product, objective, acceptance criteria

4. **Build PR title and body**

   **Title format:** `type(scope): description` (from task metadata or branch name)

   **Body template:**
   ```markdown
   ## Summary
   [Objective from task file, or brief description of changes]

   Task: [[TASK-{id}]]

   ## Changes
   [List key changes from git log]

   ## Acceptance Criteria
   - [ ] [criterion 1 from task file]
   - [ ] [criterion 2]

   ## Test Plan
   [From task's automated acceptance criteria, or describe manual testing]
   ```

5. **Create the PR**

   If a platform CLI is available, use it:
   ```bash
   source scripts/git-platform.sh
   platform_create_pr "TITLE" "BODY" [--draft]
   ```

   If no CLI is available, provide the manual URL:
   ```bash
   bash scripts/git-platform.sh pr-url main
   ```

   Print the title and body so the user can copy-paste into the web UI.

6. **Report result**

   - If CLI was used: print the PR URL
   - If manual: print the creation URL and pre-formatted title + body

## Constraints

- Never hard-depend on a specific platform CLI (`gh`, `glab`, etc.)
- Always provide a fallback path when no CLI is available
- Use `--draft` flag if the user asks for a draft PR
- Do not auto-merge or auto-approve
- Ask the user before creating the PR (show them the title and body first)
