import { resolve } from 'node:path';
import { indexProject } from '../indexer/indexer.mjs';
import { getOrInitRepo, markDirtyAndFlush, handleFileChange, unloadRepo, touchGlobalActivity } from './lifecycle.mjs';
import { validateRequest } from './protocol.mjs';
import { getRepoId, VERSION } from '../config.mjs';
import {
  searchSymbols,
  getExports,
  getImporters,
  getDependencies,
  getHubs,
  getDependencyTree,
  getFileSymbols,
  getGraphStats,
} from '../query/queries.mjs';

/**
 * Handle an incoming daemon request.
 * @param {import('./lifecycle.mjs').DaemonManager} manager
 * @param {unknown} rawRequest
 * @param {(msg: string) => void} log
 * @returns {import('../types.mjs').DaemonResponse}
 */
export function handleRequest(manager, rawRequest, log) {
  // Validate request with Zod
  const validation = validateRequest(rawRequest);
  if (!validation.ok) {
    return { error: { code: -32602, message: validation.error } };
  }

  const { method, params, id } = validation.request;

  try {
    // Methods that don't need a repo
    switch (method) {
      case 'ping':
        return { result: { pong: true, pid: process.pid, version: VERSION }, id };

      case 'shutdown':
        setTimeout(() => process.emit('SIGTERM'), 100);
        return { result: { ok: true }, id };

      case 'list-repos': {
        const repos = [];
        for (const [repoId, repo] of manager.repos) {
          const stats = getGraphStats(repo.graph);
          repos.push({
            repoId,
            projectRoot: repo.projectRoot,
            fileCount: stats.fileCount,
            symbolCount: stats.symbolCount,
            lastActivity: repo.lastActivity,
          });
        }
        return { result: repos, id };
      }

      case 'status': {
        if (!params.projectRoot) {
          // Global status
          return {
            result: {
              version: VERSION,
              pid: process.pid,
              loadedRepos: manager.repos.size,
              globalLastActivity: manager.globalLastActivity,
            },
            id,
          };
        }
        // Per-repo status — fall through to repo-scoped handling below
        break;
      }
    }

    // All other methods require projectRoot
    const { projectRoot } = params;
    const repoId = getRepoId(projectRoot);
    const state = getOrInitRepo(manager, repoId, projectRoot, { log });
    touchGlobalActivity(manager);

    switch (method) {
      case 'status': {
        const stats = getGraphStats(state.graph);
        stats.isDirty = state.persistence.isDirty;
        return {
          result: {
            ...stats,
            repoId,
            pid: process.pid,
            version: VERSION,
            projectRoot: state.projectRoot,
          },
          id,
        };
      }

      case 'index': {
        const path = params.path || state.projectRoot;
        const result = indexProject(state.graph, path, {
          force: params.force,
          language: params.language,
          log,
        });
        markDirtyAndFlush(state, log);
        return { result, id };
      }

      case 'query': {
        const results = searchSymbols(state.graph, params.term, {
          kind: params.kind,
          exported: params.exported,
          language: params.language,
        });
        return { result: results, id };
      }

      case 'exports': {
        const filePath = resolve(state.projectRoot, params.file);
        return { result: getExports(state.graph, filePath), id };
      }

      case 'importers': {
        const filePath = resolve(state.projectRoot, params.file);
        return { result: getImporters(state.graph, filePath), id };
      }

      case 'dependencies': {
        const filePath = resolve(state.projectRoot, params.file);
        return { result: getDependencies(state.graph, filePath), id };
      }

      case 'hubs': {
        return { result: getHubs(state.graph, params.top), id };
      }

      case 'deps-tree': {
        const filePath = resolve(state.projectRoot, params.file);
        const tree = getDependencyTree(state.graph, filePath, {
          depth: params.depth,
          direction: params.direction,
        });
        return { result: tree, id };
      }

      case 'file-symbols': {
        const filePath = resolve(state.projectRoot, params.file);
        return { result: getFileSymbols(state.graph, filePath), id };
      }

      case 'files': {
        const files = [];
        state.graph.forEachNode((key, attrs) => {
          if (attrs.type !== 'file' || !attrs.hash) return;
          if (params.language && attrs.language !== params.language) return;
          if (params.glob && !key.includes(params.glob.replace(/\*/g, ''))) return;
          files.push({ file: key, language: attrs.language, size: attrs.size });
        });
        return { result: files, id };
      }

      case 'file-change': {
        handleFileChange(state, params.filePath, params.eventType, log);
        return { result: { ok: true }, id };
      }

      case 'unload-repo': {
        unloadRepo(manager, repoId, log);
        return { result: { ok: true }, id };
      }

      default:
        return { error: { code: -32601, message: `Unknown method: ${method}` }, id };
    }
  } catch (err) {
    log(`Error handling ${method}: ${err.message}`);
    return { error: { code: -32000, message: err.message }, id };
  }
}
