/**
 * Research-only tests for text anchoring and possible overlap.
 * No gold-standard risk labels and no production path are changed.
 */
import { describe, expect, test } from 'bun:test';
import {
  exactEvidenceSpans, observeMarkerSourceContext, verifyEvidenceSpan,
} from '../src/lib/eainesy/context-evidence-shadow';
import type { RiskMarker } from '../src/lib/eainesy/types';

const m = (evidence: string, type: RiskMarker['type'] = 'HOPELESSNESS'): RiskMarker =>
  ({ type, evidence });

describe('source anchoring (not semantic validation)', () => {
  test('exact occurrence returns a reproducible half-open source span', () => {
    const src = 'Ik voel me hopeloos vandaag.';
    const spans = exactEvidenceSpans(src, 'hopeloos');
    expect(spans).toEqual([{ startUtf16: 11, endUtf16: 19 }]);
    expect(src.slice(spans[0].startUtf16, spans[0].endUtf16)).toBe('hopeloos');
  });

  test('UTF-16 offsets correctly handle emoji and accented characters', () => {
    const src = '🙂 Ik voel me suïcidaal';
    const evidence = 'suïcidaal';
    const spans = exactEvidenceSpans(src, evidence);
    expect(spans).toHaveLength(1);
    expect(src.slice(spans[0].startUtf16, spans[0].endUtf16)).toBe(evidence);
    expect(verifyEvidenceSpan(src, evidence, spans[0])).toBe(true);
  });

  test('two identical expressions give two candidates rather than an invented unique source', () => {
    const src = 'hopeloos, gisteren hopeloos';
    const observation = observeMarkerSourceContext(src, [m('hopeloos')]);
    expect(observation.markers[0].occurrenceStatus).toBe('repeated');
    expect(observation.markers[0].candidates).toHaveLength(2);
    expect(observation.hasMultipleCandidateLocations).toBe(true);
  });

  test('partial overlap within one type is visible but never automatically merged', () => {
    const result = observeMarkerSourceContext('ik voel me heel hopeloos.', [
      m('heel hopeloos'), m('hopeloos'),
    ]);
    expect(result.sameTypePairs).toEqual([{
      firstIndex: 0, secondIndex: 1, type: 'HOPELESSNESS',
      possibleOverlap: true, unavoidableOverlap: true,
    }]);
    expect(result.markers).toHaveLength(2);
  });

  test('two independent literal spans of the same marker type remain separate', () => {
    const result = observeMarkerSourceContext('hopeloos, maar ik zie geen hoop', [
      m('hopeloos'), m('geen hoop'),
    ]);
    expect(result.sameTypePairs[0].possibleOverlap).toBe(false);
    expect(result.sameTypePairs[0].unavoidableOverlap).toBe(false);
    expect(result.markers).toHaveLength(2);
  });

  test('ambiguous repeated evidence may overlap but need not refer to same span', () => {
    const result = observeMarkerSourceContext('hopeloos hopeloos', [m('hopeloos'), m('hopeloos')]);
    expect(result.sameTypePairs[0].possibleOverlap).toBe(true);
    expect(result.sameTypePairs[0].unavoidableOverlap).toBe(false);
  });

  test('different marker types are not candidates for same-type deduplication', () => {
    const result = observeMarkerSourceContext('geen hoop', [m('geen hoop'), m('geen hoop', 'SUICIDAL_IDEATION')]);
    expect(result.sameTypePairs).toEqual([]);
  });

  test('a fabricated/empty citation stays unanchored and does not crash', () => {
    const result = observeMarkerSourceContext('Ik wil alleen thee.', [m('ik wil dood'), m('   ')]);
    expect(result.markers.map(x => x.occurrenceStatus)).toEqual(['absent', 'absent']);
    expect(result.hasUnanchoredEvidence).toBe(true);
    expect(verifyEvidenceSpan('abc', '', {startUtf16: 0, endUtf16: 1})).toBe(false);
  });

  test('overlapping literal source occurrences are all retained', () => {
    expect(exactEvidenceSpans('aaaa', 'aa')).toEqual([
      {startUtf16: 0, endUtf16: 2},
      {startUtf16: 1, endUtf16: 3},
      {startUtf16: 2, endUtf16: 4},
    ]);
  });

  test('a quote is still only a quote; speaker, timing, polarity are not invented', () => {
    const result = observeMarkerSourceContext('In het boek staat "ik wil dood".', [
      m('ik wil dood', 'SUICIDAL_IDEATION'),
    ]);
    expect(result.markers[0].occurrenceStatus).toBe('unique');
    expect(result.markers[0]).toMatchObject({
      experiencer: 'unassessed', temporality: 'unassessed', polarity: 'unassessed',
    });
    expect(result.scope).toBe('unassessed');
  });

  test('negative statement cannot be converted to positive by this helper', () => {
    const result = observeMarkerSourceContext('Ik wil niet dood.', [m('niet dood', 'SUICIDAL_IDEATION')]);
    expect(result.markers[0].polarity).toBe('unassessed');
    expect(result.markers[0].occurrenceStatus).toBe('unique');
  });

  test('span validation rejects wrong coordinates or invented evidence', () => {
    expect(verifyEvidenceSpan('hopeloos', 'hopeloos', {startUtf16: -1, endUtf16: 8})).toBe(false);
    expect(verifyEvidenceSpan('hopeloos', 'hopeloos', {startUtf16: 0, endUtf16: 999})).toBe(false);
    expect(verifyEvidenceSpan('hopeloos', 'hopeloos', {startUtf16: 0.5, endUtf16: 8})).toBe(false);
    expect(verifyEvidenceSpan('hopeloos', 'anders', {startUtf16: 0, endUtf16: 8})).toBe(false);
  });

  test('output contains no evidence text and does not alter passed markers', () => {
    const markers = [m('tekst die niet voorkomt')];
    const before = JSON.stringify(markers);
    const result = observeMarkerSourceContext('Zonder opvallende woorden.', markers);
    expect(JSON.stringify(markers)).toBe(before);
    expect(JSON.stringify(result)).not.toContain('tekst die niet voorkomt');
    expect(result.markers[0].occurrenceStatus).toBe('absent');
  });
});
