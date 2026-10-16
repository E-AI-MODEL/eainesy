/**
 * i18n entry point — dictionary access + typed helpers.
 * The provider lives in components/language-provider.tsx (client-side).
 */
import { nl, type Dict } from './nl';
import { en } from './en';

export type Lang = 'nl' | 'en';

export const DICTS: Record<Lang, Dict> = { nl, en };

export type { Dict };

/** Localised number formatting (NL uses dotted thousands: 9.216). */
export function fmtNum(n: number, lang: Lang): string {
  return n.toLocaleString(lang === 'nl' ? 'nl-NL' : 'en-US');
}

/** Localised short time formatting. */
export function fmtTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(lang === 'nl' ? 'nl-NL' : 'en-US', { hour: '2-digit', minute: '2-digit' });
}

/** Localised date-time formatting. */
export function fmtDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(lang === 'nl' ? 'nl-NL' : 'en-US');
}

/** Pick the current-language side of a bilingual value. */
export function bi<T>(value: { nl: T; en: T }, lang: Lang): T {
  return lang === 'nl' ? value.nl : value.en;
}
