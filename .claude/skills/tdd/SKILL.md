---
name: tdd
description: Red-Green-Refactor TDD workflow with isolated subagents per phase. Prevents context bleed between test writing and implementation. Use when implementing any feature or fixing any bug — write failing tests first, then implement, then refactor.
user-invocable: true
---

# TDD — Test-Driven Development with Isolated Phases

This skill enforces strict TDD by running each phase (Red, Green, Refactor) in a **separate subagent**. This prevents the "generate-then-test" anti-pattern where tests are written to match the implementation rather than the specification.

## When to Use

Invoke this skill for any implementation work. It works with any test framework (vitest, jest, pytest, cargo test, go test).

## Workflow

### Prerequisites

Before starting, gather:
1. The **acceptance criteria** from the task file (these drive the tests)
2. Any **contract specs** from `contracts/` that define interfaces
3. The **test directory** within your `Scope.Owns` (e.g., `src/__tests__/`, `tests/`)
4. The **test command** for the project (e.g., `npm test`, `npx vitest run`, `pytest`)

### Phase 1: Red (Write Failing Tests)

Spawn a subagent with the Agent tool:

**Prompt template**:
```
You are a test writer. Write tests for the following acceptance criteria:

[paste acceptance criteria here]

Contract specs (if any):
[paste relevant contract specs]

Existing test patterns to follow:
[paste example test file path or pattern]

Rules:
- ONLY create or modify test files in: [test directory paths]
- NEVER create implementation files
- Write tests that express the SPECIFICATION, not an assumed implementation
- After writing tests, run them with: [test command]
- Tests MUST FAIL — if any test passes, the test is wrong (it's testing something that already exists or is trivially true)
- Report which tests fail and why
```

**Verify**: All new tests fail. If any pass, the test is not testing new behavior — fix or remove it.

### Phase 2: Green (Make Tests Pass)

Spawn a **separate** subagent with the Agent tool:

**Prompt template**:
```
You are an implementer. Make the following failing tests pass:

[paste the failing test output from Red phase]

Test files are at: [test file paths]
You may read the test files but NEVER modify them.

Implementation files you may create/modify: [implementation paths within Scope.Owns, excluding test dirs]

Contract specs to comply with:
[paste relevant contract specs]

Rules:
- NEVER modify test files
- Write the MINIMUM code to make tests pass
- Do not add features beyond what the tests require
- After implementation, run: [test command]
- ALL tests must PASS
- Report the test results
```

**Verify**: All tests pass. If tests still fail, the subagent continues iterating within its turn.

### Phase 3: Refactor (Improve Without Breaking)

Spawn a **separate** subagent with the Agent tool:

**Prompt template**:
```
You are a refactorer. Improve the code quality of both tests and implementation without changing behavior.

Test files: [test file paths]
Implementation files: [implementation file paths]

Rules:
- You may modify BOTH test and implementation files
- After EVERY change, run: [test command]
- Tests must STILL PASS after every change
- Focus on: removing duplication, improving naming, simplifying logic, extracting helpers
- Do NOT add new features or new test cases
- Report what you refactored and final test results
```

**Verify**: All tests still pass after refactoring.

## Summary

| Phase | May Write | May NOT Write | Exit Criteria |
|-------|-----------|---------------|---------------|
| Red | Test files | Implementation | All new tests FAIL |
| Green | Implementation | Test files | All tests PASS |
| Refactor | Both | — | All tests still PASS |

## Why Separate Subagents?

The test writer must not see the implementation — otherwise tests become mirrors of the code rather than specifications. The implementer must not touch tests — otherwise it's tempting to weaken assertions. Separate subagents enforce these boundaries naturally through context isolation.
