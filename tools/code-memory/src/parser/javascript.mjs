import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScriptLanguages from 'tree-sitter-typescript';
import { emptyResult } from './parser.mjs';

const tsParser = new Parser();
tsParser.setLanguage(TypeScriptLanguages.typescript);

const tsxParser = new Parser();
tsxParser.setLanguage(TypeScriptLanguages.tsx);

const jsParser = new Parser();
jsParser.setLanguage(JavaScript);

/**
 * Get the appropriate parser for a file extension.
 * @param {string} filePath
 * @returns {Parser}
 */
function getParser(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) return tsxParser;
  if (filePath.endsWith('.ts') || filePath.endsWith('.mts')) return tsParser;
  return jsParser;
}

/**
 * Extract the text of a node.
 * @param {any} node
 * @returns {string}
 */
function text(node) {
  return node ? node.text : '';
}

/**
 * Parse JavaScript/TypeScript/MJS source file.
 * @param {string} source
 * @param {string} filePath
 * @returns {import('../types.mjs').ParseResult}
 */
export function parse(source, filePath) {
  const parser = getParser(filePath);
  const tree = parser.parse(source);
  const result = emptyResult();

  for (const node of tree.rootNode.children) {
    switch (node.type) {
      case 'import_statement':
        parseImport(node, result);
        break;
      case 'export_statement':
        parseExport(node, result);
        break;
      case 'function_declaration':
      case 'generator_function_declaration':
        result.symbols.push({
          name: text(node.childForFieldName('name')),
          kind: 'function',
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported: false,
        });
        break;
      case 'class_declaration':
        result.symbols.push({
          name: text(node.childForFieldName('name')),
          kind: 'class',
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported: false,
        });
        break;
      case 'interface_declaration':
        result.symbols.push({
          name: text(node.childForFieldName('name')),
          kind: 'interface',
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported: false,
        });
        break;
      case 'type_alias_declaration':
        result.symbols.push({
          name: text(node.childForFieldName('name')),
          kind: 'type',
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported: false,
        });
        break;
      case 'lexical_declaration':
      case 'variable_declaration':
        parseVariableDeclaration(node, false, result);
        break;
      case 'enum_declaration':
        result.symbols.push({
          name: text(node.childForFieldName('name')),
          kind: 'enum',
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported: false,
        });
        break;
    }
  }

  return result;
}

/**
 * @param {any} node
 * @param {import('../types.mjs').ParseResult} result
 */
function parseImport(node, result) {
  const source = node.childForFieldName('source');
  if (!source) return;

  const specifier = stripQuotes(text(source));
  const names = [];

  const importClause = node.children.find(
    (c) => c.type === 'import_clause'
  );

  if (importClause) {
    for (const child of importClause.children) {
      switch (child.type) {
        case 'identifier':
          names.push('default');
          break;
        case 'named_imports':
          for (const spec of child.children) {
            if (spec.type === 'import_specifier') {
              const alias = spec.childForFieldName('alias');
              const name = spec.childForFieldName('name');
              names.push(text(alias || name));
            }
          }
          break;
        case 'namespace_import':
          names.push('*');
          break;
      }
    }
  }

  const isExternal = !specifier.startsWith('.') && !specifier.startsWith('/');

  result.imports.push({ specifier, names, isExternal });
}

/**
 * @param {any} node
 * @param {import('../types.mjs').ParseResult} result
 */
