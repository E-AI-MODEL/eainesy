import { db } from '@/lib/db';
import { parseSessions, type SeedView } from './seed-authority';

/**
 * Remembered recognition patterns (see seed-authority.ts).
 *
 * LIVE recognition is deliberately high-precision: ONLY exactly equal
 * normalized utterances may share a candidate. Token overlap is not a
 * semantic equivalence test: "ik wil tips" and "ik wil geen tips" used to
 * overlap completely, and an approved seed could incorrectly be used for
 * the opposite meaning. The same risk applies to person and time changes.
 *
 * Paraphrase matching needs independently checked semantic equivalence
 * BEFORE recurrence, learned authority or point-of-use may use it. The
 * research-only C2 observer investigates such differences without authority.
 * This guard is conservative, not a claim of semantic understanding.
 */

/** Lowercase, strip punctuation/accents, collapse whitespace. */
export function normalizeSeedText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SeedRow extends SeedView {
  utterance: string;
}

export function toSeedView(r: Record<string, unknown>): SeedRow {
  return {
    id: String(r.id),
    utterance: String(r.utterance ?? ''),
    status: String(r.status ?? 'pending'),
    weight: typeof r.weight === 'number' ? r.weight : 0,
    recurrence: typeof r.recurrence === 'number' ? r.recurrence : 1,
    contradictions: typeof r.contradictions === 'number' ? r.contradictions : 0,
    sessionsSeen: parseSessions(r.sessionsSeen),
    intent: typeof r.intent === 'string' ? r.intent : null,
    lastSeenAt: r.lastSeenAt instanceof Date ? r.lastSeenAt : r.createdAt instanceof Date ? r.createdAt : new Date(0),
  };
}

/**
 * Return an existing live candidate only for an exact normalized message.
 * Neither a model claim nor lexical similarity may silently promote a new
 * utterance to an earlier approved interpretation.
 *
 * A meaningful paraphrase therefore stays a separate, weightless review
 * opportunity. This intentionally trades recall for protection from false
 * semantic equivalence until semantic review is available.
 */
export async function findMatchingSeed(utterance: string): Promise<SeedRow | null> {
  const norm = normalizeSeedText(utterance);
  if (!norm) return null;
  const rows = await db.seedCandidate.findMany({
    where: { origin: 'live' },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  for (const raw of rows) {
    const row = toSeedView(raw as unknown as Record<string, unknown>);
    if (normalizeSeedText(row.utterance) === norm) return row;
  }
  return null;
}
