/**
 * バージョン表示の検証 (#72)。
 *
 * package.json の version を vite.config.ts の define で __APP_VERSION__ に
 * 埋め込み、ヘッダに出している。共有 URL 経由で不具合報告を受けたときに
 * どのビルドの話か切り分けるためのもの。
 *
 * ここでは「package.json と実際に埋め込まれる値が一致すること」と
 * 「表示形式が v<semver> であること」を押さえる。
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

describe('アプリのバージョン', () => {
  it('package.json の version が 0.0.0 のままではない', () => {
    expect(pkg.version).not.toBe('0.0.0');
  });

  it('semver 形式である', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
  });

  it('__APP_VERSION__ に package.json の version が埋め込まれる', () => {
    // vitest も vite.config.ts の define を通るので、実ビルドと同じ値になる
    expect(__APP_VERSION__).toBe(pkg.version);
  });
});
