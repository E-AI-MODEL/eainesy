/**
 * EAInesy orchestrator — the full neuro-symbolic pipeline for one turn.
 *
 *   ingest (+ conversation state) → lexical scan → GLM parse → risk fusion
 *   (UNKNOWN when nothing could be read) → KG grounding → confidence +
 *   conformal → per-message safety decision → verified-rule-set check →
 *   Z3 certificate → CONVERSATION LAYER (phase, strategy, risk memory,
 *   rupture — may only restrict) → plan → GLM generation → output policy →
 *   (repair | canned) → next conversation state → certificate → persist +
 *   audit chain
 *
 * Doctrine: every stage fails CLOSED. A failed parser cannot produce unsafe
 * therapy (frame invalid ⇒ clarify); a failed generator cannot produce
 * unverified content (canned reply); a failed verifier cannot be waved away
 * (documented degradation + safe path).
 */
import { db } from '@/lib/db';
import {
  type Action,
  type RiskAssessment,
  type UnknownReason,
  type Certificate,
  type ConfidenceBand,
  type Frame,
  type FrameValidity,
  type Plan,
  type RiskLevel,
  type TraceStage,
} from './types';
import {
  collectLexicalMarkers, collectProtective, estimateDistress, detectPii,
  lexicalRiskScore, scoreToRiskLevel, MARKER_WEIGHTS,
} from './lexicon';
import { groundFrame } from './kg';
import { conformalCheck, totalCalibrationSize } from './conformal';
import { CONFIDENCE_BAND_THRESHOLDS } from './z3cert';
import { decide, crisisOverridePlanTemplate, type Decision } from './controller';
import { getModelCheckReport } from './modelchecker';
import {
  decideConversation, detectSignals, mergePlan, nextConversationState, parseConversationState, readinessFor,
  STABILISE_RULES, PHASE_GOAL, STRATEGY_GUIDE, type ConversationInput,
} from './conversation';
import { certifyDecision, type Z3Certificate } from './z3cert';
import { assertVerificationGate, VerificationHalt } from './verification-gate';
import { parseFrame, generateReply } from './glm';
import { verifyOutput, violationFeedback, cannedReplyFor } from './outputpolicy';
import { appendAudit } from './audit';
import { findMatchingSeed, type SeedRow } from './hitl-seeds';
import { pointOfUse, applyRecurrence, type PointOfUseDecision } from './seed-authority';
import { DEFAULT_STEER, STEER_EPSILON, isDefaultSteer, normalizeSteer, styleMaxSentences, type SteerSettings } from './steer';

const LEVEL_INDEX: Record<RiskLevel, number> = { NONE: 0, ELEVATED: 1, HIGH: 2, CRISIS: 3 };

// Markers for the fail-closed language guess. Only unambiguous tokens:
// tokens that exist in BOTH languages ("die", "we", "was", "met", "van",
// "is", "me", "want") count for NEITHER — the old single-word regex flipped
// language on exactly such tokens ("I want to die", "I met her", "...want ik...").
// Only used when the parse failed and replyLang=auto; the frame language
// decides in every other case.
const NL_MARKERS = /\b(de|het|een|ik|mijn|je|jouw|niet|geen|hier|daar|deze|dit|dat|wat|wie|waar|waarom|maar|ook|nog|wel|heel|echt|toch|altijd|nooit|misschien|eigenlijk|gewoon|helemaal|kan|kunt|moet|ben|bent|heb|heeft|hebben|wordt|worden|voel|voelt|voelde|slaap|slapen|werk|thuis|iets|iemand|niemand|alles|niets|niks|veel|meer|zo|ze|zij|wij|ons|onze)\b/g;
const EN_MARKERS = /\b(the|and|i|my|you|your|not|no|are|am|feel|feels|feeling|felt|with|that|this|have|has|can|cannot|can't|don't|doesn't|didn't|really|today|yesterday|tomorrow|sleep|sleeping|working|home|always|never|everything|nothing|someone|tired|alone|hopeless|please|why|what|when|where|how|because|about|still|now|need|think|know)\b/g;

/**
 * Fallback reply-language guess for the fail-closed path (parse failed, no
 * steered reply language). Scored, distinctive markers instead of a one-word
 * trigger: a single ambiguous token must not flip the language, and a Dutch
 * message without function words must not end up English. No signal or a tie
 * defaults to Dutch — the product's primary language. A heuristic, honestly:
 * the frame language decides whenever the parse succeeded.
 */
export function guessLanguage(text: string): 'nl' | 'en' {
  const t = text.toLowerCase();
  const nl = (t.match(NL_MARKERS) ?? []).length;
  const en = (t.match(EN_MARKERS) ?? []).length;
  return en > nl ? 'en' : 'nl';
}

