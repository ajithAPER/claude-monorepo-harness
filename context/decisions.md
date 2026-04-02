# Architecture Decisions

## 2026-03-30: Task status via directory placement
**Decision:** Encode task status in directory path (`tasks/backlog/`, `tasks/active/`, etc.), not just YAML frontmatter.
**Rationale:** Makes project state visible from `ls` alone. No parsing needed. Complements the frontmatter field which stays in sync via `task-move.sh`.
**Trade-off:** Moving files on status change requires `git mv`, but the `task-move.sh` script and `/task-update` skill automate this.

## 2026-03-30: Unique hex-based task IDs over sequential numbering
**Decision:** Use `TASK-{hex_epoch}-{4_hex_random}` format instead of `TASK-0001`, `TASK-0002`, etc.
**Rationale:** Multiple contributors/agents can create tasks simultaneously without coordination. Sequential IDs conflict when two people create tasks at the same time on different machines.
**Trade-off:** IDs are less human-memorable, but they sort chronologically and are short enough to type.

## 2026-03-30: Wikilinks with task IDs, not file paths
**Decision:** Tasks reference each other with `[[TASK-id]]` wikilinks where the target is the immutable ID, not the file path.
**Rationale:** When tasks move between status directories (`backlog/` → `active/` → `done/`), path-based links break. ID-based links resolve via `find tasks/ -name "TASK-id.md"` regardless of directory.
**Trade-off:** Requires a resolver (simple `find` command) rather than direct file path links. Obsidian natively supports this syntax.

## 2026-03-30: Two-channel coordination (files + messages)
**Decision:** Use persistent files as source of truth and ephemeral agent messages for real-time coordination.
**Rationale:** Files alone are too slow for contract negotiation, blocking discovery, and scope renegotiation. Messages alone are ephemeral and don't survive sessions. The hybrid approach gives durability AND speed.
**Trade-off:** Agents must understand when to use each channel (decision tree in CLAUDE.md).

## 2026-04-01: Custom code-memory over third-party tools
**Decision:** Build a custom Watchman-based codebase knowledge graph (`tools/code-memory/`) instead of using Codebase-Memory-MCP, Codemap, or other existing tools.
**Rationale:** Evaluated 8 tools. All had cross-file reference staleness on renames and no native git worktree support. Custom tool uses Watchman for real-time monitoring, tree-sitter for multi-language parsing, and graphology for in-memory graph queries.
**Trade-off:** Higher upfront build cost, but eliminates a class of staleness bugs and enables parallel agent execution in worktrees.

## 2026-04-01: Hierarchical planner with sub-planners
**Decision:** For complex features spanning 3+ domains, the planner spawns domain-specific sub-planners that each get their own context-gatherer and standards-researcher.
**Rationale:** A single planner's context window can't hold deep domain research for multiple domains simultaneously. Sub-planners enable focused research per domain without context window pressure.
**Trade-off:** More agent spawns and coordination overhead for simple features. Mitigated by a complexity heuristic that only triggers sub-planners when needed.

## 2026-04-01: Hub-and-spoke over group chat
**Decision:** The orchestrator is the hub; specialist agents communicate only through it, never directly with each other.
**Rationale:** N-to-N communication creates exponential complexity. Hub-and-spoke keeps coordination auditable through task files and prevents conflicting instructions.
**Trade-off:** Slightly higher latency for cross-agent coordination (must go through orchestrator), but much simpler mental model and debugging.

## 2026-04-01: Model assignment by role
**Decision:** Opus for planner and orchestrator (deep reasoning), Sonnet for specialists and sub-planners (fast code generation), Haiku for context-gatherer (lightweight, code-memory does the work).
**Rationale:** Planning and orchestration require complex multi-step reasoning. Implementation benefits from speed and volume. Context gathering is mechanical query work.
**Trade-off:** Higher cost for planning/orchestration, but these run less frequently than specialists.

