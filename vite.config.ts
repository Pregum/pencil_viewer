/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    plugins: [react()],
    base: env.VITE_BASE ?? '/',
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    },
  };
});
