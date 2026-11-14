/**
 * Evidence grounding for neural risk markers — SHADOW MODE.
 * Design: docs/ontwerp-modelmarker-verankering-N02-S01.md (P0 N02/S01).
 *
 * Pure functions, no I/O, no model calls. The orchestrator computes the
 * outcome per turn and records it in the certificate (`groundingShadow`); it
 * does NOT change the risk assessment or the decision. Which floor variant
 * (lenient or strict) may ever take effect is decided by the O1 study
 * (docs/protocol-ontkenning-en-derde-persoon-2026-10-25.md), not here.
 */
import type { RiskLevel, RiskMarker, RiskMemory } from './types';
import { DENIAL_FORMS, MARKER_WEIGHTS, isAmbivalentDenialContext, scoreToRiskLevel } from './lexicon';

export type GroundingStatus = 'GROUNDED_AFFIRMED' | 'GROUNDED_NEGATED' | 'UNGROUNDED';

/** Only these marker types can be dropped by grounding (design §3.2). */
const GROUNDABLE: RiskMarker['type'][] = ['SUICIDAL_IDEATION', 'SELF_HARM', 'AGENCY_PLAN'];
const ORDER: RiskLevel[] = ['NONE', 'ELEVATED', 'HIGH', 'CRISIS'];
const idx = (l: RiskLevel) => ORDER.indexOf(l);
const max = (a: RiskLevel, b: RiskLevel) => (idx(a) >= idx(b) ? a : b);
const min = (a: RiskLevel, b: RiskLevel) => (idx(a) <= idx(b) ? a : b);

/** Same normalisation for message and quote: NFC, lower case, ASCII quotes, collapsed whitespace, trimmed edge punctuation. */
export function normalizeForGrounding(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s"'.,;:!?()\-–—]+|[\s"'.,;:!?()\-–—]+$/g, '');
}

export interface MarkerGrounding {
  type: RiskMarker['type'];
  status: GroundingStatus;
  /** The quote occurs in an earlier user message but not in the last one (audit only). */
  fromHistory?: boolean;
}

/** §3.1 + §3.2: is the quote verbatim in the LAST user message, and is the predicate denied there? */
export function groundMarker(marker: RiskMarker, lastUserText: string, earlierUserTexts: string[] = []): MarkerGrounding {
  const quote = normalizeForGrounding(marker.evidence ?? '');
  const message = normalizeForGrounding(lastUserText);
  if (quote.length < 3 || !message.includes(quote)) {
    const fromHistory = quote.length >= 3 && earlierUserTexts.some((t) => normalizeForGrounding(t).includes(quote));
    return { type: marker.type, status: 'UNGROUNDED', ...(fromHistory ? { fromHistory } : {}) };
  }
  if (!GROUNDABLE.includes(marker.type)) return { type: marker.type, status: 'GROUNDED_AFFIRMED' };
  // The sentence that holds the quote: denial forms must cover the quote itself.
  const at = message.indexOf(quote);
  const start = Math.max(message.lastIndexOf('.', at), message.lastIndexOf('!', at), message.lastIndexOf('?', at)) + 1;
  const endHits = ['.', '!', '?'].map((c) => message.indexOf(c, at + quote.length)).filter((i) => i >= 0);
  const sentence = message.slice(start, endHits.length ? Math.min(...endHits) : message.length);
  const denied = DENIAL_FORMS.some((p) => {
    const m = sentence.match(p);
    if (!m || m.index === undefined) return false;
    const denialStart = start + m.index;
    const denialEnd = denialStart + m[0].length;
    return denialStart < at + quote.length && denialEnd > at; // overlaps the quote
  });
  return { type: marker.type, status: denied && !isAmbivalentDenialContext(sentence) ? 'GROUNDED_NEGATED' : 'GROUNDED_AFFIRMED' };
}

export interface GroundedFusionInput {
  neuralLevel: RiskLevel;
  /** Level from the accepted markers (unique types), see acceptedNeuralLevel. */
  acceptedLevel: RiskLevel;
  lexicalLevel: RiskLevel;
  lexicalDenial: boolean;
  riskMemory: RiskMemory;
}

/**
 * §3.4. Never raises risk (fused' ≤ fused). Any reduction keeps a floor of
 * ELEVATED, except — in the LENIENT variant only — when the lexical channel
 * itself sees the denial and risk memory is not ACTIVE; then the floor is the
 * lexical level. The STRICT variant keeps ELEVATED on every reduction.
 */
export function groundedFusion(i: GroundedFusionInput, variant: 'lenient' | 'strict'): RiskLevel {
  const fused = max(i.neuralLevel, i.lexicalLevel);
  let next = min(max(i.acceptedLevel, i.lexicalLevel), fused);
  if (idx(next) < idx(fused)) {
    const lenientExit = variant === 'lenient' && i.lexicalDenial && i.riskMemory !== 'ACTIVE';
    next = max(next, lenientExit ? i.lexicalLevel : 'ELEVATED');
  }
  return next;
}

/** Neural level from the markers that survive grounding, counting each type once (as orchestrator.ts does). */
export function acceptedNeuralLevel(markers: RiskMarker[], groundings: MarkerGrounding[]): RiskLevel {
  const kept = new Set<RiskMarker['type']>();
  markers.forEach((m, k) => {
    const g = groundings[k];
    const dropped = GROUNDABLE.includes(m.type) && (g.status === 'UNGROUNDED' || g.status === 'GROUNDED_NEGATED');
    if (!dropped) kept.add(m.type);
  });
  return scoreToRiskLevel([...kept].reduce((sum, t) => sum + MARKER_WEIGHTS[t], 0));
}

export interface GroundingShadow {
  mode: 'shadow';
  markers: MarkerGrounding[];
  lexicalDenial: boolean;
  actualRisk: RiskLevel;
  wouldBeLenient: RiskLevel;
  wouldBeStrict: RiskLevel;
}

/** Everything the certificate records for one turn. Never used to decide. */
export function computeGroundingShadow(args: {
  markers: RiskMarker[];
  lastUserText: string;
  earlierUserTexts: string[];
  neuralLevel: RiskLevel;
  lexicalLevel: RiskLevel;
  lexicalDenial: boolean;
  riskMemory: RiskMemory;
}): GroundingShadow {
  const groundings = args.markers.map((m) => groundMarker(m, args.lastUserText, args.earlierUserTexts));
  const input: GroundedFusionInput = {
    neuralLevel: args.neuralLevel,
    acceptedLevel: acceptedNeuralLevel(args.markers, groundings),
    lexicalLevel: args.lexicalLevel,
    lexicalDenial: args.lexicalDenial,
    riskMemory: args.riskMemory,
  };
  return {
    mode: 'shadow',
    markers: groundings,
    lexicalDenial: args.lexicalDenial,
    actualRisk: max(args.neuralLevel, args.lexicalLevel),
    wouldBeLenient: groundedFusion(input, 'lenient'),
    wouldBeStrict: groundedFusion(input, 'strict'),
  };
}
