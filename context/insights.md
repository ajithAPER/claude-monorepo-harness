# Insights

## 2026-03-30: Claude Code native tasks vs file-based tasks
Claude Code's built-in `TaskCreate`/`TaskUpdate` tools persist to `~/.claude/tasks/` as JSON. These are useful for in-session step tracking but live outside the repo and don't survive across machines. Our file-based system in `tasks/` complements them: use native tasks for session-level progress, file tasks for cross-session and cross-contributor tracking.

## 2026-03-30: Community convergence on markdown + YAML frontmatter
Research of task tracking systems for AI development (Backlog.md, taskmd, MDTM, LCMP, Beads) shows convergence on markdown files with YAML frontmatter as the optimal format. It's human-readable, AI-parseable, git-friendly, and requires no external tools. This informed our choice of task file format.

## 2026-03-30: Context window optimization strategies
Key findings from research:
- Keep tasks sized for single conversation sessions
- Save research to files, not conversation history
- Separate research, planning, and implementation phases
- Use subagents for investigation to keep main context clean
- Commit frequently, treat sessions as disposable
- The `context/` directory (state.md, decisions.md, insights.md) is the LCMP-inspired pattern for cross-session continuity.
