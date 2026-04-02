---
name: code-review
description: Review code changes against task acceptance criteria, contract compliance, and security best practices. Use after implementing a feature to verify quality before marking a task as done.
user-invocable: true
---

# Code Review

This skill performs a structured review of code changes against the task's acceptance criteria, referenced contracts, and general quality standards.

## When to Use

Invoke after implementation is complete and tests pass, but before marking a task as done. This is the final quality gate.

## Workflow

### Step 1: Gather Context

Read the active task file to extract:
- Acceptance criteria (both Automated and Judgment)
- `Scope.Owns` file paths
- `Contracts.Publishes` — interfaces this task must implement correctly
- `Contracts.Consumes` — interfaces this task depends on

### Step 2: Review Changes

Run `git diff` scoped to the task's `Scope.Owns` files:

```bash
git diff HEAD~1 -- [Scope.Owns paths]
```

Or if multiple commits:
```bash
git log --oneline -10
git diff [base-commit]..HEAD -- [Scope.Owns paths]
```

### Step 3: Check Acceptance Criteria

For each **automated** criterion:
- Verify the criterion is testable and a test exists
- Run the relevant test command
- Mark as PASS or FAIL with evidence

For each **judgment** criterion:
- Assess the implementation against the criterion
- Provide a brief rationale for PASS or NEEDS WORK

### Step 4: Verify Contract Compliance

For each contract in `Contracts.Publishes`:
- Read the contract file from `contracts/`
- Verify the implementation matches the contract's interface specification
- Check data formats, error handling, and edge cases

### Step 5: Security & Quality Scan

Check for:
- [ ] No hardcoded secrets, API keys, or credentials
- [ ] No `console.log` / debug statements in production code
- [ ] No `TODO` or `FIXME` hacks that bypass the task scope
- [ ] Input validation at system boundaries
- [ ] No SQL injection, XSS, or command injection vulnerabilities
- [ ] Error handling for external calls (network, file I/O, database)

### Step 6: Produce Report

```markdown
## Code Review Report

### Task: [TASK-ID] — [title]

### Acceptance Criteria
| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | [criterion] | PASS/FAIL | [brief evidence] |

### Contract Compliance
| Contract | Status | Notes |
|----------|--------|-------|
| [contract name] | COMPLIANT/NON-COMPLIANT | [details] |

### Security & Quality
- [x] No secrets in code
- [x] No debug statements
- [ ] [Any issues found]

### Summary
[Overall assessment: APPROVED / NEEDS CHANGES]

### Action Items (if any)
1. [Specific change needed]
```

## Constraints

- This is a read-only review — do not modify code during the review
- If issues are found, report them clearly so the specialist agent can fix them
- Focus on correctness and contract compliance, not style preferences
