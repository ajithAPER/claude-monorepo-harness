# claude-monorepo-harness

A multi-language monorepo optimized for AI-agent-coordinated development. It provides a file-based task system, an agent swarm architecture, git workflow scripts, and reusable skills — all designed so AI agents and humans can collaborate within strict ownership boundaries.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Repository Structure](#repository-structure)
- [Task System](#task-system)
- [Agent Architecture](#agent-architecture)
- [Scripts](#scripts)
- [Skills](#skills)
- [Multi-Product Structure](#multi-product-structure)
- [Contributing](#contributing)
- [License](#license)

## Overview

This harness solves a common problem with AI-assisted development: multiple agents (or humans) writing to the same codebase simultaneously without coordination, resulting in conflicts, duplicated work, and inconsistent conventions.

The solution is a lightweight coordination layer built from plain files and bash scripts:

- **Tasks** encode status in directory placement and reference each other via wikilinks
- **Agents** operate in isolated git worktrees with explicit file ownership (`Scope.Owns`)
- **Contracts** define shared interfaces so agents can work in parallel without stepping on each other
- **Scripts** handle the git workflow (branching, committing, merging, PR creation) in a platform-independent way

See [CLAUDE.md](CLAUDE.md) for the full system documentation used as agent instructions.

## Prerequisites

- **Node.js** 20+
- **Yarn** 4 (Berry) — the repo uses `packageManager: yarn@4.12.0`
- **Claude Code CLI** — for running agent sessions (`npm install -g @anthropic-ai/claude-code`)
- **Git** 2.28+ (for worktree support)

## Getting Started

```bash
# Clone the repository
git clone <repo-url> claude-monorepo-harness
cd claude-monorepo-harness

# Install dependencies
yarn install

# Install git hooks (Conventional Commits enforcement, secret detection)
bash scripts/hooks-install.sh
```

After setup, start an agent session or run `claude` to begin working with the task system.

## Repository Structure

```
claude-monorepo-harness/
├── .claude/
│   ├── agents/          # Agent role definitions (planner, orchestrator, specialists)
│   ├── skills/          # Reusable skill prompts (tdd, code-review, commit, etc.)
│   └── worktrees/       # Isolated agent worktrees (gitignored)
├── common/              # Shared libraries across products
├── context/
│   ├── decisions.md     # Architecture decision log (append-only)
│   ├── insights.md      # Cross-session research findings (append-only)
│   └── state.md         # Current focus and active task
├── contracts/           # Shared interface specs between agents
├── products/            # One directory per product (see Multi-Product Structure)
├── scripts/             # Bash scripts for task and git workflow management
├── tasks/
│   ├── backlog/         # Ready to start
│   ├── active/          # Currently in progress
│   ├── blocked/         # Waiting on dependencies
│   └── done/            # Completed
├── tools/
│   └── code-memory/     # Custom codebase knowledge graph tool
├── CLAUDE.md            # Agent instructions and full system documentation
└── package.json         # Yarn 4 workspaces, MIT license
```

## Task System

Tasks are markdown files with YAML frontmatter. Status is encoded in directory placement — moving a task to `tasks/done/` is how you complete it.

**Task ID format:** `TASK-{hex_epoch}-{4_hex_random}` (e.g., `TASK-69cb044c-1a3f`)

Generate one with: `bash scripts/task-id.sh`

**Lifecycle:**
```
backlog → active → done
                    └→ auto-unblocks downstream tasks
```

**Cross-references** use `[[TASK-id]]` wikilinks. The ID never changes when a task moves between directories, so links never break. Resolve a link with:
```bash
find tasks/ -name "TASK-69cb044c-1a3f.md" -type f
```

Each task defines:
- `Scope.Owns` — files this agent may modify (enforced by the scope-guard hook)
- `Scope.Reads` — files this agent may read but not change
- `Contracts.Publishes` / `Contracts.Consumes` — shared interfaces with other tasks
- Acceptance criteria (automated and judgment)
- Work Log for progress notes

See [CLAUDE.md](CLAUDE.md) for the full task file format and session protocol.

## Agent Architecture

The harness uses a three-layer agent swarm:

**Planning Layer**
| Agent | Model | Role |
|-------|-------|------|
| Planner | opus | Top-level orchestrator; decomposes intent into tasks |
| Sub-Planner | sonnet | Domain-specific deep-dive for complex features |
| Context Gatherer | haiku | Queries code-memory; never reads files directly |
| Standards Researcher | sonnet | Web research for patterns and conventions |

**Execution Layer**
| Agent | Model | Role |
|-------|-------|------|
| Orchestrator | opus | Hub in hub-and-spoke; groups and spawns specialists |
| Specialists | sonnet | frontend, backend, devex, devops, qa — each in an isolated worktree |

**Quality Layer**
- `/tdd` — Red-Green-Refactor in separate subagents to prevent test-after-implementation
- `/code-review` — Structured review against acceptance criteria and contracts
- `/integration-test`, `/e2e-test` — Contract boundary and user-flow testing
- Scope-guard hook — Blocks writes outside the active task's `Scope.Owns`

Agents communicate through two channels: **files** (task files, contracts — persistent, survives sessions) and **messages** (real-time coordination during a session). See [context/decisions.md](context/decisions.md) for the architectural rationale behind each design choice.

## Scripts

All scripts are bash-native with no external dependencies.

### Task Management

| Script | Description |
|--------|-------------|
| `scripts/task-id.sh` | Generate a unique task ID |
| `scripts/task-move.sh TASK-ID STATUS` | Move task between status dirs; auto-unblocks dependents |
| `scripts/task-index.sh` | Regenerate `tasks/INDEX.md` |
| `scripts/task-validate-links.sh` | Check wikilink consistency and dependency symmetry |

### Git Workflow

| Script | Description |
|--------|-------------|
| `scripts/git-branch.sh TASK-ID` | Create a task branch from main (`task/TASK-{id}`) |
| `scripts/git-commit.sh TYPE [SCOPE] DESC` | Create a Conventional Commit |
| `scripts/git-sync.sh [--stash]` | Rebase current branch onto latest main |
| `scripts/git-push.sh [--force]` | Push with safety checks (blocks force-push to protected branches) |
| `scripts/git-finish.sh [--yes]` | Squash-merge to main, clean up branch, update task lifecycle |
| `scripts/git-worktree.sh add\|list\|remove TASK-ID` | Manage git worktrees for parallel agents |
| `scripts/git-platform.sh detect\|pr-url` | Detect hosting platform; generate PR URL (GitHub, GitLab, etc.) |
| `scripts/hooks-install.sh [--uninstall]` | Install or uninstall git hooks |

## Skills

Skills are prompt templates in `.claude/skills/` that agents invoke to follow structured workflows.

| Skill | Description |
|-------|-------------|
| `/task-create` | Create a new task with full template |
| `/task-update` | Update task status, move between dirs |
| `/task-list` | Show project status, suggest next task |
| `/task-plan` | Decompose an epic into agent-assignable tasks |
| `/requirements` | Structured requirement gathering before planning |
| `/tdd` | Red-Green-Refactor with isolated subagents per phase |
| `/code-review` | Review changes against acceptance criteria and contracts |
| `/integration-test` | Test contract boundaries between modules |
| `/e2e-test` | End-to-end testing for user flows |
| `/doc-gen` | Generate or update README and API documentation |
| `/code-memory` | Query the codebase knowledge graph |
| `/commit` | Create a Conventional Commit with task context |
| `/push` | Push current branch with safety checks |
| `/pr` | Create PR/MR (auto-detects platform, falls back to manual) |
| `/playwright-cli` | Browser automation via Playwright |

## Multi-Product Structure

Each product lives in its own directory under `products/<name>/` with its own `CLAUDE.md` for product-specific conventions. The task backlog is unified — all tasks live in the root `tasks/` tree and reference their product in frontmatter.

```
products/
└── my-product/
    ├── CLAUDE.md          # Product-specific agent instructions
    └── apps/
        └── web/           # Yarn workspace (products/*/apps/*)
```

Workspace globs in `package.json`: `tools/*`, `common/*`, `products/*/apps/*`

## Contributing

- **One task per session** — focus beats multitasking
- **Conventional Commits** enforced by git hook: `type(scope): description`
- **Scope ownership** — each task declares `Scope.Owns`; never modify files outside it
- **Platform independence** — scripts must not hard-depend on `gh` or `glab`; use `git-platform.sh` for platform-specific actions
- **Commit after every meaningful change** — small, reviewable commits
- **Research output** goes to `context/insights.md`, not directly to implementation files
- **Architecture decisions** go to `context/decisions.md` (append-only)

## License

MIT — see [package.json](package.json) for details.
