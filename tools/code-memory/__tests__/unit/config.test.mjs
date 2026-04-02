import { describe, it, expect } from 'vitest';
import {
  EXTENSION_MAP,
  SUPPORTED_EXTENSIONS,
  IGNORE_DIRS,
  DAEMON_TIMEOUT_MS,
  FLUSH_DEBOUNCE_MS,
  FLUSH_INTERVAL_MS,
  INACTIVITY_CHECK_MS,
  CLIENT_TIMEOUT_MS,
  REPO_IDLE_MS,
  CLEANUP_INTERVAL_MS,
  RETENTION_DAYS,
  VERSION,
  getSocketPath,
  getDbPath,
  getRepoId,
  getBaseDir,
  getReposDir,
} from '../../src/config.mjs';

describe('config', () => {
  describe('constants', () => {
    it('EXTENSION_MAP maps extensions to languages', () => {
      expect(EXTENSION_MAP['.ts']).toBe('typescript');
      expect(EXTENSION_MAP['.mjs']).toBe('javascript');
      expect(EXTENSION_MAP['.go']).toBe('go');
      expect(EXTENSION_MAP['.rs']).toBe('rust');
    });

    it('SUPPORTED_EXTENSIONS includes all mapped extensions', () => {
      expect(SUPPORTED_EXTENSIONS).toContain('.ts');
      expect(SUPPORTED_EXTENSIONS).toContain('.mjs');
      expect(SUPPORTED_EXTENSIONS).toContain('.go');
      expect(SUPPORTED_EXTENSIONS).toContain('.rs');
    });

    it('IGNORE_DIRS includes common directories to skip', () => {
      expect(IGNORE_DIRS).toContain('node_modules');
      expect(IGNORE_DIRS).toContain('.git');
      expect(IGNORE_DIRS).toContain('target');
    });

    it('timeout constants are positive numbers', () => {
      expect(DAEMON_TIMEOUT_MS).toBeGreaterThan(0);
      expect(FLUSH_DEBOUNCE_MS).toBeGreaterThan(0);
      expect(FLUSH_INTERVAL_MS).toBeGreaterThan(0);
      expect(INACTIVITY_CHECK_MS).toBeGreaterThan(0);
      expect(CLIENT_TIMEOUT_MS).toBeGreaterThan(0);
      expect(REPO_IDLE_MS).toBeGreaterThan(0);
      expect(CLEANUP_INTERVAL_MS).toBeGreaterThan(0);
      expect(RETENTION_DAYS).toBeGreaterThan(0);
    });

    it('VERSION is a semver string', () => {
      expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('getBaseDir', () => {
    it('uses CODE_MEMORY_DIR env when set', () => {
      const original = process.env.CODE_MEMORY_DIR;
      process.env.CODE_MEMORY_DIR = '/custom/path';
      try {
        expect(getBaseDir()).toBe('/custom/path');
      } finally {
        if (original !== undefined) {
          process.env.CODE_MEMORY_DIR = original;
        } else {
          delete process.env.CODE_MEMORY_DIR;
        }
      }
    });

    it('defaults to ~/.code-memory', () => {
      const original = process.env.CODE_MEMORY_DIR;
      delete process.env.CODE_MEMORY_DIR;
      try {
        expect(getBaseDir()).toMatch(/\.code-memory$/);
      } finally {
        if (original !== undefined) {
          process.env.CODE_MEMORY_DIR = original;
        }
      }
    });
  });

  describe('getReposDir', () => {
    it('is a subdirectory of base dir', () => {
      expect(getReposDir()).toMatch(/repos$/);
      expect(getReposDir().startsWith(getBaseDir())).toBe(true);
    });
  });

  describe('getSocketPath', () => {
    it('is a global socket (no project-specific arg)', () => {
      const path = getSocketPath();
      expect(path).toMatch(/daemon-v\d+\.\d+\.\d+\.sock$/);
    });

    it('includes the version', () => {
      expect(getSocketPath()).toContain(`v${VERSION}`);
    });

    it('is inside the base directory', () => {
      expect(getSocketPath().startsWith(getBaseDir())).toBe(true);
    });
  });

  describe('getDbPath', () => {
    it('returns path inside repos dir for given repoId', () => {
      const path = getDbPath('abc123def456');
      expect(path).toContain('repos/abc123def456.db');
      expect(path.startsWith(getReposDir())).toBe(true);
    });
  });

  describe('getRepoId', () => {
    it('returns deterministic 12-char hex for same input', () => {
      const a = getRepoId('/some/project');
      const b = getRepoId('/some/project');
      expect(a).toBe(b);
      expect(a).toMatch(/^[a-f0-9]{12}$/);
    });

    it('returns different IDs for different paths', () => {
      expect(getRepoId('/project/a')).not.toBe(getRepoId('/project/b'));
    });
  });
});
