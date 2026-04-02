---
name: code-memory
description: Query and manage the codebase knowledge graph — find symbols, trace dependencies, identify hub files, and understand code structure. Use this skill whenever the user asks about code architecture, imports, exports, dependencies, "what uses this file", "where is this function defined", "most important files", or wants to index/reindex the codebase. Also use when the user wants to understand the structure or relationships between files, or asks questions like "what does this file depend on" or "show me the dependency tree".
user-invocable: true
---

# Code Memory — Codebase Knowledge Graph

This skill gives you access to a graph-based codebase memory system that indexes source code and lets you query structural relationships instantly. The daemon auto-starts on first use — no setup needed.

All commands are run via the Bash tool using `npx code-memory <command>`.

## When to Use Which Command

Match the user's intent to the right command:

| User wants to... | Command |
|---|---|
| Index or re-index the project | `npx code-memory index` |
| Find a function, class, or symbol | `npx code-memory query <term>` |
| See what a file depends on | `npx code-memory deps <file>` |
| See what depends on a file | `npx code-memory deps <file> --direction in` |
| Find the most-connected files | `npx code-memory hubs` |
| List what a file exports | `npx code-memory exports <file>` |
| List all indexed files | `npx code-memory files` |
| Check daemon/index status | `npx code-memory status` |

## Command Reference

### Searching for Symbols

```bash
npx code-memory query <term> [--kind <kind>] [--exported] [--language <lang>] [--format flat|json]
```

The `term` is a substring match (case-insensitive). Filter results with:
- `--kind`: function, class, struct, trait, interface, type, const, enum, method, module
- `--exported`: only exported/public symbols
- `--language`: typescript, javascript, go, rust

**Example:** Find all exported functions containing "parse":
```bash
npx code-memory query parse --kind function --exported
```

### Dependency Analysis

```bash
npx code-memory deps <file> [--depth <n>] [--direction out|in|both] [--format tree|json|flat]
```

- `--direction out` (default): what this file imports
- `--direction in`: what files import this one
- `--direction both`: both directions
- `--depth`: how many levels deep to traverse (default: 3)

**Example:** See what imports `config.mjs`:
```bash
npx code-memory deps src/config.mjs --direction in --depth 2
```

### Hub Detection

```bash
npx code-memory hubs [--top <n>]
```

Shows the most-imported internal files — these are architectural focal points. Default shows top 10.

### File Exports

```bash
npx code-memory exports <file> [--format flat|json]
```

Lists every exported symbol from a file with its name, kind, and line number.

### Indexing

```bash
npx code-memory index [path] [--force] [--language <lang>]
```

Re-indexes the codebase. Use `--force` to ignore the content hash cache and reparse everything. The index happens automatically on first use, so you typically only need this after major changes or to force a refresh.

### File Listing

```bash
npx code-memory files [glob] [--language <lang>] [--format flat|json]
```

### Status & Daemon

```bash
npx code-memory status                # Graph stats for current repo
npx code-memory daemon status         # Daemon process info
npx code-memory daemon repos          # All loaded repositories
npx code-memory daemon stop           # Graceful shutdown
```

## Output Format Strategy

- Use `--format flat` or `--format tree` when showing results directly to the user (these are human-readable)
- Use `--format json` when you need to process or filter the output programmatically before presenting it
- The default format is usually the best choice for display

## Supported Languages

TypeScript (`.ts`, `.tsx`, `.mts`), JavaScript/MJS (`.mjs`, `.js`, `.jsx`), Go (`.go`), Rust (`.rs`)

## Tips

- The daemon auto-starts on any command — never tell the user to start it manually
- File paths in commands are relative to the project root
- The `query` command does substring matching, so `query config` finds `Config`, `getConfig`, `configLoader`, etc.
- Use `deps --direction both` to get a complete picture of a file's connections
- `hubs` is the fastest way to identify the most architecturally significant files
- If the index seems stale, run `npx code-memory index --force`
