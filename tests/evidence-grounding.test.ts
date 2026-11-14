/**
 * Evidence grounding (design #40) in SHADOW MODE: deterministic checks of the
 * grounding rules, the exhaustive floor invariant, and that the pipeline only
 * RECORDS the outcome — risk and action stay exactly as before.
 */
import { describe, expect, test, beforeEach } from 'bun:test';
import { collectLexicalDenials } from '../src/lib/eainesy/lexicon';
import {
  groundMarker, groundedFusion, computeGroundingShadow, type GroundedFusionInput,
} from '../src/lib/eainesy/evidence-grounding';
import { processTurn } from '../src/lib/eainesy/orchestrator';
import { RISK_MEMORY_STATES, type RiskLevel } from '../src/lib/eainesy/types';
import type { FakeDb } from './support/fake-db';

const fake = (globalThis as unknown as { __fakeDb: FakeDb }).__fakeDb;
const SI = (evidence: string) => ({ type: 'SUICIDAL_IDEATION' as const, evidence });
const N02 = 'Fictieve casus: ik wil niet dood. Ik ben veilig en wil alleen even praten.';

describe('grounding a model marker in the LAST user message', () => {
  test('N02: the quoted denial is grounded and negated', () => {
    expect(groundMarker(SI('ik wil niet dood'), N02).status).toBe('GROUNDED_NEGATED');
  });
  test('typographic quotes and spacing do not break grounding', () => {
    expect(groundMarker(SI('I don’t  want to die'), "Honestly, I don't want to die.").status).toBe('GROUNDED_NEGATED');
  });
  test('a quote that is not in the last message is UNGROUNDED, and flagged when it came from history', () => {
    const g = groundMarker(SI('ik wil niet meer leven'), N02, ['ik wil niet meer leven en heb voorbereidingen getroffen']);
    expect(g.status).toBe('UNGROUNDED');
    expect(g.fromHistory).toBe(true);
  });
  test('an affirmed wish stays affirmed ("niet meer" is not a denial)', () => {
    expect(groundMarker(SI('ik wil niet meer'), 'ik wil niet meer, ik kan het niet aan').status).toBe('GROUNDED_AFFIRMED');
  });
  test('a denial followed by "maar … kan niet meer" is ambivalent, not negated', () => {
    expect(groundMarker(SI('ik wil niet dood'), 'ik wil niet meer, ik wil niet dood maar ik kan niet meer').status).toBe('GROUNDED_AFFIRMED');
  });
  test('minimising ("niet dat ik dood wil, maar…") is not a denial', () => {
    expect(groundMarker(SI('dood wil'), 'Niet dat ik dood wil, maar ik zie het niet meer zitten.').status).toBe('GROUNDED_AFFIRMED');
  });
  test('irony markers ("heus … hoor") are not a denial', () => {
    expect(groundMarker(SI('ik wil heus niet dood'), 'ik wil heus niet dood hoor').status).toBe('GROUNDED_AFFIRMED');
  });
  test('a denial elsewhere in the message does not negate a different affirmed quote', () => {
    expect(groundMarker(SI('ik heb de pillen al klaargelegd'), 'Ik wil niet dood. Ik heb de pillen al klaargelegd.').status).toBe('GROUNDED_AFFIRMED');
  });
  test('non-groundable types (e.g. HOPELESSNESS) are never dropped', () => {
    expect(groundMarker({ type: 'HOPELESSNESS', evidence: 'ik wil niet dood' }, N02).status).toBe('GROUNDED_AFFIRMED');
  });
});

describe('the lexical channel\'s own denial observation', () => {
  test.each([
    ['Ik wil niet dood.', true],
    [N02, true],
    ['I do not want to die. I feel safe.', true],
    ['Ik wil niet dood, ik heb de pillen al klaargelegd.', false], // affirmed plan
    ['ik wil heus niet dood hoor', false], // irony
    ['ik wil niet dood maar ik kan niet meer', false], // turn + risk word
    ['Niet dat ik dood wil.', false], // no denial form, minimising
    ['Ik voel me rustig vandaag.', false], // nothing to deny
  ])('%s → %p', (text, expected) => {
    expect(collectLexicalDenials(text).denial).toBe(expected);
  });
});

