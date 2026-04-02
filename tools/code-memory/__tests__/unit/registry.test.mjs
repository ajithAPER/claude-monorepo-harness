import { describe, it, expect } from 'vitest';
import { getParser } from '../../src/parser/registry.mjs';

describe('parser/registry', () => {
  it('returns typescript parser for .ts files', () => {
    const parser = getParser('/src/foo.ts');
    expect(parser).not.toBeNull();
    expect(parser.language).toBe('typescript');
  });

  it('returns typescript parser for .tsx files', () => {
    expect(getParser('/src/foo.tsx').language).toBe('typescript');
  });

  it('returns typescript parser for .mts files', () => {
    expect(getParser('/src/foo.mts').language).toBe('typescript');
  });

  it('returns javascript parser for .mjs files', () => {
    expect(getParser('/src/foo.mjs').language).toBe('javascript');
  });

  it('returns javascript parser for .js files', () => {
    expect(getParser('/src/foo.js').language).toBe('javascript');
  });

  it('returns javascript parser for .jsx files', () => {
    expect(getParser('/src/foo.jsx').language).toBe('javascript');
  });

  it('returns go parser for .go files', () => {
    expect(getParser('/src/main.go').language).toBe('go');
  });

  it('returns rust parser for .rs files', () => {
    expect(getParser('/src/lib.rs').language).toBe('rust');
  });

  it('returns null for unsupported extensions', () => {
    expect(getParser('/src/style.css')).toBeNull();
    expect(getParser('/src/data.json')).toBeNull();
    expect(getParser('/src/readme.md')).toBeNull();
  });
});
