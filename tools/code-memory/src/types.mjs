/**
 * Shared type definitions for code-memory.
 * All types are defined via JSDoc @typedef for type-safe MJS.
 */

/**
 * @typedef {'typescript' | 'javascript' | 'go' | 'rust'} Language
 */

/**
 * @typedef {'function' | 'class' | 'struct' | 'trait' | 'interface' | 'type' | 'const' | 'variable' | 'enum' | 'method' | 'module'} SymbolKind
 */

/**
 * @typedef {Object} FileRecord
 * @property {string} path - Absolute file path
 * @property {Language} language
 * @property {number} size - File size in bytes
 * @property {string} hash - SHA-256 content hash
 * @property {number} indexedAt - Unix timestamp ms
 */

/**
 * @typedef {Object} SymbolInfo
 * @property {string} name
 * @property {SymbolKind} kind
 * @property {number} lineStart
 * @property {number} lineEnd
 * @property {boolean} exported
 */

/**
 * @typedef {Object} ImportInfo
 * @property {string} specifier - Raw import string (e.g., './utils' or 'commander')
 * @property {string[]} names - Imported names, ['*'] for namespace, ['default'] for default
 * @property {boolean} isExternal - True if importing from node_modules / external package
 */

/**
 * @typedef {Object} ExportInfo
 * @property {string} name - Exported name
 * @property {SymbolKind} kind
 * @property {number} lineStart
 * @property {number} lineEnd
 */

/**
 * @typedef {Object} ParseResult
 * @property {SymbolInfo[]} symbols
 * @property {ImportInfo[]} imports
 * @property {ExportInfo[]} exports
 */

/**
 * @typedef {Object} LanguageParser
 * @property {Language} language
 * @property {string[]} extensions
 * @property {(source: string, filePath: string) => ParseResult} parse
 */

/**
 * @typedef {Object} DaemonRequest
 * @property {string} method
 * @property {Record<string, any>} [params]
 * @property {string} [id]
 */

/**
 * @typedef {Object} DaemonResponse
 * @property {any} [result]
 * @property {{ code: number, message: string }} [error]
 * @property {string} [id]
 */

/**
 * @typedef {Object} GraphStats
 * @property {number} fileCount
 * @property {number} symbolCount
 * @property {number} edgeCount
 * @property {number} lastIndexedAt
 * @property {boolean} isDirty
 */

/**
 * @typedef {Object} RepoState
 * @property {string} repoId
 * @property {string} projectRoot
 * @property {import('graphology').default} graph
 * @property {import('./db/persistence.mjs').Persistence} persistence
 * @property {number} lastActivity
 * @property {NodeJS.Timeout | null} flushDebounceTimer
 * @property {NodeJS.Timeout | null} periodicFlushTimer
 * @property {NodeJS.Timeout | null} repoIdleTimer
 */

/**
 * @typedef {Object} DaemonManager
 * @property {Map<string, RepoState>} repos
 * @property {number} globalLastActivity
 * @property {NodeJS.Timeout | null} inactivityTimer
 * @property {NodeJS.Timeout | null} cleanupTimer
 */

export {};
