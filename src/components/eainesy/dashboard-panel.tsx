'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MessageSquareHeart,
  ShieldCheck,
  Swords,
  Network,
  ClipboardCheck,
  ScrollText,
  BookOpen,
  CircleCheck,
  CircleAlert,
  FlaskConical,
  SlidersHorizontal,
  HeartPulse,
  ChevronRight,
  ListChecks,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SignalFlow } from './signal-flow';
import { InfoTip } from './info-tip';
import { EainesyMark } from './logo';
import { useLang } from '@/components/language-provider';
import { useTurnRefresh } from '@/hooks/use-turn-refresh';
import { fmtNum, fmtTime } from '@/lib/i18n';

interface ModelCheckLite {
  pass: boolean;
  statesChecked: number;
  invariantsChecked: number;
  ms: number;
}

interface Stats {
  modelCheck: ModelCheckLite | null;
  ledgerTotal: number | null;
  ledgerOk: boolean | null;
  checkedAt: string | null;
  policyRules: number | null;
  reviewPending: number | null;
  kgNodes: number | null;
  kgEdges: number | null;
  evalPassed: number | null;
  evalTotal: number | null;
  recent: { seq: number; stage: string; createdAt: string; turnId: string }[] | null;
}

/** Haalt alle live-KPI's op in één keer — module-scope, geen state. */
async function fetchDashboardStats(): Promise<Stats> {
  const [v, l, h, k, e] = await Promise.allSettled([
    fetch('/api/verify').then((r) => r.json()),
    fetch('/api/ledger?verify=1').then((r) => r.json()),
    fetch('/api/hitl').then((r) => r.json()),
    fetch('/api/kg').then((r) => r.json()),
    fetch('/api/eval').then((r) => r.json()),
  ]);
  return {
    modelCheck: v.status === 'fulfilled' ? (v.value?.modelCheck ?? null) : null,
    policyRules: v.status === 'fulfilled' ? (Array.isArray(v.value?.policy?.rules) ? v.value.policy.rules.length : null) : null,
    ledgerTotal: l.status === 'fulfilled' ? (l.value?.total ?? null) : null,
    ledgerOk: l.status === 'fulfilled' ? (l.value?.verification?.ok ?? null) : null,
    checkedAt: l.status === 'fulfilled' ? (l.value?.verification?.checkedAt ?? null) : null,
    recent:
      l.status === 'fulfilled' && Array.isArray(l.value?.entries)
        ? l.value.entries.slice(0, 5).map((e: { seq: number; stage: string; createdAt: string; turnId: string }) => ({
            seq: e.seq,
            stage: e.stage,
            createdAt: e.createdAt,
            turnId: e.turnId,
          }))
        : null,
    reviewPending: h.status === 'fulfilled' ? (Array.isArray(h.value?.pending) ? h.value.pending.length : null) : null,
    kgNodes: k.status === 'fulfilled' ? (k.value?.counts?.nodes ?? null) : null,
    kgEdges: k.status === 'fulfilled' ? (k.value?.counts?.edges ?? null) : null,
    evalPassed: e.status === 'fulfilled' ? (e.value?.runs?.[0]?.passed ?? null) : null,
    evalTotal: e.status === 'fulfilled' ? (e.value?.runs?.[0]?.total ?? null) : null,
  };
}

