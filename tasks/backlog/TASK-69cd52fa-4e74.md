---
id: TASK-69cd52fa-4e74
title: Implement agent swarm architecture
status: backlog
priority: high
type: infrastructure
created: 2026-04-01
updated: 2026-04-01
product: harness
depends_on: []
blocks: []
tags: [agents, swarm, orchestration, planning, multi-agent]
session_estimate: 5
---

# Implement Agent Swarm Architecture

## Objective

Enable an agent swarm for the monorepo harness: a coordinated set of specialized agents that plan work collaboratively and execute tasks in parallel across domains (frontend, backend, DevEx, DevOps, QA).

**Context engineering**: Uses the custom `code-memory` tool at `tools/code-memory/` (Watchman + tree-sitter + graphology). Skill at `.claude/skills/code-memory/SKILL.md`. Full plan at `.claude/plans/distributed-rolling-dream.md`.

## Scope

### Owns
- `.claude/agents/*.md` (10 agent definitions)
- `.claude/skills/tdd/SKILL.md`
- `.claude/skills/code-review/SKILL.md`
- `.claude/skills/integration-test/SKILL.md`
- `.claude/skills/e2e-test/SKILL.md`
- `.claude/skills/doc-gen/SKILL.md`
- (`.claude/skills/code-memory/SKILL.md` already exists — not owned by this task)
- `tools/hooks/scope-guard.mjs`
- `.claude/hookify.require-tests-before-done.local.md`
- `.claude/hookify.require-commit-before-stop.local.md`
- `.claude/hookify.warn-contract-edit.local.md`

### Reads
- `CLAUDE.md`
- `tasks/INDEX.md`
- `context/state.md`
- `context/decisions.md`
- `contracts/README.md`
- `.claude/settings.json`

---

## Architecture Overview

```
User Intent
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  PLANNING LAYER (hierarchical)                        │
│                                                       │
│  [Planner] ──spawn──▶ [Context Gatherer]              │
│      │                 (queries codebase context tool) │
│      ├──spawn──▶ [Standards Researcher]               │
│      │           (web research)                       │
│      │                                                │
│      └──spawn──▶ [Sub-Planner] (per complex domain)  │
│                    ├── [Context Gatherer]             │
│                    └── [Standards Researcher]          │
│                                                       │
│  Output: tasks/, contracts/, context/                 │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  EXECUTION LAYER                                      │
│                                                       │
│  [Orchestrator]                                       │
│      ├── worktree → [Frontend Agent]                 │
│      ├── worktree → [Backend Agent]                  │
│      ├── worktree → [DevEx Agent]                    │
│      ├── worktree → [DevOps Agent]                   │
│      └── worktree → [QA Agent]                       │
│                                                       │
│  Coordination: task files + contracts                 │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  QUALITY LAYER (cross-cutting skills)                 │
│                                                       │
│  [TDD Skill] → Red/Green/Refactor subagents          │
│  [Code Review Skill]                                 │
│  [Integration Test Skill]                            │
│  [E2E Test Skill]                                    │
│  [Doc Gen Skill]                                     │
│                                                       │
│  Enforcement: hookify rules + scope-guard hook        │
└──────────────────────────────────────────────────────┘
```

---

## Context Engineering: code-memory

Custom tool at `tools/code-memory/` — Watchman-based codebase knowledge graph daemon. Skill at `.claude/skills/code-memory/SKILL.md`.

**Architecture**: CLI → Unix Socket → Daemon (Graphology graph + SQLite persistence + Watchman file watching + Tree-sitter parsing)

**Languages**: TypeScript, JavaScript/MJS, Go, Rust

**Key commands** (all via `npx code-memory`):
- `index` — index/re-index the project
- `query <term>` — find symbols by name
- `deps <file>` — dependency tree (out/in/both)
- `hubs` — most-imported files
- `exports <file>` — list exported symbols
- `status` — graph stats and daemon info

**Why custom over 3P tools**: Evaluated Codebase-Memory-MCP (1.1k stars), Codemap (494), and 6 others. All had cross-file reference staleness on renames and no native worktree support. Custom tool uses Watchman for real-time monitoring and incremental re-indexing.

