---
id: TASK-69dd543e-87aa
title: Create app template — nested workspace with frontend + backend
status: blocked
priority: medium
type: feature
created: 2026-04-13
updated: 2026-04-13
product: harness
depends_on:
  - "[[TASK-69dd543e-12b8]]"
  - "[[TASK-69dd543e-b197]]"
  - "[[TASK-69dd543e-ff0b]]"
blocks: []
tags: [tooling, dx]
session_estimate: 1
---

## Objective
Create an "app" template that scaffolds a nested pnpm workspace under `apps/` bundling a frontend (TanStack Start React) and backend (NestJS by default) together.

## Scope
### Owns
- `templates/app/` (entire directory)

### Reads
- `templates/backend-service/nestjs/` (copied into app)
- `templates/frontend-app/react/` (copied into app)
- `apps/pnpm-workspace.yaml`

## Contracts
### Consumes
- **scaffold-cli** from [[TASK-69dd543e-12b8]]
- **nestjs-service-template** from [[TASK-69dd543e-b197]]
- **frontend-app-template** from [[TASK-69dd543e-ff0b]]

### Publishes
- **app-template**: Template at `templates/app/` that bundles frontend + backend

## Acceptance Criteria
### Automated
- [ ] Given the template, when `template.json` is inspected, then it defines type `app` with variables `name`, `description`, `port`
- [ ] Given scaffolding an app named "my-app", when complete, then `apps/my-app/` contains `frontend/`, `backend/`, `package.json`, and `pnpm-workspace.yaml`
- [ ] Given the scaffolded app, when `pnpm install` runs from repo root, then it succeeds
- [ ] Given the scaffolded app, when `pnpm --filter my-app-backend test` runs, then vitest passes
- [ ] Given the scaffolded app, when `pnpm --filter my-app-frontend dev` runs, then dev server starts

### Judgment
- [ ] Nested workspace structure is clean (app root with frontend/ and backend/ sub-packages)
- [ ] Package names are scoped properly (e.g. `@my-app/frontend`, `@my-app/backend`)

## Constraints
- Default backend variant: NestJS
- Variables: `{{name}}`, `{{description}}`, `{{port}}`
- The app template must reference/compose the existing backend and frontend templates, not duplicate them
- Must register under `apps/` nested workspace

## Context
The app template is the highest-level scaffold — it creates a full-stack app workspace. The scaffold tool needs special handling here: rather than copying a flat template, it composes the frontend and backend templates into a nested workspace structure. The `template.json` for `app` type should indicate that it's a composite template.

## Delivery
- **pr_base**: task/TASK-69dd543e-12b8
- **pr_strategy**: cascade
- **commit_plan**:
  1. Create `templates/app/template.json` defining composite template structure
  2. Create app-level wrapper files (root package.json, pnpm-workspace.yaml)
  3. Implement composite template logic in scaffold tool (copy sub-templates into subdirs)
  4. Add integration test scaffolding a full app

## Work Log
