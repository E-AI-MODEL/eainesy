import { describe, expect, test } from 'bun:test';
import { RiskMarkerSchema, FrameSchema } from '../src/lib/eainesy/types';
import { observeMarkerSourceContext } from '../src/lib/eainesy/context-evidence-shadow';

const marker = { type: 'SUICIDAL_IDEATION', evidence: 'suïcidale gedachten' };
const scope = { experiencer: 'other', temporality: 'current', polarity: 'affirmed' };

describe('optional marker scope compatibility and boundaries', () => {
  test('legacy unscoped marker remains valid', () => {
    expect(RiskMarkerSchema.safeParse(marker).success).toBe(true);
  });
  test('fully scoped marker accepts attribution without validating its truth', () => {
    expect(RiskMarkerSchema.safeParse({ ...marker, scope }).success).toBe(true);
  });
  test('unknown and mixed scope are explicit valid outcomes', () => {
    expect(RiskMarkerSchema.safeParse({ ...marker, scope: {
      experiencer: 'mixed', temporality: 'unknown', polarity: 'uncertain',
    }}).success).toBe(true);
  });
  test('invented scope enums are rejected', () => {
    expect(RiskMarkerSchema.safeParse({ ...marker, scope: { ...scope, experiencer: 'me_and_everyone' } }).success).toBe(false);
  });
  test('legacy frames with no scopes stay compatible', () => {
    expect(FrameSchema.safeParse({
      intent:'CRISIS_SIGNAL', emotions:[], topics:[], riskMarkers:[marker],
      language:'nl', paraphrase:'Een fictieve situatie.', parseConfidence:0.8,
    }).success).toBe(true);
  });
  test('scope claims do not bypass exact-source tracing', () => {
    const r = observeMarkerSourceContext('Mijn broer heeft suïcidale gedachten.', [{...marker, scope}]);
    expect(r.markers[0].occurrenceStatus).toBe('unique');
    expect(r.scope).toBe('unassessed');
    expect(r.markers[0].experiencer).toBe('unassessed');
  });
  test('a scope cannot establish evidence that does not appear', () => {
    const r = observeMarkerSourceContext('Ik wil thee.', [{...marker, scope:{...scope, experiencer:'self'}}]);
    expect(r.hasUnanchoredEvidence).toBe(true);
  });
});
