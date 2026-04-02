import Graph from 'graphology';

/**
 * Create a new directed graph for codebase memory.
 * @returns {Graph}
 */
export function createGraph() {
  return new Graph({ type: 'directed', multi: true, allowSelfLoops: false });
}

/**
 * Add or update a file node in the graph.
 * @param {Graph} graph
 * @param {import('../types.mjs').FileRecord} file
 */
export function upsertFileNode(graph, file) {
  graph.mergeNode(file.path, {
    type: 'file',
    path: file.path,
    language: file.language,
    size: file.size,
    hash: file.hash,
    indexedAt: file.indexedAt,
  });
}

/**
 * Add a symbol node and link it to its file.
 * @param {Graph} graph
 * @param {string} filePath
 * @param {import('../types.mjs').SymbolInfo} symbol
 */
export function addSymbolNode(graph, filePath, symbol) {
  const symbolKey = `${filePath}::${symbol.name}::${symbol.lineStart}`;
  graph.mergeNode(symbolKey, {
    type: 'symbol',
    name: symbol.name,
    kind: symbol.kind,
    lineStart: symbol.lineStart,
    lineEnd: symbol.lineEnd,
    exported: symbol.exported,
  });
  graph.mergeEdge(filePath, symbolKey, { type: 'declares' });
  if (symbol.exported) {
    graph.mergeEdge(filePath, symbolKey, { type: 'exports' });
  }
}

/**
 * Add an import edge between two files.
 * @param {Graph} graph
 * @param {string} fromFile - Importing file path
 * @param {string} toFile - Imported file path (resolved)
 * @param {import('../types.mjs').ImportInfo} importInfo
 */
export function addImportEdge(graph, fromFile, toFile, importInfo) {
  // Ensure target file node exists (may be external or not yet indexed)
  if (!graph.hasNode(toFile)) {
    graph.mergeNode(toFile, {
      type: 'file',
      path: toFile,
      language: null,
      size: 0,
      hash: null,
      indexedAt: 0,
    });
  }
  graph.addEdge(fromFile, toFile, {
    type: 'imports',
    specifier: importInfo.specifier,
    names: JSON.stringify(importInfo.names),
    isExternal: importInfo.isExternal,
  });
}

/**
 * Remove a file node entirely — use only when the file is deleted from disk.
 * Drops the node and all connected edges (including incoming import edges).
 * @param {Graph} graph
 * @param {string} filePath
 */
export function removeFile(graph, filePath) {
  if (!graph.hasNode(filePath)) return;

  // Find and remove all symbol nodes declared by this file
  const symbolNodes = [];
  graph.forEachOutEdge(filePath, (edge, attrs, source, target) => {
    if (attrs.type === 'declares') {
      symbolNodes.push(target);
    }
  });

  for (const symbolNode of symbolNodes) {
    graph.dropNode(symbolNode);
  }

  graph.dropNode(filePath);
}

/**
 * Clear a file's outgoing data (symbols, outgoing edges) without dropping the node.
 * Preserves incoming import edges from other files.
 * Used during re-indexing so other files' edges to this file remain intact.
 * @param {Graph} graph
 * @param {string} filePath
 */
export function clearFileData(graph, filePath) {
  if (!graph.hasNode(filePath)) return;

  // Collect symbol nodes and outgoing edges to remove
  const symbolNodes = [];
  const outEdges = [];

  graph.forEachOutEdge(filePath, (edge, attrs, source, target) => {
    outEdges.push(edge);
    if (attrs.type === 'declares') {
      symbolNodes.push(target);
    }
  });

  // Drop symbol nodes first (this also removes edges to/from them)
  for (const symbolNode of symbolNodes) {
    graph.dropNode(symbolNode);
  }

  // Drop remaining outgoing edges (import edges)
  for (const edge of outEdges) {
    if (graph.hasEdge(edge)) {
      graph.dropEdge(edge);
    }
  }
}

/**
 * Get all file nodes from the graph.
 * @param {Graph} graph
 * @returns {Array<{ key: string, attributes: Record<string, any> }>}
 */
export function getFileNodes(graph) {
  /** @type {Array<{ key: string, attributes: Record<string, any> }>} */
  const files = [];
  graph.forEachNode((key, attrs) => {
    if (attrs.type === 'file' && attrs.hash) {
      files.push({ key, attributes: attrs });
    }
  });
  return files;
}
