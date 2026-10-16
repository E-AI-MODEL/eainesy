'use client';

/**
 * LanguageProvider — global NL/EN UI language with localStorage persistence.
 * Default is Dutch (nl). Backed by an external store (see language-store.ts)
 * consumed via useSyncExternalStore: hydration-safe and lint-clean.
 * Also exposes the LanguageToggle segmented control.
 */
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { DICTS, type Dict, type Lang } from '@/lib/i18n';
import { languageStore } from './language-store';

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
}

const Ctx = createContext<LangCtx>({ lang: 'nl', setLang: () => {}, t: DICTS.nl });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(languageStore.subscribe, languageStore.snapshot, languageStore.serverSnapshot);
  const value = useMemo(() => ({ lang, setLang: languageStore.setLang, t: DICTS[lang] }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  return useContext(Ctx);
}

/** NL | EN segmented pill — compact, works in header and menu. */
export function LanguageToggle({ dark = false }: { dark?: boolean }) {
  const { lang, setLang, t } = useLang();
  const base = dark
    ? 'border-white/40 text-white/90'
    : 'border-slate-300 text-slate-500';
  const on = dark
    ? 'bg-white text-blue-900 border-white'
    : 'bg-slate-900 text-white border-slate-900';
  return (
    <div
      role="group"
      aria-label={t.header.language}
      className={`inline-flex shrink-0 items-center overflow-hidden rounded-full border text-[11px] font-semibold ${base}`}
    >
      {(['nl', 'en'] as const).map((l, i) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2 py-1 uppercase tracking-wide transition-colors ${i > 0 ? 'border-l' : ''} ${
            dark ? 'border-l-white/30' : 'border-l-slate-300'
          } ${lang === l ? on : dark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
