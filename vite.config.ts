/// <reference types="vitest" />
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// package.json の version をビルド時に埋め込む。共有 URL 経由で
// 不具合報告を受けたときに、どのビルドの話か切り分けられるようにする。
const pkgVersion = (JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }).version;

// GitHub Pages はプロジェクトページ形式(https://<user>.github.io/pencil_viewer/)で
// 配信されるため、本番ビルド時はサブパス付きでアセットを吐く。
// - `npm run dev` / テスト: ルート `/`
// - `npm run build`: `/pencil_viewer/`(VITE_BASE で上書き可能)
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const defaultBase = command === 'build' ? '/pencil_viewer/' : '/';
  return {
    plugins: [react()],
    base: env.VITE_BASE ?? defaultBase,
    define: {
      __APP_VERSION__: JSON.stringify(pkgVersion),
    },
    build: {
      rollupOptions: {
        output: {
          // vite 8 (rolldown) ではオブジェクト形式の manualChunks が廃止され、
          // 関数形式のみになった。挙動は従来の { lucide: ['lucide'] } と同じで、
          // lucide を単独チャンクに切り出す。
          manualChunks: (id: string) =>
            id.includes('node_modules/lucide') ? 'lucide' : undefined,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov', 'json-summary'],
        reportsDirectory: 'coverage',
        // 計測対象は src のみ。設定ファイルや型定義だけのファイルは
        // 分母に入れても意味がないので外す。
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.d.ts',
          'src/main.tsx',
          // 文言データ。ロジックが無く、含めるとカバレッジが実態より高く出る
          'src/components/docsContent.ts',
          'src/i18n/messages/**',
        ],
        // 現状値 (lines 23.7 / functions 78.6 / branches 80.9) をわずかに
        // 下回る位置に置いた歯止め。ここから下げないことだけを保証し、
        // 引き上げは #70 のフォローで段階的に行う。
        thresholds: {
          lines: 23,
          statements: 23,
          functions: 75,
          branches: 78,
        },
      },
    },
  };
});
