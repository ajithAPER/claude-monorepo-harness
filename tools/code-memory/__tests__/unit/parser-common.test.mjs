import { describe, it, expect } from 'vitest';
import { emptyResult } from '../../src/parser/parser.mjs';

describe('parser/parser', () => {
  describe('emptyResult', () => {
    it('returns object with empty arrays', () => {
      const result = emptyResult();
      expect(result).toEqual({
        symbols: [],
        imports: [],
        exports: [],
      });
    });

    it('returns a fresh object each time', () => {
      const a = emptyResult();
      const b = emptyResult();
      expect(a).not.toBe(b);
      a.symbols.push({ name: 'x' });
      expect(b.symbols).toHaveLength(0);
    });
  });
});
