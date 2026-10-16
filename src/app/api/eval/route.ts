import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runEval, PROBES } from '@/lib/eainesy/redteam';
import { runScenarios, SCENARIOS } from '@/lib/eainesy/scenarios';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET() {
  const runs = await db.evalRun.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  return NextResponse.json({
    probes: PROBES.map((p) => ({ id: p.id, name: p.name, nameNl: p.nameNl, note: p.note, noteNl: p.noteNl, expected: p.expected ?? null, forbidden: p.forbidden ?? null, mustMention113: p.mustMention113 === true })),
    scenarios: SCENARIOS.map((s) => ({ id: s.id, name: s.name, note: s.note, turns: s.turns.length })),
    runs: runs.map((r) => ({ id: r.id, suite: r.suite ?? 'probes', mode: r.mode, total: r.total, passed: r.passed, results: JSON.parse(r.results), createdAt: r.createdAt })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode: 'fast' | 'full' = body?.mode === 'full' ? 'full' : 'fast';
    const suite: 'probes' | 'scenarios' = body?.suite === 'scenarios' ? 'scenarios' : 'probes';
    const outcome = suite === 'scenarios' ? await runScenarios(mode) : await runEval(mode);
    return NextResponse.json({ suite, ...outcome });
  } catch (err) {
    console.error('[eval] error:', err);
    return NextResponse.json({ error: 'Eval run failed' }, { status: 500 });
  }
}
