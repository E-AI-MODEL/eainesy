'use client';

import type { ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLang } from '@/components/language-provider';

/**
 * InfoTip — tap the "?" to open a one-breath, human-language explanation of a
 * term or signal. Purpose: the UI explains itself (no black box), instead of
 * relying on documentation elsewhere.
 */
export function InfoTip({ term, children }: { term: string; children: ReactNode }) {
  const { t } = useLang();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${t.common.explain}: ${term}`}
          className="relative inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-[9px] font-bold leading-none text-slate-500 transition-colors after:absolute after:-inset-1.5 after:rounded-full after:content-[''] hover:border-blue-400 hover:text-blue-700"
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-64 rounded-xl text-xs leading-relaxed text-slate-700">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-blue-800">{term}</p>
        {children}
      </PopoverContent>
    </Popover>
  );
}
