/**
 * Real processTurn execution, with the test suite's mocked Z3/LLM.
 * The resulting SKIPPED Z3 certificate must block S1/S2 authority.
 * This is NOT a live model nor a real SAT confirmation.
 */
import {beforeEach,describe,expect,test} from 'bun:test';
import {processTurn} from '../src/lib/eainesy/orchestrator';
import type {Frame} from '../src/lib/eainesy/types';
import type {FakeDb} from './support/fake-db';
import {compareCooperativeFromP0} from '../research/nesy-cooperative/p0-bridge.mjs';

const fake=(globalThis as unknown as {__fakeDb:FakeDb}).__fakeDb;
const F=(changes:Partial<Frame>):Frame=>({
  intent:'GENERAL_VENT',emotions:[],topics:[],riskMarkers:[],
  language:'nl',paraphrase:'',parseConfidence:0.9,...changes
});

describe('Real processTurn to S1/S2 read-only research bridge',()=>{
  beforeEach(()=>fake.__reset());

  test('mocked Z3 blocks all proposed use and extra calls; persisted turn unchanged',async()=>{
    const session=await fake.session.create({data:{label:'s1s2-real-p0-test'}});
    const current='Schrijf het bericht namens haar. Ik weet niet of Anna of Noor bedoeld is.';
    const turn=await processTurn(String(session.id),current,{
      presetFrame:F({topics:['gesprek']}),origin:'scenario',skipGeneration:true
    });
    expect(turn.certificate.z3.result).toBe('skipped');
    const record=await fake.turn.findUnique({where:{id:turn.turnId}});
    expect(record).not.toBeNull();
    const before=JSON.stringify(record);
    let calls=0;
    const proposal=await compareCooperativeFromP0(
      {turnResult:turn,turnRecord:record},{
        task:{source:'synthetic_annotation',type:'PERSON_REQUIRED',evidence:'Schrijf het bericht namens haar'},
        c2Claims:[{kind:'PERSON',source:'current_user',evidence:'Anna of Noor',
          hypothesis:'Unresolved referent'}],
        recheck:async()=>{calls++;throw Error('never call S2 on skipped Z3')}
      }
    );
    expect(calls).toBe(0);
    expect(proposal.P0CertificateFieldsClaimSat).toBe(false);
    expect(proposal.verifiedIndependentlyByThisBridge).toBe(false);
    expect(proposal.comparison.S1.reasonCode).toBe('LOCKED_BY_SAFETY_OR_UNVERIFIED_CHECK');
    expect(proposal.comparison.S1.proposedMove).toBe(proposal.P0Move);
    expect(proposal.comparison.S2.proposedMove).toBe(proposal.P0Move);
    expect(proposal.comparison.S2.extraModelCalls).toBe(0);
    expect(proposal.productionReplyChanged).toBe(false);
    expect(proposal.persistedChangesByCooperativeArm).toBe(false);
    expect(JSON.stringify(await fake.turn.findUnique({where:{id:turn.turnId}}))).toBe(before);
    expect(await fake.seedCandidate.count()).toBe(0);
  });

  test('one existing persisted turn with direct request stays read-only',async()=>{
    const session=await fake.session.create({data:{label:'s1s2-user-goal'}});
    const msg='Geef één voorbeeldzin, zonder eerst naar de toon te vragen.';
    const turn=await processTurn(String(session.id),msg,{
      presetFrame:F({topics:['gesprek']}),origin:'scenario',skipGeneration:true
    });
    const record=await fake.turn.findUnique({where:{id:turn.turnId}});
    const before=JSON.stringify(record);
    const result=await compareCooperativeFromP0(
      {turnResult:turn,turnRecord:record},{
        task:{source:'synthetic_annotation',type:'DIRECT_ANSWER',evidence:'Geef één voorbeeldzin'},
        c2Claims:[{kind:'MISSING_INFORMATION',source:'current_user',
          evidence:'naar de toon',hypothesis:'Tone could be needed'}]
      }
    );
    expect(result.comparison.S2.extraModelCalls).toBe(0);
    expect(result.comparison.S1.proposedMove).toBe(result.P0Move);
    expect(result.comparison.S2.proposedMove).toBe(result.P0Move);
    expect(JSON.stringify(await fake.turn.findUnique({where:{id:turn.turnId}}))).toBe(before);
  });
});
