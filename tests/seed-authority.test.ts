/**
 * Phase D — learned recognition with Shadowseed-style authority.
 *  - candidates are born weightless and deduplicated per pattern;
 *  - a human acceptance gives authority; a rejection is a contradiction;
 *  - recurrence alone can give authority only for low-stakes intents, only
 *    across independent sessions, never beyond the auto cap;
 *  - point of use: no influence on any turn with risk, unreadable input,
 *    risk-sensitive intents, a different intent, or a dormant pattern.
 */
import { describe, expect, test, beforeEach } from 'bun:test';
import { applyRecurrence, applyVerdict, pointOfUse, AUTHORITY_POLICY, type SeedView } from '../src/lib/eainesy/seed-authority';
import { processTurn } from '../src/lib/eainesy/orchestrator';
import { findMatchingSeed, normalizeSeedText } from '../src/lib/eainesy/hitl-seeds';
import type { Frame } from '../src/lib/eainesy/types';
import type { FakeDb } from './support/fake-db';

const fake = (globalThis as unknown as { __fakeDb: FakeDb }).__fakeDb;
const now = new Date('2026-10-16T10:00:00Z');
const seed = (p: Partial<SeedView> = {}): SeedView => ({ id: 's1', status: 'pending', weight: 0, recurrence: 1, contradictions: 0, sessionsSeen: ['a'], intent: 'SLEEP_ISSUE', lastSeenAt: now, ...p });
const pou = (s: SeedView, extra: Partial<Parameters<typeof pointOfUse>[0]> = {}) => pointOfUse({ seed: s, now, intent: 'SLEEP_ISSUE', frameValidity: 'VALID', risk: 'NONE', lexicalMarkers: 0, ...extra });

describe('policy (pure)', () => {
  test('born weightless: remembered, no authority', () => {
    expect(pou(seed()).allowed).toBe(false);
  });
  test('human acceptance gives authority; rejection contradicts', () => {
    const acc = { ...seed(), ...applyVerdict(seed(), 'accepted') };
    expect(acc.weight).toBeGreaterThanOrEqual(AUTHORITY_POLICY.threshold);
    expect(pou(acc).allowed).toBe(true);
    const rej = { ...acc, ...applyVerdict(acc, 'rejected') };
    expect(rej.status).toBe('rejected');
    expect(pou(rej).allowed).toBe(false);
  });
  test('point of use blocks every risky or unreadable turn even with authority', () => {
    const acc = seed({ status: 'accepted', weight: 0.6 });
    expect(pou(acc, { risk: 'ELEVATED' }).allowed).toBe(false);
    expect(pou(acc, { risk: 'UNKNOWN' }).allowed).toBe(false);
    expect(pou(acc, { frameValidity: 'INVALID' }).allowed).toBe(false);
    expect(pou(acc, { lexicalMarkers: 1 }).allowed).toBe(false);
    expect(pou(acc, { intent: 'CRISIS_SIGNAL' }).allowed).toBe(false);
    expect(pou(acc, { intent: 'WORK_STRESS' }).allowed).toBe(false); // different intent
    expect(pou({ ...acc, lastSeenAt: new Date(now.getTime() - 90 * 86_400_000) }).allowed).toBe(false); // dormant
  });
  test('recurrence: same session adds nothing, independent sessions add weight up to the cap', () => {
    let s = seed();
    const same = applyRecurrence(s, { sessionId: 'a', intent: 'SLEEP_ISSUE', frameValidity: 'VALID', risk: 'NONE', now });
    expect(same.gainedWeight).toBe(false);
    for (const sid of ['b', 'c', 'd', 'e', 'f']) {
      const r = applyRecurrence(s, { sessionId: sid, intent: 'SLEEP_ISSUE', frameValidity: 'VALID', risk: 'NONE', now });
      s = { ...s, ...r };
    }
    expect(s.weight).toBeCloseTo(AUTHORITY_POLICY.autoCap, 5);
    expect(s.weight).toBeLessThanOrEqual(AUTHORITY_POLICY.autoCap);
  });
  test('recurrence never gives weight to risk-sensitive intents or risky turns', () => {
    const t = seed({ intent: 'TRAUMA_REPORT' });
    expect(applyRecurrence(t, { sessionId: 'z', intent: 'TRAUMA_REPORT', frameValidity: 'VALID', risk: 'NONE', now }).gainedWeight).toBe(false);
    expect(applyRecurrence(seed(), { sessionId: 'z', intent: 'SLEEP_ISSUE', frameValidity: 'VALID', risk: 'ELEVATED', now }).gainedWeight).toBe(false);
    expect(applyRecurrence(seed({ status: 'rejected' }), { sessionId: 'z', intent: 'SLEEP_ISSUE', frameValidity: 'VALID', risk: 'NONE', now }).gainedWeight).toBe(false);
  });
});

