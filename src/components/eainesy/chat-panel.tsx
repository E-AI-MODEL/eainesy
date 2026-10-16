'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Send,
  ShieldCheck,
  Sparkles,
  Shapes,
  Clock,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  Workflow,
  ChevronUp,
  ChevronRight,
  HeartPulse,
  Moon,
  CircleHelp,
  Scale,
  PenLine,
  SlidersHorizontal,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { InfoTip } from './info-tip';
import { SignalLegend } from './signal-flow';
import { EainesyMark } from './logo';
import { useLang } from '@/components/language-provider';
import { useSteer } from '@/components/steer-store';
import { dispatchTurnEvent } from '@/hooks/use-turn-refresh';
import { ACTION_LABELS } from '@/lib/eainesy/types';
import { fmtNum } from '@/lib/i18n';

interface TraceStage {
  stage: string;
  label: string;
  labelKey?: string;
  kind: 'neural' | 'symbolic' | 'verify' | 'meta';
  ms: number;
  status: 'ok' | 'degraded' | 'fail';
  summary: string;
  detail?: unknown;
}

/** Automatisch inklapbaar redeneringsspoor: breedtedrempel + bewaarde handmatige keuze. */
const TRACE_DOCK_KEY = 'eainesy.traceDock.v1';
const TRACE_DOCK_WIDE = 1280;

interface Certificate {
  action: string;
  riskLevel: string;
  confidence: number;
  confidenceBand: string;
  rulesFired: { id: string; description: string; descriptionNl?: string; descriptionEn?: string }[];
  kgGroundings: string[];
  modelCheck: { pass: boolean; statesChecked: number; invariantsChecked: number; ms: number };
  z3: { available: boolean; result: string; ms: number; detail: string };
  outputPolicy: { pass: boolean; violations: string[]; repaired: boolean };
  conformal: { pValue: number; epsilon: number; abstained: boolean; n: number };
  fusion: { neuralRisk: string; lexicalRisk: string; fusedRisk: string; rule: string };
  steer?: { strictness: string; style: string; replyLang: string; epsilon: number };
  override?: { from: string; to: string; reason: string };
  unknown?: { reason: string; runtime: string };
  humanConfirmed?: boolean;
  conversation?: { ruleId: string; phase: string; nextPhase: string; strategy: string; riskMemory: string; rupture: string; restricted?: { from: string; to: string } };
  timings: Record<string, number>;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  action?: string;
  confidence?: number;
  certificate?: Certificate;
  trace?: TraceStage[];
  latencyMs?: number;
  failClosed?: boolean;
}

const ACTION_STYLES: Record<string, string> = {
  CRISIS_PROTOCOL: 'bg-rose-100 text-rose-800 border-rose-200',
  SAFETY_RESPONSE: 'bg-amber-100 text-amber-800 border-amber-200',
  REFERRAL: 'bg-orange-100 text-orange-800 border-orange-200',
  THERAPEUTIC_DIALOG: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PSYCHOEDUCATION: 'bg-teal-100 text-teal-800 border-teal-200',
  CLARIFY: 'bg-slate-100 text-slate-700 border-slate-200',
  ABSTAIN_HITL: 'bg-orange-100 text-orange-800 border-orange-200',
  BOUNDARY_REFUSAL: 'bg-zinc-200 text-zinc-800 border-zinc-300',
};

