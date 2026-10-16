import { db } from '@/lib/db';
import { parseSessions, type SeedView } from './seed-authority';

/**
 * Review candidates as remembered recognition patterns (see seed-authority.ts).
 *
 * v1 turned an approved message into "known territory" immediately and
 * created a NEW queue item for every unknown message (hundreds of
 * duplicates). v2: one candidate per pattern — a recurring message updates
 * the existing candidate (recurrence, sessions seen) instead of piling up;
 * influence goes through weight + point-of-use, never directly.
 *
 * Matching is a word-pattern match, NOT clinical understanding:
 * same normalized text, or ≥60% token overlap (min. 3 tokens per side so
 * single words cannot hijack recognition).
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

/** Overlap coefficient on tokens (robust for short messages). */
function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / Math.min(a.size, b.size);
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
 * The best matching LIVE candidate for this utterance (any status), or null.
 * Exact normalized match wins over overlap; among overlaps the highest
 * coefficient wins, ties to the heaviest pattern.
 */
export async function findMatchingSeed(utterance: string): Promise<SeedRow | null> {
  const norm = normalizeSeedText(utterance);
  if (!norm) return null;
  const tokens = new Set(norm.split(' '));
  const rows = await db.seedCandidate.findMany({
    where: { origin: 'live' },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  let best: { row: SeedRow; score: number } | null = null;
  for (const raw of rows) {
    const row = toSeedView(raw as unknown as Record<string, unknown>);
    const sn = normalizeSeedText(row.utterance);
    if (!sn) continue;
    let score = 0;
    if (sn === norm) score = 2;
    else {
      const st = new Set(sn.split(' '));
      if (st.size >= 3 && tokens.size >= 3) {
        const o = overlapCoefficient(tokens, st);
        if (o >= 0.6) score = o;
      }
    }
    if (score > 0 && (!best || score > best.score || (score === best.score && row.weight > best.row.weight))) best = { row, score };
  }
  return best?.row ?? null;
}
