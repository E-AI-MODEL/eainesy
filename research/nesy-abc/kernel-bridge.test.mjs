import test from "node:test";
import assert from "node:assert/strict";
import {fromVerifiedTurn,compareVerifiedTurn} from "./kernel-bridge.mjs";
const snapshot=(overrides={})=>{
 const cert={action:"THERAPEUTIC_DIALOG",riskLevel:"NONE",modelCheck:{pass:true},z3:{result:"sat"},outputPolicy:{pass:true},conversation:{strategy:"QUESTION",riskMemory:"NONE"},...overrides.certificate};
 const trace=[
  {stage:"parse",detail:{intent:"GENERAL_VENT",paraphrase:"",riskMarkers:[]}},
  {stage:"lexical",detail:{lexicalMarkers:[]}},
  {stage:"plan",detail:{strategy:"QUESTION",action:"THERAPEUTIC_DIALOG"}},
 ];
 return {turnResult:{action:"THERAPEUTIC_DIALOG",reply:"Existing answer",certificate:cert,trace},turnRecord:{userText:overrides.userText??"Ik wil over mijn werk praten.",certificate:JSON.stringify(cert),trace:JSON.stringify(trace),frame:JSON.stringify(trace[0].detail),plan:JSON.stringify(trace[2].detail)}};
};
test("read-only bridge maps real certificate fields into common input",()=>{
 const src=snapshot();
 const before=JSON.stringify(src);
 const v=fromVerifiedTurn(src);
 assert.equal(v.verified,true);
 assert.equal(v.input.base.move,"QUESTION");
 assert.equal(v.input.safety.verification,"sat");
 assert.equal(JSON.stringify(src),before);
});
test("all arms consume same verified turn and preserve safety snapshot",async()=>{
 const src=snapshot({userText:"Ik wil geen tips. Ik wil alleen vertellen."});
 const before=JSON.stringify(src);
 const r=await compareVerifiedTurn(src);
 assert.deepEqual(Object.keys(r.arms),["P0","A","B","C"]);
 assert.equal(r.arms.P0.selectedMove,"QUESTION");
 assert.equal(r.arms.A.selectedMove,"REFLECTION");
 assert.equal(r.arms.C.selectedMove,"REFLECTION");
 assert.equal(r.arms.C.extraCalls,0);
 assert.equal(r.baselineAction,"THERAPEUTIC_DIALOG");
 assert.equal(JSON.stringify(src),before);
});
test("blocked real Z3 never turns into safe model suggestion",async()=>{
 for(const result of ["skipped","unsat","unknown"]){
  const src=snapshot({certificate:{z3:{result}}});
  const r=await compareVerifiedTurn(src,{orchestrator:async()=>{throw Error("must not call");},supervisor:async()=>{throw Error("must not call");}});
  assert.equal(r.verified,false);
  for(const arm of ["A","B","C"])assert.equal(r.arms[arm].accepted,false);
 }
});
test("failed outputpolicy / modelcheck prevents A B C proposal",async()=>{
 for(const flag of [{modelCheck:{pass:false}},{outputPolicy:{pass:false}}]){
  const r=await compareVerifiedTurn(snapshot({certificate:flag}));
  assert.equal(r.verified,false);
  for(const arm of ["A","B","C"])assert.equal(r.arms[arm].accepted,false);
 }
});
test("risk memory ACTIVE holds safety floor and skips extra callbacks",async()=>{
 let calls=0;
 const input=snapshot({userText:"Nee, je begrijpt me niet.",certificate:{conversation:{strategy:"QUESTION",riskMemory:"ACTIVE"}}});
 const r=await compareVerifiedTurn(input,{orchestrator:async()=>{calls++;return {kind:"revise",move:"REPAIR"};},supervisor:async()=>{calls++;return {kind:"revise",move:"REPAIR"};}});
 assert.equal(calls,0);
 for(const arm of ["A","B","C"])assert.equal(r.arms[arm].accepted,false);
});
