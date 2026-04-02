import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hashString, hashFile } from '../../src/indexer/hasher.mjs';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('hasher', () => {
  describe('hashString', () => {
    it('returns consistent hash for same input', () => {
      expect(hashString('hello')).toBe(hashString('hello'));
    });

    it('returns different hash for different input', () => {
      expect(hashString('hello')).not.toBe(hashString('world'));
    });

    it('returns 64-char hex string (SHA-256)', () => {
      const hash = hashString('test');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('hashFile', () => {
    const tmpDir = join(tmpdir(), `code-memory-test-${Date.now()}`);

    beforeAll(() => {
      mkdirSync(tmpDir, { recursive: true });
    });

    afterAll(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns same hash as hashString for file contents', async () => {
      const content = 'file content here';
      const filePath = join(tmpDir, 'test.txt');
      writeFileSync(filePath, content);
      const fileHash = await hashFile(filePath);
      expect(fileHash).toBe(hashString(content));
    });
  });
});
