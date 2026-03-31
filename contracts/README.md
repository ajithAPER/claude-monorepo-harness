# Contracts

This directory holds shared interface specifications that define boundaries between tasks and agents.

## When to create a contract file

Create a contract file when:
- Two or more tasks need to agree on an API, data format, or interface
- The contract is complex enough that inline task descriptions are insufficient
- Multiple agents will implement different sides of the same interface

## Contract format

Use markdown with code blocks for schemas:

```markdown
# {Contract Name}

## Parties
- Producer: [[TASK-id]] — {what they build}
- Consumer: [[TASK-id]] — {what they need}

## Interface
{API spec, type definitions, data format, etc.}

## Constraints
{Performance requirements, error handling, security rules}
```

## Naming convention

`{feature}-{interface-type}.md` (e.g., `search-api.md`, `auth-tokens.md`)
