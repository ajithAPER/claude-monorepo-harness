import { describe, it, expect } from 'vitest';
import { parse, rustParser } from '../../src/parser/rust.mjs';

describe('parser/rust', () => {
  describe('use declarations', () => {
    it('parses simple use', () => {
      const result = parse('use std::io;', 'lib.rs');
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].specifier).toContain('std');
      expect(result.imports[0].isExternal).toBe(true);
    });

    it('detects crate-relative as internal', () => {
      const result = parse('use crate::config;', 'lib.rs');
      expect(result.imports[0].isExternal).toBe(false);
    });

    it('detects self-relative as internal', () => {
      const result = parse('use self::utils;', 'lib.rs');
      expect(result.imports[0].isExternal).toBe(false);
    });

    it('detects super-relative as internal', () => {
      const result = parse('use super::parent;', 'lib.rs');
      expect(result.imports[0].isExternal).toBe(false);
    });
  });

  describe('pub visibility', () => {
    it('detects pub functions as exported', () => {
      const result = parse('pub fn hello() {}', 'lib.rs');
      const sym = result.symbols.find(s => s.name === 'hello');
      expect(sym.exported).toBe(true);
      expect(result.exports).toHaveLength(1);
    });

    it('detects non-pub functions as unexported', () => {
      const result = parse('fn internal() {}', 'lib.rs');
      const sym = result.symbols.find(s => s.name === 'internal');
      expect(sym.exported).toBe(false);
    });

    it('detects pub structs', () => {
      const result = parse('pub struct Config { pub name: String }', 'lib.rs');
      const sym = result.symbols.find(s => s.name === 'Config');
      expect(sym.kind).toBe('struct');
      expect(sym.exported).toBe(true);
    });

    it('detects pub enums', () => {
      const result = parse('pub enum Color { Red, Blue }', 'lib.rs');
      const sym = result.symbols.find(s => s.name === 'Color');
      expect(sym.kind).toBe('enum');
      expect(sym.exported).toBe(true);
    });

    it('detects pub traits', () => {
      const result = parse('pub trait Drawable { fn draw(&self); }', 'lib.rs');
      const sym = result.symbols.find(s => s.name === 'Drawable');
      expect(sym.kind).toBe('trait');
      expect(sym.exported).toBe(true);
    });
  });

  describe('other items', () => {
    it('detects impl blocks', () => {
      const result = parse('struct Foo {}\nimpl Foo { fn new() -> Self { Foo {} } }', 'lib.rs');
      const impl = result.symbols.find(s => s.name.startsWith('impl'));
      expect(impl).toBeTruthy();
    });

    it('detects mod items', () => {
      const result = parse('pub mod config;', 'lib.rs');
      const sym = result.symbols.find(s => s.name === 'config');
      expect(sym.kind).toBe('module');
      expect(sym.exported).toBe(true);
    });

    it('detects const items', () => {
      const result = parse('pub const MAX: u32 = 100;', 'lib.rs');
      const sym = result.symbols.find(s => s.name === 'MAX');
      expect(sym.kind).toBe('const');
      expect(sym.exported).toBe(true);
    });

    it('detects type aliases', () => {
      const result = parse('pub type Result<T> = std::result::Result<T, Error>;', 'lib.rs');
      const sym = result.symbols.find(s => s.name === 'Result');
      expect(sym.kind).toBe('type');
      expect(sym.exported).toBe(true);
    });
  });

  describe('parser object', () => {
    it('has correct metadata', () => {
      expect(rustParser.language).toBe('rust');
      expect(rustParser.extensions).toEqual(['.rs']);
    });
  });
});
