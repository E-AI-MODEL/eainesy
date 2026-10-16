'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Table2, GitBranch, Scale, MessagesSquare, BookOpen } from 'lucide-react';
import { useLang } from '@/components/language-provider';
import { useTurnRefresh } from '@/hooks/use-turn-refresh';
import { fmtNum, fmtTime } from '@/lib/i18n';

interface InvariantResult {
  id: string;
  descNl: string;
  descEn: string;
  formula: string;
  statesChecked: number;
  violations: number;
  pass: boolean;
  firstViolation?: { input: unknown; action: string };
}

interface ModelCheck {
  pass: boolean;
  statesChecked: number;
  invariantsChecked: number;
  invariants: InvariantResult[];
  ruleCount: number;
  latticeShape: string;
  ms: number;
  checkedAt: string;
  conversationRuleCount?: number;
  conversationLatticeShape?: string;
  layers?: { base: { statesChecked: number; invariantsChecked: number; pass: boolean }; conversation: { statesChecked: number; invariantsChecked: number; pass: boolean } };
  conversationRulesNeverFired?: string[];
  rulesetHash?: string;
}

interface CoreSummary {
  id: string;
  version: string;
  instrumentStatus: string;
  notEstablished: string[];
  systemProfile: Record<string, unknown>;
  sources: { id: string; citation: string; url: string | null }[];
  claims: { id: string; statement: string; strength: string; supports: string[]; relation: string; status: string; backlogReason: string | null; implementedBy: string[] }[];
}

interface FamilyMeta {
  id: string;
  name: { nl: string; en: string };
  anchor: { nl: string; en: string };
}

interface Policy {
  rules: { id: string; family: string; action: string; hitl: boolean; tone: string; maxSentences: number; desc: { nl: string; en: string }; description: string }[];
  families: FamilyMeta[];
  riskThresholds: { CRISIS: number; HIGH: number; ELEVATED: number };
  confidenceBands: { HIGH: number; MEDIUM: number };
  conformal: { epsilon: number; calibrationSize: number };
  fusion: string;
  outputPolicyRules: number;
  latticeStates: number;
  chainRules: { id: string; desc: { nl: string; en: string }; derived: string }[];
  conversationRules?: { id: string; desc: { nl: string; en: string } }[];
}

type VerifyTab = 'check' | 'rules' | 'params' | 'sources';

