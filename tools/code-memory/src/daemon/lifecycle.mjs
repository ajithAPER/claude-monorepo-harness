import { mkdirSync } from 'node:fs';
import { extname } from 'node:path';
import { createPersistence } from '../db/persistence.mjs';
import { createGraph, removeFile } from '../graph/model.mjs';
import { indexProject, indexFile } from '../indexer/indexer.mjs';
import { getGraphStats } from '../query/queries.mjs';
import { cleanupStaleRepos } from '../db/cleanup.mjs';
import {
  getDbPath,
  getReposDir,
  EXTENSION_MAP,
  FLUSH_DEBOUNCE_MS,
  FLUSH_INTERVAL_MS,
  DAEMON_TIMEOUT_MS,
  REPO_IDLE_MS,
  CLEANUP_INTERVAL_MS,
} from '../config.mjs';

/**
 * @typedef {Object} RepoState
 * @property {string} repoId
 * @property {string} projectRoot
 * @property {import('graphology').default} graph
 * @property {import('../db/persistence.mjs').Persistence} persistence
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

/**
 * Create a new daemon manager (multi-repo).
 * @param {Object} [options]
 * @param {(msg: string) => void} [options.log]
 * @returns {DaemonManager}
 */
export function createDaemonManager(options = {}) {
  const { log = () => {} } = options;

  // Ensure base directories exist
  mkdirSync(getReposDir(), { recursive: true, mode: 0o700 });

  // Run initial cleanup
  const cleanupResult = cleanupStaleRepos({ log });
  if (cleanupResult.deleted.length > 0) {
    log(`Cleaned up ${cleanupResult.deleted.length} stale repo(s)`);
  }

  /** @type {DaemonManager} */
  const manager = {
    repos: new Map(),
    globalLastActivity: Date.now(),
    inactivityTimer: null,
    cleanupTimer: null,
  };

  // Periodic stale DB cleanup
  manager.cleanupTimer = setInterval(() => {
    cleanupStaleRepos({ log });
  }, CLEANUP_INTERVAL_MS);

  return manager;
}

/**
 * Get or lazily initialize a repo's state.
 * @param {DaemonManager} manager
 * @param {string} repoId
 * @param {string} projectRoot
 * @param {Object} [options]
 * @param {(msg: string) => void} [options.log]
 * @returns {RepoState}
 */
export function getOrInitRepo(manager, repoId, projectRoot, options = {}) {
  const { log = () => {} } = options;

  let repo = manager.repos.get(repoId);
  if (repo) {
    touchRepoActivity(manager, repo);
    return repo;
  }

  log(`Loading repo ${repoId} (${projectRoot})...`);
  repo = initRepo(repoId, projectRoot, { log });
  manager.repos.set(repoId, repo);

  // Start per-repo idle timer
  resetRepoIdleTimer(manager, repo, log);

  touchGlobalActivity(manager);
  return repo;
}

/**
 * Initialize a single repo's state.
 * @param {string} repoId
 * @param {string} projectRoot
 * @param {Object} [options]
 * @param {(msg: string) => void} [options.log]
 * @returns {RepoState}
 */
function initRepo(repoId, projectRoot, options = {}) {
  const { log = () => {} } = options;
  const dbPath = getDbPath(repoId);
  const persistence = createPersistence(dbPath);

  log(`Loading graph for ${repoId} from ${dbPath}...`);
  let graph = persistence.load();

  const stats = getGraphStats(graph);
  if (stats.fileCount === 0) {
    log(`No existing index for ${repoId}, performing full index...`);
    graph = createGraph();
    indexProject(graph, projectRoot, { log });
    persistence.save(graph);
    log(`Initial index complete for ${repoId}.`);
  } else {
    log(`Loaded ${repoId}: ${stats.fileCount} files, ${stats.symbolCount} symbols`);
  }

  /** @type {RepoState} */
  const state = {
    repoId,
    projectRoot,
    graph,
    persistence,
    lastActivity: Date.now(),
    flushDebounceTimer: null,
    periodicFlushTimer: null,
    repoIdleTimer: null,
  };

  // Periodic flush for this repo
  state.periodicFlushTimer = setInterval(() => {
    if (persistence.isDirty) {
      log(`Periodic flush for ${repoId}...`);
      persistence.save(graph);
    }
  }, FLUSH_INTERVAL_MS);

  return state;
}

