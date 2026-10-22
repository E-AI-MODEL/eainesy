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
import { parseDeliveredFrameOffline } from '../src/lib/eainesy/glm.ts';
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
async function replay(c, scriptedObservation = null) {
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
  // The second lane simulates a delivered JSON frame with previously frozen
  // DEV-only parser claims, validated by the SAME checkedFrame as live parsing.
  // This is scripted fixture testing, NOT an actual model classification.
  const frame = scriptedObservation == null ? neutralFrame(c)
    : parseDeliveredFrameOffline(JSON.stringify({
        ...neutralFrame(c), dialogueObservation:scriptedObservation
      }), c.userText);
  assert(frame, 'offline parser rejected scripted frame '+c.id);
  const turn=await processTurn(String(session.id),c.userText,{
    presetFrame:frame,skipGeneration:true,origin:'scenario'
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
    arms,
    fixtureClaimCount:scriptedObservation?.acts?.length ?? 0};
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


// -------------------------------------------------------------
// DEV-only scripted parser-output comparison lane.
// -------------------------------------------------------------
// The snippets below were deliberately prepared from the public DEV cases.
// They test automatic data flow and steering proposals, NOT LLM accuracy,
// human judgment, semantic quality, or independent evidence.
const observationsFile=new URL('../research/nesy-abc/dev-scripted-dialogue-observations.json',import.meta.url);
const observationBytes=readFileSync(observationsFile);
const observations=JSON.parse(observationBytes.toString('utf8'));
assert(observations.protocol===fixture.protocol,'wrong scripted observation protocol');
assert(observations.status==='DEV_SCRIPTED_MODEL_CLAIMS_NOT_LLM_MEASUREMENTS',
  'scripted fixture must be explicitly DEV only');
assert(Object.keys(observations.cases||{}).length===24,'exactly 24 scripted entries required');
const scriptedRows=[],scriptedErrors=[];
for (const c of fixture.cases) {
  const scripted=observations.cases[c.id];
  try {
    assert(scripted?.version===1 && scripted?.origin==='model_claim' && Array.isArray(scripted.acts),
      'invalid scripted dialogue observation '+c.id);
    for (const act of scripted.acts) {
      assert(typeof act?.evidence==='string'&&c.userText.includes(act.evidence),
        'scripted evidence not verbatim '+c.id);
    }
    scriptedRows.push(await replay(c,scripted));
  } catch(error) {
    scriptedErrors.push({id:c.id,reason:error instanceof Error?error.message:'unknown'});
  }
}
const byId=new Map(rows.map(r=>[r.id,r]));
const semanticChanges={A:0,B:0,C:0},changedCaseIds=[];
let claims=0;
const comparisons=[];
for(const row of scriptedRows) {
  const baseline=byId.get(row.id);
  if(!baseline){
    scriptedErrors.push({id:row.id,reason:'missing baseline case'});continue;
  }
  const changes={};
  for(const arm of ['A','B','C']){
    const changed=row.arms[arm].proposed!==baseline.arms[arm].proposed;
    changes[arm]=changed;
    if(changed)semanticChanges[arm]++;
  }
  if(changes.A||changes.B||changes.C)changedCaseIds.push(row.id);
  claims+=row.fixtureClaimCount;
  // The model-shaped optional claim must never alter production safety.
  if(row.core.action!==baseline.core.action||row.core.risk!==baseline.core.risk||
     row.core.verification!==baseline.core.verification||
     row.arms.P0.baseline!==baseline.arms.P0.baseline){
    scriptedErrors.push({id:row.id,reason:'scripted dialogue metadata influenced baseline safety/decision'});
  }
  comparisons.push({
    id:row.id,suite:row.suite,
    scriptedClaims:row.fixtureClaimCount,
    baselineP0:baseline.arms.P0.baseline,
    neutral:{A:baseline.arms.A.proposed,B:baseline.arms.B.proposed,C:baseline.arms.C.proposed},
    scripted:{A:row.arms.A.proposed,B:row.arms.B.proposed,C:row.arms.C.proposed},
    changes,cTriggers:row.arms.C.triggers,
    accepted:false,verified:false,
  });
}
const scriptedStatus=scriptedErrors.length===0 && scriptedRows.length===24 &&
  changedCaseIds.length>0 ? 'PASS_DEV_SCRIPTED_OBSERVATION_WIRING'
  : 'FAIL_DEV_SCRIPTED_OBSERVATION_WIRING';
const scriptedReport={
  schema:'eainesy-abc-scripted-parser-output-dev-v1',
  protocol:fixture.protocol,
  status:scriptedStatus,gitSha:process.env.GITHUB_SHA||'local',
  confirmatory:false,realParserModelUsed:false,modelQualityMeasured:false,
  independentAnnotations:false,semanticAnswerQualityMeasured:false,
  clinicalSafetyValidated:false,realZ3Verified:false,
  externalCalls:0,
  fixtureSha256:createHash('sha256').update(observationBytes).digest('hex'),
  originalDevCorpusSha256:sourceHash,
  counts:{processed:scriptedRows.length,claims,positiveCases:scriptedRows.filter(x=>x.fixtureClaimCount>0).length,
    changedVsNeutral:semanticChanges,changedCaseIds},
  comparisons,errors:scriptedErrors,
};
writeFileSync(resolve(out,'scripted-semantic-report.json'),JSON.stringify(scriptedReport,null,2)+'\n');
const detailed=[
  '# NeSy ABC — semantische testkoppeling met vooraf geschreven parserclaims','',
  'Status: '+scriptedStatus,
  'Broncommit: '+scriptedReport.gitSha,
  'DEV-observaties SHA-256: '+scriptedReport.fixtureSha256,'',
  '**Geen meting van parserkwaliteit, begrip of betere antwoorden.**',
  'Alle claims zijn vooraf geschreven voor de 24 bekende DEV-gevallen en worden offline als modelvormig frame ingevoerd.',
  'Alle voorstellen blijven geblokkeerd (Z3 = SKIPPED); B heeft nog geen echte supervisor.',
  '',
  '| Controle | Resultaat |','| --- | ---: |',
  '| DEV-casussen | '+scriptedRows.length+'/24 |',
  '| Scripted bronclaims | '+claims+' |',
  '| Casussen met scripted claims | '+scriptedReport.counts.positiveCases+' |',
  '| Andere ruwe A/B/C-voorstellen dan neutrale replay | '+semanticChanges.A+'/'+semanticChanges.B+'/'+semanticChanges.C+' |',
  '| Onterechte wijzigingen kernactie/risico/Z3 | '+scriptedErrors.length+' |','',
  '| Casus | A neutraal | A met claim | C neutraal | C met claim | Trigger C |',
  '| --- | --- | --- | --- | --- | --- |',
  ...comparisons.map(r=>'| '+r.id+' | '+r.neutral.A+' | '+r.scripted.A+' | '+r.neutral.C+
    ' | '+r.scripted.C+' | '+(r.cTriggers.join(',')||'-')+' |'),
  '',
  '**Interpretatie:** de tabel meet of een vooraf geschreven, exact verankerde claim technisch door de parser/bridge/mixer loopt.',
  'Een broncitaat valideert niet de betekenis en een veranderd voorstel is geen betere respons.',
  ...scriptedErrors.map(x=>'ERROR '+x.id+': '+x.reason),
  ''
];
writeFileSync(resolve(out,'scripted-semantic-report.md'),detailed.join('\n'));
console.log('NeSy ABC scripted semantic DEV: '+scriptedRows.length+'/24, claims='+claims+
  ', A/B/C proposal changes '+semanticChanges.A+'/'+semanticChanges.B+'/'+semanticChanges.C+
  ', errors='+scriptedErrors.length);
if(scriptedStatus!=='PASS_DEV_SCRIPTED_OBSERVATION_WIRING')process.exitCode=1;
