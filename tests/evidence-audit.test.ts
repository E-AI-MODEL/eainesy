/**
 * Non-blocking evidence-provenance diagnostics.
 * These assertions do not claim evidence is affirmed or risk is present.
 */
import { describe, expect, test } from 'bun:test';
import { auditRiskEvidence } from '../src/lib/eainesy/evidence-audit';
import type { RiskMarker } from '../src/lib/eainesy/types';

const marker = (evidence: string, type: RiskMarker['type'] = 'SUICIDAL_IDEATION'): RiskMarker =>
  ({ type, evidence });

describe('risk-marker evidence audit (research only)', () => {
  test('exact last-user evidence has traceable provenance', () => {
    const r = auditRiskEvidence('Ik voel me hopeloos.', [marker('hopeloos', 'HOPELESSNESS')]);
    expect(r.markers[0].match).toBe('exact_last_user');
  });

  test('whitespace and case differences are distinguishable from an exact quote', () => {
    const r = auditRiskEvidence('Ik voel me\nheel hopeloos.', [marker('HEEL HOPELOOS', 'HOPELESSNESS')]);
    expect(r.markers[0].match).toBe('normalized_last_user');
  });

  test('quotes appearing only in a previous user turn are marked as such', () => {
    const r = auditRiskEvidence('Hoe zat het ook alweer?', [marker('ik voelde me hopeloos', 'HOPELESSNESS')],
      ['Vorige week zei ik: ik voelde me hopeloos']);
    expect(r.markers[0].match).toBe('exact_prior_user');
  });

  test('do not infer source from an assistant response or system prompt', () => {
    const r = auditRiskEvidence('Dank je wel.', [marker('ik wil dood')]);
    expect(r.markers[0].match).toBe('untraced');
  });

  test('fabricated evidence is reported, not silently accepted', () => {
    const r = auditRiskEvidence('Ik wil een kop thee.', [marker('ik wil niet meer leven')]);
    expect(r.markers[0].match).toBe('untraced');
    expect(r.counts.untraced).toBe(1);
  });

  test('empty evidence is separately visible', () => {
    const r = auditRiskEvidence('Het gaat wel.', [marker('   ')]);
    expect(r.markers[0].match).toBe('empty');
  });

  test('a quoted example can match but is not proof of lived risk', () => {
    const r = auditRiskEvidence('In de les staat de zin: "ik wil niet meer leven".', [marker('ik wil niet meer leven')]);
    expect(r.markers[0].match).toBe('exact_last_user');
  });

  test('a negated sentence can match but is not proof of affirmed risk', () => {
    const r = auditRiskEvidence('Ik wil niet dood.', [marker('wil niet dood')]);
    expect(r.markers[0].match).toBe('exact_last_user');
  });

  test('a third-person report can match but not identify the speaker', () => {
    const r = auditRiskEvidence('Mijn broer heeft suïcidale gedachten.', [marker('suïcidale gedachten')]);
    expect(r.markers[0].match).toBe('exact_last_user');
  });

  test('aggregate only anonymous match categories, not the source text', () => {
    const r = auditRiskEvidence('Ik voel me hopeloos.', [marker('hopeloos','HOPELESSNESS'), marker('fictief verzonnen bewijs')]);
    expect(r.markers.map(m => m.match)).toEqual(['exact_last_user', 'untraced']);
    expect(r.counts.exact_last_user).toBe(1);
    expect(r.counts.untraced).toBe(1);
    const json = JSON.stringify(r);
    expect(json).not.toContain('fictief verzonnen bewijs');
    expect(json).not.toContain('Ik voel me hopeloos');
  });

  test('source tracing never mutates or suppresses the supplied risk markers', () => {
    const markers = [marker('niet in tekst')];
    const snapshot = JSON.stringify(markers);
    const result = auditRiskEvidence('ander bericht', markers);
    expect(JSON.stringify(markers)).toBe(snapshot);
    expect(result.markers[0].type).toBe('SUICIDAL_IDEATION');
  });
});
