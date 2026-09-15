// 動画全体で使う色とフォント。アプリ本体（landing / viewer）の見た目に寄せている。
export const COLOR = {
  bg: '#FBFBFA',
  panel: '#FFFFFF',
  ink: '#0F172A',
  muted: '#64748B',
  faint: '#94A3B8',
  line: '#E2E8F0',
  accent: '#6D28D9',
  accentSoft: '#EDE9FE',
  git: '#16A34A',
  warn: '#F59E0B',
} as const;

// macOS でレンダリングするため、Web フォントを取りに行かずシステムの日本語フォントを使う。
export const FONT = {
  sans: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, sans-serif',
  mono: '"SF Mono", "Menlo", "Courier New", monospace',
} as const;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
