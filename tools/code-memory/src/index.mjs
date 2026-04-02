/**
 * Programmatic API for code-memory.
 * Used for skill extraction and direct imports.
 */

export { sendRequest, isDaemonRunning, getDaemonPid, getDaemonVersion } from './daemon/client.mjs';
export { VERSION, getRepoId, getBaseDir } from './config.mjs';
export { cleanupStaleRepos } from './db/cleanup.mjs';
export { createGraph } from './graph/model.mjs';
export { createPersistence } from './db/persistence.mjs';
export { indexProject, indexFile } from './indexer/indexer.mjs';
export { scanFiles } from './indexer/scanner.mjs';
export { getParser } from './parser/registry.mjs';
export {
  searchSymbols,
  getExports,
  getImporters,
  getDependencies,
  getHubs,
  getDependencyTree,
  getFileSymbols,
  getGraphStats,
} from './query/queries.mjs';
