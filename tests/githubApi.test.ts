import { describe, it, expect } from 'vitest';
import { utf8ToBase64, base64ToUtf8, isPenPath, filterPenEntries } from '../src/github/githubApi';

describe('githubApi pure helpers', () => {
  describe('base64 round-trip (UTF-8 safe)', () => {
    it('round-trips ASCII', () => {
      const s = '{"version":"1.0","children":[]}';
      expect(base64ToUtf8(utf8ToBase64(s))).toBe(s);
    });

    it('round-trips multibyte (日本語 / emoji)', () => {
      const s = '日本語のデザイン 🎨 {"name":"ボタン"}';
      expect(base64ToUtf8(utf8ToBase64(s))).toBe(s);
    });

    it('tolerates newlines in GitHub-returned base64', () => {
      const s = 'hello world '.repeat(20);
      const b64 = utf8ToBase64(s);
      // GitHub は 60 文字ごとに改行を挟んで返す
      const withNewlines = b64.replace(/(.{60})/g, '$1\n');
      expect(base64ToUtf8(withNewlines)).toBe(s);
    });
  });

  describe('isPenPath', () => {
    it('matches .pen case-insensitively', () => {
      expect(isPenPath('a/b/c.pen')).toBe(true);
      expect(isPenPath('Design.PEN')).toBe(true);
    });
    it('rejects non-.pen', () => {
      expect(isPenPath('a.penx')).toBe(false);
      expect(isPenPath('a.json')).toBe(false);
      expect(isPenPath('pen')).toBe(false);
    });
  });

  describe('filterPenEntries', () => {
    it('keeps only .pen blobs, sorted by path', () => {
      const tree = [
        { path: 'z/last.pen', type: 'blob', sha: 's3' },
        { path: 'src/index.ts', type: 'blob', sha: 's2' },
        { path: 'a/first.pen', type: 'blob', sha: 's1' },
        { path: 'designs', type: 'tree', sha: 'st' },
        { path: 'designs/a.pen', type: 'tree', sha: 'noblob' }, // tree, not blob
      ];
      const result = filterPenEntries(tree);
      expect(result).toEqual([
        { path: 'a/first.pen', sha: 's1' },
        { path: 'z/last.pen', sha: 's3' },
      ]);
    });

    it('handles empty tree', () => {
      expect(filterPenEntries([])).toEqual([]);
    });
  });
});
