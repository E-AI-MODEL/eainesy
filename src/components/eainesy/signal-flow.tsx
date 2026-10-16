'use client';

import { Sparkles, Shapes, BadgeCheck, ArrowRight } from 'lucide-react';
import { InfoTip } from './info-tip';
import { useLang } from '@/components/language-provider';

/**
 * SignalFlow — the core idea of the demo in one glance:
 * neural language model → verified symbolic core → stamped answer.
 * Purely visual; answers "what am I looking at?" without prose.
 */
export function SignalFlow({ compact = false }: { compact?: boolean }) {
  const { t } = useLang();
  const cards = [
    {
      icon: Sparkles,
      label: t.signal.flow1Label,
      sub: t.signal.flow1Sub,
      classes: 'border-violet-300/40 bg-violet-400/10 text-violet-100',
      iconClass: 'text-violet-200',
      term: t.signal.flow1Term,
      body: t.signal.flow1Body,
    },
    {
      icon: Shapes,
      label: t.signal.flow2Label,
      sub: t.signal.flow2Sub,
      classes: 'border-blue-300/40 bg-blue-400/10 text-blue-50',
      iconClass: 'text-blue-200',
      term: t.signal.flow2Term,
      body: t.signal.flow2Body,
    },
    {
      icon: BadgeCheck,
      label: t.signal.flow3Label,
      sub: t.signal.flow3Sub,
      classes: 'border-cyan-300/40 bg-cyan-400/10 text-cyan-50',
      iconClass: 'text-cyan-200',
      term: t.signal.flow3Term,
      body: t.signal.flow3Body,
    },
  ];
  return (
    <div className={`flex items-stretch gap-1.5 ${compact ? '' : 'mt-4'}`}>
      {cards.map((c, i) => (
        <div key={c.label} className="flex min-w-0 flex-1 items-center gap-1.5">
          <div className={`min-w-0 flex-1 rounded-xl border px-2 py-2 ${c.classes}`}>
            <c.icon className={`h-4 w-4 ${c.iconClass}`} aria-hidden />
            <p className="mt-1 text-[11px] font-semibold leading-tight">{c.label}</p>
            <p className="flex items-center gap-1 truncate text-[9px] leading-tight opacity-80">
              {c.sub}
              <InfoTip term={c.term}>{c.body}</InfoTip>
            </p>
          </div>
          {i < cards.length - 1 && (
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/50" aria-hidden />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * SignalLegend — what the three traffic-light colours mean everywhere in the app.
 */
export function SignalLegend() {
  const { t } = useLang();
  const legend = [
    { dot: 'bg-emerald-500', label: t.signal.legendOk },
    { dot: 'bg-amber-500', label: t.signal.legendWarn },
    { dot: 'bg-rose-500', label: t.signal.legendFail },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
      <span className="font-medium text-slate-600">{t.signal.legendTitle}</span>
      {legend.map((l) => (
        <span key={l.dot} className="flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${l.dot}`} aria-hidden />
          {l.label}
        </span>
      ))}
    </div>
  );
}
