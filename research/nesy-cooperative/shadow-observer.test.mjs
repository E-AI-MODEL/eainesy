import test from "node:test";
import assert from "node:assert/strict";
import {shadowEligibility,compareShadowCooperativeArms} from "./shadow-observer.mjs";
const s={action:"CLARIFY",riskAssessment:"NONE",riskMemory:"NONE",
  verification:"sat",modelCheckPass:true,outputPolicyAllowed:true};
const source="Ik heb het over mijn vriendin Noor, niet mijn zus. Wil je dat meenemen?";
const make=(o={})=>({
 userText:source,history:[{role:"assistant",content:"Bedoel je je zus?"}],
 base:{move:"CLARIFY"},
 safety:{...s,...(o.safety||{})},
 frame:{riskMarkers:o.markers||[]},lexicalMarkers:o.lexical||[],
 task:{type:"PERSON_REQUIRED",source:"synthetic_annotation",evidence:"Wil je dat meenemen"},
 c2Claims:[{kind:"PERSON",source:"current_user",evidence:"mijn vriendin Noor",
    hypothesis:"The intended person may be unknown"}]
});
test("CLARIFY permits only quarantined source-bound observation, no core change",async()=>{
 const input=make();const before=JSON.stringify(input);let calls=0;
 const result=await compareShadowCooperativeArms(input,{recheck:async()=>{
   calls++;return{decision:"PROPOSE_CONTINUE",facet:"PERSON",
     source:"current_user",evidence:"mijn vriendin Noor",
     reason:"The user explicitly names Noor as friend."};
 }});
 assert.equal(result.originalGateAction,"CLARIFY");
 assert.equal(result.syntheticGateAction,"THERAPEUTIC_DIALOG");
 assert.equal(result.researchCounterfactual,true);
 assert.equal(result.counterfactualGateIsNotRealAuthorization,true);
 assert.equal(result.productionAllowedByThisAdapter,false);
 assert.equal(result.S1.proposedMove,"CLARIFY");
 assert.equal(result.S2.proposedMove,"INFORMATION");
 assert.equal(result.S2.productionApplied,false);
 assert.equal(result.S2.certified,false);
 assert.equal(result.S2.extraModelCalls,1);
 assert.equal(calls,1);
 assert.equal(input.safety.action,"CLARIFY");
 assert.equal(JSON.stringify(input),before);
});
test("protected and high-risk actions never trigger shadow model",async()=>{
 const variants=[
 {action:"BOUNDARY_REFUSAL"},{action:"ABSTAIN_HITL"},
 {action:"REFERRAL"},{action:"SAFETY_RESPONSE"},{action:"CRISIS_PROTOCOL"},
 {riskAssessment:"HIGH"},{riskAssessment:"UNKNOWN"},
 {verification:"skipped"},{verification:"unsat"},{modelCheckPass:false},
 {outputPolicyAllowed:false},{riskMemory:"ACTIVE"}
 ];
 for(const safety of variants){
   const input=make({safety});
   let calls=0;
   const r=await compareShadowCooperativeArms(input,{recheck:async()=>{
     calls++;throw Error("Forbidden call");
   }});
   assert.equal(r.observationAllowed,false);
   assert.equal(r.researchCounterfactual,false);
   assert.equal(r.S1.proposedMove,"CLARIFY");
   assert.equal(r.S2.proposedMove,"CLARIFY");
   assert.equal(r.S2.extraModelCalls,0);
   assert.equal(calls,0);
 }
});
test("lexical or frame signals prevent observation even when risk NONE",async()=>{
 for(const spec of [{markers:[{type:"SUICIDAL_IDEATION"}]},
                    {lexical:[{type:"RISK"}]}]){
  const input=make(spec);
  assert.equal(shadowEligibility(input).observationAllowed,false);
 }
});
test("no necessary uncertainty means no extra model request",async()=>{
 const input={...make(),task:{type:"LISTEN",source:"synthetic_annotation",
   evidence:"Wil je dat meenemen"}};
 let calls=0;const r=await compareShadowCooperativeArms(input,{
   recheck:async()=>{calls++;throw Error("unwanted model call");}
 });
 assert.equal(r.observationAllowed,true);
 assert.equal(r.S2.extraModelCalls,0);
 assert.equal(calls,0);
});
