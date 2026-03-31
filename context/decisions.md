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
