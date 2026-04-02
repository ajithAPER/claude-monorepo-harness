import { describe, it, expect } from 'vitest';
import { parse, goParser } from '../../src/parser/go.mjs';

describe('parser/go', () => {
  describe('imports', () => {
    it('parses single import', () => {
      const src = `package main\nimport "fmt"`;
      const result = parse(src, 'main.go');
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].specifier).toBe('fmt');
      expect(result.imports[0].isExternal).toBe(true);
    });

    it('parses grouped imports', () => {
      const src = `package main\nimport (\n  "fmt"\n  "os"\n)`;
      const result = parse(src, 'main.go');
      expect(result.imports).toHaveLength(2);
      expect(result.imports.map(i => i.specifier).sort()).toEqual(['fmt', 'os']);
    });

    it('parses aliased imports', () => {
      const src = `package main\nimport (\n  f "fmt"\n)`;
      const result = parse(src, 'main.go');
      expect(result.imports[0].names).toContain('f');
    });
  });

  describe('exported symbols (capitalized)', () => {
    it('detects exported functions', () => {
      const src = `package main\nfunc Hello() {}`;
      const result = parse(src, 'main.go');
      const sym = result.symbols.find(s => s.name === 'Hello');
      expect(sym.exported).toBe(true);
      expect(sym.kind).toBe('function');
      expect(result.exports.find(e => e.name === 'Hello')).toBeTruthy();
    });

    it('detects unexported functions', () => {
      const src = `package main\nfunc helper() {}`;
      const result = parse(src, 'main.go');
      const sym = result.symbols.find(s => s.name === 'helper');
      expect(sym.exported).toBe(false);
    });

    it('detects exported structs', () => {
      const src = `package main\ntype Server struct { Port int }`;
      const result = parse(src, 'main.go');
      const sym = result.symbols.find(s => s.name === 'Server');
      expect(sym.exported).toBe(true);
      expect(sym.kind).toBe('struct');
    });

    it('detects exported interfaces', () => {
      const src = `package main\ntype Reader interface { Read() }`;
      const result = parse(src, 'main.go');
      const sym = result.symbols.find(s => s.name === 'Reader');
      expect(sym.exported).toBe(true);
      expect(sym.kind).toBe('interface');
    });
  });

  describe('methods', () => {
    it('detects method declarations', () => {
      const src = `package main\ntype Foo struct{}\nfunc (f *Foo) Bar() {}`;
      const result = parse(src, 'main.go');
      const method = result.symbols.find(s => s.name === 'Bar');
      expect(method).toBeTruthy();
      expect(method.kind).toBe('method');
      expect(method.exported).toBe(true);
    });
  });

  describe('parser object', () => {
    it('has correct metadata', () => {
      expect(goParser.language).toBe('go');
      expect(goParser.extensions).toEqual(['.go']);
    });
  });
});
