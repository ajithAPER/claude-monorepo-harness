import { existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const JS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx'];
const INDEX_FILES = JS_EXTENSIONS.map((ext) => `/index${ext}`);

/**
 * Resolve a JS/TS import specifier to an absolute file path.
 * @param {string} specifier - The import specifier (e.g., './utils')
 * @param {string} fromFile - The file containing the import
 * @returns {string | null} Resolved absolute path, or null if unresolvable
 */
export function resolveImport(specifier, fromFile) {
  // External packages
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return null;
  }

  const base = resolve(dirname(fromFile), specifier);

  // Exact match
  if (existsSync(base) && !isDirectory(base)) {
    return base;
  }

  // Try adding extensions
  for (const ext of JS_EXTENSIONS) {
    const withExt = base + ext;
    if (existsSync(withExt)) return withExt;
  }

  // Try index files
  for (const indexFile of INDEX_FILES) {
    const withIndex = base + indexFile;
    if (existsSync(withIndex)) return withIndex;
  }

  return null;
}

/**
 * @param {string} p
 * @returns {boolean}
 */
function isDirectory(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