---

## File Structure

```
.claude/
  agents/
    # Planning Layer
    planner.md              # Top-level planning orchestrator
    sub-planner.md          # Domain-specific sub-planner (spawned by planner)
    context-gatherer.md     # Queries code-memory for codebase context
    standards-researcher.md # Web research sub-agent

    # Execution Layer
    orchestrator.md         # Coordinates parallel task execution

    # Specialist Agents
    frontend.md             # UI, components, client-side logic
    backend.md              # APIs, services, data layer
    devex.md                # Tooling, DX, scripts, skills, hooks
    devops.md               # CI/CD, Docker, infrastructure
    qa.md                   # Testing at all levels

  skills/
    code-memory/SKILL.md      # Already exists
    tdd/SKILL.md              # Red-Green-Refactor with isolated subagents
    integration-test/SKILL.md
    e2e-test/SKILL.md
    code-review/SKILL.md
    doc-gen/SKILL.md

tools/
  hooks/
    scope-guard.mjs         # Enforces Scope.Owns file ownership
```

---

## Agent Definitions

### Planning Layer

#### 1. Planner (`planner.md`)
- **Model**: opus (deep reasoning for decomposition)
- **Tools**: Read, Glob, Grep, Write, Edit, Agent, WebSearch, WebFetch, Bash(git/scripts only), Bash(npx code-memory)
- **Skills**: task-create, task-plan, task-list, task-update, code-memory
- **Role**: Receives user intent, acts as a **planning orchestrator** — spawns context-gatherer for context, standards-researcher for patterns, and **sub-planners for complex domains**

**Hierarchical Planning Workflow**:
1. Read `context/state.md` + `tasks/INDEX.md`
2. Spawn `context-gatherer` → returns codebase structure, dependency hubs, recent changes (via code-memory, NOT file reading)
3. **Assess complexity**: If the feature spans 3+ domains or requires deep domain research:
   - Spawn `sub-planner` agents per domain (e.g., one for frontend architecture, one for backend API design, one for infra)
   - Each sub-planner gets its own `context-gatherer` and `standards-researcher`
   - Sub-planners return domain-specific task proposals with `Scope.Owns` and contract suggestions
4. For simpler features: directly spawn `standards-researcher` if needed
5. **Synthesize** all sub-planner outputs into a unified task graph
6. Resolve cross-domain dependencies and contract boundaries
7. Create task files with strict `Scope.Owns` boundaries
8. Create contract files in `contracts/` for inter-task interfaces
9. Run `task-validate-links.sh`
10. Update `context/state.md` and `context/decisions.md`

**When to spawn sub-planners** (complexity heuristic):
- Feature touches 3+ products or domains
- Feature requires new infrastructure (DB, queue, cache)
- Feature involves both client and server contract changes
- Feature requires integration with external systems
- User explicitly requests detailed domain research

#### 2. Sub-Planner (`sub-planner.md`)
- **Model**: sonnet (fast, domain-focused)
- **Tools**: Read, Glob, Grep, Write (task drafts only), Agent, WebSearch, WebFetch, Bash(npx code-memory)
- **Skills**: task-create, code-memory
- **Max turns**: 30
- **Role**: Deep-dives into a single domain. Spawns its own context-gatherer and standards-researcher. Produces draft tasks with `Scope.Owns`, contract proposals, and implementation notes for that domain. Reports back to parent planner.

**Sub-planner output format**:
```markdown
## Domain: [frontend|backend|devops|devex|qa]
### Proposed Tasks
- Task 1: [title] — Owns: [paths], Depends: [task refs]
- Task 2: ...
### Proposed Contracts
- [contract name]: [producer] → [consumer], [interface summary]
### Research Findings
- [key patterns, libraries, standards discovered]
### Risks
- [anything that could block or complicate]
```

#### 3. Context Gatherer (`context-gatherer.md`)
- **Model**: haiku (fast, lightweight — code-memory does the heavy lifting)
- **Tools**: Bash(npx code-memory)
- **Permission**: readonly
- **Max turns**: 10
- **Role**: Queries code-memory for structure, dependency chains, hub files, and symbol search. Does NOT read individual files. Returns structured context to parent.

