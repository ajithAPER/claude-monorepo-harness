import { describe, it, expect } from 'vitest';
import { parse, typescriptParser, javascriptParser } from '../../src/parser/javascript.mjs';

describe('parser/javascript', () => {
  describe('imports', () => {
    it('parses named imports', () => {
      const result = parse('import { foo, bar } from "./utils";', 'test.mjs');
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].specifier).toBe('./utils');
      expect(result.imports[0].names).toEqual(['foo', 'bar']);
      expect(result.imports[0].isExternal).toBe(false);
    });

    it('parses default imports', () => {
      const result = parse('import React from "react";', 'test.mjs');
      expect(result.imports[0].names).toContain('default');
      expect(result.imports[0].isExternal).toBe(true);
    });

    it('parses namespace imports', () => {
      const result = parse('import * as path from "node:path";', 'test.mjs');
      expect(result.imports[0].names).toContain('*');
      expect(result.imports[0].isExternal).toBe(true);
    });

    it('parses re-exports as imports', () => {
      const result = parse('export { foo, bar } from "./other";', 'test.mjs');
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].specifier).toBe('./other');
    });

    it('detects relative imports as internal', () => {
      const result = parse('import { x } from "./local";', 'test.mjs');
      expect(result.imports[0].isExternal).toBe(false);
    });

    it('detects package imports as external', () => {
      const result = parse('import { x } from "lodash";', 'test.mjs');
      expect(result.imports[0].isExternal).toBe(true);
    });
  });

  describe('exports', () => {
    it('parses exported functions', () => {
      const result = parse('export function greet() {}', 'test.mjs');
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0].name).toBe('greet');
      expect(result.exports[0].kind).toBe('function');
    });

    it('parses exported classes', () => {
      const result = parse('export class MyClass {}', 'test.ts');
      expect(result.exports[0].name).toBe('MyClass');
      expect(result.exports[0].kind).toBe('class');
    });

    it('parses exported constants', () => {
      const result = parse('export const FOO = 42;', 'test.mjs');
      expect(result.exports[0].name).toBe('FOO');
      expect(result.exports[0].kind).toBe('const');
    });

    it('parses exported interfaces (TypeScript)', () => {
      const result = parse('export interface Foo { bar: string; }', 'test.ts');
      expect(result.exports[0].name).toBe('Foo');
      expect(result.exports[0].kind).toBe('interface');
    });

    it('parses exported type aliases (TypeScript)', () => {
      const result = parse('export type ID = string;', 'test.ts');
      expect(result.exports[0].name).toBe('ID');
      expect(result.exports[0].kind).toBe('type');
    });

    it('parses export clauses', () => {
      const src = 'const a = 1;\nconst b = 2;\nexport { a, b };';
      const result = parse(src, 'test.mjs');
      expect(result.exports).toHaveLength(2);
      expect(result.exports.map(e => e.name).sort()).toEqual(['a', 'b']);
    });
  });

  describe('symbols', () => {
    it('detects non-exported function declarations', () => {
      const result = parse('function internal() {}', 'test.mjs');
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].name).toBe('internal');
      expect(result.symbols[0].exported).toBe(false);
    });

    it('marks exported symbols as exported', () => {
      const result = parse('export function pub() {}', 'test.mjs');
      const sym = result.symbols.find(s => s.name === 'pub');
      expect(sym.exported).toBe(true);
    });

    it('detects class declarations', () => {
      const result = parse('class Foo {}', 'test.mjs');
      expect(result.symbols[0].kind).toBe('class');
    });

    it('detects const declarations', () => {
      const result = parse('const x = 1;', 'test.mjs');
      expect(result.symbols[0].kind).toBe('const');
    });

    it('records line numbers', () => {
      const src = 'const a = 1;\nfunction b() {\n  return 2;\n}';
      const result = parse(src, 'test.mjs');
      const fnSym = result.symbols.find(s => s.name === 'b');
      expect(fnSym.lineStart).toBe(2);
      expect(fnSym.lineEnd).toBe(4);
    });
  });

  describe('parser objects', () => {
    it('typescriptParser has correct extensions', () => {
      expect(typescriptParser.language).toBe('typescript');
      expect(typescriptParser.extensions).toContain('.ts');
      expect(typescriptParser.extensions).toContain('.tsx');
    });

    it('javascriptParser has correct extensions', () => {
      expect(javascriptParser.language).toBe('javascript');
      expect(javascriptParser.extensions).toContain('.mjs');
      expect(javascriptParser.extensions).toContain('.js');
    });
  });
});
