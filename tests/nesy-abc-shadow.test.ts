/**
 * Opt-in read-only shadow mode regression.
 *
 * The real processTurn is used with fictional preset Frame data, fake DB,
 * mocked model provider and SKIPPED Z3. This tests instrumentation isolation,
 * NOT live semantic validity or clinical safety.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { processTurn } from '../src/lib/eainesy/orchestrator';
import { maybeRecordABCShadow } from '../src/lib/eainesy/abc-shadow';
import type { Frame } from '../src/lib/eainesy/types';
import type { FakeDb } from './support/fake-db';

const db = (globalThis as unknown as {__fakeDb:FakeDb}).__fakeDb;
const originalFlag = process.env.EAINESY_ABC_SHADOW_ENABLED;
function baseFrame(overrides:Partial<Frame>={}):Frame {
  return {
    intent:'GENERAL_VENT',emotions:[],topics:[],riskMarkers:[],
    language:'nl',paraphrase:'',parseConfidence:0.8,...overrides
  };
}
async function scenario(message:string,sessionId?:string,origin:'scenario'|'eval'='scenario'){
  const session=sessionId ?? String((await db.session.create({data:{label:'abc-shadow-test'}})).id);
  const result=await processTurn(session,message,{
    origin,presetFrame:baseFrame(),skipGeneration:true
  });
  const stored=await db.turn.findUnique({where:{id:result.turnId}});
  return {result,stored,session};
}
async function stages(stage:string){
  return db.auditEntry.findMany({where:{stage},orderBy:{seq:'asc'}});
}
describe('ABC shadow observation alongside unchanged P0',()=>{
  beforeEach(()=>{
    db.__reset();
    delete process.env.EAINESY_ABC_SHADOW_ENABLED;
  });
  afterEach(()=>{
    if(originalFlag===undefined)delete process.env.EAINESY_ABC_SHADOW_ENABLED;
    else process.env.EAINESY_ABC_SHADOW_ENABLED=originalFlag;
  });

  test('off by default: the existing response persists without shadow entries',async()=>{
    const {result,stored}=await scenario('Een gewone fictieve vraag.');
    expect(stored.replyText).toBe(result.reply);
    expect(result.certificate.z3.result).toBe('skipped');
    expect(await stages('turn.abc_shadow')).toHaveLength(0);
    expect(await stages('turn.abc_shadow_error')).toHaveLength(0);
  });

  test('opt-in collects only P0/A/B/C metadata, never overwrites the turn',async()=>{
    process.env.EAINESY_ABC_SHADOW_ENABLED='true';
    const unique='UNIQUE_PRIVATE_CHAT_TEXT_X72';
    const {result,stored}=await scenario('Ik wil geen tips. '+unique);
    const recorded=await db.turn.findUnique({where:{id:result.turnId}});
    expect(JSON.stringify(recorded)).toBe(JSON.stringify(stored));
    expect(result.reply).toBe(stored.replyText);
    const entries=await stages('turn.abc_shadow');
    expect(entries).toHaveLength(1);
    const entry=entries[0];
    expect(entry.turnId).toBe(result.turnId);
    expect(entry.payload).not.toContain(unique);
    expect(entry.payload).not.toContain('Ik wil geen tips');
    expect(entry.payload).not.toContain(stored.replyText);
    const data=JSON.parse(entry.payload);
    expect(data.schema).toBe('nesy-abc-shadow-v1');
    expect(data.variants).toEqual(['P0','A','B','C']);
    expect(data.outputChanged).toBe(false);
    expect(data.reviewModelUsed).toBe(false);
    expect(data.extraModelCalls).toBe(0);
    expect(data.sourceCertificate.z3).toBe('skipped');
    expect(data.sourceVerified).toBe(false);
    expect(data.proposed.P0.applied).toBe(false);
    expect(data.proposed.A.applied).toBe(false);
    expect(data.proposed.B.applied).toBe(false);
    expect(data.proposed.C.applied).toBe(false);
    expect((await stages('turn.abc_shadow_error'))).toHaveLength(0);
    expect((await db.seedCandidate.count())).toBe(0);
  });

  test('two persisted turns allow C to observe a correction without applying it',async()=>{
    process.env.EAINESY_ABC_SHADOW_ENABLED='true';
    const first=await scenario('Mijn zus had een drukke week.');
    const second=await scenario('Nee, je begrijpt me niet. Het gaat over mijn moeder.',first.session);
    const entries=await stages('turn.abc_shadow');
    expect(entries).toHaveLength(2);
    const data=JSON.parse(entries[1].payload);
    expect(data.cTriggerCodes).toContain('T2');
    expect(data.outputChanged).toBe(false);
    expect(data.extraModelCalls).toBe(0);
    expect(second.stored.replyText).toBe(second.result.reply);
    expect(await db.turn.count({where:{sessionId:first.session}})).toBe(2);
  });

  test('explicit non-true flag and eval origin never enable observation',async()=>{
    process.env.EAINESY_ABC_SHADOW_ENABLED='TRUE';
    await scenario('Fictief bericht.');
    expect(await stages('turn.abc_shadow')).toHaveLength(0);
    process.env.EAINESY_ABC_SHADOW_ENABLED='true';
    await scenario('Evaluatie hoort geen telemetry te maken.',undefined,'eval');
    expect(await stages('turn.abc_shadow')).toHaveLength(0);
  });

  test('malformed observation fails without affecting a completed turn',async()=>{
    process.env.EAINESY_ABC_SHADOW_ENABLED='true';
    const {stored,result}=await scenario('Een gewoon bericht.');
    const count=await db.turn.count();
    const r=await maybeRecordABCShadow({
      turn:{...stored,frame:'undefined json',certificate:'no-json',trace:'not-json'},
      certificate:result.certificate,trace:result.trace,history:[],origin:'scenario'
    });
    // Missing frame/plan is tolerated as unknown, but a broken certificate
    // may either fail the observer or produce only an ineligible suggestion.
    expect(['failed','recorded']).toContain(r);
    expect(await db.turn.count()).toBe(count);
    expect((await db.turn.findUnique({where:{id:result.turnId}})).replyText).toBe(result.reply);
  });
});
