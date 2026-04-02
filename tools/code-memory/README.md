# code-memory

Graph-based codebase memory daemon that indexes source code into an in-memory knowledge graph for sub-millisecond structural queries. A single daemon process serves multiple repositories, with centralized persistence and auto-managed lifecycle.

## Features

- **Multi-language**: TypeScript, JavaScript/MJS, Go, Rust via native tree-sitter parsers
- **Sub-millisecond queries**: In-memory graphology graph with BFS/DFS traversal
- **Auto-managed daemon**: Starts on first use, auto-kills after inactivity, version-controlled replacement
- **Multi-repo**: One daemon serves all repositories with lazy loading and per-repo idle unload
- **Zod-validated IPC**: All socket communication validated with Zod schemas
- **Centralized persistence**: SQLite snapshots at `~/.code-memory/repos/` with 14-day stale cleanup

## Quick Start

```bash
npx code-memory index            # Index current project
npx code-memory query parse      # Find symbols named "parse"
npx code-memory hubs             # Show most-imported files
npx code-memory deps src/cli.mjs # Dependency tree
```

## CLI Reference

### `code-memory index [path]`

Index the codebase into the knowledge graph. The daemon auto-starts if not running.

| Option | Description |
|--------|-------------|
| `--force` | Re-index all files, ignoring content hash cache |
| `--language <lang>` | Only index `typescript`, `javascript`, `go`, or `rust` |

Default path is `.` (current directory).

```bash
code-memory index                          # Index current directory
code-memory index /path/to/project         # Index a specific path
code-memory index --force                  # Force full re-index
code-memory index --language typescript    # Only TypeScript files
```

### `code-memory status`

Show graph statistics and daemon info. Displays version, repo ID, file count, symbol count, edge count, dirty state, daemon PID, and project root.

```bash
code-memory status
# Metric   Value
# ─────────────────
# Version  0.1.0
# RepoID   72b9467256fc
# Files    46
# Symbols  139
# Edges    363
# Dirty    no
# PID      12345
# Project  /path/to/project
```

### `code-memory query <term>`

Search for symbols by name across all indexed files.

| Option | Description |
|--------|-------------|
| `--kind <kind>` | Filter by kind: `function`, `class`, `struct`, `trait`, `interface`, `type`, `const`, `enum`, `method`, `module` |
| `--exported` | Only show exported symbols |
| `--language <lang>` | Filter by language |
| `--format <fmt>` | Output format: `flat` (default), `json` |

```bash
code-memory query parse                           # Find all symbols containing "parse"
code-memory query Config --kind class --exported   # Exported classes named "Config"
code-memory query handle --language go             # Go symbols matching "handle"
code-memory query create --format json             # JSON output for programmatic use
```

### `code-memory deps <file>`

Show the dependency tree for a file — what it imports and/or what imports it.

| Option | Description |
|--------|-------------|
| `--depth <n>` | Max traversal depth (default: `3`) |
| `--direction <dir>` | `out` (what it imports, default), `in` (what imports it), `both` |
| `--format <fmt>` | Output format: `tree` (default), `json`, `flat` |

```bash
code-memory deps src/config.mjs                       # What config.mjs depends on
code-memory deps src/config.mjs --direction in         # What files import config.mjs
code-memory deps src/daemon/server.mjs --depth 2       # Shallow dependency tree
code-memory deps src/cli.mjs --direction both --format json  # Both directions, JSON
```

Example tree output:
```
src/daemon/server.mjs
├── src/config.mjs
├── src/daemon/lifecycle.mjs
│   ├── src/db/persistence.mjs
│   ├── src/graph/model.mjs
│   └── src/indexer/indexer.mjs
└── src/daemon/handler.mjs
```

### `code-memory hubs`

Show the most-imported internal files (architectural focal points).

| Option | Description |
|--------|-------------|
| `--top <n>` | Number of results (default: `10`) |

```bash
code-memory hubs            # Top 10 most-imported files
code-memory hubs --top 5    # Top 5
```

### `code-memory files [glob]`

List all indexed files, optionally filtered.

| Option | Description |
|--------|-------------|
| `--language <lang>` | Filter by language |
| `--format <fmt>` | Output format: `flat` (default), `json` |

```bash
code-memory files                       # All indexed files
code-memory files --language rust       # Only Rust files
code-memory files --format json         # JSON output
```

### `code-memory exports <file>`

List all exported symbols from a specific file.

| Option | Description |
|--------|-------------|
| `--format <fmt>` | Output format: `flat` (default), `json` |

```bash
code-memory exports src/config.mjs
# Name                  Kind      Line
# ────────────────────────────────────
# EXTENSION_MAP         const     5
# SUPPORTED_EXTENSIONS  const     16
# getSocketPath         function  49
# getDbPath             function  63
# getRepoId             function  89
```

### `code-memory daemon <command>`

Manage the daemon process lifecycle.

| Subcommand | Description |
|------------|-------------|
| `start` | Start the daemon (auto-starts on any command anyway) |
| `stop` | Gracefully shut down the daemon |
| `status` | Show daemon PID, version, and per-repo stats |
| `repos` | List all loaded repositories with file/symbol counts |

```bash
code-memory daemon start     # Explicitly start
code-memory daemon stop      # Graceful shutdown
code-memory daemon status    # PID, version, stats
code-memory daemon repos     # All loaded repos
```

## Architecture

```
CLI (any repo) ──► Single Unix Socket ──► Daemon Process (version-locked)
                   ~/.code-memory/          │
                   daemon-v0.1.0.sock       ├── RepoState (repo A graph + persistence)
                                            ├── RepoState (repo B graph + persistence)
                                            └── Cleanup timer (prunes stale DBs)
```

- **CLI** sends JSON requests over a Unix domain socket
- **Daemon** maintains in-memory graphs per repo, auto-starts on first use
- **Graph** (graphology) is the primary query engine — nodes are files and symbols, edges are imports/exports/declares
- **SQLite** stores gzipped graph snapshots for warm restarts at `~/.code-memory/repos/{repoId}.db`
- **Tree-sitter** (native bindings) parses source files into structural data

## Persistence

All data is stored under `~/.code-memory/`:

```
~/.code-memory/
├── daemon-v0.1.0.sock       # Unix socket (one per version)
├── daemon-v0.1.0.sock.pid   # PID + version
└── repos/
    ├── 72b9467256fc.db       # Repo A snapshot
    └── a1b2c3d4e5f6.db       # Repo B snapshot
```

**Flush strategy** (three-tier):
1. On mutation: debounced 2s after graph changes settle
2. Periodic: every 5 minutes if dirty
3. On shutdown: always flush before exit

**Stale cleanup**: Repo DBs with no writes for 14 days are automatically deleted (checked hourly and on startup).

**Per-repo idle**: Graph unloaded from memory after 15 minutes of inactivity. DB stays on disk for warm restart.

## Supported Languages

| Language | Extensions | Parser |
|----------|-----------|--------|
| TypeScript | `.ts`, `.tsx`, `.mts` | tree-sitter-typescript |
| JavaScript/MJS | `.mjs`, `.js`, `.jsx` | tree-sitter-javascript |
| Go | `.go` | tree-sitter-go |
| Rust | `.rs` | tree-sitter-rust |

## Development

All source files use `.mjs` with JSDoc-based type annotations. No build step.

```bash
yarn workspace code-memory test     # Run unit tests (vitest)
node tools/code-memory/src/cli.mjs  # Run CLI directly
```

Type checking via `jsconfig.json` with `checkJs: true`.