function parseExport(node, result) {
  const declaration = node.childForFieldName('declaration');
  const source = node.childForFieldName('source');

  // Re-export: export { X } from './foo'
  if (source) {
    const specifier = stripQuotes(text(source));
    const names = [];

    for (const child of node.children) {
      if (child.type === 'export_clause') {
        for (const spec of child.children) {
          if (spec.type === 'export_specifier') {
            const alias = spec.childForFieldName('alias');
            const name = spec.childForFieldName('name');
            names.push(text(alias || name));
          }
        }
      }
    }

    const isExternal = !specifier.startsWith('.') && !specifier.startsWith('/');
    result.imports.push({ specifier, names, isExternal });
    return;
  }

  // Named export clause without source: export { X, Y }
  if (!declaration) {
    for (const child of node.children) {
      if (child.type === 'export_clause') {
        for (const spec of child.children) {
          if (spec.type === 'export_specifier') {
            const name = spec.childForFieldName('name');
            result.exports.push({
              name: text(name),
              kind: 'variable',
              lineStart: node.startPosition.row + 1,
              lineEnd: node.endPosition.row + 1,
            });
          }
        }
      }
    }
    return;
  }

  // Export with declaration
  if (declaration) {
    switch (declaration.type) {
      case 'function_declaration':
      case 'generator_function_declaration': {
        const name = text(declaration.childForFieldName('name'));
        const sym = {
          name,
          kind: /** @type {const} */ ('function'),
          lineStart: declaration.startPosition.row + 1,
          lineEnd: declaration.endPosition.row + 1,
          exported: true,
        };
        result.symbols.push(sym);
        result.exports.push(sym);
        break;
      }
      case 'class_declaration': {
        const name = text(declaration.childForFieldName('name'));
        const sym = {
          name,
          kind: /** @type {const} */ ('class'),
          lineStart: declaration.startPosition.row + 1,
          lineEnd: declaration.endPosition.row + 1,
          exported: true,
        };
        result.symbols.push(sym);
        result.exports.push(sym);
        break;
      }
      case 'interface_declaration': {
        const name = text(declaration.childForFieldName('name'));
        const sym = {
          name,
          kind: /** @type {const} */ ('interface'),
          lineStart: declaration.startPosition.row + 1,
          lineEnd: declaration.endPosition.row + 1,
          exported: true,
        };
        result.symbols.push(sym);
        result.exports.push(sym);
        break;
      }
      case 'type_alias_declaration': {
        const name = text(declaration.childForFieldName('name'));
        const sym = {
          name,
          kind: /** @type {const} */ ('type'),
          lineStart: declaration.startPosition.row + 1,
          lineEnd: declaration.endPosition.row + 1,
          exported: true,
        };
        result.symbols.push(sym);
        result.exports.push(sym);
        break;
      }
      case 'enum_declaration': {
        const name = text(declaration.childForFieldName('name'));
        const sym = {
          name,
          kind: /** @type {const} */ ('enum'),
          lineStart: declaration.startPosition.row + 1,
          lineEnd: declaration.endPosition.row + 1,
          exported: true,
        };
        result.symbols.push(sym);
        result.exports.push(sym);
        break;
      }
      case 'lexical_declaration':
      case 'variable_declaration':
        parseVariableDeclaration(declaration, true, result);
        break;
    }
  }
}

/**
 * @param {any} node
 * @param {boolean} exported
 * @param {import('../types.mjs').ParseResult} result
 */
function parseVariableDeclaration(node, exported, result) {
  for (const child of node.children) {
    if (child.type === 'variable_declarator') {
      const nameNode = child.childForFieldName('name');
      if (nameNode && nameNode.type === 'identifier') {
        const sym = {
          name: text(nameNode),
          kind: /** @type {const} */ ('const'),
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          exported,
        };
        result.symbols.push(sym);
        if (exported) result.exports.push(sym);
      }
    }
  }
}

/**
 * @param {string} str
 * @returns {string}
 */
function stripQuotes(str) {
  if ((str.startsWith("'") && str.endsWith("'")) ||
      (str.startsWith('"') && str.endsWith('"'))) {
    return str.slice(1, -1);
  }
  return str;
}

/** @type {import('../types.mjs').LanguageParser} */
export const typescriptParser = {
  language: 'typescript',
  extensions: ['.ts', '.tsx', '.mts'],
  parse,
};

/** @type {import('../types.mjs').LanguageParser} */
export const javascriptParser = {
  language: 'javascript',
  extensions: ['.mjs', '.js', '.jsx'],
  parse,
};