## 2026-04-01: Separate TDD subagents per phase
**Decision:** The TDD skill runs Red, Green, and Refactor phases in separate subagents with isolated context.
**Rationale:** Prevents the "generate-then-test" anti-pattern where tests are written to match the implementation rather than the specification. The test writer never sees the implementation; the implementer cannot modify tests.
**Trade-off:** Three agent invocations per feature instead of one, but dramatically better test quality.

## 2026-04-01: File-based communication over Agent Teams
**Decision:** Use task files and contracts for inter-agent communication instead of Claude Code's experimental Agent Teams feature.
**Rationale:** Agent Teams is experimental and doesn't persist across sessions. Task files and contracts survive sessions, are auditable via git, and integrate with the existing task lifecycle.
**Trade-off:** Less real-time than Agent Teams, but more reliable and debuggable.

## 2026-04-01: Scope-guard as custom hook (not hookify)
**Decision:** Implement file ownership enforcement as a standalone Node.js hook rather than a hookify rule.
**Rationale:** Hookify rules use simple pattern matching (regex, contains, etc.). Scope enforcement requires reading YAML frontmatter from active task files, parsing markdown sections, and glob-matching file paths — too complex for hookify's condition system.
**Trade-off:** Separate maintenance from hookify, but the logic is inherently different (dynamic per-task rules vs. static patterns).

## 2026-04-01: Git worktrees for parallel agent execution
**Decision:** Specialist agents run in isolated git worktrees with branch naming `task/TASK-{id}`.
**Rationale:** Non-overlapping `Scope.Owns` means worktree merges should be conflict-free. Worktrees provide true filesystem isolation without the overhead of cloning.
**Trade-off:** Requires tooling (code-memory, scripts) to be worktree-aware. code-memory was designed for this from the start.

## 2026-04-02: Conventional Commits for commit messages
**Decision:** Adopt Conventional Commits (`type(scope): description`) as the required commit message format, enforced by a `commit-msg` git hook.
**Rationale:** Enables automated changelog generation, makes commit history scannable by type, and aligns with the industry standard used by Angular, Vue, Astro, and most modern open-source projects.
**Trade-off:** Slightly more friction per commit, but agents produce commits programmatically so the format is enforced automatically. Humans can bypass with `--no-verify`.

## 2026-04-02: Raw git hooks over Lefthook/Husky
**Decision:** Use plain bash git hooks installed via `scripts/hooks-install.sh` rather than Lefthook, Husky, or other hook managers.
**Rationale:** Matches the bash-native, zero-dependency philosophy of the existing scripts. Hook managers add npm dependencies and configuration complexity. The hooks are simple enough that a copy-based installer is sufficient.
**Trade-off:** No parallel hook execution, no built-in lint-staged integration. These can be added later if needed.

## 2026-04-02: Migrate package manager from Yarn 4 to PNPM
**Decision:** Replace Yarn 4 (Berry) with PNPM 10 as the monorepo package manager.
**Rationale:** PNPM has stronger defaults for monorepos, faster installs via content-addressable global store, and cleaner workspace tooling (`pnpm -r run`). Yarn 4 Berry had unnecessary complexity for this use case (no PnP, no constraints needed yet). PNPM's `node-linker=hoisted` setting preserves the flat `node_modules` layout required by native addons (`better-sqlite3`, `tree-sitter`).
**Trade-off:** Loses Yarn's `constraints` feature (version consistency enforcement across workspaces), but this can be replaced with `syncpack` if needed. PNPM's `onlyBuiltDependencies` setting in `package.json` is required to allow native addon build scripts, which is a slight increase in configuration surface.

## 2026-04-02: Platform-independent workflows with pluggable adapters
**Decision:** Git workflow scripts never hard-depend on platform-specific CLIs (`gh`, `glab`, etc.). Platform integration is pluggable via `scripts/git-platform.sh` which auto-detects the hosting platform and falls back to manual instructions.
**Rationale:** The monorepo harness must be forkable to any Git hosting platform (GitHub, GitLab, Bitbucket, self-hosted, etc.). Hard-coding `gh` would break portability.
**Trade-off:** PR creation requires manual copy-paste when no CLI is available, but the adapter generates the correct URL and pre-formatted content.
