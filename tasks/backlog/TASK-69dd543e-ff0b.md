---
id: TASK-69dd543e-ff0b
title: Create frontend app template — TanStack Start React
status: backlog
priority: high
type: feature
created: 2026-04-13
updated: 2026-04-13
product: harness
depends_on: []
blocks:
  - "[[TASK-69dd543e-87aa]]"
tags: [frontend, ui, tooling, dx]
session_estimate: 1
---

## Objective
Create a TanStack Start frontend app template with TanStack Router, identified as a "react" boilerplate. Minimal but functional: routing setup with example routes, standard React entry point.

## Scope
### Owns
- `templates/frontend-app/` (entire directory)

### Reads
- `common/typescript-config/base.json`

## Contracts
### Consumes
- **template-manifest** format from [[TASK-69dd543e-12b8]]

### Publishes
- **frontend-app-template**: Template files at `templates/frontend-app/react/`

## Acceptance Criteria
### Automated
- [ ] Given the template, when `template.json` is inspected, then it defines type `frontend-app`, variant `react`, variables `name` and `description`
- [ ] Given substituted files, when `pnpm install && pnpm dev` runs, then the dev server starts
- [ ] Given the app, when accessed in a browser, then it renders the example route
- [ ] Given `template.json`, when inspected, then it identifies as `react` template type

### Judgment
- [ ] Uses TanStack Start with TanStack Router for file-based routing
- [ ] Clean minimal boilerplate — no styling opinions
- [ ] Standard React project structure

## Constraints
- ESM (`"type": "module"`)
- TypeScript with shared tsconfig base
- Variables: `{{name}}`, `{{description}}`
- Must be tagged/identified as a "react" boilerplate in template.json

## Context
TanStack Start is a full-stack React framework built on TanStack Router and Vinxi. The template provides a minimal starting point: app entry, root route, one example route, and TanStack Router config. No styling, no auth, no data fetching opinions — those come later.

## Delivery
- **pr_base**: main
- **pr_strategy**: direct
- **commit_plan**:
  1. Create `templates/frontend-app/template.json` with react variant metadata
  2. Create React + TanStack Start template files (app entry, routes, router config)
  3. Add package.json with dev/build/start scripts

## Work Log
