import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyChain } from '@/lib/eainesy/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const verify = req.nextUrl.searchParams.get('verify') === '1';
  const entries = await db.auditEntry.findMany({ orderBy: { seq: 'desc' }, take: 120 });
  const verification = verify ? await verifyChain() : null;
  const total = await db.auditEntry.count();
  return NextResponse.json({
    total,
    entries: entries.map((e) => ({ seq: e.seq, stage: e.stage, turnId: e.turnId, payload: safeParse(e.payload), prevHash: e.prevHash.slice(0, 12), hash: e.hash.slice(0, 12), createdAt: e.createdAt })),
    verification,
  });
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
