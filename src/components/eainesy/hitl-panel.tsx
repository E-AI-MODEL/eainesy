'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardCheck, CircleCheck, CircleX, Clock, Info, Eye, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useLang } from '@/components/language-provider';
import { useTurnRefresh } from '@/hooks/use-turn-refresh';
import { fmtDateTime } from '@/lib/i18n';
import { INTENT_LABELS } from '@/lib/eainesy/types';
import type { Intent } from '@/lib/eainesy/types';

interface Candidate {
  id: string;
  utterance: string;
  frame: Record<string, unknown>;
  reason: string;
  createdAt: string;
  weight?: number;
  recurrence?: number;
  sessions?: number;
  hasAuthority?: boolean;
}

interface Decided {
  id: string;
  utterance: string;
  status: string;
  reason: string;
  feedback: string | null;
  decidedAt: string | null;
}

/** Plain-language reason for this item, derived from the stored data. */
function itemKind(c: Candidate): 'invalid' | 'abstain' | 'novel' {
  if (c.frame && (c.frame as { invalid?: unknown }).invalid === true) return 'invalid';
  if (c.reason?.startsWith('abstain')) return 'abstain';
  return 'novel';
}

export function HitlPanel() {
  const { t, lang } = useLang();
  const [pending, setPending] = useState<Candidate[]>([]);
  const [decided, setDecided] = useState<Decided[]>([]);
  const [busy, setBusy] = useState(false);
  // Afwijzen krijgt per item een optionele reden: klik op Afwijzen opent een
  // klein inline-veld; leeg veld = gewone afwijzing zonder feedback.
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/hitl');
    const data = await res.json();
    setPending(data.pending);
    setDecided(data.decided);
  }, []);

  useEffect(() => { void load(); }, [load]);
  // Live: nieuwe beurten kunnen een review-kandidaat opleveren — het paneel ververst zichzelf automatisch mee.
  useTurnRefresh(load);

  async function decide(id: string, decision: 'accepted' | 'rejected', feedback?: string) {
    setBusy(true);
    try {
      const note = feedback?.trim();
      await fetch('/api/hitl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, decision, feedback: note || undefined }) });
      await load();
      setRejectingId(null);
      setRejectNote('');
    } finally {
      setBusy(false);
    }
  }

  // Statusbadge heeft eigen woorden (goedgekeurd/afgewezen) — de knoplabels
  // zijn handelingen, het badge is het vastgelegde oordeel.
  const statusLabel = (s: string) => (s === 'accepted' ? t.hitl.statusAccepted : s === 'rejected' ? t.hitl.statusRejected : s);
  const meaningFor = (k: 'invalid' | 'abstain' | 'novel') =>
    k === 'invalid' ? t.hitl.meanInvalid : k === 'abstain' ? t.hitl.meanAbstain : t.hitl.meanNovel;

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      {/* ── Wachtrij ── */}
      <Card className="min-w-0 border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-orange-700" aria-hidden />{t.hitl.pendingTitle} ({pending.length})
            <Badge variant="outline" className="ml-auto text-[10px] text-slate-500">{t.hitl.hitlBadge}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Wat is dit & wat doen de knoppen — in gewone mensentaal */}
          <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />{t.hitl.introTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-blue-950/90">{t.hitl.intro}</p>
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-emerald-950/90">
              <ThumbsUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden />
              <span>{t.hitl.acceptEffect}</span>
            </p>
            <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-emerald-950/90">
              <ThumbsDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden />
              <span>{t.hitl.rejectEffect}</span>
            </p>
          </div>
          <ScrollArea className="h-[46vh] pr-3">
            {pending.length === 0 && (
              <p className="text-sm text-slate-400 py-8 text-center leading-relaxed">
                {t.hitl.empty}
              </p>
            )}
            <ul className="space-y-2">
              {pending.map((c) => {
                const kind = itemKind(c);
                const frame = c.frame as { intent?: string; riskMarkers?: { type: string }[] } | undefined;
                const valid = !!frame && frame.intent !== undefined && (frame as { invalid?: unknown }).invalid !== true;
                return (
                  <li key={c.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-sm">“{c.utterance}”</p>
                    {/* In begrijpelijke woorden: waarom staat dit hier? */}
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{meaningFor(kind)}</p>
                    {valid && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                        <Eye className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                        <span>
                          {t.hitl.whatParsed}: {lang === 'nl' ? INTENT_LABELS[frame!.intent as Intent]?.nl : INTENT_LABELS[frame!.intent as Intent]?.en}
                          {frame!.riskMarkers?.length ? ` · ${frame!.riskMarkers.map((m) => m.type).join(', ')}` : ''}
                        </span>
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] text-orange-700 border-orange-300"><Clock className="h-2.5 w-2.5 mr-0.5" aria-hidden />{fmtDateTime(c.createdAt, lang)}</Badge>
                      {typeof c.weight === 'number' && (
                        <Badge variant="outline" className={`text-[10px] ${c.hasAuthority ? 'border-emerald-300 text-emerald-700' : 'border-slate-300 text-slate-500'}`} title={t.hitl.weightTip}>
                          {t.hitl.weightLabel} {c.weight.toFixed(1)} · {c.recurrence ?? 1}× · {c.sessions ?? 1} {t.hitl.sessionsLabel}
                        </Badge>
                      )}
                      <span className="ml-auto text-[10px] text-slate-400">{t.hitl.statusNote}</span>
                    </div>
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[10px] text-slate-400">{t.hitl.techDetails}</summary>
                      <pre className="mt-1 max-h-36 overflow-auto rounded bg-slate-900 p-2 text-[10px] text-slate-100">{JSON.stringify(c.frame, null, 1)}</pre>
                    </details>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" disabled={busy} onClick={() => void decide(c.id, 'accepted')} className="gap-1 bg-emerald-700 hover:bg-emerald-800 h-8">
                        <CircleCheck className="h-3.5 w-3.5" aria-hidden />{t.hitl.accept}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => { setRejectingId(rejectingId === c.id ? null : c.id); setRejectNote(''); }}
                        aria-expanded={rejectingId === c.id}
                        className={`gap-1 h-8 ${rejectingId === c.id ? 'border-slate-400 bg-slate-100' : ''}`}
                      >
                        <CircleX className="h-3.5 w-3.5" aria-hidden />{t.hitl.reject}
                      </Button>
                    </div>
                    {rejectingId === c.id && (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                        <label htmlFor={`reject-note-${c.id}`} className="block text-xs font-medium text-slate-700">{t.hitl.rejectPrompt}</label>
                        <input
                          id={`reject-note-${c.id}`}
                          type="text"
                          value={rejectNote}
                          maxLength={500}
                          onChange={(e) => setRejectNote(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !busy) void decide(c.id, 'rejected', rejectNote); }}
                          placeholder={t.hitl.rejectPlaceholder}
                          className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <Button size="sm" disabled={busy} onClick={() => void decide(c.id, 'rejected', rejectNote)} className="gap-1 bg-slate-700 hover:bg-slate-800 h-8">
                            <CircleX className="h-3.5 w-3.5" aria-hidden />{t.hitl.rejectConfirm}
                          </Button>
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setRejectingId(null); setRejectNote(''); }} className="h-8">
                            {t.hitl.cancel}
                          </Button>
                          <span className="ml-auto text-[10px] text-slate-400" aria-hidden>{rejectNote.length}/500</span>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* ── Besloten ── */}
      <Card className="min-w-0 border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.hitl.decidedTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[54vh] pr-3">
            {decided.length === 0 && <p className="text-sm text-slate-400">{t.hitl.noDecisions}</p>}
            <ul className="space-y-2">
              {decided.map((d) => (
                <li key={d.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${d.status === 'accepted' ? 'text-emerald-700 border-emerald-300' : 'text-slate-500'}`}>{statusLabel(d.status)}</Badge>
                    <span className="text-xs truncate">“{d.utterance}”</span>
                    <span className="ml-auto text-[10px] text-slate-400 shrink-0">{d.decidedAt ? fmtDateTime(d.decidedAt, lang) : ''}</span>
                  </div>
                  {d.feedback && (
                    <p className="mt-1.5 border-l-2 border-slate-300 pl-2 text-[11px] leading-relaxed text-slate-600">{d.feedback}</p>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{t.hitl.footer}</p>
        </CardContent>
      </Card>
    </div>
  );
}
