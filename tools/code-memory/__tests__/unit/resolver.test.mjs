import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolveImport } from '../../src/indexer/resolver.mjs';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('indexer/resolver', () => {
  const tmpDir = join(tmpdir(), `code-memory-resolver-test-${Date.now()}`);
  const srcDir = join(tmpDir, 'src');

  beforeAll(() => {
    mkdirSync(join(srcDir, 'utils'), { recursive: true });
    writeFileSync(join(srcDir, 'foo.mjs'), 'export const x = 1;');
    writeFileSync(join(srcDir, 'bar.ts'), 'export const y = 2;');
    writeFileSync(join(srcDir, 'baz.js'), 'module.exports = {};');
    writeFileSync(join(srcDir, 'utils', 'index.mjs'), 'export {};');
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves exact .mjs path', () => {
    const from = join(srcDir, 'entry.mjs');
    const result = resolveImport('./foo.mjs', from);
    expect(result).toBe(join(srcDir, 'foo.mjs'));
  });

  it('resolves extensionless to .ts', () => {
    const from = join(srcDir, 'entry.mjs');
    const result = resolveImport('./bar', from);
    expect(result).toBe(join(srcDir, 'bar.ts'));
  });

  it('resolves extensionless to .js', () => {
    const from = join(srcDir, 'entry.mjs');
    const result = resolveImport('./baz', from);
    expect(result).toBe(join(srcDir, 'baz.js'));
  });

  it('resolves directory to index file', () => {
    const from = join(srcDir, 'entry.mjs');
    const result = resolveImport('./utils', from);
    expect(result).toContain('index');
  });

  it('returns null for external packages', () => {
    const from = join(srcDir, 'entry.mjs');
    expect(resolveImport('lodash', from)).toBeNull();
  });

  it('returns null for node: builtins', () => {
    const from = join(srcDir, 'entry.mjs');
    expect(resolveImport('node:path', from)).toBeNull();
  });

  it('returns null for non-existent relative path', () => {
    const from = join(srcDir, 'entry.mjs');
    expect(resolveImport('./nonexistent', from)).toBeNull();
  });
});
