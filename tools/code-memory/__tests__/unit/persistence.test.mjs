import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPersistence } from '../../src/db/persistence.mjs';
import { createGraph, upsertFileNode, addSymbolNode } from '../../src/graph/model.mjs';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('db/persistence', () => {
  const tmpDir = join(tmpdir(), `code-memory-persistence-test-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates database with schema', () => {
    const dbPath = join(tmpDir, 'test1.db');
    const p = createPersistence(dbPath);
    // Should not throw
    p.close();
  });

  it('round-trips a graph through save/load', () => {
    const dbPath = join(tmpDir, 'test2.db');
    const p = createPersistence(dbPath);

    // Build a graph
    const graph = createGraph();
    upsertFileNode(graph, { path: '/src/a.ts', language: 'typescript', size: 100, hash: 'abc', indexedAt: 1000 });
    addSymbolNode(graph, '/src/a.ts', { name: 'foo', kind: 'function', lineStart: 1, lineEnd: 5, exported: true });

    // Save
    p.save(graph);

    // Load
    const loaded = p.load();
    expect(loaded.hasNode('/src/a.ts')).toBe(true);
    expect(loaded.getNodeAttribute('/src/a.ts', 'language')).toBe('typescript');

    const symbolKey = '/src/a.ts::foo::1';
    expect(loaded.hasNode(symbolKey)).toBe(true);
    expect(loaded.getNodeAttribute(symbolKey, 'name')).toBe('foo');

    p.close();
  });

  it('tracks dirty state', () => {
    const dbPath = join(tmpDir, 'test3.db');
    const p = createPersistence(dbPath);

    expect(p.isDirty).toBe(false);
    p.markDirty();
    expect(p.isDirty).toBe(true);
    p.markClean();
    expect(p.isDirty).toBe(false);

    p.close();
  });

  it('save clears dirty flag', () => {
    const dbPath = join(tmpDir, 'test4.db');
    const p = createPersistence(dbPath);
    const graph = createGraph();

    p.markDirty();
    expect(p.isDirty).toBe(true);
    p.save(graph);
    expect(p.isDirty).toBe(false);

    p.close();
  });

  it('load returns empty graph when no snapshot exists', () => {
    const dbPath = join(tmpDir, 'test5.db');
    const p = createPersistence(dbPath);
    const graph = p.load();
    expect(graph.order).toBe(0); // No nodes
    p.close();
  });
});
