/**
 * Seed authority — learning without silently widening permissions.
 *
 * Design taken from Shadowseed (E-AI-MODEL/shadowseed-pro): "trace > 0 means
 * remembered; weight = 0 means no steering authority." A review candidate is
 * BORN WEIGHTLESS. It may be remembered, recur, be contradicted, and only
 * influence a later turn when (a) its weight passed the authority threshold
 * and (b) a separate point-of-use check allows it for THIS turn.
 *
 * Orthogonal axes (as in Shadowseed R1–R3):
 *   evidence (weight)  — human acceptance, or independent recurrence
 *   temporal           — a pattern unseen for long goes dormant (no influence)
 *                        until a fresh independent occurrence renews it
 *   point of use       — even an authoritative pattern never influences a
 *                        turn with any risk signal, an unreadable message,
 *                        a risk-sensitive topic, or a different intent
 * None of these implies another.
 *
 * What influence means here: ONLY the recognition layer (novel frame →
 * known territory). The proven rules never change; the model check covers
 * every input the recognition layer can produce.
 *
 * PURE: no I/O. The clock is passed in.
 */
import type { Intent, RiskAssessment, FrameValidity } from './types';

export const AUTHORITY_POLICY = {
  /** Weight at which a pattern may influence recognition (subject to point of use). */
  threshold: 0.6,
  /** One human acceptance: strong, independent validation. */
  humanAcceptIncrement: 0.6,
  /** A human rejection is a contradiction. */
  contradictionPenalty: 0.3,
  /** Each recurrence in a NEW session (independent trigger), low-stakes intents only. */
  recurrenceIncrement: 0.2,
  /** Without a human, recurrence alone may reach this weight (== threshold: four independent sessions). */
  autoCap: 0.6,
  weightCap: 1,
  /** Unseen for this long ⇒ dormant (no influence) until it recurs. */
  dormantAfterDays: 60,
} as const;

/**
 * Intents where recognition may be learned from recurrence alone. Everything
 * risk-, specialist- or medically-sensitive needs a human, and even then the
 * point-of-use check keeps influence away from risky turns.
 */
export const LOW_STAKES_INTENTS: Intent[] = [
  'SLEEP_ISSUE', 'STUDY_PRESSURE', 'WORK_STRESS', 'GENERAL_VENT', 'POSITIVE_PROGRESS',
  'LONELINESS_REPORT', 'RELATIONSHIP_ISSUE', 'META_QUESTION',
];

/** Intents on which a learned pattern may never influence a turn. */
export const NO_INFLUENCE_INTENTS: Intent[] = [
  'CRISIS_SIGNAL', 'ABUSE_DISCLOSURE', 'VIOLENCE_RISK', 'PSYCHOSIS_SIGNAL', 'EATING_CONCERN',
  'SUBSTANCE_CONCERN', 'MEDICATION_QUESTION', 'PREGNANCY_POSTNATAL', 'TRAUMA_REPORT', 'DIAGNOSIS_REQUEST',
];

export interface SeedView {
  id: string;
  status: string; // pending | accepted | rejected
  weight: number;
  recurrence: number;
  contradictions: number;
  sessionsSeen: string[];
  intent: string | null;
  lastSeenAt: Date;
}

export function parseSessions(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; }
}

/** Human verdict → new evidence state. */
export function applyVerdict(seed: SeedView, verdict: 'accepted' | 'rejected'): Pick<SeedView, 'status' | 'weight' | 'contradictions'> {
  if (verdict === 'accepted') {
    return { status: 'accepted', weight: Math.min(AUTHORITY_POLICY.weightCap, seed.weight + AUTHORITY_POLICY.humanAcceptIncrement), contradictions: seed.contradictions };
  }
  return { status: 'rejected', weight: Math.max(0, seed.weight - AUTHORITY_POLICY.contradictionPenalty), contradictions: seed.contradictions + 1 };
}

/**
 * A new occurrence of a known pattern. Recurrence is always REMEMBERED; it
 * adds weight only when it is independent (a session not seen before), the
 * pattern is not contradicted, the turn was readable and risk-free, the
 * intent matches and is low-stakes — and never beyond the auto cap.
 */
export function applyRecurrence(
  seed: SeedView,
  occurrence: { sessionId: string; intent: Intent | null; frameValidity: FrameValidity; risk: RiskAssessment; now: Date },
): Pick<SeedView, 'weight' | 'recurrence' | 'sessionsSeen' | 'lastSeenAt'> & { gainedWeight: boolean; reason: string } {
  const sessions = seed.sessionsSeen.includes(occurrence.sessionId) ? seed.sessionsSeen : [...seed.sessionsSeen, occurrence.sessionId].slice(-50);
  const base = { recurrence: seed.recurrence + 1, sessionsSeen: sessions, lastSeenAt: occurrence.now };
  const independent = !seed.sessionsSeen.includes(occurrence.sessionId);
  const why = !independent ? 'same session (not independent)'
    : seed.status === 'rejected' ? 'contradicted by a human (no further weight)'
    : occurrence.frameValidity !== 'VALID' ? 'unreadable turn'
    : occurrence.risk !== 'NONE' ? 'risk signal in this turn'
    : !occurrence.intent || occurrence.intent !== seed.intent ? 'different intent'
    : !LOW_STAKES_INTENTS.includes(occurrence.intent) ? 'not a low-stakes intent (needs a human)'
    : seed.weight >= AUTHORITY_POLICY.autoCap ? 'auto cap reached'
    : null;
  if (why) return { ...base, weight: seed.weight, gainedWeight: false, reason: why };
  return { ...base, weight: Math.min(AUTHORITY_POLICY.autoCap, seed.weight + AUTHORITY_POLICY.recurrenceIncrement), gainedWeight: true, reason: 'independent recurrence' };
}

export interface PointOfUseInput {
  seed: SeedView;
  now: Date;
  intent: Intent;
  frameValidity: FrameValidity;
  risk: RiskAssessment;
  lexicalMarkers: number;
}

export interface PointOfUseDecision { allowed: boolean; reason: string }

/** May this remembered pattern influence recognition for THIS turn? */
export function pointOfUse(i: PointOfUseInput): PointOfUseDecision {
  const ageDays = (i.now.getTime() - i.seed.lastSeenAt.getTime()) / 86_400_000;
  if (i.seed.status === 'rejected') return { allowed: false, reason: 'contradicted by a human' };
  if (i.seed.weight < AUTHORITY_POLICY.threshold) return { allowed: false, reason: `weight ${i.seed.weight.toFixed(2)} < ${AUTHORITY_POLICY.threshold} (remembered, no authority)` };
  if (ageDays > AUTHORITY_POLICY.dormantAfterDays) return { allowed: false, reason: `dormant (unseen for ${Math.floor(ageDays)} days)` };
  if (i.frameValidity !== 'VALID') return { allowed: false, reason: 'message could not be read reliably' };
  if (i.risk !== 'NONE') return { allowed: false, reason: `risk ${i.risk} in this turn` };
  if (i.lexicalMarkers > 0) return { allowed: false, reason: 'lexical risk marker in this turn' };
  if (NO_INFLUENCE_INTENTS.includes(i.intent)) return { allowed: false, reason: `risk-sensitive intent ${i.intent}` };
  if (i.seed.intent && i.seed.intent !== i.intent) return { allowed: false, reason: `different intent (${i.seed.intent} ≠ ${i.intent})` };
  return { allowed: true, reason: 'authoritative, current and relevant; no risk in this turn' };
}
