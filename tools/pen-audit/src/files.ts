/**
 * 対象 `.pen` ファイルの収集。glob の判定だけ純粋関数として切り出してある。
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PenFileInput } from './audit';

/** 走査しても意味がないディレクトリ。 */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', 'build']);

/**
 * glob パターンを正規表現に変換する。
 *
 * 対応するのは `**` (階層をまたぐ)、`*` (区切りをまたがない)、`?` の 3 つだけ。
 * `.pen` を拾う用途にはこれで十分で、依存を増やさずに済む。
 */
export function globToRegExp(pattern: string): RegExp {
  let source = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        // `**/` は「0 階層以上」。`a/**/b.pen` が `a/b.pen` にも当たるようにする
        if (pattern[i + 2] === '/') {
          source += '(?:.*/)?';
          i += 2;
        } else {
          source += '.*';
          i += 1;
        }
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

/** パスが 1 つでもパターンに当たるか。パスは常に `/` 区切りのリポジトリ相対。 */
export function matchesAny(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.replace(/^\.\//, '');
  return patterns.some((pattern) => globToRegExp(pattern.trim()).test(normalized));
}

/** ルート以下を歩いてパターンに当たるファイルのパスを返す (リポジトリ相対、ソート済み)。 */
export async function collectPaths(root: string, patterns: string[]): Promise<string[]> {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(path.join(root, dir), { withFileTypes: true });
    for (const entry of entries) {
      const relative = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(relative);
      } else if (entry.isFile() && matchesAny(relative, patterns)) {
        found.push(relative);
      }
    }
  };
  await walk('');
  return found.sort();
}

/** パスの一覧を読み込んで監査に渡せる形にする。 */
export async function readPenFiles(root: string, paths: string[]): Promise<PenFileInput[]> {
  return Promise.all(paths.map(async (p) => ({ path: p, text: await readFile(path.join(root, p), 'utf8') })));
}
