import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

/** Package version, read from package.json at import time */
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
export const VERSION = pkg.version;

/** @type {Record<string, import('./types.mjs').Language>} */
export const EXTENSION_MAP = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.mjs': 'javascript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.go': 'go',
  '.rs': 'rust',
};

export const SUPPORTED_EXTENSIONS = Object.keys(EXTENSION_MAP);

export const IGNORE_DIRS = [
  '.git',
  'node_modules',
  'target',
  'vendor',
  '.yarn',
  'dist',
  'build',
  '.next',
];

/** Default daemon inactivity timeout in ms (10 minutes) */
export const DAEMON_TIMEOUT_MS = 10 * 60 * 1000;

/** Debounce delay for mutation flushes in ms */
export const FLUSH_DEBOUNCE_MS = 2000;

/** Periodic flush interval in ms (5 minutes) */
export const FLUSH_INTERVAL_MS = 5 * 60 * 1000;

/** Inactivity check interval in ms */
export const INACTIVITY_CHECK_MS = 30 * 1000;

/** Request timeout for CLI client in ms */
export const CLIENT_TIMEOUT_MS = 5000;

/** Per-repo idle timeout — unload graph from memory after 15 min */
export const REPO_IDLE_MS = 15 * 60 * 1000;

/** Stale DB cleanup frequency — check hourly */
export const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

/** Delete repo DBs with no writes for this many days */
export const RETENTION_DAYS = 14;

/**
 * Get the base directory for all code-memory data.
 * @returns {string}
 */
export function getBaseDir() {
  return process.env.CODE_MEMORY_DIR || resolve(homedir(), '.code-memory');
}

/**
 * Get the repos directory for per-repo databases.
 * @returns {string}
 */
export function getReposDir() {
  return resolve(getBaseDir(), 'repos');
}

/**
 * Get the single global socket path (version-stamped).
 * @returns {string}
 */
export function getSocketPath() {
  return resolve(getBaseDir(), `daemon-v${VERSION}.sock`);
}

/**
 * Get the database path for a repo.
 * @param {string} repoId
 * @returns {string}
 */
export function getDbPath(repoId) {
  return resolve(getReposDir(), `${repoId}.db`);
}

/**
 * Compute a deterministic repo ID from a project root path.
 * @param {string} projectRoot
 * @returns {string} 12-char hex hash
 */
export function getRepoId(projectRoot) {
  return createHash('sha256')
    .update(resolve(projectRoot))
    .digest('hex')
    .slice(0, 12);
}
