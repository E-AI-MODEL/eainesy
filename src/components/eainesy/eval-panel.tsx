'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Swords, CircleCheck, CircleX, Zap, Globe, MessagesSquare } from 'lucide-react';
import { useLang } from '@/components/language-provider';
import { fmtDateTime } from '@/lib/i18n';

interface Probe {
  id: string;
  name: string;
  nameNl?: string;
  note: string;
  noteNl?: string;
  expected: string[] | null;
  forbidden: string[] | null;
  mustMention113: boolean;
}

interface ProbeResult {
  id: string;
  name: string;
  nameNl?: string;
  pass: boolean;
  action: string;
  expected?: string;
  reply: string;
  reason: string;
  ms: number;
}

interface ScenarioMeta {
  id: string;
  name: { nl: string; en: string };
  note: { nl: string; en: string };
  turns: number;
}

interface ScenarioResultRow {
  id: string;
  name: { nl: string; en: string };
  pass: boolean;
  failures: string[];
  metrics: { turns: number; turnsToFocus: number | null; actShare: number; safetyTurns: number };
}

interface Run {
  id: string;
  suite?: 'probes' | 'scenarios';
  mode: string;
  total: number;
  passed: number;
  results: (ProbeResult | ScenarioResultRow)[];
  createdAt: string;
}

type Suite = 'probes' | 'scenarios';

export function EvalPanel() {
  const { t, lang } = useLang();
  const [probes, setProbes] = useState<Probe[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [running, setRunning] = useState(false);
  const [activeMode, setActiveMode] = useState<'fast' | 'full' | null>(null);
  const [suite, setSuite] = useState<Suite>('probes');

  const load = useCallback(async () => {
    const res = await fetch('/api/eval');
    const data = await res.json();
    setProbes(data.probes);
    setScenarios(data.scenarios ?? []);
    setRuns(data.runs);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function run(mode: 'fast' | 'full') {
    setRunning(true);
    setActiveMode(mode);
    try {
      await fetch('/api/eval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, suite }) });
      await load();
    } finally {
      setRunning(false);
      setActiveMode(null);
    }
  }

  const probeName = (p: { name: string; nameNl?: string }) => (lang === 'nl' ? p.nameNl ?? p.name : p.name);
  const probeNote = (p: { note: string; noteNl?: string }) => (lang === 'nl' ? p.noteNl ?? p.note : p.note);
  const suiteRuns = runs.filter((r) => (r.suite ?? 'probes') === suite);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card className="border-slate-200">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Swords className="h-4 w-4 text-rose-700" aria-hidden />
            {suite === 'probes' ? `${t.eval.title} (${probes.length} ${t.eval.probes})` : `${t.eval.scenariosTitle} (${scenarios.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div role="tablist" aria-label={t.eval.suiteAria} className="mb-3 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            {(['probes', 'scenarios'] as Suite[]).map((sv) => (
              <button
                key={sv}
                role="tab"
                aria-selected={suite === sv}
                onClick={() => setSuite(sv)}
                className={`inline-flex items-center gap-1 rounded-[7px] px-3 py-1.5 text-xs font-medium transition-colors ${suite === sv ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {sv === 'probes' ? <Swords className="h-3.5 w-3.5" aria-hidden /> : <MessagesSquare className="h-3.5 w-3.5" aria-hidden />}
                {sv === 'probes' ? t.eval.suiteProbes : t.eval.suiteScenarios}
              </button>
            ))}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button onClick={() => void run('fast')} disabled={running} className="gap-1.5 bg-blue-700 hover:bg-blue-800">
              <Zap className="h-4 w-4" aria-hidden />{running && activeMode === 'fast' ? t.eval.busyFast : t.eval.runFast}
            </Button>
            <Button onClick={() => void run('full')} disabled={running} variant="outline" className="gap-1.5">
              <Globe className="h-4 w-4" aria-hidden />{running && activeMode === 'full' ? t.eval.busyFull : t.eval.runFull}
            </Button>
          </div>
          <p className="mb-2 text-xs leading-relaxed text-slate-500">{suite === 'probes' ? t.eval.intro : t.eval.scenariosIntro}</p>
          {suite === 'probes' && <p className="mb-3 text-[11px] leading-relaxed text-slate-500">{t.eval.attackClasses}</p>}
          <ScrollArea className="h-[52vh] pr-3">
            {suite === 'scenarios' && (
              <ul className="space-y-2">
                {scenarios.map((sc) => (
                  <li key={sc.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-mono">{sc.id}</Badge>
                      <span className="text-xs font-semibold">{lang === 'nl' ? sc.name.nl : sc.name.en}</span>
                      <span className="ml-auto text-[10px] text-slate-400">{sc.turns} {t.eval.turns}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-slate-500">{lang === 'nl' ? sc.note.nl : sc.note.en}</p>
                  </li>
                ))}
              </ul>
            )}
            <ul className={`space-y-2 ${suite === 'probes' ? '' : 'hidden'}`}>
              {probes.map((p) => (
                <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] font-mono">{p.id}</Badge>
                    <span className="text-xs font-semibold">{probeName(p)}</span>
                    {p.expected && <span className="ml-auto text-[10px] text-slate-400">{t.eval.expects} {p.expected.join(' | ')}</span>}
                    {p.forbidden && <span className="ml-auto text-[10px] text-slate-400">{t.eval.forbids} {p.forbidden.join(' | ')}</span>}
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-500">{probeNote(p)}</p>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.eval.history}</CardTitle>
        </CardHeader>
        <CardContent>
          {suiteRuns.length === 0 && <p className="text-sm text-slate-400">{t.eval.noRuns}</p>}
          <div className="space-y-4">
            {suiteRuns.slice(0, 4).map((r) => (
              <div key={r.id}>
                <div className="mb-2 flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={r.mode === 'fast' ? 'text-blue-700 border-blue-300' : 'text-cyan-700 border-cyan-300'}>{r.mode}</Badge>
                  <span className={`text-sm font-semibold ${(r.passed / Math.max(1, r.total)) === 1 ? 'text-emerald-700' : 'text-amber-700'}`}>{r.passed}/{r.total} {t.eval.passed}</span>
                  <span className="ml-auto text-[10px] text-slate-400">{fmtDateTime(r.createdAt, lang)}</span>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {r.results.map((res) => {
                    const isScenario = 'metrics' in res;
                    return (
                      <div key={res.id} className={`rounded-lg border p-2 ${res.pass ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}`}>
                        <div className="flex items-center gap-1.5">
                          {res.pass ? <CircleCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden /> : <CircleX className="h-3.5 w-3.5 text-rose-700" aria-hidden />}
                          <span className="text-[11px] font-semibold">{res.id}</span>
                          {isScenario ? (
                            <span className="ml-auto text-[9px] text-slate-500">
                              {t.eval.focusAt} {(res as ScenarioResultRow).metrics.turnsToFocus ?? '—'} · {t.eval.safetyTurns} {(res as ScenarioResultRow).metrics.safetyTurns}
                            </span>
                          ) : (
                            <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0">{(res as ProbeResult).action}</Badge>
                          )}
                        </div>
                        {isScenario && <p className="mt-0.5 text-[10px] text-slate-600">{lang === 'nl' ? (res as ScenarioResultRow).name.nl : (res as ScenarioResultRow).name.en}</p>}
                        {!res.pass && (
                          <p className="mt-1 text-[10px] text-rose-700">
                            {isScenario ? (res as ScenarioResultRow).failures.slice(0, 3).join(' · ') : (res as ProbeResult).reason}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
