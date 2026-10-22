/**
 * Automated, offline DEV-ONLY comparison instrumentation.
 * Run with:
 * bun --preload ./tests/support/preload.ts scripts/run-nesy-abc-dev.mjs
 *
 * The real processTurn is called for all committed fictional DEV cases using
 * a deliberately neutral preset Frame and the mocked Z3 implementation.
 * No external LLM is contacted. This is NOT answer-quality evaluation.
 */
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { processTurn } from '../src/lib/eainesy/orchestrator.ts';
import { comparePersistedTurn } from '../research/nesy-abc/kernel-bridge.mjs';

const path = new URL('../research/nesy-abc/dev-pilot-p01.json', import.meta.url);
const fixtureBytes = readFileSync(path);
const fixture = JSON.parse(fixtureBytes.toString('utf8'));
const fake = globalThis.__fakeDb;
const assert = (ok, message) => { if (!ok) throw new Error('ABC DEV runner: ' + message); };
const sourceHash = createHash('sha256').update(fixtureBytes).digest('hex');
const ARM_NAMES = ['P0','A','B','C'];
assert(fake && typeof fake.__reset === 'function', 'Bun offline fake DB preload required');
assert(fixture.status === 'DEV_ONLY_NOT_HOLDOUT', 'must not run holdout corpus');
assert(fixture.protocol === 'EAINESY-ABC-2026-10-23-P01', 'unexpected protocol');
assert(fixture.cases?.length === 24, 'expected exactly 24 DEV cases');
assert(new Set(fixture.cases.map(c => c.id)).size === 24, 'duplicate IDs');
for (const suite of ['U','R','D']) {
  assert(fixture.cases.filter(c => c.suite === suite).length === 8, 'expected eight ' + suite + ' cases');
}
function neutralFrame(c) {
  // This is NOT semantic parsing, but a neutral placeholder to exercise the
  // existing routing, safety and persistence code without a model call.
  return {intent:'GENERAL_VENT',emotions:[],topics:[],riskMarkers:[],
    language:c.language==='en'?'en':'nl',paraphrase:'',parseConfidence:0.5};
}
async function replay(c) {
  fake.__reset();
  assert(Array.isArray(c.history) && c.history.length>0 && c.history.length%2===0,
    'invalid dialogue history in ' + c.id);
  const session = await fake.session.create({data:{label:'ABC-DEV-'+c.id}});
  for (let i=0;i<c.history.length;i+=2) {
    const u=c.history[i],a=c.history[i+1];
    assert(u.role==='user'&&a.role==='assistant', 'invalid turn roles in ' + c.id);
    await fake.turn.create({data:{
      sessionId:String(session.id),userText:u.content,replyText:a.content,
      action:'THERAPEUTIC_DIALOG',riskLevel:'NONE',confidence:1,
      frame:'{}',plan:'{}',trace:'[]',certificate:'{}'
    }});
  }
  const turn=await processTurn(String(session.id),c.userText,{
    presetFrame:neutralFrame(c),skipGeneration:true,origin:'scenario'
  });
  const stored=await fake.turn.findUnique({where:{id:turn.turnId}});
  assert(stored, 'processTurn failed to persist '+c.id);
  const before=JSON.stringify(stored);
  const comparison=await comparePersistedTurn({db:fake,turnResult:turn});
  const after=await fake.turn.findUnique({where:{id:turn.turnId}});
  assert(JSON.stringify(after)===before, 'bridge mutated stored turn '+c.id);
  assert(comparison.verified===false, 'mock Z3 incorrectly verified '+c.id);
  assert(turn.certificate.z3.result==='skipped', 'unexpected mock Z3 result '+c.id);
  assert(turn.certificate.modelCheck.pass===true, 'model check failed '+c.id);
  assert(await fake.seedCandidate.count()===0, 'DEV turn leaked into live review queue '+c.id);
  const arms={};
  for (const name of ARM_NAMES) {
    const a=comparison.arms[name];
    assert(a,'missing arm '+name+'/'+c.id);
    assert(!a.accepted && a.selectedMove===comparison.baselineMove,
      'unverified proposal escaped research boundary '+name+'/'+c.id);
    assert(a.extraCalls===0,'unexpected model call '+name+'/'+c.id);
    assert(JSON.stringify(a.safetyUnchanged)===JSON.stringify(comparison.arms.P0.safetyUnchanged),
      'safety snapshot changed '+name+'/'+c.id);
    arms[name]={baseline:a.baseMove,proposed:a.proposedMove,selected:a.selectedMove,
      triggers:a.triggers,accepted:a.accepted,modelCalls:a.extraCalls};
  }
  return {id:c.id,suite:c.suite,stratum:c.stratum,language:c.language,
    core:{action:turn.action,risk:turn.certificate.riskLevel,
      verification:turn.certificate.z3.result,
      modelCheck:turn.certificate.modelCheck.pass,
      outputPolicy:turn.certificate.outputPolicy.pass,
      strategy:turn.certificate.conversation?.strategy||'unknown'},
    arms};
}
const rows=[],errors=[];
for (const c of fixture.cases) {
  try { rows.push(await replay(c)); }
  catch(error){errors.push({id:c.id,reason:error instanceof Error?error.message:'unclassified'});}
}
const suiteCounts=Object.fromEntries(['U','R','D'].map(s=>[s,rows.filter(r=>r.suite===s).length]));
const moveChanges={A:0,B:0,C:0},triggers={T1:0,T2:0,T3:0,T4:0};
for (const row of rows) {
  for (const name of ['A','B','C']) {
    if(row.arms[name].proposed!==row.arms[name].baseline)moveChanges[name]++;
  }
  for (const trig of row.arms.C.triggers) if(trig in triggers)triggers[trig]++;
}
const status=errors.length===0&&rows.length===24?'PASS_DEV_INSTRUMENTATION':'FAIL_DEV_INSTRUMENTATION';
const report={
  schema:'eainesy-abc-dev-offline-v1',protocol:fixture.protocol,status,
  confirmatory:false,semanticQualityMeasured:false,clinicalSafetyValidated:false,
  realZ3Verified:false,externalModelCalls:0,externalContacts:0,
  gitSha:process.env.GITHUB_SHA||'local',devCorpusSha256:sourceHash,
  metrics:{expected:24,processed:rows.length,bySuite:suiteCounts,
    blocked:rows.length*ARM_NAMES.length,extraModelCalls:0,cTriggers:triggers,
    counterfactualMoveDifferences:moveChanges},
  cases:rows,errors
};
const out=resolve(process.env.NESY_ABC_REPORT_DIR||'.research-output/nesy-abc');
mkdirSync(out,{recursive:true});
writeFileSync(resolve(out,'dev-report.json'),JSON.stringify(report,null,2)+'\n');
const lines=[
  '# NeSy A/B/C: automatische offline DEV-doorloop','',
  'Status: '+status,
  'Dataset SHA-256: '+sourceHash,
  'Broncommit: '+report.gitSha,'',
  'Alle 24 openbare fictieve ontwikkelgevallen lopen automatisch door de echte NeSy processTurn en de read-only A/B/C brug.',
  '**Geen externe modelaanroepen, geen echte Z3, geen semantische kwaliteitsmeting en geen onafhankelijke veiligheidsbeoordeling.**',
  'De parser heeft een neutraal ontwikkelframe; alle architectuurvoorstellen blijven door de Z3-mock geblokkeerd.','',
  '| Controle | Resultaat |','| --- | ---: |',
  '| DEV-casussen | '+rows.length+'/24 |',
  '| U / R / D | '+suiteCounts.U+' / '+suiteCounts.R+' / '+suiteCounts.D+' |',
  '| Geblokkeerde armuitkomsten | '+report.metrics.blocked+' |',
  '| Externe modelaanroepen | 0 |',
  '| A / B / C afwijkende maar niet uitgevoerde plannen | '+moveChanges.A+' / '+moveChanges.B+' / '+moveChanges.C+' |',
  '| C-triggers T1/T2/T3/T4 | '+triggers.T1+'/'+triggers.T2+'/'+triggers.T3+'/'+triggers.T4+' |',
  '| Problemen | '+errors.length+' |','',
  '| Casus | Type | P0 | A voorstel | B voorstel | C voorstel | C-triggers | Z3 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows.map(r=>'| '+r.id+' | '+r.suite+' | '+r.arms.P0.baseline+
    ' | '+r.arms.A.proposed+' | '+r.arms.B.proposed+' | '+r.arms.C.proposed+
    ' | '+(r.arms.C.triggers.join(',')||'-')+' | '+r.core.verification+' |'),
  '',
  '**Niet aangetoond:** gesprekskwaliteit, echte modelkosten, betrouwbaarheid van de semantische parse, klinische veiligheid of een winnaar.',
  'Een verschil in voorgestelde gespreksbeweging telt niet als betere respons.',
  ...errors.map(e=>'ERROR '+e.id+': '+e.reason),''
];
writeFileSync(resolve(out,'dev-report.md'),lines.join('\n'));
console.log('NeSy ABC automatic DEV: '+rows.length+'/24, '+errors.length+' errors, report dir='+out);
if(status!=='PASS_DEV_INSTRUMENTATION')process.exitCode=1;
