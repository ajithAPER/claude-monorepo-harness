import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { handleRequest } from '../../src/daemon/handler.mjs';
import {
  createGraph,
  upsertFileNode,
  addSymbolNode,
  addImportEdge,
} from '../../src/graph/model.mjs';
import { createPersistence } from '../../src/db/persistence.mjs';
import { getRepoId } from '../../src/config.mjs';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('daemon/handler', () => {
  /** @type {import('../../src/daemon/lifecycle.mjs').DaemonManager} */
  let manager;
  const tmpDir = join(tmpdir(), `code-memory-handler-test-${Date.now()}`);
  const projectRoot = '/project';
  const repoId = getRepoId(projectRoot);
  const log = () => {};

  beforeAll(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    const graph = createGraph();
    upsertFileNode(graph, { path: '/project/src/a.ts', language: 'typescript', size: 100, hash: 'aaa', indexedAt: 1000 });
    upsertFileNode(graph, { path: '/project/src/b.ts', language: 'typescript', size: 200, hash: 'bbb', indexedAt: 2000 });
    addSymbolNode(graph, '/project/src/a.ts', { name: 'main', kind: 'function', lineStart: 1, lineEnd: 10, exported: true });
    addSymbolNode(graph, '/project/src/b.ts', { name: 'helper', kind: 'function', lineStart: 1, lineEnd: 5, exported: true });
    addImportEdge(graph, '/project/src/a.ts', '/project/src/b.ts', { specifier: './b', names: ['helper'], isExternal: false });

    const dbPath = join(tmpDir, `test-${Date.now()}.db`);
    const persistence = createPersistence(dbPath);

    // Build a DaemonManager with one pre-loaded repo
    manager = {
      repos: new Map(),
      globalLastActivity: Date.now(),
      inactivityTimer: null,
      cleanupTimer: null,
    };

    manager.repos.set(repoId, {
      repoId,
      projectRoot,
      graph,
      persistence,
      lastActivity: Date.now(),
      flushDebounceTimer: null,
      periodicFlushTimer: null,
      repoIdleTimer: null,
    });
  });

  describe('ping', () => {
    it('returns pong with pid and version', () => {
      const resp = handleRequest(manager, { method: 'ping' }, log);
      expect(resp.result.pong).toBe(true);
      expect(resp.result.pid).toBe(process.pid);
      expect(resp.result.version).toBeTruthy();
    });
  });

  describe('status', () => {
    it('returns global stats when no projectRoot', () => {
      const resp = handleRequest(manager, { method: 'status', params: {} }, log);
      expect(resp.result.loadedRepos).toBe(1);
      expect(resp.result.pid).toBe(process.pid);
    });

    it('returns per-repo stats when projectRoot given', () => {
      const resp = handleRequest(manager, { method: 'status', params: { projectRoot } }, log);
      expect(resp.result.fileCount).toBe(2);
      expect(resp.result.symbolCount).toBe(2);
      expect(resp.result.repoId).toBe(repoId);
    });
  });

  describe('query', () => {
    it('searches symbols by term', () => {
      const resp = handleRequest(manager, { method: 'query', params: { projectRoot, term: 'main' } }, log);
      expect(resp.result).toHaveLength(1);
      expect(resp.result[0].name).toBe('main');
    });

    it('returns empty for no match', () => {
      const resp = handleRequest(manager, { method: 'query', params: { projectRoot, term: 'zzz' } }, log);
      expect(resp.result).toHaveLength(0);
    });
  });

  describe('exports', () => {
    it('returns exports for a file', () => {
      const resp = handleRequest(manager, { method: 'exports', params: { projectRoot, file: 'src/a.ts' } }, log);
      expect(resp.result).toHaveLength(1);
      expect(resp.result[0].name).toBe('main');
    });
  });

  describe('hubs', () => {
    it('returns most-imported files', () => {
      const resp = handleRequest(manager, { method: 'hubs', params: { projectRoot, top: 5 } }, log);
      expect(resp.result[0].file).toBe('/project/src/b.ts');
    });
  });

  describe('dependencies', () => {
    it('returns file dependencies', () => {
      const resp = handleRequest(manager, { method: 'dependencies', params: { projectRoot, file: 'src/a.ts' } }, log);
      expect(resp.result).toHaveLength(1);
      expect(resp.result[0].file).toBe('/project/src/b.ts');
    });
  });

  describe('importers', () => {
    it('returns files that import a given file', () => {
      const resp = handleRequest(manager, { method: 'importers', params: { projectRoot, file: 'src/b.ts' } }, log);
      expect(resp.result).toHaveLength(1);
      expect(resp.result[0].file).toBe('/project/src/a.ts');
    });
  });

  describe('files', () => {
    it('lists all indexed files', () => {
      const resp = handleRequest(manager, { method: 'files', params: { projectRoot } }, log);
      expect(resp.result).toHaveLength(2);
    });

    it('filters by language', () => {
      const resp = handleRequest(manager, { method: 'files', params: { projectRoot, language: 'go' } }, log);
      expect(resp.result).toHaveLength(0);
    });
  });

  describe('list-repos', () => {
    it('lists all loaded repos', () => {
      const resp = handleRequest(manager, { method: 'list-repos' }, log);
      expect(resp.result).toHaveLength(1);
      expect(resp.result[0].repoId).toBe(repoId);
      expect(resp.result[0].projectRoot).toBe(projectRoot);
    });
  });

  describe('unknown method', () => {
    it('returns validation error', () => {
      const resp = handleRequest(manager, { method: 'nonexistent' }, log);
      expect(resp.error).toBeTruthy();
      expect(resp.error.code).toBe(-32602);
    });
  });

  describe('missing projectRoot', () => {
    it('returns validation error for methods that require it', () => {
      const resp = handleRequest(manager, { method: 'query', params: { term: 'foo' } }, log);
      expect(resp.error).toBeTruthy();
      expect(resp.error.code).toBe(-32602);
    });
  });

  describe('request id', () => {
    it('echoes request id in response', () => {
      const resp = handleRequest(manager, { method: 'ping', id: 'req-42' }, log);
      expect(resp.id).toBe('req-42');
    });
  });
});