#### 4. Standards Researcher (`standards-researcher.md`)
- **Model**: sonnet
- **Tools**: WebSearch, WebFetch, Read (context files only)
- **Permission**: readonly
- **Max turns**: 15
- **Role**: Researches industry standards, API conventions, library docs, architectural patterns

### Execution Layer

#### 5. Orchestrator (`orchestrator.md`)
- **Model**: opus (coordination reasoning)
- **Tools**: Read, Glob, Grep, Write, Edit, Agent, Bash(git/scripts only), Bash(npx code-memory)
- **Skills**: task-list, task-update, code-memory
- **Max turns**: 100
- **Role**: Reads task backlog, identifies parallelizable tasks (non-overlapping Scope.Owns), spawns specialist agents in worktrees, manages task lifecycle

**Workflow**:
1. Read `tasks/INDEX.md`, identify highest-priority unblocked tasks
2. `npx code-memory hubs` to understand current repo structure
3. Group parallelizable tasks (non-overlapping `Scope.Owns`)
4. For each task: `task-move.sh TASK-ID active` → spawn specialist in worktree
5. After completion: merge branch → `task-move.sh TASK-ID done` (auto-unblocks downstream)
6. Iterate until backlog is empty
7. Update `context/state.md`

### Specialist Agents

All specialists share common traits:
- **Model**: sonnet (fast, code-focused)
- **Tools**: Read, Write, Edit, Glob, Grep, Agent (for TDD subagents), Bash (language-appropriate), Bash(npx code-memory)
- **Skills**: tdd, code-review, code-memory (all); plus domain-specific skills
- **Isolation**: worktree (parallel safe)
- **Hooks**: PreToolUse (hookify + scope-guard), Stop (hookify)

#### 6. Frontend (`frontend.md`)
- **Bash**: npm, npx, node, git
- **Extra skills**: e2e-test
- **Focus**: UI components, pages, client-side state, styling, frontend tests

#### 7. Backend (`backend.md`)
- **Bash**: npm, npx, node, python, pip, cargo, go, git
- **Extra skills**: integration-test
- **Focus**: APIs, services, database schemas, server logic, backend tests

#### 8. DevEx (`devex.md`)
- **Bash**: npm, npx, node, bash, chmod, git
- **Extra skills**: hookify, hookify-writing-rules, doc-gen
- **Focus**: Build tooling, linting, monorepo infra, scripts, skills, hooks

#### 9. DevOps (`devops.md`)
- **Bash**: docker, git, bash, chmod, node
- **Extra skills**: doc-gen
- **Focus**: CI/CD pipelines, Dockerfiles, IaC, deployment scripts

#### 10. QA (`qa.md`)
- **Bash**: npm, npx, node, python, pytest, cargo, go, git
- **Extra skills**: integration-test, e2e-test
- **Max turns**: 80 (iterative test fixing)
- **Focus**: Unit/integration/E2E tests, contract verification, regression testing, acceptance criteria validation

---

## Cross-Cutting Skills

### TDD Skill (`tdd/SKILL.md`)

The critical insight: **separate subagents per phase prevent context bleed**. The test-writer must not see the implementation; the implementer must not modify tests.

**Red Phase** (isolated subagent):
- Reads: task acceptance criteria, contract specs, existing test patterns
- Writes: test files only (within `Scope.Owns` test dirs)
- Verifies: tests FAIL (if they pass, the test is wrong)

**Green Phase** (separate isolated subagent):
- Reads: failing tests from Red output, contracts, existing code
- Writes: implementation files only (NEVER test files)
- Verifies: tests PASS

**Refactor Phase** (separate isolated subagent):
- Reads/writes: all files from Red + Green
- Verifies: tests still PASS after every change

### Code Review Skill (`code-review/SKILL.md`)
1. Read task acceptance criteria
2. `git diff` on `Scope.Owns` files
3. Check each automated criterion
4. Verify contract compliance (Publishes matches implementation)
5. Check for security issues, debug code, secrets
6. Produce structured review report

