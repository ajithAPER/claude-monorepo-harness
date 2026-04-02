---
name: commit
description: Create a Conventional Commit with task context. Use when the user says "commit", "save changes", "commit this", etc.
user-invocable: true
---

# Create a Conventional Commit

## Steps

1. **Understand current context**

   Run these commands to assess the state:
   ```bash
   git status
   git diff --cached --stat
   ```

   If nothing is staged, check unstaged changes:
   ```bash
   git diff --stat
   ```

2. **Identify the active task** (if on a task branch)

   ```bash
   git rev-parse --abbrev-ref HEAD
   ```

   If the branch matches `task/TASK-{id}`, find and read the task file:
   ```bash
   find tasks/ -name "TASK-{id}.md" -type f
   ```

   Extract: type, product, title — these inform the commit type and scope.

3. **Determine commit metadata**

   Map task type to Conventional Commit type:
   | Task type | Commit type |
   |-----------|-------------|
   | feature | feat |
   | bug | fix |
   | research, docs | docs |
   | refactor | refactor |
   | test | test |
   | infrastructure | ci |
   | other | chore |

   Scope = product name or tool directory (e.g., `code-memory`, `frontend`).

4. **Stage changes if needed**

   If user hasn't staged files, help them decide what to stage. Prefer staging specific files over `git add -A`.

5. **Create the commit**

   Use the helper script:
   ```bash
   bash scripts/git-commit.sh TYPE [SCOPE] "DESCRIPTION"
   ```

   Or directly with git:
   ```bash
   git commit -m "$(cat <<'EOF'
   type(scope): description

   Task: TASK-{id}
   EOF
   )"
   ```

6. **Verify success**
   ```bash
   git log --oneline -1
   ```

## Commit Message Format

```
type(scope): short description (max 72 chars)

Optional longer body explaining the "why" not the "what".

Task: TASK-{id}
```

**Types:** feat, fix, docs, style, refactor, test, chore, ci, perf, build
**Scope:** optional, lowercase — usually the product or tool name

## Constraints

- Never commit `.env` files, credentials, or secrets
- Prefer specific file staging over `git add -A`
- Keep the first line under 72 characters
- Do not amend previous commits unless explicitly asked
- Do not push after committing unless explicitly asked
