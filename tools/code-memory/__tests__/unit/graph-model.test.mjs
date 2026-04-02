import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGraph,
  upsertFileNode,
  addSymbolNode,
  addImportEdge,
  removeFile,
  clearFileData,
  getFileNodes,
} from '../../src/graph/model.mjs';

describe('graph/model', () => {
  /** @type {import('graphology').default} */
  let graph;

  beforeEach(() => {
    graph = createGraph();
  });

  describe('createGraph', () => {
    it('returns a directed multi graph', () => {
      expect(graph.type).toBe('directed');
      expect(graph.multi).toBe(true);
    });
  });

  describe('upsertFileNode', () => {
    it('adds a file node', () => {
      upsertFileNode(graph, {
        path: '/src/foo.ts',
        language: 'typescript',
        size: 100,
        hash: 'abc123',
        indexedAt: 1000,
      });
      expect(graph.hasNode('/src/foo.ts')).toBe(true);
      expect(graph.getNodeAttribute('/src/foo.ts', 'type')).toBe('file');
      expect(graph.getNodeAttribute('/src/foo.ts', 'language')).toBe('typescript');
    });

    it('updates an existing file node', () => {
      upsertFileNode(graph, { path: '/src/foo.ts', language: 'typescript', size: 100, hash: 'abc', indexedAt: 1000 });
      upsertFileNode(graph, { path: '/src/foo.ts', language: 'typescript', size: 200, hash: 'def', indexedAt: 2000 });
      expect(graph.getNodeAttribute('/src/foo.ts', 'hash')).toBe('def');
      expect(graph.getNodeAttribute('/src/foo.ts', 'size')).toBe(200);
    });
  });

  describe('addSymbolNode', () => {
    it('creates symbol node with declares edge', () => {
      upsertFileNode(graph, { path: '/src/foo.ts', language: 'typescript', size: 100, hash: 'abc', indexedAt: 1000 });
      addSymbolNode(graph, '/src/foo.ts', {
        name: 'hello',
        kind: 'function',
        lineStart: 1,
        lineEnd: 5,
        exported: false,
      });
      const symbolKey = '/src/foo.ts::hello::1';
      expect(graph.hasNode(symbolKey)).toBe(true);
      expect(graph.getNodeAttribute(symbolKey, 'kind')).toBe('function');
      // Check declares edge
      const edges = graph.edges('/src/foo.ts', symbolKey);
      expect(edges.some(e => graph.getEdgeAttribute(e, 'type') === 'declares')).toBe(true);
    });

    it('adds exports edge for exported symbols', () => {
      upsertFileNode(graph, { path: '/src/foo.ts', language: 'typescript', size: 100, hash: 'abc', indexedAt: 1000 });
      addSymbolNode(graph, '/src/foo.ts', {
        name: 'hello',
        kind: 'function',
        lineStart: 1,
        lineEnd: 5,
        exported: true,
      });
      const symbolKey = '/src/foo.ts::hello::1';
      const edges = graph.edges('/src/foo.ts', symbolKey);
      expect(edges.some(e => graph.getEdgeAttribute(e, 'type') === 'exports')).toBe(true);
    });
  });

  describe('addImportEdge', () => {
    it('creates import edge between files', () => {
      upsertFileNode(graph, { path: '/src/a.ts', language: 'typescript', size: 100, hash: 'abc', indexedAt: 1000 });
      upsertFileNode(graph, { path: '/src/b.ts', language: 'typescript', size: 100, hash: 'def', indexedAt: 1000 });
      addImportEdge(graph, '/src/a.ts', '/src/b.ts', {
        specifier: './b',
        names: ['foo'],
        isExternal: false,
      });
      const edges = graph.edges('/src/a.ts', '/src/b.ts');
      expect(edges.length).toBeGreaterThan(0);
      expect(graph.getEdgeAttribute(edges[0], 'type')).toBe('imports');
    });

    it('auto-creates target node if missing', () => {
      upsertFileNode(graph, { path: '/src/a.ts', language: 'typescript', size: 100, hash: 'abc', indexedAt: 1000 });
      addImportEdge(graph, '/src/a.ts', '/src/missing.ts', {
        specifier: './missing',
        names: ['x'],
        isExternal: false,
      });
      expect(graph.hasNode('/src/missing.ts')).toBe(true);
    });
  });

  describe('removeFile', () => {
    it('removes file node and its symbol nodes', () => {
      upsertFileNode(graph, { path: '/src/a.ts', language: 'typescript', size: 100, hash: 'abc', indexedAt: 1000 });
      addSymbolNode(graph, '/src/a.ts', { name: 'fn', kind: 'function', lineStart: 1, lineEnd: 3, exported: false });
      removeFile(graph, '/src/a.ts');
      expect(graph.hasNode('/src/a.ts')).toBe(false);
      expect(graph.hasNode('/src/a.ts::fn::1')).toBe(false);
    });

    it('is a no-op for non-existent files', () => {
      expect(() => removeFile(graph, '/nonexistent')).not.toThrow();
    });
  });

  describe('clearFileData', () => {
    it('removes outgoing edges and symbols but preserves incoming edges', () => {
      // Set up: a.ts imports b.ts, b.ts has a symbol
      upsertFileNode(graph, { path: '/src/a.ts', language: 'typescript', size: 100, hash: 'abc', indexedAt: 1000 });
      upsertFileNode(graph, { path: '/src/b.ts', language: 'typescript', size: 100, hash: 'def', indexedAt: 1000 });
      addImportEdge(graph, '/src/a.ts', '/src/b.ts', { specifier: './b', names: ['x'], isExternal: false });
      addSymbolNode(graph, '/src/b.ts', { name: 'x', kind: 'function', lineStart: 1, lineEnd: 3, exported: true });
      addImportEdge(graph, '/src/b.ts', 'ext:lodash', { specifier: 'lodash', names: ['*'], isExternal: true });

      // Clear b.ts data
      clearFileData(graph, '/src/b.ts');

      // b.ts node still exists
      expect(graph.hasNode('/src/b.ts')).toBe(true);
      // Symbol removed
      expect(graph.hasNode('/src/b.ts::x::1')).toBe(false);
      // Outgoing import edge removed
      expect(graph.edges('/src/b.ts', 'ext:lodash').length).toBe(0);
      // Incoming import edge from a.ts preserved
      expect(graph.edges('/src/a.ts', '/src/b.ts').length).toBeGreaterThan(0);
    });
  });

  describe('getFileNodes', () => {
    it('returns only indexed file nodes (with hash)', () => {
      upsertFileNode(graph, { path: '/src/a.ts', language: 'typescript', size: 100, hash: 'abc', indexedAt: 1000 });
      // Add a placeholder node without hash (created by addImportEdge for missing targets)
      graph.mergeNode('/src/placeholder.ts', { type: 'file', hash: null });
      const files = getFileNodes(graph);
      expect(files).toHaveLength(1);
      expect(files[0].key).toBe('/src/a.ts');
    });
  });
});
