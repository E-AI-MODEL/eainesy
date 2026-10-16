/**
 * One-off data migration for EAInesy v2 (run in the deployment environment
 * AFTER `bun run db:push`, which adds the new columns with their defaults):
 *
 *   bun scripts/migrate-v2.ts            # dry run: report only
 *   bun scripts/migrate-v2.ts --apply    # write changes
 *
 * 1. Review items whose turn belongs to a red-team / scenario session
 *    (session label eval-… / scenario-…) get origin='eval' — they leave the
 *    human review queue (they were synthetic test messages, not people).
 * 2. Items a human already ACCEPTED in v1 keep their effect under the new
 *    authority model: weight = human-accept increment (0.6).
 *    Items a human REJECTED get one contradiction.
 * 3. intent and sessionsSeen are back-filled from the stored frame / turn.
 */
import { db } from '../src/lib/db';
import { AUTHORITY_POLICY } from '../src/lib/eainesy/seed-authority';

async function main() {
  const apply = process.argv.includes('--apply');
  const seeds = await db.seedCandidate.findMany();
  const turnIds = seeds.map((s) => s.turnId).filter((x): x is string => !!x);
  const turns = await db.turn.findMany({ where: { id: { in: turnIds } }, select: { id: true, sessionId: true } });
  const sessions = await db.session.findMany({ where: { id: { in: [...new Set(turns.map((t) => t.sessionId))] } }, select: { id: true, label: true } });
  const labelOf = new Map(sessions.map((s) => [s.id, s.label]));
  const sessionOfTurn = new Map(turns.map((t) => [t.id, t.sessionId]));

  let toEval = 0, accepted = 0, rejected = 0, backfilled = 0;
  for (const s of seeds) {
    const sessionId = s.turnId ? sessionOfTurn.get(s.turnId) : undefined;
    const label = sessionId ? labelOf.get(sessionId) ?? '' : '';
    const data: Record<string, unknown> = {};
    if (/^(eval|scenario)-/.test(label) && s.origin !== 'eval') { data.origin = 'eval'; toEval++; }
    if (s.status === 'accepted' && (s.weight ?? 0) < AUTHORITY_POLICY.humanAcceptIncrement) { data.weight = AUTHORITY_POLICY.humanAcceptIncrement; accepted++; }
    if (s.status === 'rejected' && (s.contradictions ?? 0) === 0) { data.contradictions = 1; rejected++; }
    if (!s.intent) {
      try { const f = JSON.parse(s.frame); if (typeof f?.intent === 'string') { data.intent = f.intent; backfilled++; } } catch { /* invalid frame */ }
    }
    if ((s.sessionsSeen ?? '[]') === '[]' && sessionId) data.sessionsSeen = JSON.stringify([sessionId]);
    if (apply && Object.keys(data).length) await db.seedCandidate.update({ where: { id: s.id }, data });
  }
  console.log(`${apply ? 'APPLIED' : 'DRY RUN'} · ${seeds.length} items · ${toEval} test items out of the review queue · ${accepted} accepted → weight ${AUTHORITY_POLICY.humanAcceptIncrement} · ${rejected} rejected → 1 contradiction · ${backfilled} intents back-filled`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
