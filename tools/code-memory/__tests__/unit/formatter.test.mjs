import { describe, it, expect } from 'vitest';
import { formatOutput, formatTable } from '../../src/query/formatter.mjs';

describe('query/formatter', () => {
  describe('formatTable', () => {
    it('aligns columns and draws separator', () => {
      const result = formatTable(['Name', 'Kind'], [['hello', 'function'], ['x', 'const']]);
      const lines = result.split('\n');
      expect(lines).toHaveLength(4); // header + separator + 2 rows
      expect(lines[0]).toMatch(/Name\s+Kind/);
      expect(lines[1]).toMatch(/─+/);
    });

    it('handles empty rows', () => {
      const result = formatTable(['A', 'B'], []);
      const lines = result.split('\n');
      expect(lines).toHaveLength(2); // header + separator only
    });
  });

  describe('formatOutput', () => {
    it('json format returns valid JSON', () => {
      const data = [{ file: '/src/a.ts', name: 'foo' }];
      const result = formatOutput(data, 'json');
      expect(JSON.parse(result)).toEqual(data);
    });

    it('flat format shows file paths', () => {
      const data = [{ file: '/project/src/a.ts', importerCount: 5 }];
      const result = formatOutput(data, 'flat', '/project');
      expect(result).toContain('src/a.ts');
      expect(result).toContain('5 importers');
    });

    it('tree format shows connectors', () => {
      const tree = {
        file: '/project/src/a.ts',
        children: [
          { file: '/project/src/b.ts', children: [] },
          { file: '/project/src/c.ts', children: [], truncated: true },
        ],
      };
      const result = formatOutput(tree, 'tree', '/project');
      expect(result).toContain('src/a.ts');
      expect(result).toContain('├──');
      expect(result).toContain('└──');
      expect(result).toContain('(circular)');
    });
  });
});
