---
id: TASK-69dd543e-a3f2
title: Restructure workspace — replace products with apps
status: backlog
priority: high
type: infrastructure
created: 2026-04-13
updated: 2026-04-13
product: harness
depends_on: []
blocks:
  - "[[TASK-69dd543e-12b8]]"
tags: [tooling, dx, infrastructure]
session_estimate: 1
---

## Objective
Replace the `products/*/apps/*` workspace pattern with a top-level `apps/` directory that is itself a nested pnpm workspace. This establishes the directory structure all subsequent scaffolding depends on.

## Scope
### Owns
- `pnpm-workspace.yaml`
- `apps/` (directory creation)
- `package.json` (workspace-related fields only)
- `CLAUDE.md` (update workspace references)

### Reads
- `common/*/package.json`
- `tools/*/package.json`

## Contracts
### Consumes
None

### Publishes
- **workspace-layout**: `apps/` is a nested pnpm workspace; `common/*` holds platform packages; `tools/*` holds tooling

## Acceptance Criteria
### Automated
- [ ] Given the repo, when `pnpm install` runs, then it succeeds without errors
- [ ] Given `apps/` directory, when inspected, then it contains a `pnpm-workspace.yaml` for nested workspace support
- [ ] Given `pnpm-workspace.yaml` at root, when inspected, then `products/*/apps/*` pattern is removed and `apps` is registered
- [ ] Given CLAUDE.md, when inspected, then workspace docs reference `apps/` not `products/*/apps/*`

### Judgment
- [ ] Directory structure is clean and intuitive

## Constraints
- Must not break existing `common/*` or `tools/*` packages
- Must preserve `node-linker=hoisted` in `.npmrc`

## Context
Current workspace uses `products/*/apps/*` which is being replaced with a simpler top-level `apps/` pattern. The `apps/` directory will be a nested pnpm workspace so each app can manage its own sub-packages (frontend + backend).

## Delivery
- **pr_base**: main
- **pr_strategy**: direct
- **commit_plan**:
  1. Remove `products/` references, update `pnpm-workspace.yaml`
  2. Create `apps/` directory with nested `pnpm-workspace.yaml`
  3. Update `CLAUDE.md` and root `package.json`

## Work Log
