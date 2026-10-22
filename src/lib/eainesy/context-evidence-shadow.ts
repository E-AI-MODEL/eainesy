/**
 * Read-only research observation of source positions and possible evidence
 * overlap. This is NOT a risk classifier and never changes the decision,
 * risk score, marker list, user response, or clinical interpretation.
 *
 * All offsets use JavaScript UTF-16 code units (String.prototype.slice).
 * An exact occurrence says nothing about who experienced a condition, when,
 * whether it was quoted, hypothetical, negated, or a prompt instruction.
 */
import type { RiskMarker } from './types';

export type ScopeUnassessed = 'unassessed';
export type OccurrenceStatus = 'absent' | 'unique' | 'repeated';

export interface EvidenceSpan {
  startUtf16: number;
  endUtf16: number; // exclusive
}

export interface SourceMarkerObservation {
  markerIndex: number;
  type: RiskMarker['type'];
  occurrenceStatus: OccurrenceStatus;
  candidates: EvidenceSpan[];
  experiencer: ScopeUnassessed;
  temporality: ScopeUnassessed;
  polarity: ScopeUnassessed;
}

export interface SameTypeOverlapObservation {
  firstIndex: number;
  secondIndex: number;
  type: RiskMarker['type'];
  /** At least one possible pair of source occurrences intersects. */
  possibleOverlap: boolean;
  /** Every possible pair intersects (false with absent/unknown sources). */
  unavoidableOverlap: boolean;
}

export interface ContextSourceObservation {
  markers: SourceMarkerObservation[];
  sameTypePairs: SameTypeOverlapObservation[];
  hasUnanchoredEvidence: boolean;
  hasMultipleCandidateLocations: boolean;
  scope: ScopeUnassessed;
}

/** Exact source-span search, including overlapping occurrences of text. */
export function exactEvidenceSpans(source: string, evidence: string): EvidenceSpan[] {
  if (evidence.trim().length === 0) return [];
  const candidates: EvidenceSpan[] = [];
  let from = 0;
  while (from <= source.length - evidence.length) {
    const start = source.indexOf(evidence, from);
    if (start < 0) break;
    candidates.push({ startUtf16: start, endUtf16: start + evidence.length });
    from = start + 1;
  }
  return candidates;
}

function intersects(a: EvidenceSpan, b: EvidenceSpan): boolean {
  return a.startUtf16 < b.endUtf16 && b.startUtf16 < a.endUtf16;
}

/**
 * These comparisons are ambiguity observations, NOT deduplication decisions:
 * repeated occurrences may refer to different statements. In particular
 * identical marker types with different spans must NOT be merged here.
 */
export function observeMarkerSourceContext(
  source: string,
  markers: readonly RiskMarker[],
): ContextSourceObservation {
  const observed = markers.map((marker, markerIndex): SourceMarkerObservation => {
    const candidates = exactEvidenceSpans(source, marker.evidence);
    return {
      markerIndex,
      type: marker.type,
      occurrenceStatus: candidates.length === 0 ? 'absent' : candidates.length === 1 ? 'unique' : 'repeated',
      candidates,
      experiencer: 'unassessed',
      temporality: 'unassessed',
      polarity: 'unassessed',
    };
  });
  const sameTypePairs: SameTypeOverlapObservation[] = [];
  for (let i = 0; i < observed.length; i++) {
    for (let j = i + 1; j < observed.length; j++) {
      const a = observed[i], b = observed[j];
      if (a.type !== b.type) continue;
      const allPairs = a.candidates.flatMap(x => b.candidates.map(y => intersects(x, y)));
      sameTypePairs.push({
        firstIndex: i,
        secondIndex: j,
        type: a.type,
        possibleOverlap: allPairs.some(Boolean),
        unavoidableOverlap: allPairs.length > 0 && allPairs.every(Boolean),
      });
    }
  }
  return {
    markers: observed,
    sameTypePairs,
    hasUnanchoredEvidence: observed.some(x => x.occurrenceStatus === 'absent'),
    hasMultipleCandidateLocations: observed.some(x => x.occurrenceStatus === 'repeated'),
    scope: 'unassessed',
  };
}

/** Validate only the exact quote of a proposed human-selected span. */
export function verifyEvidenceSpan(source: string, evidence: string, span: EvidenceSpan): boolean {
  const { startUtf16: start, endUtf16: end } = span;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) &&
    start >= 0 && end > start && end <= source.length &&
    evidence.trim().length > 0 && source.slice(start, end) === evidence;
}
