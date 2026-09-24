export type Locale = 'zh' | 'en';
export const languageStorageKey: string;
export const englishMessages: Readonly<Record<string, string>>;
export function normalizeLocale(value: unknown): Locale;
export function translateText(source: string, locale?: Locale, params?: Record<string, string | number>): string;
export function translateBuiltin<T>(value: T, locale?: Locale): T;
export function formatDate(value: string | number | null | undefined, locale?: Locale): string;