export function DashboardPanel({ onNavigate, onOpenManual }: { onNavigate: (id: string) => void; onOpenManual: () => void }) {
  const { t, lang } = useLang();
  const [stats, setStats] = useState<Stats | null>(null);
  // Pas zodra de eerste fetch is afgerond mogen lege KPI's "niet beschikbaar"
  // tonen; daarvoor zijn het eerlijk ladende skeletons (geen blijvende leugen).
  const [loaded, setLoaded] = useState(false);

  // Laadt + herdlaadt de KPI's; aangeroepen bij mount en na elke chatbeurt.
  const load = useCallback(async () => {
    setStats(await fetchDashboardStats());
    setLoaded(true);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const s = await fetchDashboardStats();
      if (alive) {
        setStats(s);
        setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  // Live: na elke chatbeurt verversen de KPI's, gezondheid en activiteit zichzelf.
  useTurnRefresh(load);

  // Panelen-directory — zelfde groepsindeling als de navigatie (page.tsx):
  // één informatiemodel dat overal terugkomt (sidebar, mobiel menu, dashboard).
  type PanelDef = { id: string; label: string; description: string; when: string; icon: typeof MessageSquareHeart };
  const PANELS: Record<string, PanelDef> = {
    chat: { id: 'chat', label: t.nav.chat, description: t.dashboard.panels.chatDesc, when: t.dashboard.panels.chatWhen, icon: MessageSquareHeart },
    verify: { id: 'verify', label: t.nav.verify, description: t.dashboard.panels.verifyDesc, when: t.dashboard.panels.verifyWhen, icon: ShieldCheck },
    eval: { id: 'eval', label: t.nav.eval, description: t.dashboard.panels.evalDesc, when: t.dashboard.panels.evalWhen, icon: Swords },
    kg: { id: 'kg', label: t.nav.kg, description: t.dashboard.panels.kgDesc, when: t.dashboard.panels.kgWhen, icon: Network },
    hitl: { id: 'hitl', label: t.nav.hitl, description: t.dashboard.panels.hitlDesc, when: t.dashboard.panels.hitlWhen, icon: ClipboardCheck },
    ledger: { id: 'ledger', label: t.nav.ledger, description: t.dashboard.panels.ledgerDesc, when: t.dashboard.panels.ledgerWhen, icon: ScrollText },
    about: { id: 'about', label: t.nav.about, description: t.dashboard.panels.aboutDesc, when: t.dashboard.panels.aboutWhen, icon: FlaskConical },
    steer: { id: 'steer', label: t.nav.steer, description: t.dashboard.panels.steerDesc, when: t.dashboard.panels.steerWhen, icon: SlidersHorizontal },
  };

  const PANEL_GROUPS: { label: string; ids: string[] }[] = [
    { label: t.nav.groupUse, ids: ['chat', 'steer'] },
    { label: t.nav.groupResearch, ids: ['verify', 'eval', 'hitl', 'kg', 'ledger'] },
    { label: t.nav.groupMeta, ids: ['about'] },
  ];

  const stageLabel = (stage: string) => (t.ledgerStages as Record<string, string>)[stage] ?? stage;

  return (
    <div className="space-y-5">
      {/* Hero — de EAI-identiteit: navy → merkblauw, met de mark als stille watermerk */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b1238] via-[#152b70] to-[#0d6ff5] p-5 text-white shadow-sm md:p-7">
        <EainesyMark className="pointer-events-none absolute -right-6 -top-8 h-44 w-44 opacity-15 md:-right-4 md:top-1/2 md:h-56 md:w-56 md:-translate-y-1/2" />
        <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-white/30 bg-white/10 text-[10px] text-white hover:bg-white/10" variant="outline">
            <FlaskConical className="mr-1 h-3 w-3" aria-hidden />
            {t.dashboard.heroBadge}
          </Badge>
          <Badge className="border-white/30 bg-white/10 text-[10px] text-white hover:bg-white/10" variant="outline">
            {t.dashboard.heroBadge2}
          </Badge>
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight md:text-2xl">{t.dashboard.heroTitle}</h2>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-blue-50/90">{t.dashboard.heroSub}</p>
        <SignalFlow />
        <div className="mt-4 flex flex-wrap gap-2">
          {/* De drie routes uit "waar start ik?" — nu direct als CTA in de hero */}
          <Button onClick={() => onNavigate('chat')} className="bg-white text-[#0b1238] hover:bg-blue-50">
            <MessageSquareHeart className="h-4 w-4" aria-hidden />
            {t.dashboard.ctaChat}
          </Button>
          <Button onClick={() => onNavigate('verify')} variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {t.dashboard.ctaVerify}
          </Button>
          <Button onClick={() => onNavigate('eval')} variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
            <Swords className="h-4 w-4" aria-hidden />
            {t.dashboard.ctaEval}
          </Button>
          <Button onClick={onOpenManual} variant="ghost" className="text-blue-100 hover:bg-white/10 hover:text-white">
            <BookOpen className="h-4 w-4" aria-hidden />
            {t.dashboard.ctaManual}
          </Button>
        </div>
        </div>
      </section>

      {/* Systeemgezondheid — één kaart, één rij per verdedigingslinie; elke rij
          is een doorklik naar het paneel dat erachter zit. Vervangt de oude
          live-status-tegels, de red-team-banner en de losse gezondheidskaart. */}
      <section>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <HeartPulse className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              {t.dashboard.healthTitle}
              <InfoTip term={t.dashboard.healthTitle}>{t.dashboard.healthTip}</InfoTip>
              {stats?.checkedAt && (
                <span className="ml-auto font-normal normal-case tracking-normal text-slate-400">
                  {t.common.checkedAt} {fmtTime(stats.checkedAt, lang)}
                </span>
              )}
            </h3>
            <ul className="mt-2">
              <StatusRow
                icon={ShieldCheck}
                label={t.dashboard.healthModelCheck}
                tip={t.dashboard.modelCheckTip}
                ok={stats?.modelCheck ? stats.modelCheck.pass : null}
                loaded={loaded}
                unavailableLabel={t.dashboard.statusUnavailable}
                value={
                  stats?.modelCheck
                    ? `${stats.modelCheck.pass ? t.common.pass : t.common.fail} · ${fmtNum(stats.modelCheck.statesChecked, lang)} × ${stats.modelCheck.invariantsChecked} ${t.common.invariantsUnit} · ${stats.modelCheck.ms.toFixed(1)} ${t.common.ms}`
                    : null
                }
                onClick={() => onNavigate('verify')}
                navLabel={t.dashboard.statusRowAria.replace('{panel}', t.dashboard.healthModelCheck)}
              />
              <StatusRow
                icon={ListChecks}
                label={t.dashboard.healthOutputPolicy}
                ok={stats?.policyRules ? true : null}
                loaded={loaded}
                unavailableLabel={t.dashboard.statusUnavailable}
                value={stats?.policyRules ? `${stats.policyRules} ${t.dashboard.healthPolicyRules}` : null}
                onClick={() => onNavigate('verify')}
                navLabel={t.dashboard.statusRowAria.replace('{panel}', t.dashboard.healthOutputPolicy)}
              />
              <StatusRow
                icon={ScrollText}
                label={t.dashboard.healthLedger}
                tip={t.dashboard.hashTip}
                ok={stats?.ledgerOk ?? null}
                loaded={loaded}
                unavailableLabel={t.dashboard.statusUnavailable}
                value={
                  stats?.ledgerTotal !== null && stats?.ledgerTotal !== undefined
                    ? `${fmtNum(stats.ledgerTotal, lang)} ${t.dashboard.healthEntries} · ${stats.ledgerOk === true ? t.dashboard.chainOk : stats.ledgerOk === false ? t.dashboard.chainBroken : t.dashboard.chainPending}`
                    : null
                }
                onClick={() => onNavigate('ledger')}
                navLabel={t.dashboard.statusRowAria.replace('{panel}', t.dashboard.healthLedger)}
              />
              <StatusRow
                icon={Swords}
                label={t.dashboard.healthRedteam}
                ok={stats?.evalTotal ? stats.evalPassed === stats.evalTotal : null}
                loaded={loaded}
                unavailableLabel={t.dashboard.statusUnavailable}
                value={stats?.evalTotal ? `${stats.evalPassed}/${stats.evalTotal} ${t.dashboard.healthProbes}` : null}
                onClick={() => onNavigate('eval')}
                navLabel={t.dashboard.statusRowAria.replace('{panel}', t.dashboard.healthRedteam)}
              />
              <StatusRow
                icon={ClipboardCheck}
                label={t.dashboard.reviewQueue}
                tip={t.dashboard.hitlTip}
                ok={null}
                loaded={loaded}
                unavailableLabel={t.dashboard.statusUnavailable}
                value={stats?.reviewPending !== null && stats?.reviewPending !== undefined ? `${stats.reviewPending} ${t.dashboard.healthReviewCount}` : null}
                onClick={() => onNavigate('hitl')}
                navLabel={t.dashboard.statusRowAria.replace('{panel}', t.dashboard.reviewQueue)}
              />
              <StatusRow
                icon={Network}
                label={t.dashboard.healthKg}
                tip={t.dashboard.kgTip}
                ok={stats?.kgNodes ? true : null}
                loaded={loaded}
                unavailableLabel={t.dashboard.statusUnavailable}
                value={stats?.kgNodes ? `${stats.kgNodes} ${t.dashboard.healthKgValue.replace('·', `· ${stats.kgEdges ?? '—'}`)}` : null}
                onClick={() => onNavigate('kg')}
                navLabel={t.dashboard.statusRowAria.replace('{panel}', t.dashboard.healthKg)}
              />
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Verder verkennen: directory (compacte rijen, zelfde groepen als de
          sidebar) naast de live activiteit — twee kolommen, geen tegelvloer. */}
      <section className="grid items-start gap-3 lg:grid-cols-[1.5fr_1fr] lg:gap-4">
        {/* Directory */}
        <div>
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.dashboard.panelsTitle}</h3>
          <Card className="border-slate-200">
            <CardContent className="p-2">
              {PANEL_GROUPS.map((g, gi) => (
                <div key={g.label} className={gi > 0 ? 'mt-1 border-t border-slate-100 pt-2' : ''}>
                  <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{g.label}</p>
                  {g.ids.map((id) => {
                    const p = PANELS[id];
                    if (!p) return null;
                    return (
                      <button
                        key={p.id}
                        onClick={() => onNavigate(p.id)}
                        className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50"
                        aria-label={`Open ${p.label}`}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 transition-colors group-hover:bg-[#0b1238] group-hover:text-white">
                          <p.icon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold leading-snug text-slate-800">{p.label}</span>
                          <span className="block truncate text-[11px] text-slate-500">{p.description}</span>
                        </span>
                        <span className="hidden shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] leading-4 text-blue-800 xl:inline-flex">
                          {t.dashboard.whenChip} {p.when}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-blue-700" aria-hidden />
                      </button>
                    );
                  })}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Activity feed */}
        <div>
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.dashboard.activityTitle}</h3>
          <Card className="border-slate-200">
            <CardContent className="p-4">
              {stats?.recent && stats.recent.length > 0 ? (
                <ul className="space-y-1">
                  {stats.recent.map((e) => (
                    <li key={e.seq} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-[13px] hover:bg-slate-50">
                      <span className="w-10 shrink-0 text-[10px] tabular-nums text-slate-400">#{e.seq}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-700">{stageLabel(e.stage)}</span>
                      <span className="shrink-0 text-[10px] tabular-nums text-slate-400">{fmtTime(e.createdAt, lang)}</span>
                    </li>
                  ))}
                </ul>
              ) : loaded ? (
                <p className="py-2 text-[11px] text-slate-400">{t.dashboard.statusUnavailable}</p>
              ) : (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-3/4" />
                </div>
              )}
              <button
                onClick={() => onNavigate('ledger')}
                className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800"
              >
                {t.dashboard.viewLedger}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </CardContent>
          </Card>
        </div>
      </section>

      <p className="text-center text-[11px] text-slate-400">{t.dashboard.footer}</p>
    </div>
  );
}

/**
 * Eén rij in de statuskaart: statuspunt + icoon + label (+ uitleg) + waarde.
 * Status is nooit kleur-alleen: groene/rode stip mét vink-/waarschuwingsicoon.
 * Met onClick is de rij een doorklik naar het bijbehorende paneel — de InfoTip
 * erin stopt de propagering (popover-trigger mag de navigatie niet fires).
 */
function StatusRow({
  icon: Icon,
  label,
  tip,
  ok,
  value,
  loaded,
  unavailableLabel,
  onClick,
  navLabel,
}: {
  icon?: LucideIcon;
  label: string;
  tip?: string;
  ok: boolean | null;
  value: string | null;
  loaded: boolean;
  unavailableLabel: string;
  onClick?: () => void;
  navLabel?: string;
}) {
  const dotClass =
    ok === true ? 'bg-emerald-500' : ok === false ? 'bg-rose-500' : 'bg-slate-300';
  const inner = (
    <>
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />}
      <span className="shrink-0 text-[13px] font-medium text-slate-700">{label}</span>
      {tip && (
        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <InfoTip term={label}>{tip}</InfoTip>
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-right text-xs text-slate-500">
        {value ?? (loaded ? <span className="italic text-slate-400">{unavailableLabel}</span> : <Skeleton className="ml-auto h-3.5 w-24" />)}
      </span>
      {ok === true && <CircleCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />}
      {ok === false && <CircleAlert className="h-3.5 w-3.5 shrink-0 text-rose-600" aria-hidden />}
      {onClick && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />}
    </>
  );
  if (!onClick) {
    return (
      <li className="flex items-center gap-2 py-2">{inner}</li>
    );
  }
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        aria-label={navLabel ?? label}
        className="-mx-1.5 flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-2 transition-colors hover:bg-slate-50"
      >
        {inner}
      </div>
    </li>
  );
}
