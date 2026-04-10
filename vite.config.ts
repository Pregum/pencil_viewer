/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    },
  };
});