/**
 * Unload a repo's graph from memory. DB file stays on disk.
 * @param {DaemonManager} manager
 * @param {string} repoId
 * @param {(msg: string) => void} [log]
 */
export function unloadRepo(manager, repoId, log = () => {}) {
  const repo = manager.repos.get(repoId);
  if (!repo) return;

  log(`Unloading repo ${repoId}...`);

  if (repo.flushDebounceTimer) clearTimeout(repo.flushDebounceTimer);
  if (repo.periodicFlushTimer) clearInterval(repo.periodicFlushTimer);
  if (repo.repoIdleTimer) clearTimeout(repo.repoIdleTimer);

  // Final flush
  if (repo.persistence.isDirty) {
    log(`Final flush for ${repoId}...`);
    repo.persistence.save(repo.graph);
  }
  repo.persistence.close();

  manager.repos.delete(repoId);
  log(`Repo ${repoId} unloaded.`);
}

/**
 * Shut down all repos and clear global timers.
 * @param {DaemonManager} manager
 * @param {(msg: string) => void} [log]
 */
export function shutdownManager(manager, log = () => {}) {
  log('Shutting down daemon manager...');

  for (const [repoId] of manager.repos) {
    unloadRepo(manager, repoId, log);
  }

  if (manager.inactivityTimer) clearInterval(manager.inactivityTimer);
  if (manager.cleanupTimer) clearInterval(manager.cleanupTimer);

  log('Daemon manager shut down.');
}

/**
 * Touch a repo's activity timestamp and reset its idle timer.
 * @param {DaemonManager} manager
 * @param {RepoState} repo
 */
function touchRepoActivity(manager, repo) {
  repo.lastActivity = Date.now();
  touchGlobalActivity(manager);
}

/**
 * Touch the global activity timestamp.
 * @param {DaemonManager} manager
 */
export function touchGlobalActivity(manager) {
  manager.globalLastActivity = Date.now();
}

/**
 * Reset the per-repo idle timer.
 * @param {DaemonManager} manager
 * @param {RepoState} repo
 * @param {(msg: string) => void} [log]
 */
function resetRepoIdleTimer(manager, repo, log = () => {}) {
  if (repo.repoIdleTimer) clearTimeout(repo.repoIdleTimer);
  repo.repoIdleTimer = setTimeout(() => {
    const idle = Date.now() - repo.lastActivity;
    if (idle >= REPO_IDLE_MS) {
      log(`Repo ${repo.repoId} idle for ${Math.round(idle / 1000)}s, unloading...`);
      unloadRepo(manager, repo.repoId, log);
    }
  }, REPO_IDLE_MS);
}

/**
 * Mark a repo's graph as dirty and schedule a debounced flush.
 * @param {RepoState} state
 * @param {(msg: string) => void} [log]
 */
export function markDirtyAndFlush(state, log = () => {}) {
  state.persistence.markDirty();

  if (state.flushDebounceTimer) {
    clearTimeout(state.flushDebounceTimer);
  }
  state.flushDebounceTimer = setTimeout(() => {
    if (state.persistence.isDirty) {
      log(`Debounced flush for ${state.repoId}...`);
      state.persistence.save(state.graph);
    }
  }, FLUSH_DEBOUNCE_MS);
}

/**
 * Handle a file change event for a repo.
 * @param {RepoState} state
 * @param {string} filePath
 * @param {'change' | 'delete'} eventType
 * @param {(msg: string) => void} [log]
 */
export function handleFileChange(state, filePath, eventType, log = () => {}) {
  const ext = extname(filePath);
  const language = EXTENSION_MAP[ext];
  if (!language) return;

  if (eventType === 'delete') {
    removeFile(state.graph, filePath);
    log(`Removed: ${filePath}`);
    markDirtyAndFlush(state, log);
    return;
  }

  try {
    const changed = indexFile(state.graph, filePath, language, true);
    if (changed) {
      log(`Re-indexed: ${filePath}`);
      markDirtyAndFlush(state, log);
    }
  } catch (err) {
    log(`Error re-indexing ${filePath}: ${err.message}`);
  }
}
