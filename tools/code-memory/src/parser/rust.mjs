import Parser from 'tree-sitter';
import Rust from 'tree-sitter-rust';
import { emptyResult } from './parser.mjs';

const parser = new Parser();
parser.setLanguage(Rust);

/**
 * @param {any} node
 * @returns {string}
 */
function text(node) {
  return node ? node.text : '';
}

/**
 * Check if a Rust item has pub visibility.
 * @param {any} node
 * @returns {boolean}
 */
function isPub(node) {
  for (const child of node.children) {
    if (child.type === 'visibility_modifier') return true;
  }
  return false;
}

/**
 * Parse Rust source file.
 * @param {string} source
 * @param {string} filePath
 * @returns {import('../types.mjs').ParseResult}
 */
export function parse(source, filePath) {
  const tree = parser.parse(source);
  const result = emptyResult();

  for (const node of tree.rootNode.children) {
    switch (node.type) {
      case 'use_declaration':
        parseUseDecl(node, result);
        break;
      case 'function_item': {
        const name = text(node.childForFieldName('name'));
        const exported = isPub(node);
        result.symbols.push({
          name,
          kind: 'function',
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported,
        });
        if (exported) {
          result.exports.push({
            name,
            kind: 'function',
            lineStart: node.startPosition.row + 1,
            lineEnd: node.endPosition.row + 1,
          });
        }
        break;
      }
      case 'struct_item': {
        const name = text(node.childForFieldName('name'));
        const exported = isPub(node);
        result.symbols.push({
          name,
          kind: 'struct',
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported,
        });
        if (exported) {
          result.exports.push({
            name,
            kind: 'struct',
            lineStart: node.startPosition.row + 1,
            lineEnd: node.endPosition.row + 1,
          });
        }
        break;
      }
      case 'enum_item': {
        const name = text(node.childForFieldName('name'));
        const exported = isPub(node);
        result.symbols.push({
          name,
          kind: 'enum',
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported,
        });
        if (exported) {
          result.exports.push({
            name,
            kind: 'enum',
            lineStart: node.startPosition.row + 1,
            lineEnd: node.endPosition.row + 1,
          });
        }
        break;
      }
      case 'trait_item': {
        const name = text(node.childForFieldName('name'));
        const exported = isPub(node);
        result.symbols.push({
          name,
          kind: 'trait',
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported,
        });
        if (exported) {
          result.exports.push({
            name,
            kind: 'trait',
            lineStart: node.startPosition.row + 1,
            lineEnd: node.endPosition.row + 1,
          });
        }
        break;
      }
      case 'impl_item': {
        // Extract the type being implemented
        const typeNode = node.childForFieldName('type');
        const name = text(typeNode);
        result.symbols.push({
          name: `impl ${name}`,
          kind: 'type',
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported: false,
        });
        break;
      }
      case 'mod_item': {
        const name = text(node.childForFieldName('name'));
        const exported = isPub(node);
        result.symbols.push({
          name,
          kind: 'module',
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported,
        });
        if (exported) {
          result.exports.push({
            name,
            kind: 'module',
            lineStart: node.startPosition.row + 1,
            lineEnd: node.endPosition.row + 1,
          });
        }
        break;
      }
      case 'type_item': {
        const name = text(node.childForFieldName('name'));
        const exported = isPub(node);
        result.symbols.push({
          name,
          kind: 'type',
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported,
        });
        if (exported) {
          result.exports.push({
            name,
            kind: 'type',
            lineStart: node.startPosition.row + 1,
            lineEnd: node.endPosition.row + 1,
          });
        }
        break;
      }
      case 'const_item':
      case 'static_item': {
        const name = text(node.childForFieldName('name'));
        const exported = isPub(node);
        result.symbols.push({
          name,
          kind: 'const',
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported,
        });
        if (exported) {
          result.exports.push({
            name,
            kind: 'const',
            lineStart: node.startPosition.row + 1,
            lineEnd: node.endPosition.row + 1,
          });
        }
        break;
      }
    }
  }

  return result;
}

/**
 * Parse a use declaration into imports.
 * @param {any} node
 * @param {import('../types.mjs').ParseResult} result
 */
function parseUseDecl(node, result) {
  // Extract the full use path as a specifier
  const argument = node.children.find(
    (c) => c.type === 'use_list' || c.type === 'scoped_identifier' ||
           c.type === 'use_as_clause' || c.type === 'use_wildcard' ||
           c.type === 'identifier' || c.type === 'scoped_use_list'
  );

  if (!argument) return;

  const specifier = text(argument).replace(/\s+/g, '');
  const isCrate = specifier.startsWith('crate::') || specifier.startsWith('self::') || specifier.startsWith('super::');
  const isExternal = !isCrate;

  result.imports.push({
    specifier,
    names: ['*'],
    isExternal,
  });
}

/** @type {import('../types.mjs').LanguageParser} */
export const rustParser = {
  language: 'rust',
  extensions: ['.rs'],
  parse,
};
