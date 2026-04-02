---
name: e2e-test
description: Write and run end-to-end tests for complete user flows. Use when a task involves user-facing features that need full-stack validation.
user-invocable: true
---

# E2E Test

This skill writes and runs end-to-end tests that validate complete user flows through the full stack. E2E tests verify that the system works correctly from the user's perspective.

## When to Use

Invoke when a task implements user-facing features that span multiple layers (UI → API → database) or when acceptance criteria describe user workflows rather than unit-level behavior.

## Workflow

### Step 1: Extract User Flows

Read the active task file and extract:
- Acceptance criteria that describe user-visible behavior
- Any user story or flow description in the Objective section
- Referenced contracts that define API boundaries

### Step 2: Design Test Scenarios

For each user flow, define:
- **Setup**: What state must exist before the test (data, auth, config)
- **Actions**: What the user does (clicks, inputs, navigations, API calls)
- **Assertions**: What the user should see or what state should change
- **Teardown**: How to clean up after the test

### Step 3: Write E2E Tests

Choose the appropriate approach based on the feature type:

**For CLI tools**:
```bash
# Test via shell commands
# Assert on stdout, stderr, exit codes, and file system changes
```

**For APIs**:
```bash
# Test via HTTP requests (curl, fetch, or test framework HTTP client)
# Assert on response status, body, and side effects
```

**For web UI** (if browser tools available):
```
# Use browser automation tools (mcp__claude-in-chrome__*)
# Navigate, interact, assert on page content
```

### Step 4: Run Tests

```bash
# JavaScript/TypeScript
npx vitest run --reporter=verbose [e2e-test-file]

# Python
pytest -v [e2e-test-file]

# Shell-based
bash [test-script.sh]
```

### Step 5: Report Results

```markdown
## E2E Test Report

### Flows Tested
| Flow | Steps | Status | Duration |
|------|-------|--------|----------|
| [user flow name] | N | PASS/FAIL | Ns |

### Failed Flows
- **[flow name]**: Failed at step [N] — [description]
  - Expected: [what should happen]
  - Actual: [what happened]
  - Logs: [relevant log output]

### Coverage
- [N/M] acceptance criteria verified end-to-end
```

## Guidelines

- E2E tests should be deterministic — no timing-dependent assertions
- Use explicit waits (poll for condition) rather than fixed sleeps
- Test the happy path AND at least one error path per flow
- Keep E2E tests focused — test the flow, not every edge case (that's for unit tests)
- If a test is flaky, investigate the root cause rather than adding retries
- Capture logs on failure for debugging
