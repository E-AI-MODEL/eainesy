/**
 * Opt-in research aid: does a risk-marker's quoted evidence occur in a
 * user-authored message? This is NOT a risk classifier or a truth check.
 *
 * Never auto-reject or downgrade a risk marker based on this result.
 * The absence of an exact quote can be a paraphrase, a formatting mismatch,
 * or a real fabrication. An exact quote can still be negated, quoted,
 * third-person, historical, or part of a prompt injection.
 *
 * Data minimisation: the output contains only marker indices, types and match
 * categories, never user text or evidence strings. No logs/persistence here.
 */
import type { RiskMarker } from './types';

export type EvidenceMatch =
  | 'exact_last_user'
  | 'normalized_last_user'
  | 'exact_prior_user'
  | 'normalized_prior_user'
  | 'untraced'
  | 'empty';

export interface EvidenceAuditItem {
  markerIndex: number;
  type: RiskMarker['type'];
  match: EvidenceMatch;
}

export interface EvidenceAuditResult {
  markers: EvidenceAuditItem[];
  counts: Record<EvidenceMatch, number>;
}

function normalized(s: string): string {
  // Conservative typography normalisation only. Do not remove negation,
  // word order, accents or punctuation: that would invent a source match.
  return s.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase();
}

function traceOne(evidence: string, lastUserText: string, priorUserTexts: readonly string[]): EvidenceMatch {
  if (!evidence.trim()) return 'empty';
  if (lastUserText.includes(evidence)) return 'exact_last_user';
  if (normalized(lastUserText).includes(normalized(evidence))) return 'normalized_last_user';
  for (const msg of priorUserTexts) {
    if (msg.includes(evidence)) return 'exact_prior_user';
  }
  for (const msg of priorUserTexts) {
    if (normalized(msg).includes(normalized(evidence))) return 'normalized_prior_user';
  }
  return 'untraced';
}

/**
 * Pass ONLY real user messages in priorUserTexts. Never model/assistant
 * messages, prompts, generated paraphrases or instructions supplied by tools.
 *
 * The status means quote occurrence, NOT that the speaker endorsed the words.
 */
export function auditRiskEvidence(
  lastUserText: string,
  markers: readonly RiskMarker[],
  priorUserTexts: readonly string[] = [],
): EvidenceAuditResult {
  const counts: Record<EvidenceMatch, number> = {
    exact_last_user: 0,
    normalized_last_user: 0,
    exact_prior_user: 0,
    normalized_prior_user: 0,
    untraced: 0,
    empty: 0,
  };
  const items = markers.map((marker, markerIndex): EvidenceAuditItem => {
    const match = traceOne(marker.evidence, lastUserText, priorUserTexts);
    counts[match]++;
    return { markerIndex, type: marker.type, match };
  });
  return { markers: items, counts };
}
