import test from "node:test";
import assert from "node:assert/strict";
import {compareCooperativeFromP0,fromP0TurnEvidence} from "./p0-bridge.mjs";
const certificate=(verification="sat")=>({
  z3:{result:verification,available:verification==="sat"},
  modelCheck:{pass:true},outputPolicy:{pass:true},action:"THERAPEUTIC_DIALOG",
  riskLevel:"NONE",conversation:{riskMemory:"NONE",strategy:"QUESTION"}
});
function makeSnapshot(verification="sat"){
  const message="Geef me één voorbeeldzin en stel geen extra vragen.";
  const cert=certificate(verification);
  return {
    turnResult:{action:"THERAPEUTIC_DIALOG",reply:"Je kunt beginnen met een korte introductie.",
      certificate:cert},
    turnRecord:{
      userText:message,replyText:"Je kunt beginnen met een korte introductie.",
      certificate:JSON.stringify(cert),
      frame:JSON.stringify({intent:"GENERAL_VENT",riskMarkers:[],paraphrase:""}),
      plan:JSON.stringify({strategy:"QUESTION",action:"THERAPEUTIC_DIALOG"}),
      trace:JSON.stringify([{stage:"lexical",detail:{lexicalMarkers:[]}}])
    },
    history:[]
  };
}
const task={type:"DIRECT_ANSWER",source:"synthetic_annotation",
  evidence:"Geef me één voorbeeldzin"};
const c2Claims=[{kind:"MISSING_INFORMATION",source:"current_user",
  evidence:"geen extra vragen",hypothesis:"Maybe a different style is needed"}];

test("same certificate/turn source flows into S1 and S2 without modifying P0",async()=>{
  const snapshot=makeSnapshot();
  const before=JSON.stringify(snapshot);
  const adapted=fromP0TurnEvidence(snapshot,{task,c2Claims});
  assert.equal(adapted.source,"persisted_processTurn_read_only");
  assert.equal(adapted.P0CertificateFieldsClaimSat,true);
  assert.equal(adapted.verifiedIndependentlyByThisBridge,false);
  assert.equal(adapted.input.base.move,"QUESTION");
  const r=await compareCooperativeFromP0(snapshot,{task,c2Claims,
    recheck:async()=>{throw Error("model should not be called");}});
  assert.equal(r.comparison.S1.proposedMove,"INFORMATION");
  assert.equal(r.comparison.S2.proposedMove,"INFORMATION");
  assert.equal(r.comparison.S2.extraModelCalls,0);
  assert.equal(r.comparison.S2.certified,false);
  assert.equal(r.persistedChangesByCooperativeArm,false);
  assert.equal(r.productionReplyChanged,false);
  assert.equal(JSON.stringify(snapshot),before);
});

test("mocked, missing or UNSAT verification may not gain S2 authority",async()=>{
  for(const verification of ["skipped","unknown","unsat"]){
    const snap=makeSnapshot(verification);
    const r=await compareCooperativeFromP0(snap,{
      task:{type:"PERSON_REQUIRED",source:"synthetic_annotation",
        evidence:"stel geen extra vragen"},
      c2Claims:[{kind:"PERSON",source:"current_user",
        evidence:"extra vragen",hypothesis:"An imaginary referent conflict"}],
      recheck:async()=>{throw Error("model callback not allowed");}
    });
    assert.equal(r.P0CertificateFieldsClaimSat,false);
    assert.equal(r.comparison.S2.proposedMove,"QUESTION");
    assert.equal(r.comparison.S2.extraModelCalls,0);
    assert.equal(r.verifiedIndependentlyByThisBridge,false);
  }
});

test("absent P0 record or inferred task cannot bypass the bridge",async()=>{
  const snap=makeSnapshot();
  assert.throws(()=>fromP0TurnEvidence({...snap,turnRecord:null},{task,c2Claims}));
  assert.throws(()=>fromP0TurnEvidence(snap,{c2Claims}));
  assert.throws(()=>fromP0TurnEvidence(snap,{task,c2Claims:"invalid"}));
});
