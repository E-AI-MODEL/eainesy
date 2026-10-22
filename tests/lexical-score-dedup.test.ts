import { describe, expect, test } from 'bun:test';
import { collectLexicalMarkers, lexicalRiskScore, scoreToRiskLevel } from '../src/lib/eainesy/lexicon';
import type { RiskMarker } from '../src/lib/eainesy/types';

const score = (s: string) => {
  const { markers } = collectLexicalMarkers(s);
  const value = lexicalRiskScore(markers, 0);
  return { markers, value, level: scoreToRiskLevel(value) };
};

describe('production lexical score counts each marker category once', () => {
  test('two hopelessness expressions retain evidence but do not inflate to CRISIS', () => {
    for (const s of [
      'Fictieve zin: ik heb geen zin meer. Het voelt hopeloos.',
      'Fictieve zin: ik zie het niet meer zitten en ik voel me hopeloos.',
    ]) {
      const r = score(s);
      expect(r.markers.filter(m => m.type === 'HOPELESSNESS').length).toBeGreaterThan(1);
      expect(r.value).toBe(2.5);
      expect(r.level).toBe('ELEVATED');
    }
  });

  test('single hopelessness signal remains elevated', () => {
    expect(score('Fictieve zin: ik heb geen zin meer.').level).toBe('ELEVATED');
  });

  test('distinct categories still add to HIGH', () => {
    const r = score('Fictieve zin: ik voel me hopeloos en heel alleen.');
    expect(r.markers.map(m => m.type)).toContain('HOPELESSNESS');
    expect(r.markers.map(m => m.type)).toContain('ISOLATION');
    expect(r.level).toBe('HIGH');
  });

  test('an explicit suicidal wish always retains the CRISIS floor', () => {
    expect(score('Fictieve zin: ik wil dood en ik wil niet meer leven.').level).toBe('CRISIS');
  });

  test('neural-style duplicate markers also score exactly once per type', () => {
    const a: RiskMarker[] = [
      { type: 'HOPELESSNESS', evidence: 'hopeloos' },
      { type: 'HOPELESSNESS', evidence: 'geen hoop' },
      { type: 'HOPELESSNESS', evidence: 'alles zinloos' },
    ];
    expect(lexicalRiskScore(a, 0)).toBe(2.5);
    expect(lexicalRiskScore([...a, {type:'ISOLATION',evidence:'heel alleen'}], 0)).toBe(3.5);
  });

  test('protective factors do not reduce an acute marker below its floor', () => {
    const markers: RiskMarker[] = [
      {type:'SUICIDAL_IDEATION',evidence:'wil dood'},
      {type:'SUICIDAL_IDEATION',evidence:'niet meer leven'},
      {type:'HOPELESSNESS',evidence:'hopeloos'},
    ];
    expect(lexicalRiskScore(markers, 3)).toBe(5.5);
    expect(scoreToRiskLevel(lexicalRiskScore(markers, 3))).toBe('CRISIS');
  });

  test('protective factors still reduce non-acute combined risk', () => {
    const markers: RiskMarker[] = [
      {type:'HOPELESSNESS',evidence:'geen hoop'},
      {type:'HOPELESSNESS',evidence:'hopeloos'},
      {type:'ISOLATION',evidence:'alleen'},
    ];
    expect(lexicalRiskScore(markers, 2)).toBe(1.5);
    expect(scoreToRiskLevel(lexicalRiskScore(markers, 2))).toBe('ELEVATED');
  });

  test('no markers stays NONE', () => {
    expect(scoreToRiskLevel(lexicalRiskScore([], 0))).toBe('NONE');
  });
});
