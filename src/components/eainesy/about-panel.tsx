'use client';

import { Badge } from '@/components/ui/badge';
import {
  FlaskConical,
  HeartPulse,
  Scale,
  Library,
  ExternalLink,
  CircleCheck,
  Ban,
  Brain,
  Workflow,
  ListChecks,
  ArrowRight,
  DatabaseZap,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EainesyMark } from './logo';
import { useLang } from '@/components/language-provider';
import type { ReactNode } from 'react';

/**
 * Over-paneel — answers the honest questions of this demo:
 *  1. What experiment is this?
 *  2. What is neurosymbolic AI (for zero prior knowledge)?
 *  3. How is it applied here, concretely?
 *  4. Why this domain?
 *  5. What happens to your data (honest data flow)?
 *  6. What is mathematically proven — and what is NOT (the black box)?
 *  7. Which findable sources substantiate what succeeded?
 */

function Section({
  icon: Icon,
  accent,
  title,
  id,
  children,
}: {
  icon: LucideIcon;
  accent: string;
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accent} text-white`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <h3 className="text-base font-semibold tracking-tight text-slate-900">{title}</h3>
      </div>
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  );
}

export function AboutPanel() {
  const { t, lang } = useLang();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b1238] via-[#152b70] to-[#1d4ed8] p-5 text-white md:p-7">
        <EainesyMark className="pointer-events-none absolute -right-6 -top-8 h-40 w-40 opacity-15 md:h-52 md:w-52" />
        <div className="relative flex flex-wrap items-center gap-2">
          <Badge className="border-white/30 bg-white/10 text-[10px] text-white hover:bg-white/10" variant="outline">
            <FlaskConical className="mr-1 h-3 w-3" aria-hidden />
            {t.dashboard.heroBadge}
          </Badge>
          <Badge className="border-white/30 bg-white/10 text-[10px] text-white hover:bg-white/10" variant="outline">
            {t.dashboard.heroBadge2}
          </Badge>
        </div>
        <h2 className="relative mt-3 text-xl font-semibold tracking-tight md:text-2xl">{t.about.title}</h2>
        <p className="relative mt-1.5 max-w-xl text-sm leading-relaxed text-blue-50/90">{t.about.sub}</p>
      </section>

      {/* Sectie-navigatie */}
      <nav
        aria-label={t.about.chipLabel}
        className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-3"
      >
        {([
          { id: 'about-disc', label: t.disclaimer.chip },
          { id: 'about-exp', label: t.about.chips.exp },
          { id: 'about-nesy', label: t.about.chips.nesy },
          { id: 'about-how', label: t.about.chips.how },
          { id: 'about-domain', label: t.about.chips.domain },
          { id: 'about-data', label: t.about.chips.data },
          { id: 'about-eps', label: t.about.chips.eps },
          { id: 'about-refs', label: t.about.chips.refs },
        ]).map((c) => (
          <button
            key={c.id}
            onClick={() =>
              document.getElementById(c.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-blue-400 hover:text-blue-800"
          >
            {c.label}
          </button>
        ))}
      </nav>

      {/* 0 · Disclaimer — lees dit eerst */}
      <Section id="about-disc" icon={TriangleAlert} accent="bg-rose-700" title={t.disclaimer.title}>
        <p className="text-sm leading-relaxed text-slate-700">{t.disclaimer.whatIs}</p>
        <p className="text-xs font-semibold text-slate-800">{t.disclaimer.notTitle}</p>
        <ul className="space-y-1.5">
          {t.disclaimer.notList.map((row) => (
            <li key={row.k} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
              <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" aria-hidden />
              <span className="text-xs leading-relaxed text-slate-700"><span className="font-semibold">{row.k}</span> {row.v}</span>
            </li>
          ))}
        </ul>
        <p className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm font-medium leading-relaxed text-rose-950">
          {t.disclaimer.crisis}
        </p>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
          {t.disclaimer.data}
        </p>
        <p className="text-xs leading-relaxed text-slate-600">{t.disclaimer.use}</p>
      </Section>

      {/* 1 · Het experiment */}
      <Section id="about-exp" icon={FlaskConical} accent="bg-[#0b1238]" title={t.about.expTitle}>
        <p className="text-sm leading-relaxed text-slate-700">{t.about.expP1}</p>
        <p className="text-sm leading-relaxed text-slate-700">{t.about.expP2}</p>
        <p className="text-sm leading-relaxed text-slate-700">{t.about.expP3}</p>
        <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-950">
          {t.about.expLevel}
        </p>
      </Section>

      {/* 2 · Basis: wat is neurosymbolische AI? (nul voorkennis) */}
      <Section id="about-nesy" icon={Brain} accent="bg-amber-700" title={t.about.nesyTitle}>
        <p className="text-sm leading-relaxed text-slate-700">{t.about.nesyIntro}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
              <Brain className="h-3.5 w-3.5" aria-hidden />
              {t.about.nesyNTitle}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-amber-950/90">{t.about.nesyNBody}</p>
            <ul className="mt-2 space-y-1.5">
              {t.about.nesyNPoints.map((p) => (
                <li key={p.k} className="text-xs leading-relaxed text-amber-950/90">
                  <span className="font-semibold">{p.k}:</span> {p.v}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <ListChecks className="h-3.5 w-3.5" aria-hidden />
              {t.about.nesySTitle}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{t.about.nesySBody}</p>
            <ul className="mt-2 space-y-1.5">
              {t.about.nesySPoints.map((p) => (
                <li key={p.k} className="text-xs leading-relaxed text-slate-700">
                  <span className="font-semibold">{p.k}:</span> {p.v}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-950">
          {t.about.nesyTogether}
        </p>
        <p className="rounded-xl border border-amber-300 bg-amber-100/70 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
          {t.about.nesyGrailP}
        </p>
        <p className="text-[11px] leading-relaxed text-slate-500">{t.about.nesyTermP}</p>
      </Section>

      {/* 3 · Toepassing: hoe zit het hier in elkaar? */}
      <Section id="about-how" icon={Workflow} accent="bg-[#0b1238]" title={t.about.howTitle}>
        <p className="text-sm leading-relaxed text-slate-700">{t.about.howIntro}</p>
        <ol className="space-y-2">
          {t.about.howSteps.map((s, i) => (
            <li
              key={s.title}
              className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0b1238] text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-snug text-slate-900">{s.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t.about.howMapTitle}</h4>
          <div className="mt-1.5 grid gap-2 md:grid-cols-2">
            {t.about.howMap.map((m) => (
              <div key={m.k} className="rounded-lg border border-slate-200 bg-white p-2.5">
                <p className="text-xs font-semibold text-slate-900">{m.k}</p>
                <p className="mt-0.5 flex items-start gap-1 text-xs leading-relaxed text-slate-600">
                  <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-blue-600" aria-hidden />
                  {m.v}
                </p>
              </div>
            ))}
          </div>
        </div>
        <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-950">
          {t.about.howOutro}
        </p>
      </Section>

      {/* 4 · Waarom dit domein */}
      <Section id="about-domain" icon={HeartPulse} accent="bg-rose-700" title={t.about.domainTitle}>
        <p className="text-sm leading-relaxed text-slate-700">{t.about.domainP1}</p>
        <ul className="space-y-1.5">
          {t.about.domainList.map((line) => (
            <li key={line} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-xs leading-relaxed text-slate-700">
              <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-slate-700">{t.about.domainP2}</p>
      </Section>

      {/* 5 · Wat er met je woorden gebeurt (eerlijke datastroom) */}
      <Section id="about-data" icon={DatabaseZap} accent="bg-amber-700" title={t.about.dataTitle}>
        <p className="text-sm leading-relaxed text-slate-700">{t.about.dataIntro}</p>
        <div className="space-y-2">
          {t.about.dataRows.map((r) => (
            <div key={r.k} className="rounded-lg border border-slate-200 bg-white p-2.5">
              <p className="text-xs font-semibold text-slate-900">{r.k}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{r.v}</p>
            </div>
          ))}
        </div>
        <p className="rounded-xl border border-amber-300 bg-amber-100/70 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
          {t.about.dataAdvice}
        </p>
      </Section>

      {/* 6 · Epistemiek: bewezen / niet bewezen */}
      <Section id="about-eps" icon={Scale} accent="bg-teal-700" title={t.about.epsTitle}>
        <p className="text-sm leading-relaxed text-slate-700">{t.about.epsIntro}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
            <p className="text-xs font-semibold text-blue-900">{t.about.epsYesTitle}</p>
            <ul className="mt-2 space-y-1.5">
              {t.about.epsYes.map((line) => (
                <li key={line} className="flex items-start gap-1.5 text-xs leading-relaxed text-blue-950/90">
                  <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-800">{t.about.epsNoTitle}</p>
            <ul className="mt-2 space-y-1.5">
              {t.about.epsNo.map((line) => (
                <li key={line} className="flex items-start gap-1.5 text-xs leading-relaxed text-slate-700">
                  <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-xs leading-relaxed text-teal-950">
          {t.about.epsMetaphor}
        </p>
      </Section>

      {/* 7 · Bronnen */}
      <Section id="about-refs" icon={Library} accent="bg-slate-700" title={t.about.refsTitle}>
        <p className="text-sm leading-relaxed text-slate-700">{t.about.refsIntro}</p>
        <div className="space-y-4">
          {t.about.refGroups.map((group) => (
            <div key={group.name}>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{group.name}</h4>
              <ul className="mt-1.5 space-y-1.5">
                {group.items.map((ref) => (
                  <li key={ref.title} className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold leading-snug text-slate-900">
                      {ref.title}
                      {ref.url && (
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[10px] font-normal text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-900"
                        >
                          {lang === 'nl' ? 'bron' : 'source'}
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      )}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{ref.meta}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{ref.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500">{t.about.refNote}</p>
      </Section>

      <p className="text-center text-[11px] text-slate-400">{t.dashboard.footer}</p>
    </div>
  );
}
