---
name: integration-test
description: Write and run integration tests that verify contract boundaries between modules or services. Use when a task consumes or publishes contracts defined in contracts/.
user-invocable: true
---

# Integration Test

This skill writes and runs integration tests that exercise the boundaries defined by contract files in `contracts/`. Integration tests verify that producers and consumers agree on interfaces.

## When to Use

Invoke when a task references contracts in its `Contracts.Consumes` or `Contracts.Publishes` sections. Integration tests verify that the implementation correctly implements or consumes the contracted interface.

## Workflow

### Step 1: Identify Contracts

Read the active task file and extract:
- `Contracts.Consumes` — interfaces this code depends on
- `Contracts.Publishes` — interfaces this code must provide

### Step 2: Read Contract Specs

For each referenced contract, read the file from `contracts/`:
- Understand the interface shape (function signatures, API endpoints, data formats)
- Note constraints (validation rules, error codes, rate limits)
- Identify edge cases mentioned in the contract

### Step 3: Write Integration Tests

For each **consumed** contract:
```
Test that this code correctly calls the interface:
- Correct request format / function arguments
- Handles all documented response types (success, errors)
- Respects documented constraints (timeouts, retries, rate limits)
```

For each **published** contract:
```
Test that this code correctly provides the interface:
- Returns the documented response format
- Handles documented input variations
- Returns correct error codes for invalid inputs
- Meets documented performance constraints
```

### Step 4: Run Tests

Run the integration test suite:
```bash
# JavaScript/TypeScript
npx vitest run --reporter=verbose [test-file]

# Python
pytest -v [test-file]

# Go
go test -v -run Integration ./...

# Rust
cargo test --test integration
```

### Step 5: Report Results

```markdown
## Integration Test Report

### Contracts Tested
| Contract | Role | Tests | Pass | Fail |
|----------|------|-------|------|------|
| [name] | consumer/producer | N | N | N |

### Failed Tests
- `test_name`: [failure reason and expected vs actual]

### Contract Compliance
- [contract name]: COMPLIANT / NON-COMPLIANT — [details]
```

## Guidelines

- Test real interactions, not mocks — integration tests should exercise actual contract boundaries
- Use test fixtures or factories for test data, not hardcoded values
- Each test should be independent and idempotent
- Clean up test state after each test (database rows, temp files, etc.)
- If a contract defines error codes, test each one