### Integration Test Skill (`integration-test/SKILL.md`)
1. Read task's `Contracts.Consumes` section
2. Read corresponding contract files in `contracts/`
3. Write integration tests exercising contract boundaries
4. Run tests, report contract compliance status

### E2E Test Skill (`e2e-test/SKILL.md`)
1. Read full user flow from task/acceptance criteria
2. Write E2E tests (browser tools if available, CLI otherwise)
3. Run against the integrated system
4. Report pass/fail with screenshots or logs

### Doc Gen Skill (`doc-gen/SKILL.md`)
- Generate/update README, API docs, inline comments
- Architecture diagrams as Mermaid in markdown
- Triggered after implementation tasks complete

---

## Enforcement Hooks

### Scope Guard (`tools/hooks/scope-guard.mjs`)
A custom PreToolUse hook (not hookify — too complex for pattern matching):
1. On Write/Edit/MultiEdit, extract `file_path` from tool input
2. Find the active task in `tasks/active/`
3. Parse `Scope.Owns` from YAML frontmatter
4. Glob-match `file_path` against owned paths
5. If no match → deny with explanation

Register in `settings.json` as additional PreToolUse hook alongside hookify.

### Hookify Rules (new)

| Rule | Event | Action | Purpose |
|------|-------|--------|---------|
| `require-tests-before-done` | stop | block | Tests must pass before task completion |
| `require-commit-before-stop` | stop | block | No uncommitted work |
| `warn-contract-edit` | file | warn | Editing shared contracts needs coordination |
| `no-dangerous-rm` | bash | block | Block `rm -rf` (already in examples) |

---

## Communication Protocol

**Hub-and-spoke** — Orchestrator is the hub. Specialists don't talk to each other directly.

| Channel | Medium | Purpose |
|---------|--------|---------|
| Task assignment | `tasks/*.md` files | Orchestrator → Specialist |
| Progress updates | Task `Work Log` sections | Specialist → Orchestrator |
| Interface specs | `contracts/*.md` files | Planner → all agents |
| Architecture decisions | `context/decisions.md` | Any agent → all agents |
| Current state | `context/state.md` | Orchestrator → all agents |
| Knowledge graph | code-memory daemon | Shared structural understanding |
| Ephemeral coordination | Agent tool messages | Orchestrator ↔ Specialist |

**Conflict resolution**: If specialist needs a contract change → reports blocker in task file → Orchestrator coordinates with the publishing task's specialist.

---

## Task-to-Agent Assignment

| Task tags/type | Assigned Agent |
|----------------|---------------|
| frontend, ui, component | frontend |
| api, backend, service, database | backend |
| tooling, dx, scripts, skills | devex |
| ci, cd, docker, deploy, infra | devops |
| testing, qa, integration, e2e | qa |
| research | planner (with sub-agents) |
| bug | inherits from affected area |

---

## Key Design Decisions

These decisions will also be recorded in `context/decisions.md`.

1. **Custom code-memory over 3P tools** — Evaluated Codebase-Memory-MCP (1.1k stars), Codemap (494), and 6 others. All had cross-file reference staleness and no worktree support. Built custom Watchman-based tool (`tools/code-memory/`) with tree-sitter parsing, in-memory graphology graph, and auto-managed daemon.

2. **Hierarchical planner with sub-planners** — For complex features spanning 3+ domains, the planner spawns domain-specific sub-planners that each get their own context-gatherer and standards-researcher. Sub-planners return task proposals; the parent planner synthesizes into a unified graph. This drives better context engineering per domain without overloading a single planner's context window.

3. **Hub-and-spoke over group chat** — N-to-N communication creates complexity. The Orchestrator as hub keeps coordination auditable through task files.

4. **Sonnet for specialists, Opus for planner/orchestrator** — Planning and orchestration require deeper reasoning. Implementation benefits from speed. Haiku for context-gatherer since code-memory does the heavy lifting.

5. **Separate TDD subagents per phase** — Prevents "generate-then-test" anti-pattern where tests match implementation rather than specification.

