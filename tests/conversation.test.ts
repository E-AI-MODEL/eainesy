/**
 * Phase C/E — the conversation layer.
 *  - every scripted conversation passes (per-turn + G1–G6 conversation checks);
 *  - the exhaustive check over both layers passes, C99 is unreachable;
 *  - risk memory decays as specified and keeps its floor after HIGH/CRISIS;
 *  - every human-written fallback reply passes the output policy of every
 *    reachable merged plan (base rule × conversation decision);
 *  - persisted state is parsed defensively.
 */
import { describe, expect, test, beforeEach } from 'bun:test';
import { runScenarios, SCENARIOS } from '../src/lib/eainesy/scenarios';
import { runModelCheck } from '../src/lib/eainesy/modelchecker';
import {
  INITIAL_CONVERSATION_STATE, nextConversationState, parseConversationState, decideConversation, mergePlan,
  STABILISE_RULES, type ConversationDecision, type TurnSignals,
} from '../src/lib/eainesy/conversation';
import { decide } from '../src/lib/eainesy/controller';
import { verifyOutput, cannedReplyFor } from '../src/lib/eainesy/outputpolicy';
import { enumerateControllerInputs, CONVERSATION_PHASES, RISK_MEMORY_STATES, RUPTURE_STATES, type Plan } from '../src/lib/eainesy/types';
import { REPLY_STYLES, styleMaxSentences } from '../src/lib/eainesy/steer';
import type { FakeDb } from './support/fake-db';

const fake = (globalThis as unknown as { __fakeDb: FakeDb }).__fakeDb;
const NO_SIGNALS: TurnSignals = { changeTalk: false, asksForHelp: false, closure: false, rupture: false, topicShift: false };
const dialog = (strategy: ConversationDecision['strategy'] = 'REFLECTION'): ConversationDecision => ({ ruleId: 'C11', action: 'THERAPEUTIC_DIALOG', strategy, nextPhase: 'EXPLORE', stripTechniques: true, addMustInclude: [], repairs: false });

describe('scripted conversations (fast mode)', () => {
  beforeEach(() => fake.__reset());
  test(`all ${SCENARIOS.length} scenarios pass`, async () => {
    const out = await runScenarios('fast');
    const failing = out.results.filter((r) => !r.pass).map((r) => `${r.id}: ${r.failures.join(' | ')}`);
    expect(failing).toEqual([]);
    expect(out.passed).toBe(out.total);
  });
  test('scenario runs never create review items', async () => {
    await runScenarios('fast');
    expect(await fake.seedCandidate.count()).toBe(0);
  });
});

