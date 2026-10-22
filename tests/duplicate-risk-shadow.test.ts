/**
 * Research-only counterfactual: compare the existing per-pattern risk score
 * with a hypothetical once-per-type score. DO NOT use the counterfactual
 * to decide any response, adjust any patient risk or pass a safety gate.
 */
import { describe, expect, test } from 'bun:test';
import { collectLexicalMarkers, lexicalRiskScore, scoreToRiskLevel } from '../src/lib/eainesy/lexicon';

const CASES = [
  { id: 'D01', text: 'Fictieve zin: ik heb geen zin meer. Het voelt hopeloos.' },
  { id: 'D02', text: 'Fictieve zin: ik heb geen zin meer.' },
  { id: 'D03', text: 'Fictieve zin: ik zie het niet meer zitten en ik voel me hopeloos.' },
  { id: 'D04', text: 'Fictieve zin: ik wil dood en ik wil niet meer leven.' },
  { id: 'D05', text: 'Fictieve zin: ik ben hopeloos en voel me heel alleen.' },
] as const;

describe('shadow-only duplicate marker sensitivity', () => {
  test('observe raw vs deduplicated marker weights without changing production scoring', () => {
    const out = CASES.map(c => {
      const { markers } = collectLexicalMarkers(c.text);
      const types = markers.map(x => x.type);
      const firstPerType = markers.filter((x, i) => types.indexOf(x.type) === i);
      const raw = lexicalRiskScore(markers, 0);
      const unique = lexicalRiskScore(firstPerType, 0);
      return {
        id: c.id, types, rawScore: raw, rawLevel: scoreToRiskLevel(raw),
        oncePerTypeScore: unique, oncePerTypeLevel: scoreToRiskLevel(unique),
        duplicateTypes: [...new Set(types.filter((x,i)=>types.indexOf(x)!==i))],
      };
    });
    expect(out).toHaveLength(CASES.length);
    expect(out.every(x => x.oncePerTypeScore <= x.rawScore)).toBe(true);
    // Printed only as an *unscored* shadow observation. Not a clinical target.
    console.log('EAINESY_DUPLICATE_SHADOW_V1=' + JSON.stringify(out));
  });
});
