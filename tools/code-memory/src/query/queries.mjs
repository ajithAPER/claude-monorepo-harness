/**
 * Graph query functions — all operate on the in-memory graphology graph.
 */

/**
 * Search for symbols by name.
 * @param {import('graphology').default} graph
 * @param {string} term
 * @param {Object} [options]
 * @param {string} [options.kind]
 * @param {boolean} [options.exported]
 * @param {string} [options.language]
 * @returns {Array<{ name: string, kind: string, file: string, line: number, exported: boolean }>}
 */
export function searchSymbols(graph, term, options = {}) {
  const results = [];
  const lowerTerm = term.toLowerCase();

  graph.forEachNode((key, attrs) => {
    if (attrs.type !== 'symbol') return;
    if (!attrs.name.toLowerCase().includes(lowerTerm)) return;
    if (options.kind && attrs.kind !== options.kind) return;
    if (options.exported !== undefined && attrs.exported !== options.exported) return;

    // Find the file this symbol belongs to
    const file = findParentFile(graph, key);
    if (!file) return;

    if (options.language) {
      const fileAttrs = graph.getNodeAttributes(file);
      if (fileAttrs.language !== options.language) return;
    }

    results.push({
      name: attrs.name,
      kind: attrs.kind,
      file,
      line: attrs.lineStart,
      exported: attrs.exported,
    });
  });

  return results;
}

/**
 * Get exported symbols from a file.
 * @param {import('graphology').default} graph
 * @param {string} filePath
 * @returns {Array<{ name: string, kind: string, line: number }>}
 */
export function getExports(graph, filePath) {
  if (!graph.hasNode(filePath)) return [];

  const exports = [];
  graph.forEachOutEdge(filePath, (edge, attrs, source, target) => {
    if (attrs.type === 'exports') {
      const sym = graph.getNodeAttributes(target);
      exports.push({
        name: sym.name,
        kind: sym.kind,
        line: sym.lineStart,
      });
    }
  });
  return exports;
}

/**
 * Get files that import a given file.
 * @param {import('graphology').default} graph
 * @param {string} filePath
 * @returns {Array<{ file: string, specifier: string, names: string[] }>}
 */
export function getImporters(graph, filePath) {
  if (!graph.hasNode(filePath)) return [];

  const importers = [];
  graph.forEachInEdge(filePath, (edge, attrs, source) => {
    if (attrs.type === 'imports') {
      importers.push({
        file: source,
        specifier: attrs.specifier,
        names: JSON.parse(attrs.names || '[]'),
      });
    }
  });
  return importers;
}

/**
 * Get files imported by a given file.
 * @param {import('graphology').default} graph
 * @param {string} filePath
 * @returns {Array<{ file: string, specifier: string, names: string[], isExternal: boolean }>}
 */
export function getDependencies(graph, filePath) {
  if (!graph.hasNode(filePath)) return [];

  const deps = [];
  graph.forEachOutEdge(filePath, (edge, attrs, source, target) => {
    if (attrs.type === 'imports') {
      deps.push({
        file: target,
        specifier: attrs.specifier,
        names: JSON.parse(attrs.names || '[]'),
        isExternal: attrs.isExternal,
      });
    }
  });
  return deps;
}

/**
 * Get the most-imported internal files (hubs).
 * @param {import('graphology').default} graph
 * @param {number} [topN=10]
 * @returns {Array<{ file: string, importerCount: number }>}
 */
export function getHubs(graph, topN = 10) {
  /** @type {Map<string, number>} */
  const counts = new Map();

  graph.forEachEdge((edge, attrs, source, target) => {
    if (attrs.type !== 'imports') return;
    if (attrs.isExternal) return;
    counts.set(target, (counts.get(target) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([file, importerCount]) => ({ file, importerCount }))
    .sort((a, b) => b.importerCount - a.importerCount)
    .slice(0, topN);
}

/**
 * Get a dependency tree for a file (BFS).
 * @param {import('graphology').default} graph
 * @param {string} filePath
 * @param {Object} [options]
 * @param {number} [options.depth=3]
 * @param {'in' | 'out' | 'both'} [options.direction='out']
 * @returns {Object} Tree structure
 */
export function getDependencyTree(graph, filePath, options = {}) {
  const { depth = 3, direction = 'out' } = options;
  const visited = new Set();

  /**
   * @param {string} node
   * @param {number} currentDepth
   * @returns {Object}
   */
  function buildTree(node, currentDepth) {
    if (currentDepth > depth || visited.has(node)) {
      return { file: node, children: [], truncated: visited.has(node) };
    }
    visited.add(node);

    const children = [];

    if (direction === 'out' || direction === 'both') {
      graph.forEachOutEdge(node, (edge, attrs, source, target) => {
        if (attrs.type === 'imports' && !attrs.isExternal) {
          children.push(buildTree(target, currentDepth + 1));
        }
      });
    }

    if (direction === 'in' || direction === 'both') {
      graph.forEachInEdge(node, (edge, attrs, source) => {
        if (attrs.type === 'imports') {
          children.push(buildTree(source, currentDepth + 1));
        }
      });
    }

    return { file: node, children };
  }

  return buildTree(filePath, 0);
}

/**
 * Get all symbols declared in a file.
 * @param {import('graphology').default} graph
 * @param {string} filePath
 * @returns {Array<{ name: string, kind: string, line: number, exported: boolean }>}
 */
export function getFileSymbols(graph, filePath) {
  if (!graph.hasNode(filePath)) return [];

  const symbols = [];
  graph.forEachOutEdge(filePath, (edge, attrs, source, target) => {
    if (attrs.type === 'declares') {
      const sym = graph.getNodeAttributes(target);
      symbols.push({
        name: sym.name,
        kind: sym.kind,
        line: sym.lineStart,
        exported: sym.exported,
      });
    }
  });
  return symbols;
}

/**
 * Get graph statistics.
 * @param {import('graphology').default} graph
 * @returns {import('../types.mjs').GraphStats}
 */
export function getGraphStats(graph) {
  let fileCount = 0;
  let symbolCount = 0;
  let lastIndexedAt = 0;

  graph.forEachNode((key, attrs) => {
    if (attrs.type === 'file' && attrs.hash) {
      fileCount++;
      if (attrs.indexedAt > lastIndexedAt) lastIndexedAt = attrs.indexedAt;
    } else if (attrs.type === 'symbol') {
      symbolCount++;
    }
  });

  return {
    fileCount,
    symbolCount,
    edgeCount: graph.size,
    lastIndexedAt,
    isDirty: false, // Will be overridden by caller
  };
}

/**
 * Find the parent file node of a symbol node.
 * @param {import('graphology').default} graph
 * @param {string} symbolKey
 * @returns {string | null}
 */
function findParentFile(graph, symbolKey) {
  let parent = null;
  graph.forEachInEdge(symbolKey, (edge, attrs, source) => {
    if (attrs.type === 'declares') {
      parent = source;
    }
  });
  return parent;
}