const KIND_META: Record<TraceStage['kind'], { icon: typeof Sparkles; classes: string }> = {
  neural: { icon: Sparkles, classes: 'bg-violet-100 text-violet-800 border-violet-200' },
  symbolic: { icon: Shapes, classes: 'bg-blue-100 text-blue-800 border-blue-200' },
  verify: { icon: ShieldCheck, classes: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  meta: { icon: Clock, classes: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const STATUS_ICON: Record<TraceStage['status'], typeof CircleCheck> = {
  ok: CircleCheck,
  degraded: CircleMinus,
  fail: CircleAlert,
};

const STATUS_COLOR: Record<TraceStage['status'], string> = {
  ok: 'text-emerald-700',
  degraded: 'text-amber-700',
  fail: 'text-rose-700',
};

type TraceFilter = 'all' | TraceStage['kind'];

/* ── Zelf-verklarende samenvatting: wat er net gebeurde, in gewone taal,
      automatisch zichtbaar onder elk antwoord (geen klik nodig) ── */
function TurnSummary({ m }: { m: ChatMessage }) {
  const { t, lang } = useLang();
  const c = m.certificate;
  if (!c || m.failClosed) return null;
  const fill = (tpl: string, vars: Record<string, string>) =>
    tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `"{${k}}"`);
  const risk = (t.chat.riskLabels as Record<string, string>)[c.riskLevel] ?? c.riskLevel;
  const action = ACTION_LABELS[m.action as keyof typeof ACTION_LABELS]?.[lang] ?? m.action;
  const parts: string[] = [
    fill(t.chat.sumBase, { risk, action, conf: String(Math.round((m.confidence ?? 0) * 100)) }),
  ];
  if (c.unknown) parts.push(t.chat.sumUnknown);
  if (c.conversation) {
    const phase = (t.chat.phaseLabels as Record<string, string>)[c.conversation.phase] ?? c.conversation.phase;
    const strategy = (t.chat.strategyLabels as Record<string, string>)[c.conversation.strategy] ?? c.conversation.strategy;
    parts.push(fill(t.chat.sumPhase, { phase, strategy }));
    if (c.conversation.restricted) parts.push(t.chat.sumRestricted);
  }
  if (c.humanConfirmed) parts.push(t.chat.sumLearned);
  if (c.override) parts.push(t.chat.sumOverride);
  if (c.conformal?.abstained) parts.push(t.chat.sumConformal);
  if (c.outputPolicy?.repaired) parts.push(t.chat.sumRepaired);
  if (c.steer && c.steer.strictness !== 'standard') {
    const mode = (t.chat.strictLabels as Record<string, string>)?.[c.steer.strictness] ?? c.steer.strictness;
    parts.push(fill(t.chat.sumSteer, { mode }));
  }
  if (c.modelCheck?.pass && c.z3?.result === 'sat' && c.outputPolicy?.pass && !c.outputPolicy?.repaired) {
    parts.push(t.chat.sumGreen);
  }
  return (
    <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-[11px] leading-snug text-slate-500">
      {parts.join(' ')}
    </p>
  );
}

const FILTERS: TraceFilter[] = ['all', 'neural', 'symbolic', 'verify', 'meta'];

/* ── Visuele fasen-stapper: de reis van een bericht in vijf menselijke fases ── */
const PHASE_OF_STAGE: Record<string, number> = {
  steer: 0, ingest: 0, parse: 0,
  lexical: 1, fusion: 1, ground: 1,
  decide: 2, plan: 2,
  confidence: 3, modelcheck: 3, z3: 3, 'z3-fallback': 3,
  generate: 4, 'output-policy': 4, persist: 4,
};

const PHASE_ICONS: (typeof Sparkles)[] = [Sparkles, Scale, Shapes, ShieldCheck, PenLine];

const PHASE_STATUS_STYLE: Record<TraceStage['status'], string> = {
  ok: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  degraded: 'border-amber-300 bg-amber-50 text-amber-900',
  fail: 'border-rose-300 bg-rose-50 text-rose-900',
};

function PhaseStepper({ trace }: { trace: TraceStage[] }) {
  const { t } = useLang();
  // Aggregeer status per fase: fail wint van degraded wint van ok
  const worst = (a: TraceStage['status'], b: TraceStage['status']): TraceStage['status'] =>
    a === 'fail' || b === 'fail' ? 'fail' : a === 'degraded' || b === 'degraded' ? 'degraded' : 'ok';
  const statuses: (TraceStage['status'] | null)[] = t.chat.phases.map(() => null);
  for (const s of trace) {
    const p = PHASE_OF_STAGE[s.stage];
    if (p === undefined) continue;
    statuses[p] = statuses[p] === null ? s.status : worst(statuses[p] as TraceStage['status'], s.status);
  }
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {t.chat.journeyTitle}
        <InfoTip term={t.chat.journeyTitle}>{t.chat.journeyTip}</InfoTip>
      </p>
      <ol className="flex items-center gap-0.5">
        {t.chat.phases.map((label, i) => {
          const Icon = PHASE_ICONS[i];
          const st = statuses[i];
          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-0.5">
              <span
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 ${
                  st ? PHASE_STATUS_STYLE[st] : 'border-dashed border-slate-200 bg-white text-slate-400'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="w-full truncate text-center text-[9px] font-medium leading-none">{label}</span>
              </span>
              {i < t.chat.phases.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ── Compact, filterable trace list (shared by desktop column + sheet) ── */
function TraceView({ trace, certificate }: { trace: TraceStage[]; certificate?: Certificate }) {
  const { t } = useLang();
  const [filter, setFilter] = useState<TraceFilter>('all');
  const shown = filter === 'all' ? trace : trace.filter((s) => s.kind === filter);

  const stageLabel = (s: TraceStage) => (s.labelKey && (t.trace as Record<string, string>)[s.labelKey]) || s.label;

  return (
    <div>
      {/* Visuele stapper eerst — het verhaal, niet de logregels */}
      <div className="mb-3">
        <PhaseStepper trace={trace} />
      </div>
      <div className="mb-3">
        <SignalLegend />
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label={t.chat.filterGroupAria}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              filter === f
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {(t.chat.filters as Record<string, string>)[f]}
          </button>
        ))}
      </div>

      <ol className="space-y-1.5">
        {shown.map((s, i) => {
          const Kind = KIND_META[s.kind];
          const StatusIcon = STATUS_ICON[s.status];
          return (
            <li key={`${s.stage}-${i}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`h-5 shrink-0 gap-1 px-1.5 text-[10px] ${Kind.classes}`}>
                  <Kind.icon className="h-3 w-3" aria-hidden />
                  {(t.chat.kindNames as Record<string, string>)[s.kind]}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{stageLabel(s)}</span>
                <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${STATUS_COLOR[s.status]}`} aria-hidden />
                <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-slate-400">
                  {s.ms < 1 ? '<1' : Math.round(s.ms)} {t.common.ms}
                </span>
              </div>
              <p className="mt-1 break-words text-xs leading-snug text-slate-600">{s.summary}</p>
              {s.detail !== undefined && s.detail !== null && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-[10px] text-slate-400 hover:text-slate-600">{t.chat.details}</summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-900 p-2 text-[10px] leading-snug text-slate-100 whitespace-pre-wrap">
                    {JSON.stringify(s.detail, null, 1)}
                  </pre>
                </details>
              )}
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="py-6 text-center text-xs text-slate-400">{t.chat.noSteps}</li>
        )}
      </ol>

      {certificate && (
        <details className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800">
            {t.chat.certificateTitle}
            <InfoTip term={t.chat.certificateTitle}>{t.chat.certificateTip}</InfoTip>
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded bg-slate-900 p-3 text-[10px] leading-snug text-slate-100 whitespace-pre-wrap">
            {JSON.stringify(certificate, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

export function ChatPanel({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const { t, lang } = useLang();
  const { steer } = useSteer();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [traceIdx, setTraceIdx] = useState<number | null>(null);
  const [hintIdx, setHintIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Redeneringsspoor: automatisch inklapbaar. Onder 1280px ingeklapt zodat de
  // chat de ruimte krijgt (laptop), daarboven uitgeklapt; een handmatige keuze
  // wordt bewaard en gaat vóór de automaat. Mobiel blijft het de bottom-sheet.
  const [dockOpen, setDockOpen] = useState(true);
  const dockOverride = useRef<boolean | null>(null);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(TRACE_DOCK_KEY);
      if (stored === '1' || stored === '0') dockOverride.current = stored === '1';
    } catch {
      // negeren
    }
    const apply = () => setDockOpen(dockOverride.current ?? window.innerWidth >= TRACE_DOCK_WIDE);
    apply();
    const mq = window.matchMedia(`(min-width: ${TRACE_DOCK_WIDE}px)`);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  const toggleDock = () => {
    const next = !dockOpen;
    dockOverride.current = next;
    setDockOpen(next);
    try {
      window.localStorage.setItem(TRACE_DOCK_KEY, next ? '1' : '0');
    } catch {
      // negeren
    }
  };

  const starters = [
    { cap: t.chat.starter1Cap, desc: t.chat.starter1Desc, example: lang === 'nl' ? 'Hoi! Alles goed? Met mij wel… eigenlijk niet, ik wil niet meer leven.' : "Honestly? Not great. I wouldn't mind if I just didn't wake up tomorrow.", icon: HeartPulse, iconClass: 'bg-rose-100 text-rose-700' },
    { cap: t.chat.starter2Cap, desc: t.chat.starter2Desc, example: lang === 'nl' ? 'Ik lig elke nacht wakker over mijn werk.' : 'My manager keeps pushing deadlines and I lie awake every night.', icon: Moon, iconClass: 'bg-blue-100 text-blue-700' },
    { cap: t.chat.starter3Cap, desc: t.chat.starter3Desc, example: lang === 'nl' ? 'Hoe werkt dit eigenlijk? Ben jij een echte therapeut?' : 'How does this actually work? Are you a real therapist?', icon: CircleHelp, iconClass: 'bg-slate-100 text-slate-600' },
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  // Cycling “thinking” hints while the verified pipeline runs
  const hintCount = t.chat.hints.length;
  useEffect(() => {
    if (!busy) {
      setHintIdx(0);
      return;
    }
    const iv = setInterval(() => setHintIdx((i) => (i + 1) % hintCount), 900);
    return () => clearInterval(iv);
  }, [busy, hintCount]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId ?? undefined, message: text, uiLang: lang, steer }),
      });
      const data = await res.json();
      if (data.sessionId) setSessionId((prev) => prev ?? data.sessionId);
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: data.reply ?? '…',
          action: data.action,
          confidence: data.confidence,
          certificate: data.certificate,
          trace: data.trace,
          latencyMs: data.latencyMs,
          failClosed: data.failClosed,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: t.chat.clientFallback,
          failClosed: true,
        },
      ]);
    } finally {
      setBusy(false);
      // Laat live panelen (dashboard, logboek, review, verificatie) zichzelf verversen — geen knoppen.
      dispatchTurnEvent();
    }
  }

  // Index of the most recent assistant message that carries a trace
  let lastTraceIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].trace) {
      lastTraceIdx = i;
      break;
    }
  }
  const lastTraceMsg = lastTraceIdx >= 0 ? messages[lastTraceIdx] : null;

  const sheetTrace = traceIdx !== null && messages[traceIdx]?.trace ? messages[traceIdx] : lastTraceMsg;
  const turnNumber =
    sheetTrace !== null ? messages.slice(0, messages.indexOf(sheetTrace) + 1).filter((m) => m.role === 'assistant').length : 0;

  const openTrace = (idx: number) => {
    setTraceIdx(idx);
    setTraceOpen(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 md:flex-row md:gap-4">
      {/* ── Chat-kolom — min-w-0: mag krimpen, nooit horizontale overloop ── */}
      <Card className="flex min-h-0 min-w-0 flex-1 flex-col border-slate-200">
        <CardHeader className="shrink-0 flex-row items-center justify-between space-y-0 pb-2 pt-4">
          <CardTitle className="text-base">
            {t.chat.title} <span className="font-normal text-slate-400">— {t.chat.titleSub}</span>
          </CardTitle>
          {onNavigate && (
            <button
              onClick={() => onNavigate('steer')}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-900"
              aria-label={t.chat.steerAria}
            >
              <SlidersHorizontal className="h-3 w-3" aria-hidden />
              {t.chat.steerBtn}
            </button>
          )}
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2.5 px-4 pb-3 md:gap-3">
          {/* Messages */}
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-3"
            aria-live="polite"
          >
            {messages.length === 0 && (
              <div className="mx-auto max-w-md px-1 py-4">
                {/* Invitation empty state (benchmark: ChatGPT — empty state as invitation) */}
                <div className="mb-4 flex items-start gap-3">
                  <EainesyMark className="mt-0.5 h-10 w-10" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{t.chat.emptyGreeting}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{t.chat.emptyIntro}</p>
                  </div>
                </div>
                {/* Named capability starters (benchmark: fuselab — capability transparency) */}
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t.chat.emptyHeader}</p>
                <div className="flex flex-col gap-2">
                  {starters.map((s) => (
                    <button
                      key={s.cap}
                      onClick={() => setInput(s.example)}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-blue-300"
                      aria-label={`${t.chat.starterAria}: ${s.cap}`}
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.iconClass}`}>
                        <s.icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-slate-800">{s.cap}</span>
                        <span className="block truncate text-[11px] text-slate-400">{s.desc}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-slate-600">“{s.example}”</span>
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-center text-[10px] leading-relaxed text-slate-400">{t.chat.demoNote}</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-blue-700 text-white' : 'border border-slate-200 bg-white'}`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.role === 'assistant' && m.action && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={`px-1.5 py-0 text-[10px] ${ACTION_STYLES[m.action] ?? ''}`}>{m.action}</Badge>
                      {typeof m.confidence === 'number' && <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-slate-500">conf {(m.confidence * 100).toFixed(0)}%</Badge>}
                      {m.certificate?.modelCheck.pass && (
                        <Badge variant="outline" className="border-emerald-300 px-1.5 py-0 text-[10px] text-emerald-700" title={t.chat.chipStates}>
                          ✓ {fmtNum(m.certificate.modelCheck.statesChecked, lang)} {t.common.statesUnit}
                        </Badge>
                      )}
                      {m.certificate?.z3.result === 'sat' && <Badge variant="outline" className="border-teal-300 px-1.5 py-0 text-[10px] text-teal-700">✓ Z3</Badge>}
                      {m.certificate?.conversation && (
                        <Badge variant="outline" className="border-indigo-300 px-1.5 py-0 text-[10px] text-indigo-700" title={`${m.certificate.conversation.ruleId} · ${m.certificate.conversation.phase} → ${m.certificate.conversation.nextPhase}`}>
                          {(t.chat.phaseLabels as Record<string, string>)[m.certificate.conversation.phase] ?? m.certificate.conversation.phase}
                        </Badge>
                      )}
                      {m.certificate?.outputPolicy.repaired && <Badge variant="outline" className="border-amber-300 px-1.5 py-0 text-[10px] text-amber-700">{t.chat.repaired}</Badge>}
                      {m.trace && (
                        <button
                          onClick={() => openTrace(i)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 transition-colors hover:bg-slate-100"
                          aria-label={`${t.chat.pipelineAria} (${t.chat.turnLabel} ${i})`}
                        >
                          <Workflow className="h-3 w-3" aria-hidden />
                          {t.chat.pipelineBtn}
                        </button>
                      )}
                      {m.latencyMs !== undefined && <span className="text-[10px] text-slate-400">{m.latencyMs} {t.common.ms}</span>}
                      <InfoTip term={t.chat.title}>{t.chat.signalsTip}</InfoTip>
                    </div>
                  )}
                  {m.role === 'assistant' && <TurnSummary m={m} />}
                  {m.failClosed && <p className="mt-1 text-[10px] text-rose-700">{t.chat.failClosedNote}</p>}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500">
                  <Workflow className="h-4 w-4 shrink-0 animate-pulse text-blue-700" aria-hidden />
                  <span className="tabular-nums">{t.chat.hints[hintIdx]}</span>
                  <span className="flex gap-0.5" aria-hidden>
                    <span className="h-1 w-1 animate-bounce rounded-full bg-slate-300 [animation-delay:0ms]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-slate-300 [animation-delay:150ms]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-slate-300 [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Mobile: last pipeline quick access */}
          {lastTraceMsg && (
            <button
              onClick={() => openTrace(lastTraceIdx)}
              className="flex w-full shrink-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-slate-300 md:hidden"
              aria-label={t.chat.lastPipelineAria}
            >
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-700">
                <Workflow className="h-3.5 w-3.5 text-blue-700" aria-hidden />
                {t.chat.lastPipeline}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-slate-400">
                {lastTraceMsg.trace?.length ?? 0} {t.common.steps}
                {lastTraceMsg.certificate?.modelCheck.pass ? ` · ✓ ${fmtNum(lastTraceMsg.certificate.modelCheck.statesChecked, lang)} ${t.common.statesUnit}` : ''}
                {lastTraceMsg.latencyMs !== undefined ? ` · ${lastTraceMsg.latencyMs} ${t.common.ms}` : ''}
              </span>
              <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            </button>
          )}

          {/* Input */}
          <div className="flex shrink-0 items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={lang === 'nl' ? t.chat.placeholder : t.chat.placeholderEn}
              className="min-h-[52px] resize-none"
              aria-label={t.chat.yourMessage}
            />
            <Button onClick={() => void send()} disabled={busy || !input.trim()} className="h-[52px] bg-blue-700 px-4 hover:bg-blue-800">
              <Send className="h-4 w-4" aria-hidden />
              <span className="sr-only">{t.chat.send}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Desktop redeneringsspoor: inklapbaar dock ────────── */}
      {dockOpen ? (
        <Card className="hidden min-h-0 w-[300px] shrink-0 flex-col border-slate-200 md:flex lg:w-[360px] xl:w-[420px]">
          <CardHeader className="shrink-0 flex-row items-center justify-between space-y-0 pb-2 pt-4">
            <CardTitle className="text-base">
              {t.chat.traceTitle} {lastTraceMsg ? '' : <span className="font-normal text-slate-400">{t.chat.traceIdle}</span>}
            </CardTitle>
            <button
              onClick={toggleDock}
              aria-label={t.chat.dockClose}
              title={t.chat.dockClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <PanelRightClose className="h-4 w-4" aria-hidden />
            </button>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            {lastTraceMsg ? (
              <div className="h-full overflow-y-auto pr-2">
                <TraceView trace={lastTraceMsg.trace ?? []} certificate={lastTraceMsg.certificate} />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400">
                <Workflow className="h-5 w-5" aria-hidden />
                <p className="max-w-[220px]">{t.chat.traceIdleBody}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="hidden w-11 shrink-0 flex-col items-center border border-slate-200 bg-white py-2 md:flex">
          <button
            onClick={toggleDock}
            aria-label={t.chat.dockOpen}
            title={t.chat.dockOpen}
            className="relative flex flex-col items-center gap-2.5 rounded-lg py-3 text-slate-400 transition-colors hover:text-blue-800"
          >
            {lastTraceMsg && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-600" aria-hidden />}
            <PanelRightOpen className="h-4 w-4" aria-hidden />
            <span className="text-[11px] font-medium [writing-mode:vertical-rl]">{t.chat.traceTitle}</span>
          </button>
        </div>
      )}

      {/* ── Trace sheet (mobile bottom / desktop right) ─────── */}
      <Sheet open={traceOpen} onOpenChange={setTraceOpen}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={`gap-0 border-slate-200 p-0 ${isMobile ? 'h-[85dvh] rounded-t-2xl' : 'w-[440px] gap-0 sm:max-w-[440px]'}`}
        >
          <SheetHeader className="shrink-0 border-b border-slate-100 px-4 py-3 text-left">
            <SheetTitle className="text-sm">{t.chat.traceTitle}</SheetTitle>
            <SheetDescription className="text-xs">
              {sheetTrace ? `${t.chat.turnLabel} ${turnNumber} — ${t.chat.traceSheetSub}` : t.chat.traceSheetEmpty}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {sheetTrace ? (
              <TraceView trace={sheetTrace.trace ?? []} certificate={sheetTrace.certificate} />
            ) : (
              <p className="py-8 text-center text-xs text-slate-400">{t.chat.traceNoData}</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
