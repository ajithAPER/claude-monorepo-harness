---
name: task-plan
description: Decompose an epic or feature into agent-assignable tasks with dependency chains, file ownership, and interface contracts. Use when the user says "plan", "break down", "create tasks for", "decompose", etc.
user-invocable: true
---

# Plan and Decompose a Feature into Tasks

**Plan-first workflow**: This skill generates a plan ID, pre-generates all task IDs, and writes the plan to `.plan/{PLAN-ID}.md` for review. Task IDs are created once and reused verbatim when materializing — never regenerated.

## Steps

1. **Understand the feature**: If requirements haven't been gathered yet, invoke `/requirements` first to run a structured elicitation conversation. If a requirements summary already exists (from a prior `/requirements` invocation or a detailed user spec), use it as the primary input for decomposition.

2. **Check for existing plan session**: Look for any `.plan/PLAN-*.md` file with status `draft`. If found, ask the user if they want to resume it or start fresh. On resume, read the file to restore context (including pre-generated task IDs) and skip to Step 8.

3. **Explore the codebase**: Use subagents to understand:
   - Which products/directories are involved
   - Existing patterns, types, and interfaces to reuse
   - What code already exists vs. what needs to be created

4. **Identify layers and agents**: Determine which layers are involved:
   - Frontend / UI
   - Backend / API
   - Database / Schema
   - Infrastructure / DevOps
   - Testing / QA
   Each layer typically maps to one agent and one task.

5. **Generate IDs**: Generate the plan ID and all task IDs upfront:
   - Plan ID: `bash scripts/plan-id.sh` → e.g. `PLAN-69cb170c-a1b2`
   - Task IDs: `bash scripts/task-id.sh` (one call per task)

   These IDs are **final** — they go into the plan document and are reused as-is when materializing task files.

6. **Decompose into tasks**: For each task (using the pre-generated IDs):
   - Define clear `Scope.Owns` — files this task creates/modifies
   - Define `Scope.Reads` — files this task reads but must not modify
   - **Verify no file overlap**: Two tasks must NEVER have overlapping `Owns` entries
   - Size each task for a single session (`session_estimate: 1`)
   - **Assign delivery strategy** based on dependencies:
     - No `depends_on` → `pr_base: main`, `pr_strategy: direct`
     - Single `depends_on` → `pr_base: task/TASK-{dep}`, `pr_strategy: cascade`
     - Multiple `depends_on` → `pr_base: main`, `pr_strategy: direct` (must wait for all deps to merge first)
   - Always populate `commit_plan` with 2–4 logical steps matching acceptance criteria

7. **Write plan document**: Write the full plan to `.plan/{PLAN-ID}.md` with:
   - YAML frontmatter: `id` (plan ID), `title`, `status: draft`, `created` date, `task_ids` list
   - Summary section
   - Full task definitions under `### TASK-{id}: {title}` headings (complete task file content — frontmatter + all sections)
   - Dependency graph showing task ordering and parallelism
   - File ownership map (table: task → Scope.Owns)
   - Contracts summary (table: name, producer, consumer, interface)
   - Independent tasks grouped to show what can run in parallel
   - A final integration/QA task that depends on all implementation tasks

   **Define contracts at boundaries**: Where one task produces something another consumes:
   - Write a contract in the Publishes/Consumes sections
   - For complex interfaces, note that a shared contract file in `contracts/` will be created on materialization
   - Ensure both the producer and consumer reference the same contract

8. **Present for review**: Show the user a summary:
   - Plan ID for reference
   - Task list with IDs, titles, priorities, and assigned agent tags
   - Dependency graph (parallel vs sequential)
   - File ownership map
   - Contract summary

   Then ask:

   > **Does this plan look complete? Say "create tasks" to materialize, or tell me what to change.**

9. **Iterate or materialize**:
   - **Changes requested**: Update `.plan/{PLAN-ID}.md`, keeping existing task IDs stable. Only generate new IDs (via `bash scripts/task-id.sh`) for newly added tasks. Re-present the summary and ask again.
   - **Approved** ("create tasks", "looks good", "approve", "go ahead"): Invoke `/plan-apply {PLAN-ID}` to create task files and contracts from the plan.

10. **Validate**:
    ```bash
    bash scripts/task-index.sh
    bash scripts/task-validate-links.sh
    ```

11. **Present results**: Show the user:
    - Created task files with paths
    - Dependency graph (which tasks can run in parallel, which are sequential)
    - File ownership map (which agent owns which files)
    - Contract summary (what interfaces connect the tasks)
    - Suggest `/commit-tasks` to commit

## Multi-Agent Coordination Notes

- Each task should be completable by a single agent with zero prior context
- The task file + referenced contracts must contain everything needed
- Parallel tasks communicate via the two-channel model:
  - **Files**: Contracts, work logs, task files (persistent)
  - **Messages**: Contract negotiation, blocking discovery, scope renegotiation (ephemeral)
- The integration/QA task should verify all contracts are satisfied end-to-end

## Example Decomposition Pattern

```
Feature: "Add search to the app"

TASK-aaa (backend)          TASK-bbb (frontend)
  Owns: src/api/search/       Owns: src/ui/Search/
  Publishes: GET /api/search   Consumes: GET /api/search
  blocks: [[TASK-ccc]]        blocks: [[TASK-ccc]]
             ↓                         ↓
          TASK-ccc (QA/integration)
            Owns: tests/e2e/search/
            depends_on: [[TASK-aaa]], [[TASK-bbb]]
```
