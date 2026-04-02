import { typescriptParser, javascriptParser } from './javascript.mjs';
import { goParser } from './go.mjs';
import { rustParser } from './rust.mjs';

/** @type {Map<string, import('../types.mjs').LanguageParser>} */
const extensionMap = new Map();

for (const parser of [typescriptParser, javascriptParser, goParser, rustParser]) {
  for (const ext of parser.extensions) {
    extensionMap.set(ext, parser);
  }
}

/**
 * Get the parser for a given file path based on its extension.
 * @param {string} filePath
 * @returns {import('../types.mjs').LanguageParser | null}
 */
export function getParser(filePath) {
  for (const [ext, parser] of extensionMap) {
    if (filePath.endsWith(ext)) {
      return parser;
    }
  }
  return null;
}
