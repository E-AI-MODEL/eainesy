'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Ban, TriangleAlert, PhoneCall } from 'lucide-react';
import { useLang } from '@/components/language-provider';

/**
 * Canonieke disclaimer-dialog — dezelfde gestructureerde tekst als de
 * disclaimer-sectie in het Over-paneel, bereikbaar vanaf de desktop-footer
 * en het mobiele menu.
 */
export function DisclaimerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useLang();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <TriangleAlert className="h-4 w-4 text-rose-600" aria-hidden />
            {t.disclaimer.title}
          </DialogTitle>
          <DialogDescription>{t.disclaimer.whatIs}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-slate-800">{t.disclaimer.notTitle}</p>
          <ul className="space-y-1.5">
            {t.disclaimer.notList.map((row) => (
              <li key={row.k} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
                <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" aria-hidden />
                <span className="text-xs leading-relaxed text-slate-700"><span className="font-semibold">{row.k}</span> {row.v}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm font-medium leading-relaxed text-rose-950">
            <PhoneCall className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{t.disclaimer.crisis}</span>
          </p>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
            {t.disclaimer.data}
          </p>
          <p className="text-xs leading-relaxed text-slate-600">{t.disclaimer.use}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
