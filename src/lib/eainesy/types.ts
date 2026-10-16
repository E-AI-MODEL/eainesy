/**
 * EAInesy — typed neuro-symbolic contracts.
 *
 * Every stage of the pipeline communicates through these types. The neural
 * side (GLM) may only enter the pipeline as a validated `Frame`; the symbolic
 * side may only leave it as a verified `Plan` + `Certificate`.
 *
 * Design rule inherited from the evai v30 post-mortem: FAIL CLOSED.
 * Any invalid, missing, or unverifiable intermediate collapses to the safest
 * representable value — never to "probably fine".
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Actions — the complete decision space of the symbolic controller.
// This list is CLOSED: the model checker proves properties over all of it.
// ---------------------------------------------------------------------------
export const ACTIONS = [
  'CRISIS_PROTOCOL',      // warm handoff to human crisis resources + check-in
  'SAFETY_RESPONSE',      // empathic acknowledgment + resources + explicit check-in
  'REFERRAL',             // suggest professional care, stay supportive
  'THERAPEUTIC_DIALOG',   // validate + explore + KG-grounded technique
  'PSYCHOEDUCATION',      // KG-grounded psycho-education
  'CLARIFY',              // ask a grounding clarifying question
  'ABSTAIN_HITL',         // hand to human review; generic safe reply
  'BOUNDARY_REFUSAL',     // refuse out-of-scope request, offer re-anchor
] as const;
export type Action = (typeof ACTIONS)[number];

/** Human-readable action labels for the UI (NL + EN). */
export const ACTION_LABELS: Record<Action, { nl: string; en: string }> = {
  CRISIS_PROTOCOL: { nl: 'Crisisprotocol', en: 'Crisis protocol' },
  SAFETY_RESPONSE: { nl: 'Veiligheidsantwoord', en: 'Safety response' },
  REFERRAL: { nl: 'Verwijzing', en: 'Referral' },
  THERAPEUTIC_DIALOG: { nl: 'Therapeutische dialoog', en: 'Therapeutic dialogue' },
  PSYCHOEDUCATION: { nl: 'Psycho-educatie', en: 'Psycho-education' },
  CLARIFY: { nl: 'Verduidelijking', en: 'Clarify' },
  ABSTAIN_HITL: { nl: 'Aanhouden voor review', en: 'Abstain for review' },
  BOUNDARY_REFUSAL: { nl: 'Grens getrokken', en: 'Boundary refusal' },
};

