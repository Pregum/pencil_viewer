import { describe, it, expect } from 'vitest';
import {
  utf8ToBase64,
  base64ToUtf8,
  isPenPath,
  filterPenEntries,
  classifyToken,
} from '../src/github/githubApi';

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

describe('classifyToken', () => {
  it('github_pat_ 始まりは fine-grained', () => {
    expect(classifyToken('github_pat_11ABCDE0Y0abcdefghijkl_mnopqrstuvwxyz')).toBe('fine-grained');
  });

  it('ghp_ 始まりは classic', () => {
    expect(classifyToken('ghp_abcdefghijklmnopqrstuvwxyz0123456789')).toBe('classic');
  });

  it('OAuth / GitHub App のトークンも classic 扱いにする', () => {
    // fine-grained ではない = リポジトリ単位で絞れていない可能性がある
    for (const prefix of ['gho_', 'ghu_', 'ghs_', 'ghr_']) {
      expect(classifyToken(`${prefix}abcdefghijklmnopqrstuvwxyz012345`)).toBe('classic');
    }
  });

  it('2021 年以前の 40 桁 16 進も classic', () => {
    expect(classifyToken('a'.repeat(40))).toBe('classic');
    expect(classifyToken('0123456789ABCDEF0123456789abcdef01234567')).toBe('classic');
  });

  it('40 桁でも 16 進でなければ unknown', () => {
    expect(classifyToken('z'.repeat(40))).toBe('unknown');
  });

  it('前後の空白は無視する', () => {
    expect(classifyToken('  github_pat_abc  ')).toBe('fine-grained');
  });

  it('空文字や判別できないものは unknown', () => {
    expect(classifyToken('')).toBe('unknown');
    expect(classifyToken('   ')).toBe('unknown');
    expect(classifyToken('not-a-token')).toBe('unknown');
  });

  it('github_pat_ を含んでいても先頭でなければ fine-grained としない', () => {
    expect(classifyToken('xgithub_pat_abc')).toBe('unknown');
  });
});
