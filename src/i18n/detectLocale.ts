export type SupportedLocale = 'en' | 'ja' | 'zh';

const STORAGE_KEY = 'pencil-viewer-locale';

export function detectLocale(): SupportedLocale {
  // 1. localStorage (手動切替の永続化)
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'ja' || stored === 'zh') return stored;

  // 2. ?lang= クエリパラメータ
  const params = new URLSearchParams(window.location.search);
  const qLang = params.get('lang');
  if (qLang) {
    const mapped = mapLang(qLang);
    if (mapped) return mapped;
  }

  // 3. navigator.language
  const nav = navigator.language ?? navigator.languages?.[0] ?? 'en';
  return mapLang(nav) ?? 'en';
}

export function persistLocale(locale: SupportedLocale): void {
  localStorage.setItem(STORAGE_KEY, locale);
}

function mapLang(tag: string): SupportedLocale | null {
  const lower = tag.toLowerCase();
  if (lower.startsWith('ja')) return 'ja';
  if (lower.startsWith('zh')) return 'zh';
  if (lower.startsWith('en')) return 'en';
  return null;
}
