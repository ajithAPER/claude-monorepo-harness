---
id: TASK-69dd543e-aaaf
title: Create backend service template — Koa variant
status: backlog
priority: medium
type: feature
created: 2026-04-13
updated: 2026-04-13
product: harness
depends_on: []
blocks: []
tags: [backend, tooling, dx]
session_estimate: 1
---

## Objective
Create a Koa backend service template with production-ready defaults: structured logging (koa-pino-logger), health check endpoint, graceful shutdown, global error handling middleware, environment config, and vitest test setup.

## Scope
### Owns
- `templates/backend-service/koa/` (entire directory)

### Reads
- `common/typescript-config/base.json`
- `templates/backend-service/template.json` (shared manifest created by NestJS task)

## Contracts
### Consumes
- **template-manifest** format from [[TASK-69dd543e-12b8]]

### Publishes
- **koa-service-template**: Template files at `templates/backend-service/koa/`

## Acceptance Criteria
### Automated
- [ ] Given the template, when the shared `template.json` is inspected, then it includes variant `koa` alongside `nestjs`
- [ ] Given substituted files, when `pnpm install && pnpm build` runs, then it succeeds
- [ ] Given the service, when started, then GET `/health` returns `{ status: 'ok' }` with 200
- [ ] Given the service, when `pnpm test` runs, then vitest executes health endpoint test
- [ ] Given SIGTERM, when sent to the process, then it shuts down gracefully

### Judgment
- [ ] Middleware stack follows standard Koa ordering (error handler -> security -> cors -> body parser -> logging -> router)
- [ ] Full ESM — `"type": "module"` in package.json
- [ ] Error handling returns consistent JSON error responses

## Constraints
- Full ESM (`"type": "module"`) — Koa supports it natively
- Variables: `{{name}}`, `{{description}}`, `{{port}}` (default 3000)

## Context
Koa variant is the lightweight alternative to NestJS. Template includes: src/main.ts (create app, apply middleware, start server with graceful shutdown), src/router.ts (@koa/router with health + example routes), src/middleware/errorHandler.ts (global try/catch). Uses `dotenv` for env config, `koa-pino-logger` for structured logging. Vitest works out of the box with ESM — no SWC needed.

## Delivery
- **pr_base**: main
- **pr_strategy**: direct
- **commit_plan**:
  1. Create Koa variant template files (src/, middleware, router)
  2. Add vitest config and health endpoint test
  3. Update shared `templates/backend-service/template.json` to include koa variant

## Work Log
