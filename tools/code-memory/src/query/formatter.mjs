import { relative } from 'node:path';

/**
 * Format output based on format option.
 * @param {any} data
 * @param {'tree' | 'json' | 'flat'} format
 * @param {string} [projectRoot]
 * @returns {string}
 */
export function formatOutput(data, format, projectRoot = process.cwd()) {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'flat':
      return formatFlat(data, projectRoot);
    case 'tree':
      return formatTree(data, projectRoot);
    default:
      return formatFlat(data, projectRoot);
  }
}

/**
 * @param {any} data
 * @param {string} projectRoot
 * @returns {string}
 */
function formatFlat(data, projectRoot) {
  if (Array.isArray(data)) {
    return data
      .map((item) => {
        if (item.file) {
          const rel = relative(projectRoot, item.file);
          if (item.name) {
            return `${rel}:${item.line || 0}  ${item.exported ? 'export ' : ''}${item.kind || ''} ${item.name}`;
          }
          if (item.importerCount !== undefined) {
            return `${rel}  (${item.importerCount} importers)`;
          }
          if (item.specifier) {
            return `${rel}  ${item.specifier}`;
          }
          return rel;
        }
        return JSON.stringify(item);
      })
      .join('\n');
  }
  return JSON.stringify(data, null, 2);
}

/**
 * Format a dependency tree.
 * @param {Object} tree
 * @param {string} projectRoot
 * @param {string} [prefix]
 * @returns {string}
 */
function formatTree(tree, projectRoot, prefix = '') {
  if (!tree || !tree.file) return '';

  const rel = relative(projectRoot, tree.file);
  const lines = [prefix + rel + (tree.truncated ? ' (circular)' : '')];

  if (tree.children) {
    for (let i = 0; i < tree.children.length; i++) {
      const isLast = i === tree.children.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      const childTree = formatTree(tree.children[i], projectRoot, childPrefix);
      if (childTree) {
        // Replace the first line's prefix with the connector
        const childLines = childTree.split('\n');
        childLines[0] = prefix + connector + childLines[0].slice(childPrefix.length);
        lines.push(childLines.join('\n'));
      }
    }
  }

  return lines.filter(Boolean).join('\n');
}

/**
 * Format a table of results.
 * @param {string[]} headers
 * @param {string[][]} rows
 * @returns {string}
 */
export function formatTable(headers, rows) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] || '').length))
  );

  const headerLine = headers
    .map((h, i) => h.padEnd(widths[i]))
    .join('  ');
  const separator = widths.map((w) => '─'.repeat(w)).join('──');
  const bodyLines = rows.map((row) =>
    row.map((cell, i) => (cell || '').padEnd(widths[i])).join('  ')
  );

  return [headerLine, separator, ...bodyLines].join('\n');
}