export interface TurnResult {
  turnId: string;
  sessionId: string;
  reply: string;
  action: Action;
  confidence: number;
  certificate: Certificate;
  trace: TraceStage[];
  latencyMs: number;
}

/**
 * Single production definition of the Z3 fail-closed override.
 *  - 'unsat'   : the arithmetic is PROVEN inconsistent → no rule outcome can
 *                be trusted → the safest action wins.
 *  - 'unknown' : the solver could not decide — NOT a proof of inconsistency,
 *                but the arithmetic is untrusted as a precaution → same
 *                fail-closed outcome, reported truthfully as 'unknown'.
 *  - 'sat'/'skipped': unchanged in synthetic fixtures ONLY; live HTTP now
 *                stops before this helper on every non-SAT result.
 * The override also swaps the plan template for the canonical crisis plan
 * (P04) so the shipped plan is coherent: tone, moves, mustInclude and the
 * sentence bound all belong to the crisis family, not to the overridden
 * rule. Exported so the regression suite (R8) tests exactly the branch the
 * server runs. The path is unreachable from orchestrator-feeding today
 * (reasoned, not proven by an invariant) — recording it explicitly in the
 * certificate keeps the certificate honest if that ever changes.
 */
export function applyZ3Fallback(
  result: Z3Certificate['result'],
  decision: Pick<Decision, 'action' | 'planTemplate'>,
): { action: Action; planTemplate: Decision['planTemplate']; override?: { from: Action; to: Action; reason: string } } {
  if (result !== 'unsat' && result !== 'unknown') {
    return { action: decision.action, planTemplate: decision.planTemplate };
  }
  return {
    action: 'CRISIS_PROTOCOL',
    planTemplate: crisisOverridePlanTemplate(),
    override: {
      from: decision.action,
      to: 'CRISIS_PROTOCOL',
      reason: result === 'unsat'
        ? 'Z3 SMT-check unsat — rekenkundige onderbouwing aantoonbaar intern inconsistent; beslissing onbetrouwbaar, crisisprotocol met coherent crisisplan toegepast (fail-closed).'
        : 'Z3 SMT-check unknown — onbeslist: de solver kon niet beslissen (geen inconsistentie-bewijs, maar onzeker); rekenkunde voorzorgshalve onbetrouwbaar, crisisprotocol met coherent crisisplan toegepast (fail-closed).',
    },
  };
}

/**
 * Where a turn comes from. Only 'live' turns may enter the human review
 * queue: red-team probes and scripted test conversations are observations
 * of the system, not people asking for help — mixing them in polluted the
 * review queue with hundreds of synthetic messages.
 */
export type TurnOrigin = 'live' | 'eval' | 'scenario';