describe('exhaustive check over both layers', () => {
  test('passes, and the conversation backstop C99 is unreachable', () => {
    const mc = runModelCheck();
    expect(mc.invariants.filter((i) => !i.pass).map((i) => i.id)).toEqual([]);
    expect(mc.layers.conversation.statesChecked).toBeGreaterThan(100_000);
    expect(mc.conversationRulesNeverFired).toEqual(['C99']);
    expect(mc.rulesetHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('risk memory', () => {
  test('CRISIS → ACTIVE, two calm turns → RECENT, never below RECENT afterwards', () => {
    let s = nextConversationState(INITIAL_CONVERSATION_STATE, dialog(), 'CRISIS', NO_SIGNALS, [], true);
    expect(s.riskMemory).toBe('ACTIVE');
    s = nextConversationState(s, dialog(), 'NONE', NO_SIGNALS, [], false);
    expect(s.riskMemory).toBe('ACTIVE');
    s = nextConversationState(s, dialog(), 'NONE', NO_SIGNALS, [], false);
    expect(s.riskMemory).toBe('RECENT');
    for (let k = 0; k < 12; k++) s = nextConversationState(s, dialog(), 'NONE', NO_SIGNALS, [], false);
    expect(s.riskMemory).toBe('RECENT'); // floor after CRISIS
    expect(s.resourcesGiven).toBe(true);
  });
  test('ELEVATED alone decays back to NONE', () => {
    let s = nextConversationState(INITIAL_CONVERSATION_STATE, dialog(), 'ELEVATED', NO_SIGNALS, [], true);
    expect(s.riskMemory).toBe('RECENT');
    for (let k = 0; k < 4; k++) s = nextConversationState(s, dialog(), 'NONE', NO_SIGNALS, [], false);
    expect(s.riskMemory).toBe('NONE');
  });
  test('UNKNOWN neither raises nor decays memory', () => {
    let s = nextConversationState(INITIAL_CONVERSATION_STATE, dialog(), 'HIGH', NO_SIGNALS, [], true);
    const before = s.calmTurns;
    s = nextConversationState(s, dialog(), 'UNKNOWN', NO_SIGNALS, [], true);
    expect(s.riskMemory).toBe('ACTIVE');
    expect(s.calmTurns).toBe(before);
  });
});

describe('rupture', () => {
  test('a rupture marker stays open until a repairing turn answers it', () => {
    const safety: ConversationDecision = { ruleId: 'C01', action: 'SAFETY_RESPONSE', strategy: 'SAFETY', nextPhase: 'EXPLORE', stripTechniques: false, addMustInclude: [], repairs: false };
    let s = nextConversationState(INITIAL_CONVERSATION_STATE, safety, 'HIGH', { ...NO_SIGNALS, rupture: true }, [], true);
    expect(s.rupture).toBe('ACTIVE');
    s = nextConversationState(s, { ...dialog('REPAIR'), repairs: true }, 'NONE', NO_SIGNALS, [], false);
    expect(s.rupture).toBe('NONE');
  });
});

describe('fallback replies pass the merged plan of every reachable situation', () => {
  test('canned reply × merged plan × style × language', () => {
    const seen = new Set<string>();
    const bad: string[] = [];
    let checked = 0;
    const bools = [false, true];
    const projections = new Map<string, ReturnType<typeof decide> & { risk: string; conf: string }>();
    for (const i of enumerateControllerInputs()) {
      const d = decide(i);
      projections.set(`${d.ruleId}|${i.riskLevel}|${i.confidenceBand}`, { ...d, risk: i.riskLevel, conf: i.confidenceBand });
    }
    for (const b of projections.values()) {
      for (const phase of CONVERSATION_PHASES) for (const riskMemory of RISK_MEMORY_STATES) for (const rupture of RUPTURE_STATES)
        for (const resourcesGiven of bools) for (const ready of bools) for (const fresh of bools) {
          const c = { baseAction: b.action, stabilise: (STABILISE_RULES as readonly string[]).includes(b.ruleId), risk: b.risk as never, confidence: b.conf as never, phase, riskMemory, rupture, resourcesGiven, ready, fresh, closure: false, topicShift: false };
          const conv = decideConversation(c);
          const tpl = mergePlan(b.planTemplate, conv);
          const key = `${b.ruleId}|${conv.ruleId}|${conv.strategy}|${phase}|${tpl.mustInclude.join('¦')}`;
          if (seen.has(key)) continue;
          seen.add(key);
          for (const st of REPLY_STYLES) for (const language of ['nl', 'en'] as const) {
            const plan: Plan = {
              action: conv.action, ruleId: conv.replacePlan ? conv.ruleId : b.ruleId, phase, strategy: conv.strategy, tone: tpl.tone, language,
              allowedMoves: tpl.allowedMoves, forbiddenMoves: tpl.forbiddenMoves, kgCitations: [], crisisResources: [], mustInclude: tpl.mustInclude,
              maxSentences: styleMaxSentences(tpl.maxSentences, st),
            };
            checked++;
            const res = verifyOutput(cannedReplyFor(plan), plan);
            if (!res.pass) bad.push(`${key}/${language}/${st}: ${res.violations.map((v) => v.ruleId).join(',')}`);
          }
        }
    }
    expect(bad.slice(0, 8)).toEqual([]);
    expect(checked).toBeGreaterThan(1000);
  });
});

describe('persisted state', () => {
  test('garbage and missing state fall back to the initial state', () => {
    expect(parseConversationState(undefined).phase).toBe('OPENING');
    expect(parseConversationState({ phase: 'NONSENSE', riskMemory: 7, themes: 'x' }).phase).toBe('OPENING');
    expect(parseConversationState({ phase: 'ACT', riskMemory: 'ACTIVE' }).riskMemory).toBe('ACTIVE');
  });
});
