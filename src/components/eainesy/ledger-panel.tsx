'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScrollText, ShieldCheck } from 'lucide-react';
import { useLang } from '@/components/language-provider';
import { useTurnRefresh } from '@/hooks/use-turn-refresh';
import { fmtNum, fmtTime } from '@/lib/i18n';

interface Entry {
  seq: number;
  stage: string;
  turnId: string | null;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
  createdAt: string;
}

interface Verification {
  ok: boolean;
  entries: number;
  firstBrokenSeq: number | null;
  checkedAt: string;
}

const STAGE_COLORS: Record<string, string> = {
  'turn.ingest': 'bg-slate-100 text-slate-600 border-slate-200',
  'turn.lexical': 'bg-blue-100 text-blue-800 border-blue-200',
  'turn.parse': 'bg-amber-100 text-amber-800 border-amber-200',
  'turn.fusion': 'bg-blue-100 text-blue-800 border-blue-200',
  'turn.decision': 'bg-blue-100 text-blue-800 border-blue-200',
  'turn.verification': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'turn.response': 'bg-amber-100 text-amber-800 border-amber-200',
  'turn.hitl': 'bg-orange-100 text-orange-800 border-orange-200',
  'hitl.decision': 'bg-orange-100 text-orange-800 border-orange-200',
};

export function LedgerPanel() {
  const { t, lang } = useLang();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (verify = false) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/ledger${verify ? '?verify=1' : ''}`);
      const data = await res.json();
      setEntries(data.entries);
      setTotal(data.total);
      setVerification(data.verification);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  // Live: elke beurt breidt de keten uit — het logboek ververst zichzelf automatisch mee.
  useTurnRefresh(() => void load());

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 flex-wrap gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-teal-700" aria-hidden />{t.ledger.title}
          <Badge variant="outline" className="text-[10px] text-slate-500">{fmtNum(total, lang)} {t.ledger.entries}</Badge>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => void load(true)} disabled={busy} className="gap-1.5">
          <ShieldCheck className={`h-3.5 w-3.5 ${busy ? 'animate-pulse' : ''}`} aria-hidden />{t.ledger.verifyChain}
        </Button>
      </CardHeader>
      <CardContent>
        {verification && (
          <div className={`mb-4 rounded-lg border p-3 text-sm leading-relaxed ${verification.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-rose-300 bg-rose-50 text-rose-800'}`}>
            {verification.ok
              ? <>{t.ledger.chainOk} <span className="text-[11px]">({fmtTime(verification.checkedAt, lang)})</span></>
              : <>{t.ledger.chainBroken.replace('vermelding', `#${verification.firstBrokenSeq}`)}</>}
          </div>
        )}
        <ScrollArea className="h-[54vh]">
          <div className="space-y-1">
            {entries.map((e) => (
              <div key={e.seq} className="rounded border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-slate-400">#{String(e.seq).padStart(4, '0')}</span>
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${STAGE_COLORS[e.stage] ?? ''}`}>{e.stage}</Badge>
                  <span className="ml-auto shrink-0 text-[9px] text-slate-400">{fmtTime(e.createdAt, lang)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  {e.turnId && <span className="min-w-0 truncate font-mono text-[9px] text-slate-300">{e.turnId.slice(0, 8)}</span>}
                  <span className="ml-auto min-w-0 truncate font-mono text-[9px] text-slate-400">←{e.prevHash.slice(0, 8)} · {e.hash.slice(0, 8)}</span>
                </div>
                <details className="mt-1">
                  <summary className="cursor-pointer text-[10px] text-slate-400">{t.ledger.payload}</summary>
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-900 p-2 text-[10px] text-slate-100">{JSON.stringify(e.payload, null, 1)}</pre>
                </details>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
