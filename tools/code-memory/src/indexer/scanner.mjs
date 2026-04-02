import { execSync } from 'node:child_process';
import { extname, resolve } from 'node:path';
import { EXTENSION_MAP, IGNORE_DIRS } from '../config.mjs';

/**
 * @typedef {Object} ScannedFile
 * @property {string} path - Absolute file path
 * @property {import('../types.mjs').Language} language
 */

/**
 * Discover files in the project using git ls-files.
 * @param {string} projectRoot
 * @param {Object} [options]
 * @param {import('../types.mjs').Language} [options.language] - Filter by language
 * @returns {ScannedFile[]}
 */
export function scanFiles(projectRoot, options = {}) {
  const output = execSync('git ls-files --cached --others --exclude-standard', {
    cwd: projectRoot,
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
  });

  const files = output
    .split('\n')
    .filter(Boolean)
    .filter((relativePath) => {
      // Exclude ignored directories
      return !IGNORE_DIRS.some((dir) => relativePath.startsWith(dir + '/') || relativePath === dir);
    })
    .map((relativePath) => {
      const ext = extname(relativePath);
      const language = EXTENSION_MAP[ext];
      if (!language) return null;
      if (options.language && language !== options.language) return null;
      return {
        path: resolve(projectRoot, relativePath),
        language,
      };
    })
    .filter(/** @returns {f is ScannedFile} */ (f) => f !== null);

  return files;
}