export async function processTurn(
  sessionId: string,
  userText: string,
  opts?: { presetFrame?: Frame | null; skipGeneration?: boolean; steer?: unknown; origin?: TurnOrigin },
): Promise<TurnResult> {
  const origin: TurnOrigin = opts?.origin ?? 'live';
  const t0 = performance.now();
  const trace: TraceStage[] = [];
  const timings: Record<string, number> = {};
  const mark = (stage: string, s: TraceStage) => {
    trace.push(s);
    timings[stage] = s.ms;
  };
  const steer: SteerSettings = normalizeSteer(opts?.steer);
  const steerActive = !isDefaultSteer(steer);
  const steerEpsilon = STEER_EPSILON[steer.strictness];

  // --- ingest -------------------------------------------------------------
  let ts = performance.now();
  const pastTurns = await db.turn.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { userText: true, replyText: true, certificate: true },
  });
  // Conversation state travels with the most recent turn's certificate.
  let convState = parseConversationState(undefined);
  if (pastTurns[0]) {
    try { convState = parseConversationState(JSON.parse(pastTurns[0].certificate)?.conversation?.next); } catch { /* older turn without state */ }
  }
  const historyPast = [...pastTurns].reverse().flatMap((t) => [
    { role: 'user' as const, content: t.userText },
    { role: 'assistant' as const, content: t.replyText },
  ]);
  // v1 counted at most 4 turns (take: 3 + 1); the real count drives the KG chain rules.
  const turnCount = (await db.turn.count({ where: { sessionId } })) + 1;
  const fallbackLanguage = guessLanguage(userText);
  mark('ingest', {
    stage: 'ingest', label: 'Bericht ontvangen', labelKey: 'ingest', kind: 'meta', ms: performance.now() - ts, status: 'ok',
    summary: `turn #${turnCount}, ${userText.length} chars, ${historyPast.length} history messages · phase=${convState.phase} · risk memory=${convState.riskMemory}`,
  });

  // --- 0. steering (bijsturing) — visible in the trace when active ----------
  if (steerActive) {
    mark('steer', {
      stage: 'steer', label: 'Bijsturing toegepast', labelKey: 'steer', kind: 'meta', ms: 0.01, status: 'ok',
      summary: `strictness=${steer.strictness} (ε=${steerEpsilon}) · style=${steer.style} · replyLang=${steer.replyLang} — de bewezen regels blijven onveranderd actief`,
      detail: steer,
    });
  }

  // --- 1. lexical scan (symbolic, GLM-independent) --------------------------
  ts = performance.now();
  const { markers: lexicalMarkers, negated } = collectLexicalMarkers(userText);
  const protective = collectProtective(userText);
  const distressLevel = estimateDistress(userText);
  const piiState = detectPii(userText);
  const lexicalScore = lexicalRiskScore(lexicalMarkers, protective.length);
  const lexicalLevel = scoreToRiskLevel(lexicalScore);
  mark('lexical', {
    stage: 'lexical', label: 'Lexische risicoscan', labelKey: 'lexical', kind: 'symbolic', ms: performance.now() - ts, status: 'ok',
    summary: `markers=[${lexicalMarkers.map((m) => m.type).join(', ') || '—'}] score=${lexicalScore} level=${lexicalLevel}${negated ? ` · ${negated} negated` : ''}${protective.length ? ` · protective×${protective.length}` : ''}`,
    detail: { lexicalMarkers, protective, distressLevel, piiState },
  });

  // --- 2. neural parse (GLM) ------------------------------------------------
  ts = performance.now();
  const presetProvided = opts && 'presetFrame' in opts;
  const frame: Frame | null = presetProvided ? (opts!.presetFrame ?? null) : await parseFrame(userText, historyPast);
  const frameValidity: FrameValidity = frame ? 'VALID' : 'INVALID';
  // Reply language: follow the user (frame language) unless steered.
  const language: 'nl' | 'en' = steer.replyLang !== 'auto' ? steer.replyLang : (frame?.language ?? fallbackLanguage);
  mark('parse', {
    stage: 'parse', label: presetProvided ? 'Frame (eval-referentie)' : 'GLM — semantische parse', labelKey: presetProvided ? 'parse-eval' : 'parse', kind: presetProvided ? 'symbolic' : 'neural', ms: performance.now() - ts,
    status: frame ? 'ok' : 'degraded',
    summary: frame
      ? presetProvided
        ? `${frame.intent} · preset reference frame (fast mode)`
        : `${frame.intent} · lang=${frame.language} · conf=${frame.parseConfidence.toFixed(2)} · ${frame.riskMarkers.length} neural markers`
      : 'parse failed or schema violation → frame INVALID (fail-closed)',
    detail: frame ?? { error: 'null frame' },
  });

  // --- 3. neural risk + fusion ----------------------------------------------
  ts = performance.now();
  const neuralTypes = new Set(frame?.riskMarkers.map((m) => m.type) ?? []);
  const neuralScore = [...neuralTypes].reduce((sum, t) => sum + MARKER_WEIGHTS[t], 0);
  const neuralLevel = scoreToRiskLevel(neuralScore);
  const fusedLevel: RiskLevel = LEVEL_INDEX[neuralLevel] >= LEVEL_INDEX[lexicalLevel] ? neuralLevel : lexicalLevel;
  // UNKNOWN policy (EAI Core 0.5.4): without a usable neural reading, an empty
  // lexical scan is NOT an observation of "no risk". Only a valid frame can
  // establish NONE; otherwise the assessment is UNKNOWN (outside the scale).
  const unknownReason: UnknownReason | null = !frame && fusedLevel === 'NONE' ? 'no_observation' : null;
  const riskAssessment: RiskAssessment = unknownReason ? 'UNKNOWN' : fusedLevel;
  mark('fusion', {
    stage: 'fusion', label: 'Risicofusie', labelKey: 'fusion', kind: 'symbolic', ms: performance.now() - ts, status: unknownReason ? 'degraded' : 'ok',
    summary: unknownReason
      ? `no usable observation (neural reading failed, lexical scan empty) → risk UNKNOWN (never coerced to NONE)`
      : `max(neural=${neuralLevel} [score ${neuralScore}], lexical=${lexicalLevel} [score ${lexicalScore}]) = ${fusedLevel}`,
    detail: { neuralScore, lexicalScore, fusedLevel, riskAssessment, unknownReason },
  });

  // --- 4. KG grounding + forward chaining ------------------------------------
  ts = performance.now();
  const degenerateFrame: Frame = frame ?? {
    intent: 'GENERAL_VENT', emotions: [], topics: [], riskMarkers: [],
    language: fallbackLanguage, paraphrase: '', parseConfidence: 0,
  };
  let grounding = await groundFrame(degenerateFrame, distressLevel, fusedLevel, turnCount);
  // Learned recognition (Shadowseed model, seed-authority.ts): a remembered
  // pattern may turn "unknown terrain" into known territory ONLY when it has
  // authority (weight ≥ threshold) AND the point-of-use check allows it for
  // this turn (readable, no risk at all, not a risk-sensitive intent, same
  // intent). Input-layer change only: the proven rules cover every input.
  // Test runs (eval/scenario) never use learned patterns: reproducible.
  let humanConfirmed: string | null = null;
  let seedMatch: SeedRow | null = null;
  let seedPou: PointOfUseDecision | null = null;
  if (grounding.novelFrame && origin === 'live') {
    seedMatch = await findMatchingSeed(userText);
    if (seedMatch) {
      seedPou = pointOfUse({ seed: seedMatch, now: new Date(), intent: frame?.intent ?? 'GENERAL_VENT', frameValidity, risk: riskAssessment, lexicalMarkers: lexicalMarkers.length });
      if (seedPou.allowed) {
        humanConfirmed = seedMatch.id;
        grounding = { ...grounding, novelFrame: false };
      }
    }
  }
  mark('ground', {
    stage: 'ground', label: 'Kennisgraph-gronding', labelKey: 'ground', kind: 'symbolic', ms: performance.now() - ts, status: 'ok',
    summary: `emotions=[${grounding.emotionKeys.join(', ') || '—'}] topics=[${grounding.topicKeys.join(', ') || '—'}] techniques=[${grounding.techniqueKeys.join(', ') || '—'}]${grounding.derived.length ? ` · derived: ${grounding.derived.join(' | ')}` : ''}${humanConfirmed ? ' · geleerd patroon toegelaten (gewicht + point-of-use)' : seedMatch ? ` · bekend patroon zonder invloed: ${seedPou?.reason}` : ''}`,
    detail: { ...grounding, humanConfirmed, seed: seedMatch ? { id: seedMatch.id, weight: seedMatch.weight, status: seedMatch.status, pointOfUse: seedPou } : undefined },
  });

  // --- 5. confidence + conformal calibration ---------------------------------
  ts = performance.now();
  const parseConf = frame?.parseConfidence ?? 0;
  const groundQuality = Math.min(1, (grounding.emotionKeys.length + grounding.topicKeys.length + (grounding.techniqueKeys.length > 0 ? 0.5 : 0)) / 3);
  const composed = Math.max(0, Math.min(1, 0.65 * parseConf + 0.35 * groundQuality));
  const rawBand: ConfidenceBand = composed >= CONFIDENCE_BAND_THRESHOLDS.HIGH ? 'HIGH' : composed >= CONFIDENCE_BAND_THRESHOLDS.MEDIUM ? 'MEDIUM' : 'LOW';
  const conformal = conformalCheck(rawBand, composed, steerEpsilon);
  mark('confidence', {
    stage: 'confidence', label: 'Zekerheid + conformele kalibratie', labelKey: 'confidence', kind: 'verify', ms: performance.now() - ts,
    status: conformal.downgraded ? 'degraded' : 'ok',
    summary: `composed=${composed.toFixed(2)} band=${conformal.band}${conformal.downgraded ? ` (downgraded from ${conformal.originalBand}, p=${conformal.pValue.toFixed(3)} < ε=${conformal.epsilon})` : ` (p=${conformal.pValue.toFixed(3)})`}`,
    detail: conformal,
  });

  // --- 6. symbolic decision ----------------------------------------------------
  ts = performance.now();
  const controllerInput = {
    riskLevel: riskAssessment,
    frameValidity,
    confidenceBand: conformal.band,
    distressLevel,
    piiState,
    novelty: grounding.novelFrame ? ('NOVEL_FRAME' as const) : ('KNOWN' as const),
    intent: frame?.intent ?? ('GENERAL_VENT' as const),
  };
  const decision = decide(controllerInput);
  mark('decide', {
    stage: 'decide', label: 'Symbolische beslissing', labelKey: 'decide', kind: 'symbolic', ms: performance.now() - ts, status: 'ok',
    summary: `rule ${decision.ruleId} → ${decision.action}${decision.hitl ? ' · HITL flag raised' : ''}`,
    detail: { controllerInput, decision: { action: decision.action, ruleId: decision.ruleId, description: decision.ruleDescription, descNl: decision.ruleDescBilingual.nl } },
  });

  // --- 7. verified rule set -------------------------------------------------------
  // The exhaustive proof covers the rule SET (both layers), not this message;
  // it runs once per process and is keyed by the rule-set hash.
  ts = performance.now();
  const modelCheck = getModelCheckReport();
  mark('modelcheck', {
    stage: 'modelcheck', label: 'Bewezen regelset', labelKey: 'modelcheck', kind: 'verify', ms: performance.now() - ts,
    status: modelCheck.pass ? 'ok' : 'fail',
    summary: `${modelCheck.pass ? 'PASS' : 'FAIL'} · rule set ${modelCheck.rulesetHash.slice(0, 12)} · ${modelCheck.statesChecked} states (${modelCheck.layers.base.statesChecked} message + ${modelCheck.layers.conversation.statesChecked} conversation) · ${modelCheck.invariantsChecked} invariants · proven ${modelCheck.checkedAt}`,
    detail: { pass: modelCheck.pass, rulesetHash: modelCheck.rulesetHash, layers: modelCheck.layers, checkedAt: modelCheck.checkedAt },
  });

  // Refuse to generate from a failed rule-set model check, including in fixtures.
  if (!modelCheck.pass) {
    await appendAudit('turn.verification_blocked', null, { sessionId, reason: 'modelcheck_failed', rulesetHash: modelCheck.rulesetHash });
    throw new VerificationHalt('modelcheck_failed', null, false);
  }

  // --- 8. Z3 SMT certificate -------------------------------------------------------
  ts = performance.now();
  let z3cert = await certifyDecision({
    riskScore: Math.max(neuralScore, lexicalScore),
    claimedLevel: fusedLevel,
    neuralLevel,
    lexicalLevel,
    fusedLevel,
    confidence: composed,
    numericBand: rawBand,
    policyBand: conformal.band,
  });
  mark('z3', {
    stage: 'z3', label: 'Z3 SMT-certificaat', labelKey: 'z3', kind: 'verify', ms: z3cert.ms,
    status: z3cert.result === 'sat' ? 'ok' : z3cert.result === 'skipped' ? 'degraded' : 'fail',
    summary: z3cert.detail,
  });

  // Automatic live-chat answers require ACTUAL SAT. Preset test fixtures are
  // explicitly synthetic and run with a mocked Z3; never count them as verified.
  if (origin === 'live' && !presetProvided) {
    try {
      assertVerificationGate(modelCheck.pass, z3cert);
    } catch (err) {
      if (err instanceof VerificationHalt) {
        await appendAudit('turn.verification_blocked', null, { sessionId, reason: err.reason, z3: z3cert.result, available: z3cert.available });
      }
      throw err;
    }
  }

  // Legacy research fixture: Z3 unsat/unknown ⇒ simulated fall-back action
  const z3Fallback = applyZ3Fallback(z3cert.result, decision);
  if (z3Fallback.override) {
    trace.push({
      stage: 'z3-fallback', label: 'Z3 fail-closed overschrijving', labelKey: 'z3-fallback', kind: 'verify', ms: 0, status: 'fail',
      summary: `SMT ${z3cert.result} → arithmetic untrusted → action overridden to CRISIS_PROTOCOL with the coherent crisis plan (fail-closed)`,
    });
  }

  // --- 8b. conversation layer (phase, strategy, memory, rupture) ------------------
  // EAI Core triage step 2+: the per-message core decided safety first; this
  // layer places the turn in the conversation and may only restrict it.
  ts = performance.now();
  const themesNow = [...grounding.emotionKeys, ...grounding.topicKeys];
  const signals = detectSignals(userText, frame, convState, themesNow);
  const convInput: ConversationInput = {
    baseAction: z3Fallback.action,
    stabilise: !z3Fallback.override && (STABILISE_RULES as readonly string[]).includes(decision.ruleId),
    risk: riskAssessment,
    confidence: conformal.band,
    phase: convState.phase,
    riskMemory: convState.riskMemory,
    rupture: convState.rupture === 'ACTIVE' || signals.rupture ? 'ACTIVE' : 'NONE',
    resourcesGiven: convState.resourcesGiven,
    ready: readinessFor(convState.phase, convState, signals),
    fresh: convState.turnsInPhase === 0,
    closure: signals.closure,
    topicShift: signals.topicShift,
  };
  const conv = decideConversation(convInput);
  const planTemplate = mergePlan(z3Fallback.planTemplate, conv);
  let action: Action = conv.action;
  mark('conversation', {
    stage: 'conversation', label: 'Gespreksregie', labelKey: 'conversation', kind: 'symbolic', ms: performance.now() - ts, status: 'ok',
    summary: `rule ${conv.ruleId} · phase ${convState.phase}→${conv.nextPhase} · strategy ${conv.strategy} · risk memory ${convState.riskMemory}${convInput.rupture === 'ACTIVE' ? ' · rupture open' : ''}${conv.action !== z3Fallback.action ? ` · ${z3Fallback.action}→${conv.action} (restricted)` : ''}`,
    detail: { input: convInput, decision: conv, signals },
  });

  // --- 9. plan construction ----------------------------------------------------------
  ts = performance.now();
  const plan: Plan = {
    action,
    ruleId: conv.replacePlan ? conv.ruleId : z3Fallback.override ? 'P04' : decision.ruleId,
    phase: convState.phase,
    strategy: conv.strategy,
    tone: planTemplate.tone,
    language,
    allowedMoves: planTemplate.allowedMoves,
    forbiddenMoves: planTemplate.forbiddenMoves,
    // Not yet the phase for techniques ⇒ no technique lines reach the generator
    // (OP-7 then flags any technique it still names).
    kgCitations: conv.stripTechniques ? [] : [...grounding.techniqueKeys],
    crisisResources: action === 'CRISIS_PROTOCOL' || action === 'SAFETY_RESPONSE'
      ? ['113 Zelfmoordpreventie — bel 113 of 0800-0113 (NL) / 1813 (BE)', 'Huisarts(enpost)']
      : [],
    mustInclude: [...planTemplate.mustInclude],
    // Reply style ("bijsturing"): scale the sentence bound — the output
    // policy (OP-8) still enforces whatever bound ends up in the plan.
    maxSentences: styleMaxSentences(planTemplate.maxSentences, steer.style),
  };
  // Unreadable message, but the independent word list recognised abuse at
  // home: the safety answer must name Veilig Thuis (the rule could not see the
  // intent, the lexical channel did).
  if (!frame && (action === 'CRISIS_PROTOCOL' || action === 'SAFETY_RESPONSE') && lexicalMarkers.some((m) => m.type === 'ABUSE_MARK')
      && !plan.mustInclude.some((m) => /0800-2000/.test(m))) {
    plan.mustInclude.push('Veilig Thuis: 0800-2000');
  }
  // Safety-family responses always carry the crisis resource lines as grounded citations
  if (action === 'CRISIS_PROTOCOL' || action === 'SAFETY_RESPONSE') {
    plan.kgCitations = ['res:113', 'res:huisarts', ...plan.kgCitations.filter((k) => k.startsWith('tech:'))];
  }
  mark('plan', {
    stage: 'plan', label: 'Plan-opbouw', labelKey: 'plan', kind: 'symbolic', ms: performance.now() - ts, status: 'ok',
    summary: `${plan.action} · tone=${plan.tone} · moves=${plan.allowedMoves.length} · citations=[${plan.kgCitations.join(', ') || '—'}]`,
    detail: plan,
  });

  // --- 10. technique lines for the generator ------------------------------------------
  const kgCache = await import('./kg').then((m) => m.loadGraph());
  const techniqueLines = plan.kgCitations.flatMap((key) => {
    const node = kgCache.nodes.get(key);
    if (!node) return [];
    return [language === 'nl' ? `${node.nl} — ${node.data.nl ?? ''}`.trim() : `${node.en} — ${node.data.en ?? ''}`.trim()];
  });

  // --- 11. generation + output policy (with one repair cycle) --------------------------
  ts = performance.now();
  const historyAll = [...historyPast, { role: 'user' as const, content: userText }];
  const skipGeneration = opts?.skipGeneration === true;
  const conversationBrief = {
    phaseGoal: PHASE_GOAL[convState.phase][language],
    strategyInstruction: STRATEGY_GUIDE[conv.strategy].instruction[language],
    focus: convState.focus,
    riskMemory: convState.riskMemory,
    turn: convState.turn + 1,
  };
  let reply = skipGeneration
    ? null
    : await generateReply({ plan, frame, techniqueLines, history: historyAll, style: steer.style, conversation: conversationBrief });
  let outPolicy = verifyOutput(reply ?? '', plan);
  let repaired = false;
  if (!reply) {
    reply = cannedReplyFor(plan);
    repaired = true;
    // Re-verify what is actually sent: the certificate must describe the
    // shipped reply, not the empty string it was provisionally checked on.
    outPolicy = verifyOutput(reply, plan);
  } else if (!outPolicy.pass) {
    const feedback = violationFeedback(outPolicy.violations, language);
    const retry = await generateReply({ plan, frame, techniqueLines, history: historyAll, violationFeedback: feedback, style: steer.style, conversation: conversationBrief });
    const retryCheck = verifyOutput(retry ?? '', plan);
    if (retry && retryCheck.pass) {
      reply = retry;
      outPolicy = retryCheck;
      repaired = true;
    } else {
      reply = cannedReplyFor(plan);
      const check = verifyOutput(reply, plan);
      outPolicy = {
        pass: check.pass,
        violations: [...check.violations, { ruleId: 'CANNED', description: 'degraded to human-written safe reply', excerpt: '' }],
      };
      repaired = true;
    }
  }
  mark('generate', {
    stage: 'generate', label: 'GLM — plan-geleide generatie', labelKey: 'generate', kind: 'neural', ms: performance.now() - ts,
    status: repaired ? 'degraded' : 'ok',
    summary: skipGeneration
      ? 'skipped — fast mode uses the human-written safe reply for this action'
      : repaired ? 'canned/repaired reply used (generator unavailable or policy violation)' : `${reply.length} chars generated under plan`,
    detail: { repaired, violations: outPolicy.violations },
  });
  mark('output-policy', {
    stage: 'output-policy', label: 'Uitvoerbeleid-controle', labelKey: 'output-policy', kind: 'verify', ms: 0.01,
    status: outPolicy.pass ? 'ok' : 'degraded',
    summary: outPolicy.pass ? (outPolicy.violations.length ? 'degraded: canned safe reply substituted' : 'PASS — no policy violations') : 'violations after repair → canned reply',
    detail: outPolicy,
  });

  // --- 11b. next conversation state ----------------------------------------------------
  const replyHadResources = /113|0800-0113|112|0800-2000/.test(reply);
  const nextState = nextConversationState(convState, conv, riskAssessment, signals, themesNow, replyHadResources);

  // --- 12. certificate -------------------------------------------------------------------
  const certificate: Certificate = {
    action,
    riskLevel: riskAssessment,
    unknown: unknownReason ? { reason: unknownReason, runtime: 'neural_parse_failed' } : undefined,
    confidence: composed,
    confidenceBand: conformal.band,
    rulesFired: [{ id: decision.ruleId, description: decision.ruleDescription, descriptionNl: decision.ruleDescBilingual.nl, descriptionEn: decision.ruleDescBilingual.en }],
    kgGroundings: [...grounding.emotionKeys, ...grounding.topicKeys, ...grounding.techniqueKeys],
    modelCheck: {
      pass: modelCheck.pass, statesChecked: modelCheck.statesChecked, invariantsChecked: modelCheck.invariantsChecked, ms: modelCheck.ms,
      rulesetHash: modelCheck.rulesetHash, checkedAt: modelCheck.checkedAt,
      layers: { base: modelCheck.layers.base.statesChecked, conversation: modelCheck.layers.conversation.statesChecked },
    },
    conversation: {
      ruleId: conv.ruleId,
      phase: convState.phase,
      nextPhase: conv.nextPhase,
      strategy: conv.strategy,
      riskMemory: convState.riskMemory,
      rupture: convInput.rupture,
      restricted: conv.action !== z3Fallback.action ? { from: z3Fallback.action, to: conv.action } : undefined,
      signals,
      next: nextState,
    },
    z3: { available: z3cert.available, result: z3cert.result, ms: z3cert.ms, detail: z3cert.detail },
    outputPolicy: { pass: outPolicy.pass, violations: outPolicy.violations.map((v) => `${v.ruleId}: ${v.description}`), repaired },
    conformal: { pValue: conformal.pValue, epsilon: conformal.epsilon, abstained: conformal.downgraded, n: totalCalibrationSize() },
    fusion: { neuralRisk: neuralLevel, lexicalRisk: lexicalLevel, fusedRisk: fusedLevel, rule: 'max(neural, lexical) — fail-closed' },
    steer: { strictness: steer.strictness, style: steer.style, replyLang: steer.replyLang, epsilon: steerEpsilon },
    humanConfirmed: humanConfirmed ? true : undefined,
    seed: seedMatch ? { id: seedMatch.id, weight: seedMatch.weight, allowed: seedPou?.allowed === true, reason: seedPou?.reason ?? '' } : undefined,
    override: z3Fallback.override,
    timings,
  };

  // --- 13. persist + audit chain -----------------------------------------------------------
  ts = performance.now();
  const turn = await db.turn.create({
    data: {
      sessionId,
      userText,
      replyText: reply,
      action,
      riskLevel: riskAssessment,
      confidence: composed,
      latencyMs: Math.round(performance.now() - t0),
      frame: JSON.stringify(frame ?? { invalid: true }),
      plan: JSON.stringify(plan),
      certificate: JSON.stringify(certificate),
      trace: JSON.stringify(trace),
    },
  });
  await appendAudit('turn.ingest', turn.id, { sessionId, chars: userText.length, turnCount, origin });
  await appendAudit('turn.lexical', turn.id, { markers: lexicalMarkers.map((m) => m.type), score: lexicalScore, level: lexicalLevel, negated });
  await appendAudit('turn.parse', turn.id, frame ? { intent: frame.intent, language: frame.language, parseConfidence: frame.parseConfidence, markers: frame.riskMarkers.map((m) => m.type) } : { invalid: true });
  await appendAudit('turn.fusion', turn.id, { neuralScore, lexicalScore, neuralLevel, lexicalLevel, fusedLevel, riskAssessment, unknownReason: unknownReason ?? undefined });
  await appendAudit('turn.decision', turn.id, { controllerInput, ruleId: decision.ruleId, action, hitl: decision.hitl, humanConfirmed: humanConfirmed ? true : undefined });
  await appendAudit('turn.conversation', turn.id, { ruleId: conv.ruleId, phase: convState.phase, nextPhase: conv.nextPhase, strategy: conv.strategy, riskMemory: convState.riskMemory, nextRiskMemory: nextState.riskMemory, rupture: convInput.rupture });
  await appendAudit('turn.verification', turn.id, { modelCheck: { pass: modelCheck.pass, states: modelCheck.statesChecked, rulesetHash: modelCheck.rulesetHash }, z3: { result: z3cert.result }, outputPolicy: outPolicy.pass, conformal: { p: conformal.pValue, band: conformal.band, epsilon: conformal.epsilon }, steer: steerActive ? steer : undefined });
  await appendAudit('turn.response', turn.id, { action, chars: reply.length, repaired });
  // Unreadable messages (no frame) are outages, not unknown territory: they
  // cannot teach recognition anything, so they go to the ledger, not the
  // review queue (v1 flooded the queue during provider outages).
  const wantsReview = !!frame && (decision.hitl || (grounding.novelFrame && !humanConfirmed));
  if (!frame && origin === 'live') {
    await appendAudit('turn.unreadable', turn.id, { riskAssessment, lexicalMarkers: lexicalMarkers.map((m) => m.type) });
  }
  if (seedPou && seedMatch) {
    await appendAudit('seed.influence', turn.id, { seedId: seedMatch.id, allowed: seedPou.allowed, reason: seedPou.reason, weight: seedMatch.weight });
  }
  if (origin === 'live' && seedMatch) {
    // A known pattern recurs: remember it (one item per pattern, no duplicates).
    const rec = applyRecurrence(seedMatch, { sessionId, intent: frame?.intent ?? null, frameValidity, risk: riskAssessment, now: new Date() });
    await db.seedCandidate.update({
      where: { id: seedMatch.id },
      data: { recurrence: rec.recurrence, sessionsSeen: JSON.stringify(rec.sessionsSeen), lastSeenAt: rec.lastSeenAt, weight: rec.weight },
    });
    await appendAudit('seed.recurrence', turn.id, { seedId: seedMatch.id, recurrence: rec.recurrence, weight: rec.weight, gainedWeight: rec.gainedWeight, reason: rec.reason });
  } else if (wantsReview && origin === 'live') {
    await db.seedCandidate.create({
      data: {
        turnId: turn.id,
        utterance: userText.slice(0, 500),
        frame: JSON.stringify(frame ?? { invalid: true }),
        reason: decision.hitl ? `abstain (${decision.ruleId})` : `novel frame — no KG anchors`,
        origin,
        weight: 0, // born weightless: remembered, no steering authority
        intent: frame?.intent ?? null,
        sessionsSeen: JSON.stringify([sessionId]),
        lastSeenAt: new Date(),
      },
    });
    await appendAudit('turn.hitl', turn.id, { queued: true, reason: decision.hitl ? 'abstain' : 'novel-frame' });
  }
  mark('persist', {
    stage: 'persist', label: 'Opslaan + audit-chain', labelKey: 'persist', kind: 'meta', ms: performance.now() - ts, status: 'ok',
    summary: `turn ${turn.id.slice(0, 8)} · 6+ ledger entries appended${wantsReview ? (origin === 'live' ? ' · review item queued' : ` · review skipped (origin=${origin})`) : ''}`,
  });

  return {
    turnId: turn.id,
    sessionId,
    reply,
    action,
    confidence: composed,
    certificate,
    trace,
    latencyMs: Math.round(performance.now() - t0),
  };
}