describe('end to end through the pipeline', () => {
  beforeEach(() => fake.__reset());
  // A frame without KG anchors: novel territory → review candidate.
  const novel: Frame = { intent: 'SLEEP_ISSUE', emotions: [], topics: [], riskMarkers: [], language: 'nl', paraphrase: '', parseConfidence: 0.9 };
  const text = 'Mijn nachten zijn een soort draaimolen geworden';

  async function liveTurn(label: string, frame: Frame = novel, t = text) {
    const s = await fake.session.create({ data: { label } });
    return processTurn(s.id as string, t, { presetFrame: frame, skipGeneration: true, origin: 'live' });
  }

  test('one candidate per pattern; recurrence is counted, not duplicated', async () => {
    await liveTurn('chat-1');
    await liveTurn('chat-2');
    await liveTurn('chat-3');
    const rows = await fake.seedCandidate.findMany();
    expect(rows.length).toBe(1);
    expect(rows[0].weight).toBeGreaterThan(0); // two independent recurrences on a low-stakes intent
    expect(rows[0].weight).toBeLessThan(AUTHORITY_POLICY.threshold);
    expect(rows[0].recurrence).toBe(3);
  });

  test('after human acceptance the pattern counts as known — but never on a risky turn', async () => {
    const first = await liveTurn('chat-1');
    expect(first.certificate.rulesFired[0].id).toBe('P21'); // novel → clarify
    const row = (await fake.seedCandidate.findMany())[0];
    await fake.seedCandidate.update({ where: { id: row.id }, data: { status: 'accepted', weight: 0.6 } });

    const second = await liveTurn('chat-2');
    expect(second.certificate.humanConfirmed).toBe(true);
    expect(second.certificate.seed?.allowed).toBe(true);
    expect(second.certificate.rulesFired[0].id).not.toBe('P21');

    const risky = await liveTurn('chat-3', novel, `${text} en ik zie het niet meer zitten`);
    expect(risky.certificate.humanConfirmed).toBeUndefined();
    expect(['SAFETY_RESPONSE', 'CRISIS_PROTOCOL']).toContain(risky.action);
  });

  test('opposite meaning and changed time never reuse accepted recognition', async () => {
    const original = 'Ik wil tips voor dat moeilijke gesprek';
    const negated = 'Ik wil geen tips voor dat moeilijke gesprek';
    const historical = 'Ik wilde vroeger tips voor dat moeilijke gesprek';
    await liveTurn('first-message', novel, original);
    const candidate = (await fake.seedCandidate.findMany())[0];
    expect(candidate).toBeDefined();
    await fake.seedCandidate.update({ where: { id: candidate.id }, data: { status: 'accepted', weight: 0.6 } });
    expect(await findMatchingSeed(negated)).toBeNull();
    expect(await findMatchingSeed(historical)).toBeNull();
    const denied = await liveTurn('opposite-message', novel, negated);
    const past = await liveTurn('past-message', novel, historical);
    expect(denied.certificate.humanConfirmed).toBeUndefined();
    expect(past.certificate.humanConfirmed).toBeUndefined();
    expect(denied.certificate.rulesFired[0].id).toBe('P21');
    expect(past.certificate.rulesFired[0].id).toBe('P21');
    expect((await fake.seedCandidate.findMany()).length).toBe(3);
    expect((await fake.seedCandidate.findMany()).find(x => x.id === candidate.id)?.weight).toBe(0.6);
  });

  test('orthographic normalization still recognizes genuinely repeated utterances', async () => {
    const first = 'IK WIL TIPS VOOR DAT MOEILIJKE GESPREK!';
    const second = 'ik wil tips voor dat moeilijke gesprek.';
    expect(normalizeSeedText(first)).toBe(normalizeSeedText(second));
    await liveTurn('first-case', novel, first);
    const before = (await fake.seedCandidate.findMany())[0];
    expect(await findMatchingSeed(second)).not.toBeNull();
    await liveTurn('repeat-case', novel, second);
    const rows = await fake.seedCandidate.findMany();
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(before.id);
    expect(rows[0].recurrence).toBe(2);
  });

  test('test runs neither use nor create learned patterns', async () => {
    const s = await fake.session.create({ data: { label: 'eval-x' } });
    await processTurn(s.id as string, text, { presetFrame: novel, skipGeneration: true, origin: 'eval' });
    expect(await fake.seedCandidate.count()).toBe(0);
  });
});
