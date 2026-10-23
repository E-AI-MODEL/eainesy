#!/usr/bin/env node
/**
 * Pure offline paired comparison P0/S1/S2. NO cloud model, API, key,
 * production DB, user message, or real Z3 assertion.
 *
 * DEV scenario expectations were authored with the scenario definitions;
 * they can test software behavior only, not prove semantic superiority.
 */
import assert from "node:assert/strict";
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {resolve,join} from "node:path";
import {compareCooperativeArms} from "../research/nesy-cooperative/coordinator.mjs";
import {createInjectedS2Rechecker} from "../research/nesy-cooperative/neural-recheck.mjs";

if(process.argv.length!==3 || process.argv[2]!=="--dev")
  throw Error("S1/S2 deterministic comparison requires --dev");
const ROOT=resolve(fileURLToPath(new URL("../",import.meta.url)));
const path=join(ROOT,"research/nesy-cooperative/s1s2-dev-v1.json");
const bytes=readFileSync(path);
const data=JSON.parse(bytes.toString("utf8"));
const sha=b=>createHash("sha256").update(b).digest("hex");
assert.equal(data.status,"PUBLIC_SYNTHETIC_ENGINEERING_FIXTURES_NOT_BLIND");
assert.equal(data.cases?.length,20);
assert.equal(new Set(data.cases.map(c=>c.id)).size,20);
const rows=[];let totalReviewerCallbacks=0;
for(const fixture of data.cases){
  let stubRequests=0;
  const reviewer=createInjectedS2Rechecker({complete:async()=>{
    stubRequests++;
    if(!fixture.scriptedNeuralReview)
      throw Error("unexpected recheck: no scripted DEV answer exists");
    if(fixture.scriptedNeuralReview.throws)
      throw Error("simulated model transport outage");
    return JSON.stringify(fixture.scriptedNeuralReview);
  }});
  const input={
    userText:fixture.userText,history:fixture.history,
    task:fixture.task,base:fixture.base,safety:fixture.safety,
    frame:fixture.frame,lexicalMarkers:fixture.lexicalMarkers,
    c2Claims:fixture.c2Claims
  };
  const previous=JSON.stringify(input);
  const paired=await compareCooperativeArms(input,{recheck:reviewer.recheck});
  assert.equal(JSON.stringify(input),previous,"input must remain unchanged");
  assert.equal(paired.S1.proposedMove,fixture.expected.S1,
    fixture.id+": unexpected S1 move");
  assert.equal(paired.S2.proposedMove,fixture.expected.S2,
    fixture.id+": unexpected S2 move");
  assert.equal(paired.S1.extraModelCalls,0);
  assert.equal(paired.S2.extraModelCalls,fixture.expected.calls,
    fixture.id+": unexpected model-call count");
  assert.equal(stubRequests,fixture.expected.calls,
    fixture.id+": callback may be invoked only when allowed");
  assert.equal(reviewer.count(),fixture.expected.calls);
  assert.equal(paired.S1.productionApplied,false);
  assert.equal(paired.S2.productionApplied,false);
  assert.equal(paired.S1.certified,false);
  assert.equal(paired.S2.certified,false);
  assert.equal(paired.caseContentChanged,false);
  assert.equal(paired.storedStateChanged,false);
  totalReviewerCallbacks+=stubRequests;
  rows.push({
    id:fixture.id,stratum:fixture.stratum,
    baselineMove:paired.baselineP0Move,
    S1:paired.S1.proposedMove,S2:paired.S2.proposedMove,
    S1Calls:0,S2Calls:paired.S2.extraModelCalls,
    S1Reason:paired.S1.reasonCode,
    proposedMoveChanged:paired.S2.proposedMove!==paired.S1.proposedMove,
    neuralCheck:paired.S2.neuralValidation?.reason??null,
    materialGapHypothesis:paired.S1.materialGapHypothesis,
    sourceAnchoringIsSemanticProof:false,productionApplied:false
  });
}
const report={
  schema:"nesy-s1-s2-scripted-dev-paired-report-v1",
  status:"PASS_ENGINEERING_ONLY_NOT_MODEL_EFFICACY",
  protocol:data.schema,
  sourceCommit:process.env.GITHUB_SHA||"local",
  corpusSha256:sha(bytes),
  cases:rows.length,synthetic:true,authoredExpectedLabels:true,
  blinded:false,realLLM:false,realZ3:false,
  P0RuntimeInvoked:false,noUserData:true,
  independentJudgments:false,semanticQualityMeasured:false,
  safetyChanged:false,productionRepliesChanged:false,
  totalCalls:{P0:0,S1:0,S2:totalReviewerCallbacks},
  S1ToS2ProposedMoveDifferences:rows.filter(x=>x.proposedMoveChanged).length,
  materialGapCases:rows.filter(x=>x.materialGapHypothesis).length,
  details:rows
};
const out=join(ROOT,".research-output/nesy-s1s2-dev");
mkdirSync(out,{recursive:true});
writeFileSync(join(out,"paired-report.json"),JSON.stringify(report,null,2)+"\n");
writeFileSync(join(out,"paired-report.md"),[
  "# NeSy P0/S1/S2 paired comparison — synthetic DEV engineering only","",
  "The tests used hand-authored expected moves and a scripted callback, **not a real LLM or real Z3**.",
  "None of these are evidence of improved dialogue understanding or safety. P0 was a frozen input, not a live execution.",
  "",
  "| Category | Number |","| --- | ---: |",
  "| Cases | "+report.cases+" |",
  "| S1 model calls | "+report.totalCalls.S1+" |",
  "| S2 scripted model callbacks | "+report.totalCalls.S2+" |",
  "| Research-only proposed move differences S2 versus S1 | "+report.S1ToS2ProposedMoveDifferences+" |",
  "| Cases with task-linked uncertainty hypotheses | "+report.materialGapCases+" |",
  "",
  "| ID | P0 | S1 | S2 | S2 calls | Reason |",
  "| --- | --- | --- | --- | ---: | --- |",
  ...rows.map(r=>"| "+r.id+" | "+r.baselineMove+" | "+r.S1+" | "+r.S2+" | "+r.S2Calls+" | "+r.S1Reason+" |"),
  "",
  "No claims of statistical superiority, learning, clinical validity or production permission.",
  ""
].join("\n"));
if(process.env.GITHUB_STEP_SUMMARY)
  writeFileSync(process.env.GITHUB_STEP_SUMMARY,[
    "## NeSy S1 / S2 offline cooperative engineering",
    "",
    "| Metric | Result |","| --- | ---: |",
    "| Fictitious cases | "+report.cases+"/20 |",
    "| S1 extra calls | "+report.totalCalls.S1+" |",
    "| S2 scripted callbacks | "+report.totalCalls.S2+" |",
    "| S1/S2 proposed-move differences | "+report.S1ToS2ProposedMoveDifferences+" |",
    "",
    "Scripted callbacks, synthetic verification; NO genuine LLM run or quality ranking."
  ].join("\n"),{flag:"a"});
console.log("NESY S1S2 DEV "+JSON.stringify({
  status:report.status,cases:report.cases,
  S1Calls:0,S2ScriptedCalls:report.totalCalls.S2,
  S1S2MoveDifferences:report.S1ToS2ProposedMoveDifferences,
  realModelCalls:0,realZ3:false
}));
