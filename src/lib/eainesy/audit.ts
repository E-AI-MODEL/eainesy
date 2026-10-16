/**
 * Audit ledger — append-only, hash-chained.
 *
 * Every pipeline stage appends an entry: seq | stage | prevHash | payload |
 * timestamp → SHA-256 hash. `verifyChain` recomputes the whole chain so any
 * tampering (or a bug) is detectable from the UI. evai's audit story was a
 * table; EAInesy's is tamper-evident.
 */
import { createHash } from 'crypto';
import { db } from '@/lib/db';

const GENESIS = '0'.repeat(64);

function entryHash(seq: number, stage: string, prevHash: string, payload: string, createdAt: Date): string {
  return createHash('sha256')
    .update(`${seq}|${stage}|${prevHash}|${payload}|${createdAt.toISOString()}`)
    .digest('hex');
}

export async function appendAudit(stage: string, turnId: string | null, payload: unknown): Promise<void> {
  const last = await db.auditEntry.findFirst({ orderBy: { seq: 'desc' }, select: { seq: true, hash: true } });
  const seq = (last?.seq ?? -1) + 1;
  const prevHash = last?.hash ?? GENESIS;
  const payloadStr = JSON.stringify(payload ?? {}).slice(0, 4000);
  const createdAt = new Date();
  const hash = entryHash(seq, stage, prevHash, payloadStr, createdAt);
  await db.auditEntry.create({ data: { seq, stage, turnId, payload: payloadStr, prevHash, hash, createdAt } });
}

export interface ChainVerification {
  ok: boolean;
  entries: number;
  firstBrokenSeq: number | null;
  checkedAt: string;
}

export async function verifyChain(): Promise<ChainVerification> {
  const entries = await db.auditEntry.findMany({ orderBy: { seq: 'asc' } });
  let prevHash = GENESIS;
  for (const e of entries) {
    const expected = entryHash(e.seq, e.stage, prevHash, e.payload, e.createdAt);
    if (e.prevHash !== prevHash || e.hash !== expected) {
      return { ok: false, entries: entries.length, firstBrokenSeq: e.seq, checkedAt: new Date().toISOString() };
    }
    prevHash = e.hash;
  }
  return { ok: true, entries: entries.length, firstBrokenSeq: null, checkedAt: new Date().toISOString() };
}
