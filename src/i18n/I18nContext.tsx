import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { detectLocale, persistLocale, type SupportedLocale } from './detectLocale';
import en from './locales/en.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';

type Messages = Record<string, string>;
const MESSAGES: Record<SupportedLocale, Messages> = { en, ja, zh };

interface I18nValue {
  locale: SupportedLocale;
  setLocale: (l: SupportedLocale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nValue>({
  locale: 'en',
  setLocale: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleRaw] = useState<SupportedLocale>(detectLocale);

  const setLocale = useCallback((l: SupportedLocale) => {
    setLocaleRaw(l);
    persistLocale(l);
  }, []);

  // <html lang="..."> を同期
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key: string): string => MESSAGES[locale][key] ?? MESSAGES.en[key] ?? key,
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
