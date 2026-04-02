# Claude Monorepo Harness

A multi-language monorepo for building products and pipelines, managed through a file-based task system optimized for AI-assisted development.

## Task System

### Directory Layout
```
tasks/backlog/   — Ready to start (all dependencies met)
tasks/active/    — Currently being worked on
tasks/blocked/   — Waiting on dependencies
tasks/done/      — Completed
```

Status is encoded in directory placement. `ls tasks/active/` shows all in-progress work.

### Task IDs
Format: `TASK-{hex_epoch}-{4_hex_random}` (e.g., `TASK-69cb044c-1a3f`)
Generate with: `bash scripts/task-id.sh`
Filenames: `TASK-69cb044c-1a3f.md` (ID is the filename)

### Cross-References (Wikilinks)
Tasks reference each other with `[[TASK-id]]` wikilinks. Links target the ID, not the path, so they never break when files move between status directories.

Resolve a wikilink: `find tasks/ -name "TASK-69cb044c-1a3f.md" -type f`

### Task File Format
Each task has YAML frontmatter with: id, title, status, priority, type, created, updated, product, depends_on, blocks, tags, session_estimate. See any task file for the full template.

Key sections: Objective, Scope (Owns/Reads), Contracts (Consumes/Publishes), Acceptance Criteria (Automated/Judgment), Constraints, Context, Work Log.

### Task Lifecycle
```
task-plan creates tasks
  → Has unmet depends_on? → tasks/blocked/
  → No dependencies?      → tasks/backlog/

Agent starts work         → tasks/active/
Work complete             → tasks/done/
  → Auto-unblocks downstream tasks whose depends_on are all in done/
```

## Session Protocol

1. Read `context/state.md` — understand current focus
2. Read `tasks/INDEX.md` — see all tasks and their status
3. Pick or continue a task (highest priority unblocked)
4. Move task to `tasks/active/` using `bash scripts/task-move.sh TASK-ID active`
5. Do the work, respecting `Scope.Owns` boundaries
6. Update task file: check off acceptance criteria, append to Work Log
7. Move task to `tasks/done/` using `bash scripts/task-move.sh TASK-ID done`
8. Update `context/state.md` with current focus
9. Commit

## Context Files

- `context/state.md` — Current focus, active task, blockers (read at session start)
- `context/decisions.md` — Architecture decision log (append-only)
- `context/insights.md` — Cross-session learnings (append-only)

Update state.md every session. Append to decisions.md for architectural choices. Append to insights.md for learnings that help future sessions.

## Multi-Agent Coordination

### File Ownership
- `Scope.Owns` in a task defines which files that agent may modify
- `Scope.Reads` lists read-only dependencies
- Two tasks must NEVER have overlapping Owns entries

### Two-Channel Communication
- **Files** (persistent): Task files, contracts, work logs — source of truth
- **Messages** (ephemeral): For contract negotiation, blocking discovery, scope renegotiation, progress signals, conflict resolution

### Contracts
Shared interface specs live in `contracts/`. When task A publishes an API that task B consumes, both reference the same contract file.

## Scripts

All bash-native, no external dependencies:

### Task Management
- `scripts/task-id.sh` — Generate unique task ID
- `scripts/task-move.sh TASK-ID STATUS` — Move task between status dirs (auto-unblocks)
- `scripts/task-index.sh` — Regenerate tasks/INDEX.md
- `scripts/task-validate-links.sh` — Check link consistency and dependency symmetry

### Git Workflow
- `scripts/git-branch.sh TASK-ID` — Create task branch from main (`task/TASK-{id}`)
- `scripts/git-branch.sh --type hotfix|chore|release NAME` — Create typed branch
- `scripts/git-sync.sh [--stash]` — Rebase current branch onto latest main
- `scripts/git-commit.sh TYPE [SCOPE] DESCRIPTION` — Create Conventional Commit
- `scripts/git-push.sh [--force]` — Push with safety checks (blocks force-push to protected branches)
- `scripts/git-finish.sh [--yes] [--no-task-update]` — Squash-merge to main, cleanup, task lifecycle
- `scripts/git-worktree.sh add|list|remove TASK-ID` — Manage worktrees for parallel agents
- `scripts/git-platform.sh detect|pr-url` — Detect hosting platform, generate PR URLs

### Git Hooks
- `scripts/hooks-install.sh [--uninstall]` — Install/uninstall git hooks
- `scripts/hooks/commit-msg` — Validates Conventional Commits format
- `scripts/hooks/pre-commit` — Secret detection, whitespace, large file checks

## Skills

- `/task-create` — Create a new task with full template
- `/task-update` — Update task status, move between dirs
- `/task-list` — Show project status, suggest next task
- `/requirements` — Structured requirement gathering before task planning
- `/task-plan` — Decompose an epic into agent-assignable tasks
- `/tdd` — Red-Green-Refactor with isolated subagents per phase
- `/code-review` — Review changes against acceptance criteria and contracts
- `/integration-test` — Test contract boundaries between modules
- `/e2e-test` — End-to-end testing for user flows
- `/doc-gen` — Generate/update README and API documentation
- `/code-memory` — Query codebase knowledge graph
- `/commit` — Create a Conventional Commit with task context
- `/push` — Push current branch with safety checks
- `/pr` — Create PR/MR (auto-detects platform, falls back to manual)

## Agent Swarm Architecture

The monorepo uses a three-layer agent swarm for planning and executing complex features.

### Planning Layer
- **Planner** (opus) — Top-level orchestrator. Decomposes user intent into tasks. Spawns sub-planners for complex features spanning 3+ domains.
- **Sub-Planner** (sonnet) — Domain-specific planner. Deep-dives into one domain, returns task proposals.
- **Context Gatherer** (haiku) — Queries `code-memory` for codebase structure. Never reads files directly.
- **Standards Researcher** (sonnet) — Web research for patterns, libraries, conventions.

### Execution Layer
- **Orchestrator** (opus) — Hub in hub-and-spoke. Reads task backlog, groups parallelizable tasks, spawns specialists in worktrees.
- **Specialists** (sonnet) — `frontend`, `backend`, `devex`, `devops`, `qa`. Each works within strict `Scope.Owns` boundaries.

### Quality & Enforcement Layer
- **Skills**: `/tdd` (isolated Red-Green-Refactor), `/code-review`, `/integration-test`, `/e2e-test`, `/doc-gen`
- **Scope Guard** hook — Blocks writes outside active task's `Scope.Owns`
- **Hookify rules** — Require tests and commits before stopping, warn on contract edits

Agent definitions live in `.claude/agents/`. See `context/decisions.md` for architectural rationale.

### Task-to-Agent Assignment

| Task tags | Agent |
|---|---|
| `frontend`, `ui`, `component` | frontend |
| `api`, `backend`, `service`, `database` | backend |
| `tooling`, `dx`, `scripts`, `skills` | devex |
| `ci`, `cd`, `docker`, `deploy`, `infra` | devops |
| `testing`, `qa`, `integration`, `e2e` | qa |

## Multi-Product Structure

Each product lives in `products/<name>/` with its own CLAUDE.md. Tasks reference their product in frontmatter. The task backlog is unified (all tasks in one `tasks/` tree).

## Conventions

- One task per session unless trivially small
- Commit after every meaningful change
- Research tasks output to context/insights.md, not implementation
- Always validate links after creating/moving tasks: `bash scripts/task-validate-links.sh`
