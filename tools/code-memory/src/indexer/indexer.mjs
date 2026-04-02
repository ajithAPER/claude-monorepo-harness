import { readFileSync, statSync } from 'node:fs';
import { getParser } from '../parser/registry.mjs';
import { hashString } from './hasher.mjs';
import { resolveImport } from './resolver.mjs';
import { scanFiles } from './scanner.mjs';
import {
  upsertFileNode,
  addSymbolNode,
  addImportEdge,
  clearFileData,
} from '../graph/model.mjs';

/**
 * Index the entire project into the graph.
 * @param {import('graphology').default} graph
 * @param {string} projectRoot
 * @param {Object} [options]
 * @param {boolean} [options.force] - Re-index all files regardless of hash
 * @param {import('../types.mjs').Language} [options.language] - Only index this language
 * @param {(msg: string) => void} [options.log] - Progress logger
 * @returns {{ indexed: number, skipped: number, errors: number }}
 */
export function indexProject(graph, projectRoot, options = {}) {
  const { force = false, language, log = () => {} } = options;
  const files = scanFiles(projectRoot, { language });
  let indexed = 0;
  let skipped = 0;
  let errors = 0;

  log(`Scanning ${files.length} files...`);

  for (const file of files) {
    try {
      const result = indexFile(graph, file.path, file.language, force);
      if (result) {
        indexed++;
      } else {
        skipped++;
      }
    } catch (err) {
      errors++;
      log(`Error indexing ${file.path}: ${err.message}`);
    }
  }

  log(`Done: ${indexed} indexed, ${skipped} unchanged, ${errors} errors`);
  return { indexed, skipped, errors };
}

/**
 * Index a single file into the graph.
 * Returns true if the file was (re-)indexed, false if skipped.
 * @param {import('graphology').default} graph
 * @param {string} filePath
 * @param {import('../types.mjs').Language} language
 * @param {boolean} [force]
 * @returns {boolean}
 */
export function indexFile(graph, filePath, language, force = false) {
  const parser = getParser(filePath);
  if (!parser) return false;

  const source = readFileSync(filePath, 'utf-8');
  const hash = hashString(source);

  // Skip if unchanged
  if (!force && graph.hasNode(filePath)) {
    const attrs = graph.getNodeAttributes(filePath);
    if (attrs.hash === hash) return false;
  }

  const stat = statSync(filePath);

  // Clear old outgoing data (preserves incoming edges from other files)
  clearFileData(graph, filePath);

  // Add file node
  upsertFileNode(graph, {
    path: filePath,
    language,
    size: stat.size,
    hash,
    indexedAt: Date.now(),
  });

  // Parse
  const result = parser.parse(source, filePath);

  // Add symbols
  for (const symbol of result.symbols) {
    addSymbolNode(graph, filePath, symbol);
  }

  // Add imports
  for (const imp of result.imports) {
    if (imp.isExternal) {
      // Create an external package node
      addImportEdge(graph, filePath, `ext:${imp.specifier}`, imp);
    } else {
      const resolved = resolveImport(imp.specifier, filePath);
      if (resolved) {
        addImportEdge(graph, filePath, resolved, imp);
      }
    }
  }

  return true;
}
