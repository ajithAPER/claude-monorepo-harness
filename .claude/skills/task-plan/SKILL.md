---
name: task-plan
description: Decompose an epic or feature into agent-assignable tasks with dependency chains, file ownership, and interface contracts. Use when the user says "plan", "break down", "create tasks for", "decompose", etc.
user-invocable: true
---

# Plan and Decompose a Feature into Tasks

## Steps

1. **Understand the feature**: If requirements haven't been gathered yet, invoke `/requirements` first to run a structured elicitation conversation. If a requirements summary already exists (from a prior `/requirements` invocation or a detailed user spec), use it as the primary input for decomposition.

2. **Explore the codebase**: Use subagents to understand:
   - Which products/directories are involved
   - Existing patterns, types, and interfaces to reuse
   - What code already exists vs. what needs to be created

3. **Identify layers and agents**: Determine which layers are involved:
   - Frontend / UI
   - Backend / API
   - Database / Schema
   - Infrastructure / DevOps
   - Testing / QA
   Each layer typically maps to one agent and one task.

4. **Decompose into tasks**: For each task:
   - Generate a unique ID: `bash scripts/task-id.sh`
   - Define clear `Scope.Owns` — files this task creates/modifies
   - Define `Scope.Reads` — files this task reads but must not modify
   - **Verify no file overlap**: Two tasks must NEVER have overlapping `Owns` entries
   - Size each task for a single session (`session_estimate: 1`)
   - **Assign delivery strategy** based on dependencies:
     - No `depends_on` → `pr_base: main`, `pr_strategy: direct`
     - Single `depends_on` → `pr_base: task/TASK-{dep}`, `pr_strategy: cascade`
     - Multiple `depends_on` → `pr_base: main`, `pr_strategy: direct` (must wait for all deps to merge first)
   - Always populate `commit_plan` with 2–4 logical steps matching acceptance criteria

5. **Define contracts at boundaries**: Where one task produces something another consumes:
   - Write a contract in the Publishes/Consumes sections
   - For complex interfaces, create a shared contract file in `contracts/`
   - Ensure both the producer and consumer reference the same contract

6. **Set up the dependency graph**:
   - Tasks with no dependencies → `tasks/backlog/`
   - Tasks whose dependencies are not yet done → `tasks/blocked/`
   - Use `depends_on` and `blocks` with `[[TASK-id]]` wikilinks
   - Independent tasks can run in parallel
   - Always create a final integration/QA task that depends on all implementation tasks

7. **Create all task files**: Use the full template from `/task-create` for each. Ensure the `## Delivery` section is populated with the correct `pr_base`, `pr_strategy`, and `commit_plan` as determined in Step 4.

8. **Regenerate and validate**:
   ```bash
   bash scripts/task-index.sh
   bash scripts/task-validate-links.sh
   ```

9. **Present the plan**: Show the user:
   - Task list with IDs, titles, and status
   - Dependency graph (which tasks can run in parallel, which are sequential)
   - File ownership map (which agent owns which files)
   - Contract summary (what interfaces connect the tasks)

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
