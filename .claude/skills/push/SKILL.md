---
name: push
description: Push the current branch to origin with safety checks. Use when the user says "push", "push changes", "push to remote", etc.
user-invocable: true
---

# Push to Remote

## Steps

1. **Check current state**

   ```bash
   git rev-parse --abbrev-ref HEAD
   git status --short
   ```

   If there are uncommitted changes, warn the user and suggest committing first.

2. **Check remote tracking**

   ```bash
   git config "branch.$(git rev-parse --abbrev-ref HEAD).remote" 2>/dev/null || echo "none"
   ```

3. **Check ahead/behind status**

   ```bash
   git fetch origin 2>/dev/null
   git rev-list --left-right --count HEAD...origin/$(git rev-parse --abbrev-ref HEAD) 2>/dev/null
   ```

4. **Push using the helper script**

   ```bash
   bash scripts/git-push.sh
   ```

   For force-push (non-protected branches only):
   ```bash
   bash scripts/git-push.sh --force
   ```

5. **Report result**

   Show the push result and the remote branch URL if available:
   ```bash
   bash scripts/git-platform.sh pr-url
   ```

## Safety Rules

- **Never** force-push to `main`, `master`, or `release/*` branches
- Warn if the branch is behind the remote (suggest pulling/rebasing first)
- If push fails due to diverged history, suggest `bash scripts/git-sync.sh` first
- Use `--force-with-lease` instead of `--force` for safer force-push

## Constraints

- Do not push without user confirmation
- Do not push if there are uncommitted changes — suggest committing first
- Report the remote URL after pushing so the user can create a PR if needed