export function VerifyPanel() {
  const { t, lang } = useLang();
  const [modelCheck, setModelCheck] = useState<ModelCheck | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [core, setCore] = useState<CoreSummary | null>(null);
  const [tab, setTab] = useState<VerifyTab>('check');

  // Laadt + herlaadt het bewijsverslag; aangeroepen bij mount en na elke chatbeurt.
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/verify');
      const data = await res.json();
      setModelCheck(data.modelCheck);
      setPolicy(data.policy);
      setCore(data.core ?? null);
    } catch {
      // bij een mislukte refresh blijft de vorige (consistente) rapportage staan
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch('/api/verify');
        const data = await res.json();
        if (alive) {
          setModelCheck(data.modelCheck);
          setPolicy(data.policy);
          setCore(data.core ?? null);
        }
      } catch {
        // bij een mislukte eerste load blijven de skeletons staan
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  // Live: na elke chatbeurt ververst het bewijs zichzelf — geen knop nodig.
  useTurnRefresh(load);

  const TABS: { id: VerifyTab; label: string }[] = [
    { id: 'check', label: t.verify.tabCheck },
    { id: 'rules', label: t.verify.tabRules },
    { id: 'params', label: t.verify.tabParams },
    { id: 'sources', label: t.verify.tabSources },
  ];

  return (
    <div className="space-y-4">
      {/* Epistemiek-banner: de grens van het bewijs hoort bij het bewijs */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
          <Scale className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t.verify.epistemicsTitle}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-amber-900/90">{t.verify.epistemicsBody}</p>
      </div>

      {/* Bewijs-samenvatting: oordeel + kerncijfers, altijd zichtbaar boven de tabs */}
      {modelCheck && (
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-700" aria-hidden />
              {t.verify.title}
            </p>
            {modelCheck.checkedAt && (
              <span className="text-[10px] tabular-nums text-slate-400">{t.common.checkedAt} {fmtTime(modelCheck.checkedAt, lang)}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={t.verify.statVerdict} value={modelCheck.pass ? t.common.pass : t.common.fail} tone={modelCheck.pass ? 'ok' : 'bad'} />
            <Stat label={t.verify.statStates} value={fmtNum(modelCheck.statesChecked, lang)} />
            <Stat label={t.verify.statInvariants} value={String(modelCheck.invariantsChecked)} />
            <Stat label={t.verify.statTime} value={`${modelCheck.ms.toFixed(1)} ${t.common.ms}`} />
          </div>
        </div>
      )}

      {/* Gesegmenteerde tabs — de vlakverdeling van het bewijs (check / regels / parameters) */}
      <div
        role="tablist"
        aria-label={t.verify.tabsAria}
        className="inline-flex max-w-full flex-wrap rounded-lg border border-slate-200 bg-slate-100 p-0.5"
      >
        {TABS.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={tab === tb.id}
            onClick={() => setTab(tb.id)}
            className={`rounded-[7px] px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === tb.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── Tab: model check ──────────────────────────────── */}
      {tab === 'check' && (
        <div role="tabpanel" aria-label={t.verify.tabCheck}>
          <Card className="border-slate-200">
            <CardContent className="pt-4">
              {modelCheck ? (
                <>
                  <p className="mb-1 text-xs leading-relaxed text-slate-500">
                    {modelCheck.latticeShape} · {modelCheck.ruleCount} {lang === 'nl' ? 'geordende beslisregels' : 'ordered decision rules'} · {t.verify.latticeLine}
                  </p>
                  {modelCheck.layers && (
                    <p className="mb-1 text-xs leading-relaxed text-slate-500">
                      {t.verify.convLayerLine}: {fmtNum(modelCheck.layers.conversation.statesChecked, lang)} {t.common.statesShort} × {modelCheck.layers.conversation.invariantsChecked} · {modelCheck.conversationRuleCount} {t.verify.convRulesShort} · {modelCheck.conversationLatticeShape}
                    </p>
                  )}
                  {modelCheck.rulesetHash && (
                    <p className="mb-3 font-mono text-[10px] text-slate-400">{t.verify.hashLabel} {modelCheck.rulesetHash.slice(0, 16)}… · {t.verify.neverFired}: {(modelCheck.conversationRulesNeverFired ?? []).join(', ') || '—'}</p>
                  )}
                  <ul className="space-y-2">
                    {modelCheck.invariants.map((inv) => (
                      <li key={inv.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${inv.pass ? 'text-emerald-700 border-emerald-300' : 'text-rose-700 border-rose-300'}`}>
                            {inv.pass ? t.common.pass : t.common.fail}
                          </Badge>
                          <span className="text-xs font-semibold">{inv.id}</span>
                          <span className="ml-auto text-[10px] text-slate-400">
                            {fmtNum(inv.statesChecked, lang)} {t.common.statesShort} · {inv.violations} {t.common.violationsShort}
                          </span>
                        </div>
                        {/* Plain language first — the guarantee, in the reader's language */}
                        <p className="mt-1 text-xs font-medium leading-relaxed text-slate-800">
                          {lang === 'nl' ? inv.descNl : inv.descEn}
                        </p>
                        {/* Technical formula, collapsible */}
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[10px] text-slate-400 hover:text-slate-600">{t.verify.technical}</summary>
                          <p className="mt-1 rounded bg-slate-50 px-2 py-1.5 font-mono text-[10px] leading-snug text-slate-600">{inv.formula}</p>
                        </details>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-slate-400">{t.common.loading}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: beslisregels ─────────────────────────────── */}
      {tab === 'rules' && (
        <div role="tabpanel" aria-label={t.verify.tabRules}>
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Table2 className="h-4 w-4 text-blue-700" aria-hidden />{t.verify.policyTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {policy && (
                <p className="mb-3 text-[11px] leading-relaxed text-slate-500">{t.verify.policyFamilies}</p>
              )}
              {/* Families with their scientific anchors — grouped, not a flat list */}
              {policy ? (
                <div className="space-y-4">
                  {policy.families.map((fam) => {
                    const famRules = policy.rules.filter((r) => r.family === fam.id);
                    return (
                      <div key={fam.id}>
                        <div className="mb-1 flex items-baseline gap-2">
                          <Badge variant="outline" className="shrink-0 border-blue-300 text-[10px] font-mono text-blue-800">{fam.id}</Badge>
                          <h4 className="text-xs font-semibold text-slate-800">{lang === 'nl' ? fam.name.nl : fam.name.en}</h4>
                          <span className="ml-auto text-[10px] text-slate-400">{famRules.length} {lang === 'nl' ? 'regels' : 'rules'}</span>
                        </div>
                        <p className="mb-1.5 pl-1 text-[10px] italic leading-snug text-slate-400">{lang === 'nl' ? fam.anchor.nl : fam.anchor.en}</p>
                        <ul className="space-y-1.5">
                          {famRules.map((r) => (
                            <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-[10px] font-mono">{r.id}</Badge>
                                <Badge variant="outline" className="bg-slate-50 text-[10px]">{r.action}</Badge>
                                {r.hitl && <Badge variant="outline" className="border-orange-300 text-[10px] text-orange-700">{t.verify.hitlBadge}</Badge>}
                                <span className="ml-auto text-[10px] text-slate-400">
                                  {t.common.toneLabel} {r.tone} · ≤{r.maxSentences} {t.common.sentencesLabel}
                                </span>
                              </div>
                              {/* Plain language first */}
                              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-800">{lang === 'nl' ? r.desc.nl : r.desc.en}</p>
                              <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{r.description}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400">{t.common.loading}</p>
              )}
              {policy && (
                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-600 sm:grid-cols-3">
                  <div className="rounded border border-slate-200 p-2">{t.verify.thresholdRisk} ≥ {policy.riskThresholds.ELEVATED} / {policy.riskThresholds.HIGH} / {policy.riskThresholds.CRISIS}</div>
                  <div className="rounded border border-slate-200 p-2">{t.verify.thresholdBands} ≥ {policy.confidenceBands.MEDIUM} / {policy.confidenceBands.HIGH}</div>
                  <div className="rounded border border-slate-200 p-2">{t.verify.thresholdConformal} ε={policy.conformal.epsilon}, n={policy.conformal.calibrationSize}</div>
                </div>
              )}
            </CardContent>
          </Card>
          {policy?.conversationRules && (
            <Card className="mt-4 border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><MessagesSquare className="h-4 w-4 text-indigo-700" aria-hidden />{t.verify.convRulesTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-[11px] leading-relaxed text-slate-500">{t.verify.convRulesSub}</p>
                <ul className="space-y-1.5">
                  {policy.conversationRules.map((r) => (
                    <li key={r.id} className="flex gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                      <Badge variant="outline" className="shrink-0 font-mono text-[10px]">{r.id}</Badge>
                      <span className="min-w-0 font-medium leading-relaxed text-slate-800">{lang === 'nl' ? r.desc.nl : r.desc.en}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Tab: bronnen → claims → regels ─────────────────── */}
      {tab === 'sources' && (
        <div role="tabpanel" aria-label={t.verify.tabSources}>
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4 text-amber-700" aria-hidden />{t.verify.sourcesTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {core ? (
                <>
                  <p className="mb-3 text-[11px] leading-relaxed text-slate-500">{t.verify.sourcesSub} ({core.id} {core.version} · {core.instrumentStatus})</p>
                  <ul className="space-y-2">
                    {core.claims.map((c) => (
                      <li key={c.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="font-mono text-[10px]">{c.id}</Badge>
                          <Badge variant="outline" className="text-[10px]">{t.verify.strength} {c.strength}</Badge>
                          <Badge variant="outline" className={`text-[10px] ${c.status === 'backlog' ? 'border-amber-300 text-amber-700' : 'border-emerald-300 text-emerald-700'}`}>{c.status === 'backlog' ? t.verify.backlog : t.verify.implemented}</Badge>
                        </div>
                        <p className="mt-1 text-xs font-medium leading-relaxed text-slate-800">{c.statement}</p>
                        <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
                          {t.verify.claimSources}: {c.supports.map((sid) => shortCitation(core.sources.find((s) => s.id === sid)?.citation, sid)).join(' · ')}
                        </p>
                        {c.status === 'backlog' ? (
                          <p className="mt-0.5 text-[10px] italic leading-snug text-amber-700">{c.backlogReason}</p>
                        ) : (
                          <p className="mt-0.5 font-mono text-[10px] leading-snug text-slate-400">{t.verify.claimImpl}: {c.implementedBy.join(', ')}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{t.verify.notEstablished}: {core.notEstablished.join(' · ')}</p>
                </>
              ) : (
                <p className="text-sm text-slate-400">{t.common.loading}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: parameters & keten ───────────────────────── */}
      {tab === 'params' && (
        <div role="tabpanel" aria-label={t.verify.tabParams}>
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><GitBranch className="h-4 w-4 text-teal-700" aria-hidden />{t.verify.chainTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {policy ? (
                <>
                  <p className="mb-2 text-[11px] text-slate-500">{t.verify.chainSub}</p>
                  <ul className="space-y-1.5">
                    {policy.chainRules.map((c) => (
                      <li key={c.id} className="text-xs text-slate-600 flex gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono shrink-0">{c.id}</Badge>
                        <span className="min-w-0">{lang === 'nl' ? c.desc.nl : c.desc.en}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{t.verify.fusionLine}</p>
                </>
              ) : (
                <p className="text-sm text-slate-400">{t.common.loading}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/** "Hill, C. E. (2020). Helping Skills…" → "Hill (2020)"; two authors "A & B (year)"; three+ "A et al. (year)". */
function shortCitation(citation: string | undefined, fallback: string): string {
  if (!citation) return fallback;
  const year = citation.match(/\((\d{4})\)/)?.[1];
  const authors = citation.split('(')[0].trim();
  if (!year) return authors.replace(/,$/, '');
  const names = authors.match(/\b[A-Z][A-Za-zÀ-ÿ'-]{2,}\b(?=,)/g) ?? [authors.split(',')[0].trim()];
  const who = authors.includes('et al.') || names.length > 2 ? `${names[0]} et al.` : names.length === 2 ? `${names[0]} & ${names[1]}` : names[0];
  return `${who} (${year})`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <div className={`text-lg font-semibold ${tone === 'ok' ? 'text-emerald-700' : tone === 'bad' ? 'text-rose-700' : 'text-slate-800'}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}
