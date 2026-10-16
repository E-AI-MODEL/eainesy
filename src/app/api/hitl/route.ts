import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appendAudit } from '@/lib/eainesy/audit';
import { applyVerdict, AUTHORITY_POLICY, parseSessions } from '@/lib/eainesy/seed-authority';
import { toSeedView } from '@/lib/eainesy/hitl-seeds';

export const dynamic = 'force-dynamic';

type SeedRecord = Awaited<ReturnType<typeof db.seedCandidate.findMany>>[number];

/**
 * Review queue. Only LIVE conversation turns belong here. Items created by
 * red-team or scripted test runs are excluded twice over: by `origin`
 * (set since v2) and, for items created before v2, by the label of the
 * session their turn belongs to (eval-… / scenario-…).
 */
async function liveOnly(items: SeedRecord[]): Promise<SeedRecord[]> {
  const candidates = items.filter((s) => (s.origin ?? 'live') === 'live');
  const turnIds = candidates.map((s) => s.turnId).filter((x): x is string => !!x);
  if (turnIds.length === 0) return candidates;
  const turns = await db.turn.findMany({ where: { id: { in: turnIds } }, select: { id: true, sessionId: true } });
  const sessionIds = [...new Set(turns.map((t) => t.sessionId))];
  const sessions = await db.session.findMany({ where: { id: { in: sessionIds } }, select: { id: true, label: true } });
  const testSessions = new Set(sessions.filter((s) => /^(eval|scenario)-/.test(s.label)).map((s) => s.id));
  const testTurns = new Set(turns.filter((t) => testSessions.has(t.sessionId)).map((t) => t.id));
  return candidates.filter((s) => !s.turnId || !testTurns.has(s.turnId));
}

const authority = (s: SeedRecord) => ({
  weight: s.weight ?? 0,
  recurrence: s.recurrence ?? 1,
  sessions: parseSessions(s.sessionsSeen).length,
  hasAuthority: (s.weight ?? 0) >= AUTHORITY_POLICY.threshold && s.status !== 'rejected',
});

export async function GET() {
  const pendingRaw = await db.seedCandidate.findMany({ where: { status: 'pending' }, orderBy: [{ recurrence: 'desc' }, { createdAt: 'desc' }], take: 200 });
  const decidedRaw = await db.seedCandidate.findMany({ where: { status: { not: 'pending' } }, orderBy: { decidedAt: 'desc' }, take: 100 });
  const pending = (await liveOnly(pendingRaw)).slice(0, 50);
  const decided = (await liveOnly(decidedRaw)).slice(0, 30);
  return NextResponse.json({
    policy: AUTHORITY_POLICY,
    pending: pending.map((s) => ({ id: s.id, utterance: s.utterance, frame: JSON.parse(s.frame), reason: s.reason, createdAt: s.createdAt, ...authority(s) })),
    decided: decided.map((s) => ({ id: s.id, utterance: s.utterance, status: s.status, reason: s.reason, feedback: s.feedback, decidedAt: s.decidedAt, ...authority(s) })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = body?.id as string | undefined;
  const decision = body?.decision as string | undefined;
  if (!id || (decision !== 'accepted' && decision !== 'rejected')) {
    return NextResponse.json({ error: 'id and decision (accepted|rejected) required' }, { status: 400 });
  }
  // Optional reviewer feedback: why this verdict? Building material for a
  // future rule version — never touches the proven rules themselves.
  const feedback = typeof body?.feedback === 'string' && body.feedback.trim() ? body.feedback.trim().slice(0, 500) : null;
  const current = await db.seedCandidate.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const next = applyVerdict(toSeedView(current as unknown as Record<string, unknown>), decision);
  const candidate = await db.seedCandidate.update({
    where: { id },
    data: { status: next.status, weight: next.weight, contradictions: next.contradictions, feedback, decidedAt: new Date() },
  });
  await appendAudit('hitl.decision', candidate.turnId, {
    seedId: id,
    decision,
    weight: next.weight,
    hasAuthority: next.weight >= AUTHORITY_POLICY.threshold && next.status !== 'rejected',
    utterance: candidate.utterance.slice(0, 200),
    reviewer: 'dashboard-operator',
    ...(feedback ? { feedback } : {}),
  });
  return NextResponse.json({ ok: true, id, status: next.status, weight: next.weight });
}