6. **File-based communication over Agent Teams** — Agent Teams is experimental; task files and contracts survive across sessions and are auditable.

7. **Scope-guard as custom hook** — Hookify rules use simple pattern matching. Scope enforcement requires reading YAML frontmatter and glob matching, too complex for hookify.

8. **Worktrees for parallel execution** — Non-overlapping `Scope.Owns` means merges should be conflict-free. Branch naming: `task/TASK-{id}`.

---

## Implementation Sequence

### Phase 1: Agent Definitions (foundation)
(code-memory tool and skill already exist)
1. Create `.claude/agents/` directory
6. Write `planner.md` with hierarchical planning workflow
7. Write `sub-planner.md` with domain-specific planning template
8. Write `context-gatherer.md`
9. Write `standards-researcher.md`
10. Write `orchestrator.md`
11. Write specialist agents: `frontend.md`, `backend.md`, `devex.md`, `devops.md`, `qa.md`

### Phase 2: Skills
12. Write `tdd/SKILL.md` with Red-Green-Refactor workflow (code-memory skill already exists)
14. Write `code-review/SKILL.md`
15. Write `integration-test/SKILL.md`, `e2e-test/SKILL.md`
16. Write `doc-gen/SKILL.md`

### Phase 3: Enforcement
17. Create `tools/hooks/scope-guard.mjs`
18. Create hookify rules: `require-tests-before-done`, `require-commit-before-stop`, `warn-contract-edit`
19. Update `.claude/settings.json` to register scope-guard hook

### Phase 4: Integration & Documentation
20. Update root `CLAUDE.md` to document agent swarm architecture and reference `context/decisions.md`
21. Append all design decisions to `context/decisions.md`
22. End-to-end validation: run the full planning → execution flow on a sample feature

---

## Acceptance Criteria

### Automated
- [x] All 10 agent files exist in `.claude/agents/` and are recognized by Claude Code
- [x] All 6 skill files exist and appear in skill list
- [x] Scope-guard hook blocks writes outside `Scope.Owns`
- [x] Hookify rules block stop without tests/commit
- [x] `task-validate-links.sh` passes after all changes

### Judgment
- [ ] Planner spawns sub-planners for complex multi-domain features
- [ ] Context-gatherer returns useful structural context via code-memory
- [ ] Orchestrator correctly parallelizes tasks with non-overlapping Scope.Owns
- [ ] TDD skill produces failing tests first, then passing implementation
- [ ] End-to-end flow works: plan → execute → verify

---

## Constraints
- Context-gatherer must NOT read individual files — must use `npx code-memory` commands
- No overlapping `Scope.Owns` between parallel tasks
- code-memory must support git worktrees for parallel agent execution

---

## Work Log
- 2026-04-01: Plan designed through research on multi-agent architectures, Claude Code agent capabilities, TDD patterns, and codebase mapping tools. Evaluated Codebase-Memory-MCP, Codemap, and 6 other tools. Decided to build custom Watchman-based tooling due to cross-file reference staleness and worktree limitations in existing tools.
- 2026-04-01: Custom `code-memory` tool built at `tools/code-memory/` with Watchman + tree-sitter + graphology. Skill created at `.claude/skills/code-memory/SKILL.md`. Task unblocked and moved to backlog. Plan updated at `.claude/plans/distributed-rolling-dream.md`.
- 2026-04-01: Implemented full agent swarm architecture:
  - Phase 1: Created 10 agent definitions in `.claude/agents/` (planner, sub-planner, context-gatherer, standards-researcher, orchestrator, frontend, backend, devex, devops, qa)
  - Phase 2: Created 5 new skills (tdd, code-review, integration-test, e2e-test, doc-gen)
  - Phase 3: Created scope-guard.mjs hook, 3 hookify rules (require-tests-before-done, require-commit-before-stop, warn-contract-edit), registered scope-guard in settings.json
  - Phase 4: Updated CLAUDE.md with agent swarm section, appended 8 design decisions to context/decisions.md, created .claude/plans/ directory
  - All validation passed: 10 agents, 15 skills, task-validate-links clean
