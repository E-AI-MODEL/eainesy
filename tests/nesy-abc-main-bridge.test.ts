/**
 * Development-only integration with NeSy's real processTurn.
 *
 * The Bun test preload mocks Z3 and the language model: this is a real
 * application pipeline execution but NOT a live provider test and NOT
 * a SAT-certified run. The research bridge MUST treat mocked certificates
 * as blocked and leave actual persisted results untouched.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { processTurn } from '../src/lib/eainesy/orchestrator';
import type { Frame } from '../src/lib/eainesy/types';
import type { FakeDb } from './support/fake-db';
import { compareVerifiedTurn, comparePersistedTurn, fromVerifiedTurn } from '../research/nesy-abc/kernel-bridge.mjs';

const fake = (globalThis as unknown as { __fakeDb: FakeDb }).__fakeDb;
const F = (changes: Partial<Frame>): Frame => ({
  intent: 'GENERAL_VENT',
  emotions: [], topics: [], riskMarkers: [],
  language: 'nl', paraphrase: '', parseConfidence: 0.9,
  ...changes,
});

describe('NeSy real processTurn -> A/B/C research bridge (DEV ONLY)', () => {
  beforeEach(() => fake.__reset());

  test('synthetic source-anchored observation reaches A/C without overriding mock Z3', async () => {
    const session = await fake.session.create({data:{label:'abc-semantic-parser-integration'}});
    const first=await processTurn(String(session.id),'Mijn zus heeft het moeilijk.',{
      presetFrame:F({intent:'GENERAL_VENT',topics:['familie']}),
      origin:'scenario',skipGeneration:true,
    });
    expect(first.action).toBeDefined();
    const user='Nee, het gaat over mijn zus. Ik heb zelf geen relatieprobleem.';
    // The main production parser is intentionally unchanged. This fixture
    // injects model-shaped evidence into the offline-only preset path.
    const injectedFrame = {
      ...F({intent:'GENERAL_VENT',topics:['familie']}),
      dialogueObservation:{version:1,origin:'model_claim',acts:[
        {type:'CORRECT_ASSUMPTION',evidence:'het gaat over mijn zus'}
      ]},
    };
    const next=await processTurn(String(session.id),user,{
      presetFrame:injectedFrame,origin:'scenario',skipGeneration:true,
    });
    const record=await fake.turn.findUnique({where:{id:next.turnId}});
    expect(record).not.toBeNull();
    const original=JSON.stringify(record);
    const compared=await comparePersistedTurn({db:fake,turnResult:next});
    expect(compared.arms.A.proposedMove).toBe('REPAIR');
    expect(compared.arms.C.proposedMove).toBe('REPAIR');
    expect(compared.arms.C.triggers).toContain('T2');
    expect(compared.arms.C.accepted).toBe(false);
    expect(compared.arms.C.selectedMove).toBe(compared.baselineMove);
    expect(next.certificate.z3.result).toBe('skipped');
    expect(JSON.stringify(await fake.turn.findUnique({where:{id:next.turnId}}))).toBe(original);
  });



  test('consumes the actual stored turn and keeps simulated-Z3 decisions blocked', async () => {
    const session = await fake.session.create({ data: { label: 'abc-pipeline-test' } });
    const result = await processTurn(
      String(session.id),
      'Ik wil geen tips, ik wil gewoon mijn verhaal vertellen.',
      {
        presetFrame: F({
          intent: 'GENERAL_VENT',
          emotions: ['onrust'],
          topics: ['werk'],
          paraphrase: 'De gebruiker wil zonder ongevraagde tips vertellen.',
        }),
        skipGeneration: true,
        origin: 'scenario',
      },
    );
    const record = await fake.turn.findUnique({ where: { id: result.turnId } });
    expect(record).not.toBeNull();
    expect(result.certificate.modelCheck.pass).toBe(true);
    expect(result.certificate.z3.result).toBe('skipped');
    const before = JSON.stringify(record);
    const snapshot = { turnResult: result, turnRecord: record };
    const bridge = fromVerifiedTurn(snapshot);
    expect(bridge.input.userText).toBe('Ik wil geen tips, ik wil gewoon mijn verhaal vertellen.');
    expect(bridge.input.frame.intent).toBe('GENERAL_VENT');
    expect(bridge.input.safety.action).toBe(result.action);
    expect(bridge.input.draft).toBe(result.reply);
    expect(bridge.input.bindingPlan?.action).toBe(result.action);
    expect(Array.isArray(bridge.input.bindingPlan?.mustInclude)).toBe(true);
    expect(Array.isArray(bridge.input.grounding?.topicKeys)).toBe(true);
    expect(bridge.input.safety.riskAssessment).toBe(result.certificate.riskLevel);
    expect(bridge.input.safety.verification).toBe('skipped');
    expect(bridge.verified).toBe(false);
    let callbacks = 0;
    const comparison = await compareVerifiedTurn(snapshot, {
      supervisor: async () => { callbacks++; return { kind: 'revise', move: 'REFLECTION' }; },
      orchestrator: async () => { callbacks++; return { kind: 'revise', move: 'REFLECTION' }; },
    });
    expect(callbacks).toBe(0);
    expect(Object.keys(comparison.arms)).toEqual(['P0', 'A', 'B', 'C']);
    for (const arm of ['A', 'B', 'C']) {
      expect(comparison.arms[arm].accepted).toBe(false);
      expect(comparison.arms[arm].selectedMove).toBe(comparison.baselineMove);
      expect(comparison.arms[arm].extraCalls).toBe(0);
    }
    const after = await fake.turn.findUnique({ where: { id: result.turnId } });
    expect(JSON.stringify(after)).toBe(before);
    expect((await fake.seedCandidate.count())).toBe(0);
  });

  test('preserves conversation state over two actual turns; cannot override the core', async () => {
    const session = await fake.session.create({ data: { label: 'abc-correction-test' } });
    const first = await processTurn(String(session.id), 'Ik maak me zorgen over mijn werk.', {
      presetFrame: F({ intent: 'WORK_STRESS', emotions: ['spanning'], topics: ['werk'] }),
      skipGeneration: true, origin: 'scenario',
    });
    const second = await processTurn(String(session.id), 'Nee, ik bedoelde mijn familie, niet het werk.', {
      presetFrame: F({ intent: 'RELATIONSHIP_ISSUE', emotions: ['zorgen'], topics: ['familie'] }),
      skipGeneration: true, origin: 'scenario',
    });
    const firstRecord = await fake.turn.findUnique({ where: { id: first.turnId } });
    const secondRecord = await fake.turn.findUnique({ where: { id: second.turnId } });
    expect(firstRecord).not.toBeNull();
    expect(secondRecord).not.toBeNull();
    expect(second.certificate.conversation).toBeDefined();
    const stored = JSON.stringify(secondRecord);
    const comparison = await comparePersistedTurn({ db: fake, turnResult: second });
    expect(comparison.verified).toBe(false);
    expect(comparison.baselineAction).toBe(second.action);
    expect(comparison.arms.C.triggers).toContain('T2');
    for (const arm of ['A', 'B', 'C']) expect(comparison.arms[arm].accepted).toBe(false);
    const latest = await fake.turn.findUnique({ where: { id: second.turnId } });
    expect(JSON.stringify(latest)).toBe(stored);
    expect((await fake.turn.count({ where: { sessionId: String(session.id) } }))).toBe(2);
  });
});