// ---------------------------------------------------------------------------
// Controller input lattice — FINITE and ENUMERABLE (this is what makes
// exhaustive model checking possible; see lib/eainesy/modelchecker.ts).
// ---------------------------------------------------------------------------
/** The ORDINAL risk scale (score thresholds; max-fusion operates here). */
export const RISK_LEVELS = ['NONE', 'ELEVATED', 'HIGH', 'CRISIS'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/**
 * What the controller actually receives: the ordinal level, or UNKNOWN.
 *
 * UNKNOWN sits OUTSIDE the ordinal scale (EAI Core 0.5.4 unknown_policy:
 * "may_be_coerced_to_lowest_state: false"). It is assigned when there is no
 * usable observation: the neural reading failed AND the lexical scan found
 * nothing. Absence of evidence is not evidence of absence — UNKNOWN is never
 * silently turned into NONE (that coercion is what let RT-01 through).
 */
export const RISK_ASSESSMENTS = [...RISK_LEVELS, 'UNKNOWN'] as const;
export type RiskAssessment = (typeof RISK_ASSESSMENTS)[number];

/** Canonical reasons for UNKNOWN (subset of EAI Core 0.5.4 reason codes). */
export type UnknownReason = 'no_observation' | 'conflicting_evidence' | 'phase_not_determined';

export const FRAME_VALIDITY = ['VALID', 'INVALID', 'MISSING'] as const;
export type FrameValidity = (typeof FRAME_VALIDITY)[number];

export const CONFIDENCE_BANDS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

export const DISTRESS_LEVELS = ['LOW', 'MODERATE', 'ELEVATED', 'ACUTE'] as const;
export type DistressLevel = (typeof DISTRESS_LEVELS)[number];

export const PII_STATES = ['CLEAN', 'PII_DETECTED'] as const;
export type PiiState = (typeof PII_STATES)[number];

export const NOVELTY_STATES = ['KNOWN', 'NOVEL_FRAME'] as const;
export type NoveltyState = (typeof NOVELTY_STATES)[number];

/** One point in the controller's input lattice. */
export interface ControllerInput {
  riskLevel: RiskAssessment;
  frameValidity: FrameValidity;
  confidenceBand: ConfidenceBand;
  distressLevel: DistressLevel;
  piiState: PiiState;
  novelty: NoveltyState;
  intent: Intent;
}

// ---------------------------------------------------------------------------
// Frame — the ONLY shape in which GLM output may enter symbolic reasoning.
// ---------------------------------------------------------------------------
export const INTENTS = [
  'CRISIS_SIGNAL',
  'DEPRESSIVE_REPORT',
  'ANXIETY_REPORT',
  'PANIC_REPORT',
  'GRIEF',
  'WORK_STRESS',
  'RELATIONSHIP_ISSUE',
  'LONELINESS_REPORT',
  'SELF_WORTH_INJURY',
  'SLEEP_ISSUE',
  'STUDY_PRESSURE',
  'SUBSTANCE_CONCERN',
  'MEDICATION_QUESTION',
  'PREGNANCY_POSTNATAL',
  'CAREGIVER_BURDEN',
  'FINANCIAL_STRESS',
  'ABUSE_DISCLOSURE',
  'VIOLENCE_RISK',
  'PSYCHOSIS_SIGNAL',
  'TRAUMA_REPORT',
  'EATING_CONCERN',
  'BULLYING_REPORT',
  'IDENTITY_DISTRESS',
  'ALLIANCE_RUPTURE',
  'POSITIVE_PROGRESS',
  'GENERAL_VENT',
  'THERAPY_REQUEST',
  'OUT_OF_SCOPE',
  'DIAGNOSIS_REQUEST',
  'META_QUESTION',
] as const;
export type Intent = (typeof INTENTS)[number];

/** Human-readable intent labels (NL + EN) for KG/explorer UIs. */
export const INTENT_LABELS: Record<Intent, { nl: string; en: string }> = {
  CRISIS_SIGNAL: { nl: 'crisis-signaal', en: 'crisis signal' },
  DEPRESSIVE_REPORT: { nl: 'somberheid/depressieve klachten', en: 'depressive report' },
  ANXIETY_REPORT: { nl: 'angst', en: 'anxiety' },
  PANIC_REPORT: { nl: 'paniek', en: 'panic' },
  GRIEF: { nl: 'rouw', en: 'grief' },
  WORK_STRESS: { nl: 'werkstress', en: 'work stress' },
  RELATIONSHIP_ISSUE: { nl: 'relatieprobleem', en: 'relationship issue' },
  LONELINESS_REPORT: { nl: 'eenzaamheid', en: 'loneliness' },
  SELF_WORTH_INJURY: { nl: 'zelfbeeld gekrenkt', en: 'self-worth injury' },
  SLEEP_ISSUE: { nl: 'slaapprobleem', en: 'sleep issue' },
  STUDY_PRESSURE: { nl: 'studiedruk', en: 'study pressure' },
  SUBSTANCE_CONCERN: { nl: 'middelengebruik', en: 'substance concern' },
  MEDICATION_QUESTION: { nl: 'medicatievraag', en: 'medication question' },
  PREGNANCY_POSTNATAL: { nl: 'zwangerschap/geboorte', en: 'pregnancy / postnatal' },
  CAREGIVER_BURDEN: { nl: 'mantelzorg-overbelasting', en: 'caregiver burden' },
  FINANCIAL_STRESS: { nl: 'geldzorgen/schulden', en: 'financial stress' },
  ABUSE_DISCLOSURE: { nl: 'mishandeling/geweld onthulling', en: 'abuse disclosure' },
  VIOLENCE_RISK: { nl: 'gewelddadigheid richting anderen', en: 'violence towards others' },
  PSYCHOSIS_SIGNAL: { nl: 'psychose-spectrum signaal', en: 'psychosis-spectrum signal' },
  TRAUMA_REPORT: { nl: 'trauma/PTSS-achtige klachten', en: 'trauma / PTSD-like report' },
  EATING_CONCERN: { nl: 'eetgedrag/lichaamsbeeld', en: 'eating/body-image concern' },
  BULLYING_REPORT: { nl: 'pesten/peer-victimisatie', en: 'bullying / peer victimisation' },
  IDENTITY_DISTRESS: { nl: 'identiteit/seksualiteit', en: 'identity / sexuality distress' },
  ALLIANCE_RUPTURE: { nl: 'alliantie-breuk (frustratie met de bot)', en: 'alliance rupture (frustration with the bot)' },
  POSITIVE_PROGRESS: { nl: 'vooruitgang', en: 'positive progress' },
  GENERAL_VENT: { nl: 'algemeen verhaal', en: 'general vent' },
  THERAPY_REQUEST: { nl: 'zoek hulpverlening', en: 'seeking therapy' },
  OUT_OF_SCOPE: { nl: 'buiten bereik', en: 'out of scope' },
  DIAGNOSIS_REQUEST: { nl: 'diagnosevraag', en: 'diagnosis request' },
  META_QUESTION: { nl: 'vraag over het systeem', en: 'meta question' },
};

export const RiskMarkerSchema = z.object({
  type: z.enum(['SELF_HARM', 'SUICIDAL_IDEATION', 'HOPELESSNESS', 'ISOLATION', 'SUBSTANCE', 'AGENCY_PLAN', 'HARM_OTHERS', 'ABUSE_MARK', 'BURDENSOMENESS']),
  evidence: z.string().max(200),
});
export type RiskMarker = z.infer<typeof RiskMarkerSchema>;

export const FrameSchema = z.object({
  intent: z.enum(INTENTS),
  emotions: z.array(z.string().max(40)).max(8),
  topics: z.array(z.string().max(40)).max(8),
  riskMarkers: z.array(RiskMarkerSchema).max(6),
  language: z.enum(['nl', 'en']),
  paraphrase: z.string().max(400),          // neutral restatement used for traceability
  parseConfidence: z.number().min(0).max(1), // GLM's own parse confidence
  /** MI change talk in the last message (desire/ability/reasons/need/commitment). Optional. */
  changeTalk: z.boolean().optional(),
  /** The person explicitly asks what to do / for suggestions. Optional. */
  asksForHelp: z.boolean().optional(),
});
export type Frame = z.infer<typeof FrameSchema>;

// ---------------------------------------------------------------------------
// The FULL enumerable input lattice.
// |L| = 30 intents × 5 risk (4 ordinal + UNKNOWN) × 3 validity × 3 confidence
//       × 4 distress × 2 pii × 2 novelty = 21,600 states — exhaustively
//       model-checked. The conversation layer (conversation.ts) is checked
//       on top of this lattice.
// ---------------------------------------------------------------------------
export const LATTICE_STATES =
  INTENTS.length *
  RISK_ASSESSMENTS.length *
  FRAME_VALIDITY.length *
  CONFIDENCE_BANDS.length *
  DISTRESS_LEVELS.length *
  PII_STATES.length *
  NOVELTY_STATES.length;

export function enumerateControllerInputs(): ControllerInput[] {
  const inputs: ControllerInput[] = [];
  for (const intent of INTENTS)
    for (const riskLevel of RISK_ASSESSMENTS)
      for (const frameValidity of FRAME_VALIDITY)
        for (const confidenceBand of CONFIDENCE_BANDS)
          for (const distressLevel of DISTRESS_LEVELS)
            for (const piiState of PII_STATES)
              for (const novelty of NOVELTY_STATES)
                inputs.push({ intent, riskLevel, frameValidity, confidenceBand, distressLevel, piiState, novelty });
  return inputs;
}

// ---------------------------------------------------------------------------
// Symbolic pre-decision artefacts
// ---------------------------------------------------------------------------
export interface SymbolicScan {
  markers: RiskMarker[];          // union of neural + lexical markers
  lexicalMarkers: RiskMarker[];   // found independently of GLM (fail-closed fusion)
  protective: string[];           // protective factors detected ("steun van vrienden")
  riskScore: number;              // additive weighted score, >= 0
  riskLevel: RiskLevel;           // thresholded from riskScore
  distressLevel: DistressLevel;
  piiState: PiiState;
  language: 'nl' | 'en';
}

export interface Grounding {
  emotionKeys: string[];
  topicKeys: string[];
  techniqueKeys: string[];
  resourceKeys: string[];
  derived: string[];              // forward-chained facts, e.g. "sleep+distress => sleep-hygiene"
  novelFrame: boolean;
}

// ---------------------------------------------------------------------------
// Plan — the symbolic side's binding instruction to the generator.
// ---------------------------------------------------------------------------
export interface Plan {
  action: Action;
  /** Id of the controller rule this plan came from (for rule-specific canned text). */
  ruleId?: string;
  /** Conversation phase this turn is answered in (conversation layer). */
  phase?: ConversationPhase;
  /** Support strategy chosen for this turn (conversation layer). */
  strategy?: SupportStrategy;
  tone: 'warm' | 'calm' | 'direct' | 'validating' | 'boundaried';
  language: 'nl' | 'en';
  allowedMoves: string[];
  forbiddenMoves: string[];
  kgCitations: string[];
  crisisResources: string[];
  mustInclude: string[];
  maxSentences: number;
}

// ---------------------------------------------------------------------------
// Conversation layer — phases and per-turn support strategies.
// Phases: Hill (2020) exploration → insight/comforting → action, as
// operationalised for text support by Liu et al. (2021, ESConv); stage
// order observed in 80k crisis-line conversations by Althoff et al. (2016):
// introduction → problem introduction/exploration → problem solving → wrap-up.
// Strategies: the ESConv strategy set, minus self-disclosure (an assistant
// has no life story to disclose — honesty), plus REPAIR (Safran & Muran)
// and SAFETY (the per-message safety core decided).
// ---------------------------------------------------------------------------
export const CONVERSATION_PHASES = ['OPENING', 'EXPLORE', 'FOCUS', 'ACT', 'CLOSE'] as const;
export type ConversationPhase = (typeof CONVERSATION_PHASES)[number];

export const SUPPORT_STRATEGIES = [
  'QUESTION',
  'RESTATEMENT',
  'REFLECTION',
  'AFFIRMATION',
  'SUMMARY',
  'SUGGESTION',
  'INFORMATION',
  'REPAIR',
  'SAFETY',
  'BOUNDARY',
  'REFERRAL',
  'CLARIFY',
] as const;
export type SupportStrategy = (typeof SUPPORT_STRATEGIES)[number];

export const RISK_MEMORY_STATES = ['NONE', 'RECENT', 'ACTIVE'] as const;
export type RiskMemory = (typeof RISK_MEMORY_STATES)[number];

export const RUPTURE_STATES = ['NONE', 'ACTIVE'] as const;
export type RuptureState = (typeof RUPTURE_STATES)[number];

// ---------------------------------------------------------------------------
// Certificate — proof-carrying response metadata.
// ---------------------------------------------------------------------------
export interface Certificate {
  action: Action;
  riskLevel: RiskAssessment;
  /** Present when riskLevel is UNKNOWN: canonical reason + runtime cause. */
  unknown?: { reason: UnknownReason; runtime: string };
  confidence: number;
  confidenceBand: ConfidenceBand;
  rulesFired: { id: string; description: string; descriptionNl?: string; descriptionEn?: string }[];
  kgGroundings: string[];
  modelCheck: {
    pass: boolean; statesChecked: number; invariantsChecked: number; ms: number;
    /** SHA-256 of the proven rule set; the proof covers every message under this hash. */
    rulesetHash?: string; checkedAt?: string; layers?: { base: number; conversation: number };
  };
  /** Conversation layer: where this turn sits and what follows. */
  conversation?: {
    ruleId: string;
    phase: ConversationPhase;
    nextPhase: ConversationPhase;
    strategy: SupportStrategy;
    riskMemory: RiskMemory;
    rupture: RuptureState;
    restricted?: { from: Action; to: Action };
    signals: { changeTalk: boolean; asksForHelp: boolean; closure: boolean; rupture: boolean; topicShift: boolean };
    /** State carried into the next turn (see conversation.ts). */
    next: unknown;
  };
  z3: { available: boolean; result: 'sat' | 'unsat' | 'unknown' | 'skipped'; ms: number; detail: string };
  outputPolicy: { pass: boolean; violations: string[]; repaired: boolean };
  conformal: { pValue: number; epsilon: number; abstained: boolean; n: number };
  fusion: { neuralRisk: RiskLevel; lexicalRisk: RiskLevel; fusedRisk: RiskLevel; rule: string };
  /** Active steering for this turn (visible proof of "bijsturing"). */
  steer?: { strictness: string; style: string; replyLang: string; epsilon: number };
  /** True when a learned recognition pattern was allowed to influence this turn. */
  humanConfirmed?: boolean;
  /** The matching remembered pattern and the point-of-use verdict (seed-authority.ts). */
  seed?: { id: string; weight: number; allowed: boolean; reason: string };
  /**
   * Present ONLY when the Z3-UNSAT fail-closed override replaced the rule's
   * action after the decision. `rulesFired` stays a truthful record of which
   * symbolic rule fired; this field records the post-decision intervention
   * explicitly, so the certificate never has to be reconstructed by inference
   * (action ≠ rule action) — see applyZ3Fallback in orchestrator.ts.
   */
  override?: { from: Action; to: Action; reason: string };
  timings: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Trace — pipeline stage records for the UI.
// `label` is a Dutch human label (back-compat); `labelKey` lets the client
// localise the label via the i18n dictionary (see src/lib/i18n.ts).
// ---------------------------------------------------------------------------
export interface TraceStage {
  stage: string;
  label: string;
  labelKey?: string;
  kind: 'neural' | 'symbolic' | 'verify' | 'meta';
  ms: number;
  status: 'ok' | 'degraded' | 'fail';
  summary: string;
  detail?: unknown;
}

// ---------------------------------------------------------------------------
// Output policy — symbolic verification of GENERATED text
// ---------------------------------------------------------------------------
export interface OutputViolation {
  ruleId: string;
  description: string;
  excerpt: string;
}

// Chat API contracts
export const ChatRequestSchema = z.object({
  sessionId: z.string().min(1).optional(),
  message: z.string().min(1).max(2000),
  /** UI language — used only for the fail-closed fallback reply. */
  uiLang: z.enum(['nl', 'en']).optional(),
  /** User steering ("bijsturing"): strictness / reply style / reply language.
   *  Validated + normalised server-side (see lib/eainesy/steer.ts). */
  steer: z
    .object({
      strictness: z.enum(['relaxed', 'standard', 'strict']).optional(),
      style: z.enum(['concise', 'normal', 'elaborate']).optional(),
      replyLang: z.enum(['auto', 'nl', 'en']).optional(),
    })
    .optional(),
});
