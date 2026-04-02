# code-memory

A graph-based codebase memory daemon that indexes and queries structural information about a codebase. It maintains a persistent in-memory knowledge graph for sub-millisecond queries across CLI invocations.

## Architecture

```
CLI (client) ──Unix Socket IPC──► Daemon (long-running)
                                    ├── Graphology Graph (in-memory)
                                    ├── SQLite (cold persistence)
                                    ├── Watchman (file subscriptions)
                                    └── Tree-sitter (multi-language parsing)
```

- **CLI** sends JSON requests over a Unix domain socket to the daemon
- **Daemon** keeps the knowledge graph hot in memory; auto-starts on first CLI use, auto-kills after 10 minutes of inactivity
- **Graph** (graphology) is the primary query engine — nodes are files, symbols, and modules; edges are imports, exports, declares, implements, contains
- **SQLite** stores gzipped graph snapshots for warm restarts — not queried at runtime
- **Watchman** subscribes to file changes and triggers incremental re-indexing
- **Tree-sitter** (native bindings) parses source files into structural data

## Supported Languages

- **TypeScript** / **MJS** / **JavaScript** (`.ts`, `.tsx`, `.mts`, `.mjs`, `.js`, `.jsx`)
- **Go** (`.go`)
- **Rust** (`.rs`)

## Use Cases

- **Dependency analysis**: trace what a file imports and what imports it
- **Hub detection**: identify the most-imported files in the codebase
- **Symbol search**: find functions, classes, structs, traits by name across all languages
- **Export inspection**: list what a file exports
- **Impact analysis**: understand the blast radius of changes via dependency trees

## CLI Commands

```
code-memory index [path]             # Full index (default: cwd)
code-memory status                   # Graph stats, daemon info
code-memory query <term>             # Search symbols by name
code-memory deps <file>              # Dependency graph for a file
code-memory hubs                     # Most-imported internal files
code-memory files [glob]             # List indexed files
code-memory exports <file>           # List exported symbols
code-memory daemon start|stop|status # Daemon lifecycle management
```

## Daemon Lifecycle

1. First CLI command auto-spawns the daemon as a detached process
2. Daemon loads graph from SQLite (warm start) or indexes from scratch (cold start)
3. Watchman subscription keeps graph up-to-date on file changes
4. Graph flushes to SQLite: on mutation (debounced 2s), every 5 minutes, and on shutdown
5. After 10 minutes of no CLI activity, daemon gracefully shuts down
6. Next CLI command re-spawns the daemon with a warm start from SQLite

## Flush Strategy

Three-tier persistence to balance durability and performance:
1. **On mutation**: debounce-flush 2s after last batch of graph changes settles
2. **Periodic**: every 5 minutes if graph is dirty
3. **On shutdown**: always flush before exit (SIGTERM, SIGINT, inactivity timeout)

## Development Conventions

- All source files use `.mjs` with JSDoc-based type annotations
- No TypeScript compiler or build step — run directly with `node`
- Type checking via `jsconfig.json` with `checkJs: true`
- Types defined in `src/types.mjs` using `@typedef` exports
