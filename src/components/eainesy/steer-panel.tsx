'use client';

/**
 * SteerPanel — "Bijsturen": the user steers the demo (strictness, reply
 * style, reply language) and sees honest limits: the proven rulebase is
 * untouched; steering only moves the caution dial inside proven behaviour.
 * Every steered turn records the setting in its certificate + audit log.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SlidersHorizontal, RotateCcw, ShieldCheck, Info } from 'lucide-react';
import { useLang } from '@/components/language-provider';
import { useSteer } from '@/components/steer-store';
import { DEFAULT_STEER, STEER_EPSILON, type Strictness, type ReplyStyle, type ReplyLang } from '@/lib/eainesy/steer';
import type { Dict } from '@/lib/i18n';

type Opt<T extends string> = { id: T; label: string; desc: string };

function Segmented<T extends string>({
  opts,
  value,
  onChange,
  labelId,
}: {
  opts: Opt<T>[];
  value: T;
  onChange: (v: T) => void;
  labelId: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="grid gap-2 sm:grid-cols-3">
      {opts.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`rounded-xl border p-3 text-left transition-all ${
              on
                ? 'border-blue-600 bg-blue-50 shadow-sm ring-1 ring-blue-600'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <span className={`block text-[13px] font-semibold ${on ? 'text-blue-900' : 'text-slate-800'}`}>{o.label}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{o.desc}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SteerPanel() {
  const { t } = useLang();
  const { steer, setSteer } = useSteer();
  const s = t.steer;

  const strictOpts: Opt<Strictness>[] = (['relaxed', 'standard', 'strict'] as const).map((id) => ({
    id,
    label: s.strictness[id].label,
    desc: s.strictness[id].desc,
  }));
  const styleOpts: Opt<ReplyStyle>[] = (['concise', 'normal', 'elaborate'] as const).map((id) => ({
    id,
    label: s.styles[id].label,
    desc: s.styles[id].desc,
  }));
  const langOpts: Opt<ReplyLang>[] = (['auto', 'nl', 'en'] as const).map((id) => ({
    id,
    label: s.replyLangs[id].label,
    desc: s.replyLangs[id].desc,
  }));

  const isDefault =
    steer.strictness === DEFAULT_STEER.strictness &&
    steer.style === DEFAULT_STEER.style &&
    steer.replyLang === DEFAULT_STEER.replyLang;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b1238] text-white">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
          </span>
          {s.title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{s.sub}</p>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle id="steer-strict" className="text-sm flex items-center gap-2">
            {s.strictnessTitle}
            <Badge variant="outline" className="text-[10px] font-mono text-teal-800">ε = {STEER_EPSILON[steer.strictness].toFixed(2)}</Badge>
          </CardTitle>
          <p className="text-xs leading-relaxed text-slate-500">{s.strictnessDesc}</p>
        </CardHeader>
        <CardContent>
          <Segmented opts={strictOpts} value={steer.strictness} onChange={(v) => setSteer({ ...steer, strictness: v })} labelId="steer-strict" />
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle id="steer-style" className="text-sm">{s.styleTitle}</CardTitle>
          <p className="text-xs leading-relaxed text-slate-500">{s.styleDesc}</p>
        </CardHeader>
        <CardContent>
          <Segmented opts={styleOpts} value={steer.style} onChange={(v) => setSteer({ ...steer, style: v })} labelId="steer-style" />
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle id="steer-lang" className="text-sm">{s.replyLangTitle}</CardTitle>
          <p className="text-xs leading-relaxed text-slate-500">{s.replyLangDesc}</p>
        </CardHeader>
        <CardContent>
          <Segmented opts={langOpts} value={steer.replyLang} onChange={(v) => setSteer({ ...steer, replyLang: v })} labelId="steer-lang" />
        </CardContent>
      </Card>

      <div className="rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-900">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {s.honestyTitle}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-teal-900/90">{s.honestyBody}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 pb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSteer({ ...DEFAULT_STEER })}
          disabled={isDefault}
          className="gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {s.reset}
        </Button>
        {isDefault ? (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <Info className="h-3 w-3" aria-hidden />
            {s.resetDone}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-blue-800">
            <Info className="h-3 w-3" aria-hidden />
            {s.appliesNote}
          </span>
        )}
      </div>
    </div>
  );
}
