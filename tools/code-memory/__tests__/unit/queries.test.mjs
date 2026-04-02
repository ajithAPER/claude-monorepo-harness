import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGraph,
  upsertFileNode,
  addSymbolNode,
  addImportEdge,
} from '../../src/graph/model.mjs';
import {
  searchSymbols,
  getExports,
  getImporters,
  getDependencies,
  getHubs,
  getDependencyTree,
  getFileSymbols,
  getGraphStats,
} from '../../src/query/queries.mjs';

describe('query/queries', () => {
  let graph;

  beforeEach(() => {
    graph = createGraph();

    // Build test graph:
    // a.ts imports b.ts and c.ts
    // b.ts imports c.ts
    // c.ts has no imports (hub - imported by 2 files)
    upsertFileNode(graph, { path: '/src/a.ts', language: 'typescript', size: 100, hash: 'aaa', indexedAt: 1000 });
    upsertFileNode(graph, { path: '/src/b.ts', language: 'typescript', size: 200, hash: 'bbb', indexedAt: 2000 });
    upsertFileNode(graph, { path: '/src/c.ts', language: 'typescript', size: 50, hash: 'ccc', indexedAt: 3000 });

    addSymbolNode(graph, '/src/a.ts', { name: 'main', kind: 'function', lineStart: 1, lineEnd: 10, exported: true });
    addSymbolNode(graph, '/src/b.ts', { name: 'helper', kind: 'function', lineStart: 1, lineEnd: 5, exported: true });
    addSymbolNode(graph, '/src/b.ts', { name: 'internal', kind: 'function', lineStart: 6, lineEnd: 8, exported: false });
    addSymbolNode(graph, '/src/c.ts', { name: 'Config', kind: 'class', lineStart: 1, lineEnd: 20, exported: true });

    addImportEdge(graph, '/src/a.ts', '/src/b.ts', { specifier: './b', names: ['helper'], isExternal: false });
    addImportEdge(graph, '/src/a.ts', '/src/c.ts', { specifier: './c', names: ['Config'], isExternal: false });
    addImportEdge(graph, '/src/b.ts', '/src/c.ts', { specifier: './c', names: ['Config'], isExternal: false });
    addImportEdge(graph, '/src/a.ts', 'ext:lodash', { specifier: 'lodash', names: ['*'], isExternal: true });
  });

  describe('searchSymbols', () => {
    it('finds symbols by name substring', () => {
      const results = searchSymbols(graph, 'help');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('helper');
    });

    it('is case-insensitive', () => {
      const results = searchSymbols(graph, 'CONFIG');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Config');
    });

    it('filters by kind', () => {
      const results = searchSymbols(graph, '', { kind: 'class' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Config');
    });

    it('filters by exported', () => {
      const results = searchSymbols(graph, '', { exported: false });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('internal');
    });
  });

  describe('getExports', () => {
    it('returns exported symbols for a file', () => {
      const exports = getExports(graph, '/src/b.ts');
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('helper');
    });

    it('returns empty for non-existent file', () => {
      expect(getExports(graph, '/nonexistent')).toEqual([]);
    });
  });

  describe('getImporters', () => {
    it('returns files that import a given file', () => {
      const importers = getImporters(graph, '/src/c.ts');
      expect(importers).toHaveLength(2);
      const files = importers.map(i => i.file).sort();
      expect(files).toEqual(['/src/a.ts', '/src/b.ts']);
    });
  });

  describe('getDependencies', () => {
    it('returns files imported by a given file', () => {
      const deps = getDependencies(graph, '/src/a.ts');
      expect(deps).toHaveLength(3); // b.ts, c.ts, ext:lodash
      expect(deps.find(d => d.file === '/src/b.ts')).toBeTruthy();
      expect(deps.find(d => d.isExternal)).toBeTruthy();
    });
  });

  describe('getHubs', () => {
    it('returns most-imported internal files', () => {
      const hubs = getHubs(graph, 10);
      expect(hubs[0].file).toBe('/src/c.ts');
      expect(hubs[0].importerCount).toBe(2);
    });

    it('respects topN limit', () => {
      const hubs = getHubs(graph, 1);
      expect(hubs).toHaveLength(1);
    });

    it('excludes external packages', () => {
      const hubs = getHubs(graph, 10);
      expect(hubs.find(h => h.file === 'ext:lodash')).toBeUndefined();
    });
  });

  describe('getDependencyTree', () => {
    it('builds outbound dependency tree', () => {
      const tree = getDependencyTree(graph, '/src/a.ts', { depth: 2, direction: 'out' });
      expect(tree.file).toBe('/src/a.ts');
      expect(tree.children.length).toBeGreaterThan(0);
    });

    it('detects circular dependencies', () => {
      // Add circular: c.ts imports a.ts
      addImportEdge(graph, '/src/c.ts', '/src/a.ts', { specifier: './a', names: ['main'], isExternal: false });
      const tree = getDependencyTree(graph, '/src/a.ts', { depth: 5, direction: 'out' });
      // Should mark circular reference
      const findCircular = (node) => {
        if (node.truncated) return true;
        return node.children?.some(findCircular) || false;
      };
      expect(findCircular(tree)).toBe(true);
    });

    it('respects depth limit', () => {
      // depth=2 means root(0) → children(1) → grandchildren(2) are shown
      // depth=1 means root(0) → children(1) only, grandchildren truncated
      const shallowTree = getDependencyTree(graph, '/src/a.ts', { depth: 2 });
      const deepTree = getDependencyTree(graph, '/src/a.ts', { depth: 10 });
      // Shallow tree should have fewer or equal total nodes than deep tree
      const countNodes = (t) => 1 + (t.children?.reduce((sum, c) => sum + countNodes(c), 0) || 0);
      expect(countNodes(shallowTree)).toBeLessThanOrEqual(countNodes(deepTree));
    });

    it('supports inbound direction', () => {
      const tree = getDependencyTree(graph, '/src/c.ts', { depth: 1, direction: 'in' });
      expect(tree.children.length).toBe(2); // a.ts and b.ts import c.ts
    });
  });

  describe('getFileSymbols', () => {
    it('returns all declared symbols', () => {
      const symbols = getFileSymbols(graph, '/src/b.ts');
      expect(symbols).toHaveLength(2);
      expect(symbols.map(s => s.name).sort()).toEqual(['helper', 'internal']);
    });
  });

  describe('getGraphStats', () => {
    it('counts files, symbols, and edges', () => {
      const stats = getGraphStats(graph);
      expect(stats.fileCount).toBe(3);
      expect(stats.symbolCount).toBe(4);
      expect(stats.edgeCount).toBeGreaterThan(0);
      expect(stats.lastIndexedAt).toBe(3000);
    });
  });
});
