'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MessageSquareHeart,
  ShieldCheck,
  Swords,
  CircleCheck,
  CircleMinus,
  CircleAlert,
  FlaskConical,
  MessagesSquare,
  Ban,
} from 'lucide-react';
import { SignalFlow, SignalLegend } from './signal-flow';
import { useLang } from '@/components/language-provider';

/**
 * Handleiding / onboarding — three visual steps, minimal prose, NL/EN:
 *  1. What kind of demo is this?      (let the flow speak)
 *  2. How do you read the signals?    (let the colours + badges speak)
 *  3. When what — and when not?       (let the choices speak)
 * Shown automatically on first visit (localStorage flag) and re-openable
 * via the header help button and the dashboard.
 */
export function ManualDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useLang();
  const [step, setStep] = useState(0);

  const close = () => {
    setStep(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : close())}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
            {step === 0 && t.manual.step1Title}
            {step === 1 && t.manual.step2Title}
            {step === 2 && t.manual.step3Title}
            <Badge className="border-amber-300 bg-amber-50 text-[10px] text-amber-800 hover:bg-amber-50" variant="outline">
              {t.dashboard.heroBadge}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {step === 0 && t.manual.step1Sub}
            {step === 1 && t.manual.step2Sub}
            {step === 2 && t.manual.step3Sub}
          </DialogDescription>
        </DialogHeader>

        {/* ── Stap 1: de flow ── */}
        {step === 0 && (
          <div className="space-y-3">
            <div className="rounded-xl bg-gradient-to-br from-[#0b1238] to-[#0d6ff5] p-3">
              <SignalFlow compact />
            </div>
            <p className="text-sm leading-relaxed text-slate-700">{t.manual.step1Body}</p>
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-blue-800">
              <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {t.manual.step1More}
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <FlaskConical className="h-4 w-4 shrink-0" aria-hidden />
              {t.manual.step1Demo}
            </div>
          </div>
        )}

        {/* ── Stap 2: signalen ── */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <SignalLegend />
            </div>
            <div className="space-y-1.5 text-xs text-slate-700">
              {t.manual.step2Rows.map((row, idx) => {
                const icons = [CircleCheck, CircleCheck, CircleMinus, CircleAlert];
                const iconClasses = ['text-emerald-600', 'text-emerald-600', 'text-amber-600', 'text-rose-600'];
                const Icon = icons[idx] ?? CircleCheck;
                return (
                  <div key={row.badge} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClasses[idx] ?? ''}`} aria-hidden />
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${
                      idx === 0 ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : idx === 1 ? 'border-cyan-300 bg-cyan-50 text-cyan-700'
                      : idx === 2 ? 'border-slate-300 bg-white text-slate-600'
                      : 'border-amber-300 bg-amber-50 text-amber-700'
                    }`}>
                      {row.badge}
                    </Badge>
                    <span className="min-w-0 flex-1 leading-snug">{row.text}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs leading-relaxed text-slate-500">{t.manual.step2Footer}</p>
          </div>
        )}

        {/* ── Stap 3: wanneer wat ── */}
        {step === 2 && (
          <div className="space-y-2">
            {t.manual.step3Cards.map((d, idx) => {
              const icons = [MessageSquareHeart, ShieldCheck, Swords];
              const accents = ['bg-[#0b1238]', 'bg-[#0b1238]', 'bg-[#0b1238]'];
              const Icon = icons[idx] ?? MessageSquareHeart;
              return (
                <div key={d.title} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accents[idx] ?? 'bg-emerald-700'} text-white`}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800">{d.title}</p>
                    <p className="mt-0.5 flex items-start gap-1 text-xs leading-snug text-slate-600">
                      <CircleCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
                      {d.when}
                    </p>
                    <p className="mt-0.5 flex items-start gap-1 text-xs leading-snug text-slate-400">
                      <Ban className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      {d.not}
                    </p>
                  </div>
                </div>
              );
            })}
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <MessagesSquare className="h-3.5 w-3.5 shrink-0 text-blue-700" aria-hidden />
              {t.manual.step3Tip}
            </p>
          </div>
        )}

        {/* ── Navigatie ── */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-4 bg-blue-700' : 'w-1.5 bg-slate-300'}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                {t.manual.back}
              </Button>
            )}
            {step < 2 ? (
              <Button size="sm" onClick={() => setStep((s) => s + 1)} className="bg-blue-700 hover:bg-blue-800">
                {t.manual.next}
              </Button>
            ) : (
              <Button size="sm" onClick={close} className="bg-blue-700 hover:bg-blue-800">
                {t.manual.done}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
