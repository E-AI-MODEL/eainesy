/**
 * P0 deviation N06: a readable medication question must always end in a
 * referral to the prescriber/GP (or stricter), whatever the confidence band,
 * novelty or PII state. Deterministic controller checks — not live GLM.
 */
import { describe, expect, test } from 'bun:test';
import { decide } from '../src/lib/eainesy/controller';
import { cannedReplyFor, verifyOutput } from '../src/lib/eainesy/outputpolicy';
import { runModelCheck } from '../src/lib/eainesy/modelchecker';
import { enumerateControllerInputs, type ControllerInput, type Plan } from '../src/lib/eainesy/types';

const REFERRAL_OR_STRICTER = ['REFERRAL', 'SAFETY_RESPONSE', 'CRISIS_PROTOCOL'];
const n06: ControllerInput = {
  intent: 'MEDICATION_QUESTION', riskLevel: 'NONE', frameValidity: 'VALID',
  confidenceBand: 'HIGH', distressLevel: 'NONE', piiState: 'CLEAN', novelty: 'NOVEL_FRAME',
};

describe('medication question always ends in a referral (N06)', () => {
  test('N06 shape (MEDICATION_QUESTION + NOVEL_FRAME) is P52 REFERRAL, not P21 CLARIFY', () => {
    const d = decide(n06);
    expect(d.ruleId).toBe('P52');
    expect(d.action).toBe('REFERRAL');
  });

  test('low confidence, novel frame or personal data no longer divert it', () => {
    expect(decide({ ...n06, confidenceBand: 'LOW' }).action).toBe('REFERRAL');
    expect(decide({ ...n06, confidenceBand: 'LOW', novelty: 'NOVEL_FRAME' }).action).toBe('REFERRAL');
    const pii = decide({ ...n06, piiState: 'PII_DETECTED' });
    expect(pii.ruleId).toBe('P68');
    expect(pii.action).toBe('REFERRAL');
    expect(pii.planTemplate.forbiddenMoves).toContain('never repeat the PII back');
  });

  test('every readable risk-NONE medication state in the lattice is REFERRAL or stricter', () => {
    const states = enumerateControllerInputs().filter((i) => i.intent === 'MEDICATION_QUESTION' && i.riskLevel === 'NONE' && i.frameValidity === 'VALID');
    expect(states.length).toBeGreaterThan(0);
    for (const s of states) expect(REFERRAL_OR_STRICTER).toContain(decide(s).action);
  });

  test('higher risk still outranks the referral (sensitivity not lowered)', () => {
    expect(decide({ ...n06, riskLevel: 'CRISIS' }).action).toBe('CRISIS_PROTOCOL');
    expect(decide({ ...n06, riskLevel: 'HIGH' }).action).toBe('SAFETY_RESPONSE');
    expect(['CRISIS_PROTOCOL', 'SAFETY_RESPONSE']).toContain(decide({ ...n06, riskLevel: 'ELEVATED' }).action);
    expect(['CRISIS_PROTOCOL', 'SAFETY_RESPONSE']).toContain(decide({ ...n06, riskLevel: 'UNKNOWN' }).action);
  });

  test('unreadable input keeps its fail-closed 113 path (P15/P16)', () => {
    const d = decide({ ...n06, frameValidity: 'INVALID' });
    expect(['P15', 'P16']).toContain(d.ruleId);
    expect(d.planTemplate.mustInclude.some((m) => /113/.test(m))).toBe(true);
  });

  test('other intents on a novel frame still clarify (negative control)', () => {
    expect(decide({ ...n06, intent: 'WORK_STRESS' }).ruleId).toBe('P21');
  });

  test('model check carries INV-29 and it passes', () => {
    const mc = runModelCheck();
    const inv = mc.invariants.find((x) => x.id === 'INV-29');
    expect(inv?.pass).toBe(true);
    expect(inv?.violations).toBe(0);
  });

  // The referral must reach the shipped text, not only the action label (OP-18).
  describe('output policy enforces the referral in the reply', () => {
    const planFor = (input: ControllerInput, language: 'nl' | 'en'): Plan => {
      const d = decide(input);
      return { ...d.planTemplate, action: d.action, ruleId: d.ruleId, language, kgCitations: [], crisisResources: [] };
    };
    for (const input of [n06, { ...n06, piiState: 'PII_DETECTED' as const }, { ...n06, distressLevel: 'ACUTE' as const }]) {
      const rule = decide(input).ruleId;
      test(`${rule}: a reply without prescriber/GP is rejected`, () => {
        const r = verifyOutput('Ik begrijp dat dit je bezighoudt. Wat maakt dat je dit nu vraagt?', planFor(input, 'nl'));
        expect(r.violations.map((v) => v.ruleId)).toContain('OP-18');
      });
      test(`${rule}: a reply naming the GP passes OP-18`, () => {
        const r = verifyOutput('Ik begrijp dat dit je bezighoudt. Over je medicatie beslist je huisarts of voorschrijver; bespreek het vandaag nog met hen.', planFor(input, 'nl'));
        expect(r.violations.map((v) => v.ruleId)).not.toContain('OP-18');
      });
      for (const language of ['nl', 'en'] as const) {
        test(`${rule}: the canned fallback (${language}) passes OP-18`, () => {
          const plan = planFor(input, language);
          const r = verifyOutput(cannedReplyFor(plan), plan);
          expect(r.violations.map((v) => v.ruleId)).not.toContain('OP-18');
        });
      }
    }
    test('OP-18 does not apply to plans without a medication referral', () => {
      const plan = planFor({ ...n06, intent: 'WORK_STRESS', novelty: 'KNOWN' }, 'nl');
      expect(verifyOutput('Wat maakt dat je dit nu vraagt?', plan).violations.map((v) => v.ruleId)).not.toContain('OP-18');
    });
  });
});
