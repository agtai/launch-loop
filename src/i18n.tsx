import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import {formatDate, languageStorageKey, normalizeLocale, translateText, type Locale} from './i18n-core.mjs';
export {translateBuiltin} from './i18n-core.mjs';
export type {Locale} from './i18n-core.mjs';
type I18n = {locale: Locale; setLocale: (locale: Locale) => void; t: (source: string, params?: Record<string, string | number>) => string; date: (value: string | number | null | undefined) => string};
const I18nContext = createContext<I18n | null>(null);
function initialLocale(): Locale { try { return normalizeLocale(localStorage.getItem(languageStorageKey)); } catch { return 'zh'; } }

export function I18nProvider({children}: {children: ReactNode}) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    const checked = normalizeLocale(next);
    updateLocale(checked);
    try { localStorage.setItem(languageStorageKey, checked); } catch { /* Language still switches when storage is unavailable. */ }
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
    document.title = translateText('Launch Loop · 本地内容工作台', locale);
  }, [locale]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === languageStorageKey) updateLocale(normalizeLocale(event.newValue)); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const value = useMemo<I18n>(() => ({locale, setLocale, t: (source, params) => translateText(source, locale, params), date: input => formatDate(input, locale)}), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n(): I18n {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider.');
  return context;
}
