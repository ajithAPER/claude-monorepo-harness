/**
 * Parser interface types are defined in types.mjs.
 * This module re-exports the type definitions and provides
 * a factory for creating empty parse results.
 */

/**
 * Create an empty parse result.
 * @returns {import('../types.mjs').ParseResult}
 */
export function emptyResult() {
  return { symbols: [], imports: [], exports: [] };
}
