import Parser from 'tree-sitter';
import Go from 'tree-sitter-go';
import { emptyResult } from './parser.mjs';

const parser = new Parser();
parser.setLanguage(Go);

/**
 * @param {any} node
 * @returns {string}
 */
function text(node) {
  return node ? node.text : '';
}

/**
 * Check if a Go identifier is exported (starts with uppercase).
 * @param {string} name
 * @returns {boolean}
 */
function isExported(name) {
  return name.length > 0 && name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase();
}

/**
 * Parse Go source file.
 * @param {string} source
 * @param {string} filePath
 * @returns {import('../types.mjs').ParseResult}
 */
export function parse(source, filePath) {
  const tree = parser.parse(source);
  const result = emptyResult();

  for (const node of tree.rootNode.children) {
    switch (node.type) {
      case 'import_declaration':
        parseImportDecl(node, result);
        break;
      case 'function_declaration': {
        const name = text(node.childForFieldName('name'));
        result.symbols.push({
          name,
          kind: 'function',
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported: isExported(name),
        });
        if (isExported(name)) {
          result.exports.push({
            name,
            kind: 'function',
            lineStart: node.startPosition.row + 1,
            lineEnd: node.endPosition.row + 1,
          });
        }
        break;
      }
      case 'method_declaration': {
        const name = text(node.childForFieldName('name'));
        result.symbols.push({
          name,
          kind: 'method',
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported: isExported(name),
        });
        if (isExported(name)) {
          result.exports.push({
            name,
            kind: 'method',
            lineStart: node.startPosition.row + 1,
            lineEnd: node.endPosition.row + 1,
          });
        }
        break;
      }
      case 'type_declaration':
        parseTypeDecl(node, result);
        break;
      case 'var_declaration':
      case 'const_declaration':
        parseVarDecl(node, result);
        break;
    }
  }

  return result;
}

/**
 * @param {any} node
 * @param {import('../types.mjs').ParseResult} result
 */
function parseImportDecl(node, result) {
  for (const child of node.children) {
    if (child.type === 'import_spec') {
      const path = child.childForFieldName('path');
      if (path) {
        const specifier = stripQuotes(text(path));
        result.imports.push({
          specifier,
          names: ['*'],
          isExternal: !specifier.startsWith('.') && !specifier.startsWith('/'),
        });
      }
    }
    if (child.type === 'import_spec_list') {
      for (const spec of child.children) {
        if (spec.type === 'import_spec') {
          const path = spec.childForFieldName('path');
          if (path) {
            const specifier = stripQuotes(text(path));
            const alias = spec.childForFieldName('name');
            result.imports.push({
              specifier,
              names: alias ? [text(alias)] : ['*'],
              isExternal: !specifier.startsWith('.') && !specifier.startsWith('/'),
            });
          }
        }
      }
    }
  }
}

/**
 * @param {any} node
 * @param {import('../types.mjs').ParseResult} result
 */
function parseTypeDecl(node, result) {
  for (const child of node.children) {
    if (child.type === 'type_spec') {
      const name = text(child.childForFieldName('name'));
      const typeNode = child.childForFieldName('type');
      /** @type {import('../types.mjs').SymbolKind} */
      let kind = 'type';
      if (typeNode) {
        if (typeNode.type === 'struct_type') kind = 'struct';
        else if (typeNode.type === 'interface_type') kind = 'interface';
      }
      result.symbols.push({
        name,
        kind,
        lineStart: node.startPosition.row + 1,
        lineEnd: node.endPosition.row + 1,
        exported: isExported(name),
      });
      if (isExported(name)) {
        result.exports.push({
          name,
          kind,
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
        });
      }
    }
  }
}

/**
 * @param {any} node
 * @param {import('../types.mjs').ParseResult} result
 */
function parseVarDecl(node, result) {
  for (const child of node.children) {
    if (child.type === 'var_spec' || child.type === 'const_spec') {
      const nameNode = child.childForFieldName('name');
      if (nameNode) {
        const name = text(nameNode);
        result.symbols.push({
          name,
          kind: 'const',
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported: isExported(name),
        });
        if (isExported(name)) {
          result.exports.push({
            name,
            kind: 'const',
            lineStart: node.startPosition.row + 1,
            lineEnd: node.endPosition.row + 1,
          });
        }
      }
    }
  }
}

/**
 * @param {string} str
 * @returns {string}
 */
function stripQuotes(str) {
  if ((str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith('`') && str.endsWith('`'))) {
    return str.slice(1, -1);
  }
  return str;
}

/** @type {import('../types.mjs').LanguageParser} */
export const goParser = {
  language: 'go',
  extensions: ['.go'],
  parse,
};