describe('groundedFusion: exhaustive floor invariant (design §3.5)', () => {
  const LEVELS: RiskLevel[] = ['NONE', 'ELEVATED', 'HIGH', 'CRISIS'];
  const i = (l: RiskLevel) => LEVELS.indexOf(l);
  test('fused\' ≤ fused, and any reduction keeps ELEVATED unless the lenient exit applies', () => {
    let states = 0;
    for (const variant of ['lenient', 'strict'] as const)
      for (const neuralLevel of LEVELS) for (const acceptedLevel of LEVELS) for (const lexicalLevel of LEVELS)
        for (const lexicalDenial of [false, true]) for (const riskMemory of RISK_MEMORY_STATES) {
          const input: GroundedFusionInput = { neuralLevel, acceptedLevel, lexicalLevel, lexicalDenial, riskMemory };
          const fused = LEVELS[Math.max(i(neuralLevel), i(lexicalLevel))];
          const next = groundedFusion(input, variant);
          states++;
          expect(i(next)).toBeLessThanOrEqual(i(fused));
          if (i(next) < i(fused)) {
            const lenientExit = variant === 'lenient' && lexicalDenial && riskMemory !== 'ACTIVE' && next === lexicalLevel;
            expect(i(next) >= i('ELEVATED') || lenientExit).toBe(true);
          }
          if (variant === 'strict' && i(next) < i(fused)) expect(i(next)).toBeGreaterThanOrEqual(i('ELEVATED'));
        }
    expect(states).toBe(2 * 4 * 4 * 4 * 2 * 3);
  });
});

describe('shadow outcomes for the P0 patterns', () => {
  const base = { earlierUserTexts: [], neuralLevel: 'CRISIS' as RiskLevel, lexicalLevel: 'NONE' as RiskLevel };
  test('N02 (fresh session): lenient → NONE, strict → ELEVATED, actual stays CRISIS', () => {
    const s = computeGroundingShadow({ ...base, markers: [SI('ik wil niet dood')], lastUserText: N02, lexicalDenial: true, riskMemory: 'NONE' });
    expect(s).toMatchObject({ actualRisk: 'CRISIS', wouldBeLenient: 'NONE', wouldBeStrict: 'ELEVATED' });
  });
  test('S01 (after a crisis, risk memory ACTIVE): never below ELEVATED', () => {
    const s = computeGroundingShadow({ ...base, markers: [SI('ik wil niet dood')], lastUserText: N02, lexicalDenial: true, riskMemory: 'ACTIVE' });
    expect(s).toMatchObject({ wouldBeLenient: 'ELEVATED', wouldBeStrict: 'ELEVATED' });
  });
  test('a real crisis with an affirmed, grounded marker stays CRISIS in both variants', () => {
    const text = 'Fictieve casus: ik wil niet meer leven en heb voorbereidingen getroffen.';
    const s = computeGroundingShadow({ ...base, markers: [SI('ik wil niet meer leven')], lastUserText: text, lexicalDenial: false, riskMemory: 'NONE' });
    expect(s).toMatchObject({ wouldBeLenient: 'CRISIS', wouldBeStrict: 'CRISIS' });
  });
  test('an ungrounded (paraphrased) marker without lexical denial floors at ELEVATED in both variants', () => {
    const s = computeGroundingShadow({ ...base, markers: [SI('wants to die')], lastUserText: 'Het was een rare week.', lexicalDenial: false, riskMemory: 'NONE' });
    expect(s).toMatchObject({ wouldBeLenient: 'ELEVATED', wouldBeStrict: 'ELEVATED' });
  });
});

describe('pipeline: shadow is recorded, never decides', () => {
  beforeEach(() => fake.__reset());
  test('N02 with the P0 model reading: risk CRISIS and CRISIS_PROTOCOL unchanged; shadow recorded', async () => {
    const s = await fake.session.create({ data: { label: 'scenario-grounding' } });
    const frame = { intent: 'CRISIS_SIGNAL' as const, emotions: [], topics: [], riskMarkers: [SI('ik wil niet dood')], language: 'nl' as const, paraphrase: 'denial', parseConfidence: 0.9 };
    const r = await processTurn(s.id as string, N02, { presetFrame: frame, skipGeneration: true, origin: 'scenario' });
    expect(r.certificate.riskLevel).toBe('CRISIS');
    expect(r.action).toBe('CRISIS_PROTOCOL');
    expect(r.certificate.groundingShadow).toMatchObject({ mode: 'shadow', actualRisk: 'CRISIS', wouldBeLenient: 'NONE', wouldBeStrict: 'ELEVATED', lexicalDenial: true });
    expect(r.certificate.groundingShadow?.markers[0].status).toBe('GROUNDED_NEGATED');
  });
  test('no valid frame → no shadow (UNKNOWN policy untouched)', async () => {
    const s = await fake.session.create({ data: { label: 'scenario-grounding' } });
    const r = await processTurn(s.id as string, 'qwerty zzz', { presetFrame: null, skipGeneration: true, origin: 'scenario' });
    expect(r.certificate.groundingShadow).toBeUndefined();
  });
});
