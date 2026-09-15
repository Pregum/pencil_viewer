// @ts-check
/**
 * ESLint flat config。
 *
 * tsc は型エラーしか見ない。未使用変数、useEffect の依存配列漏れ、
 * any の混入といったものを拾うために導入した (#69)。
 *
 * Prettier とは責務を分ける。整形は Prettier、コードの正しさは ESLint。
 * eslint-config-prettier で整形系ルールを無効化して衝突を避けている。
 */

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'workers/**/dist/**', '~/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // _ 始まりは「意図的に使わない」の慣習。既存コードもこれに従っている。
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // フックの呼び出し順序が壊れると実行時に確実に壊れるので error のまま。
      // 導入時に NodeTree.tsx の違反を 1 件直してゼロにした。
      'react-hooks/rules-of-hooks': 'error',

      // 以下は eslint-plugin-react-hooks v6 で入った React Compiler 系の
      // ルール。導入時 (#69) は既存コードに 31 件あったため warn で可視化し、
      // #78 で全件解消した。CI は --max-warnings=0 で回すので、warn でも
      // 新規の違反は CI で落ちる。error に上げていないのは、ローカルで
      // 試行錯誤している途中でも lint 全体が赤くならないようにするため。
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Context モジュールは Provider コンポーネントと useXxx フックを同じファイルに
    // 置く (React の標準的な Context パターン)。フックを別ファイルに分けても
    // HMR の粒度以外に得るものがなく、import 元 30 箇所超の書き換えが要るだけなので、
    // このファイル群に限って only-export-components を外す。
    files: ['**/*Context.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Cloudflare Worker と Node スクリプトはブラウザ以外のグローバルを使う
    files: ['workers/**/*.{ts,js}', 'tools/**/*.{ts,js}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.worker },
    },
  },
  {
    // テストは開発時のみ動くコードなので、本体より少しゆるくする
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  prettier,
);
