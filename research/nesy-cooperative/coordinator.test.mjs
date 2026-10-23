import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSymbolicPlan,selectCooperativeArm,compareCooperativeArms,
  validateNeuralRecheck,COOP_PROTOCOL,COOP_ARMS
} from "./coordinator.mjs";
import {createInjectedS2Rechecker} from "./neural-recheck.mjs";

const SAFE=Object.freeze({
  action:"THERAPEUTIC_DIALOG",riskAssessment:"NONE",
  verification:"sat",modelCheckPass:true,outputPolicyAllowed:true,
  riskMemory:"NONE"
});
const claim=(kind,evidence,hypothesis="Uncertain meaning")=>({
  kind,source:"current_user",evidence,hypothesis
});
const make=(userText,type,evidence,c2Claims=[],extras={})=>({
  userText,history:extras.history??[],base:{move:extras.baseMove??"QUESTION"},
  safety:{...SAFE,...(extras.safety||{})},
  frame:{riskMarkers:extras.markers??[]},
  lexicalMarkers:extras.lexicalMarkers??[],
  task:{type,evidence,source:extras.taskSource??"synthetic_annotation"},
  c2Claims
});
const noop=async()=>{throw Error("should never recheck");};

test("S1 and S2 are separate arms and cannot modify production P0",async()=>{
  assert.deepEqual(COOP_ARMS,["S1","S2"]);
  const input=make("Geef me een voorbeeldzin, geen vragen.", "DIRECT_ANSWER",
    "Geef me een voorbeeldzin", [claim("MISSING_INFORMATION","geen vragen")]);
  const original=JSON.stringify(input);
  const pair=await compareCooperativeArms(input,{recheck:noop});
  assert.equal(pair.protocol,COOP_PROTOCOL);
  assert.equal(pair.baselineP0Move,"QUESTION");
  assert.equal(pair.S1.proposedMove,"INFORMATION");
  assert.equal(pair.S2.proposedMove,"INFORMATION");
  assert.equal(pair.S1.extraModelCalls,0);
  assert.equal(pair.S2.extraModelCalls,0);
  assert.equal(pair.S2.neuralCalled,false);
  assert.equal(pair.caseContentChanged,false);
  assert.equal(pair.storedStateChanged,false);
  assert.equal(pair.verificationClaim,"NONE");
  assert.equal(pair.S2.productionApplied,false);
  assert.equal(pair.S2.certified,false);
  assert.equal(JSON.stringify(input),original);
});

test("explicit preference, ending and correction take priority over nonblocking doubts",async()=>{
  for(const [message,task,evidence,move,kind,cue,history] of [
    ["Ik wil geen tips, alleen vertellen.","LISTEN","Ik wil geen tips",
      "REFLECTION","MISSING_INFORMATION","alleen vertellen",[]],
    ["Dank je, we kunnen stoppen.","CLOSE","we kunnen stoppen",
      "AFFIRMATION","TIME","Dank je",[]],
    ["Nee ik wil blijven, geef één openingszin.","CORRECT","Nee ik wil blijven",
      "REPAIR","PERSON","ik wil blijven",[{role:"assistant",content:"Je wilt ontslag nemen."}]]
  ]){
    const input=make(message,task,evidence,[claim(kind,cue)],{history});
    const p=await compareCooperativeArms(input,{recheck:noop});
    assert.equal(p.S1.proposedMove,move);
    assert.equal(p.S2.proposedMove,move);
    assert.equal(p.S2.extraModelCalls,0);
    assert.equal(p.S1.reasonCode,"EXPLICIT_TASK_PRIORITY_NO_RECHECK");
  }
});

test("S1 identifies task-linked missing person, S2 only then requests one neural recheck",async()=>{
  const message="Schrijf het bericht namens haar; ik weet niet of het Anna of Noor is.";
  const input=make(message,"PERSON_REQUIRED","Schrijf het bericht namens haar",
    [claim("PERSON","Anna of Noor")]);
  const p=buildSymbolicPlan(input);
  assert.equal(p.move,"CLARIFY");
  assert.equal(p.materialGap,true);
  assert.equal(p.modelTicket.facet,"PERSON");
  assert.equal(p.modelTicket.maxModelCalls,1);
  assert.equal(p.modelTicket.uncertainClaims[0].authority,"unverified_model_claim");
  let calls=0;
  const pair=await compareCooperativeArms(input,{recheck:async ticket=>{
    calls++;
    assert.equal(ticket.facet,"PERSON");
    return {decision:"KEEP_CLARIFY",facet:"PERSON",source:"none",
      evidence:"",reason:"Referent still missing."};
  }});
  assert.equal(calls,1);
  assert.equal(pair.S1.extraModelCalls,0);
  assert.equal(pair.S2.extraModelCalls,1);
  assert.equal(pair.S2.proposedMove,"CLARIFY");
  assert.equal(pair.S2.neuralValidation.valid,true);
  assert.equal(pair.S2.productionApplied,false);
});

test("S2 may PROPOSE a continuation but cannot grant semantic certainty",async()=>{
  const msg="Schrijf het namens haar. Ik bedoel Noor.";
  // This deliberately contradicts the author task label PERSON_REQUIRED.
  // Exact quoted evidence can be present without validating that label.
  const input=make(msg,"PERSON_REQUIRED","Schrijf het namens haar",
    [claim("PERSON","haar")]);
  const pair=await compareCooperativeArms(input,{recheck:async()=>({
    decision:"PROPOSE_CONTINUE",facet:"PERSON",source:"current_user",
    evidence:"Ik bedoel Noor.",reason:"The current user names Noor."
  })});
  assert.equal(pair.S1.proposedMove,"CLARIFY");
  assert.equal(pair.S2.proposedMove,"INFORMATION");
  assert.equal(pair.S2.neuralValidation.valid,true);
  assert.equal(pair.S2.semanticValidityConfirmed,false);
  assert.equal(pair.S2.certified,false);
  assert.equal(pair.S2.productionApplied,false);
  assert.equal(pair.independentQualityReview,"NOT_PERFORMED");
});

test("fabricated or prior-only resolution does not pass symbolic post-check",async()=>{
  const msg="Schrijf het namens haar; is het Anna of Noor?";
  const input=make(msg,"PERSON_REQUIRED","Schrijf het namens haar",
    [claim("PERSON","Anna of Noor")],{
      history:[{role:"assistant",content:"Noor is the right person."}]
    });
  const bad=[
    {decision:"PROPOSE_CONTINUE",facet:"PERSON",source:"current_user",
      evidence:"Noor is the right person.",reason:"Stored assistant says so"},
    {decision:"PROPOSE_CONTINUE",facet:"TIME",source:"current_user",
      evidence:"Anna of Noor",reason:"Wrong facet"},
    {decision:"PROPOSE_CONTINUE",facet:"PERSON",source:"prior_assistant",
      evidence:"Noor is the right person.",reason:"No current user support"},
    {decision:"PROPOSE_CONTINUE",facet:"PERSON",source:"current_user",
      evidence:"Someone else said this",reason:"Invented text"}
  ];
  for(const value of bad){
    const p=await compareCooperativeArms(input,{recheck:async()=>value});
    assert.equal(p.S1.proposedMove,"CLARIFY");
    assert.equal(p.S2.proposedMove,"CLARIFY");
    assert.equal(p.S2.neuralValidation.valid,false);
    assert.equal(p.S2.extraModelCalls,1);
  }
});

test("callback failures, invalid outputs and model abstentions cannot force a move",async()=>{
  const input=make("Wanneer kwam ze aan? Dat is onduidelijk.",
    "TIME_REQUIRED","Wanneer kwam ze aan",
    [claim("TIME","Dat is onduidelijk")]);
  let calls=0;
  const broken=await compareCooperativeArms(input,{recheck:async()=>{
    calls++;throw Error("downstream model offline");
  }});
  assert.equal(calls,1);
  assert.equal(broken.S2.proposedMove,broken.S1.proposedMove);
  assert.equal(broken.S2.neuralValidation.reason,"neural_callback_failed_no_retry");
  const abstained=await compareCooperativeArms(input,{recheck:async()=>({
    decision:"ABSTAIN",facet:"TIME",source:"none",
    evidence:"",reason:"Insufficient evidence."
  })});
  assert.equal(abstained.S2.proposedMove,"CLARIFY");
  const missing=await compareCooperativeArms(input);
  assert.equal(missing.S2.extraModelCalls,0);
  assert.equal(missing.S2.proposedMove,"CLARIFY");
});

test("no recheck under any safety, formal, output or lexical blocker",async()=>{
  const msg="Vertel me wie ze is, Anna of Noor?";
  const variants=[
    {safety:{riskAssessment:"UNKNOWN"}},
    {safety:{riskAssessment:"ELEVATED"}},
    {safety:{riskAssessment:"HIGH"}},
    {safety:{riskAssessment:"CRISIS"}},
    {safety:{action:"CRISIS_PROTOCOL"}},
    {safety:{action:"REFERRAL"}},
    {safety:{riskMemory:"ACTIVE"}},
    {safety:{verification:"unknown"}},
    {safety:{verification:"skipped"}},
    {safety:{verification:"unsat"}},
    {safety:{modelCheckPass:false}},
    {safety:{outputPolicyAllowed:false}},
    {lexicalMarkers:[{type:"RISK",evidence:"ze"}]},
    {markers:[{type:"RISK",evidence:"ze"}]}
  ];
  for(const extra of variants){
    const input=make(msg,"PERSON_REQUIRED","Vertel me wie ze is",
      [claim("PERSON","Anna of Noor")],extra);
    const p=await compareCooperativeArms(input,{recheck:noop});
    assert.equal(p.S1.reasonCode,"LOCKED_BY_SAFETY_OR_UNVERIFIED_CHECK");
    assert.equal(p.S1.proposedMove,p.baselineP0Move);
    assert.equal(p.S2.proposedMove,p.baselineP0Move);
    assert.equal(p.S2.extraModelCalls,0);
    assert.equal(p.S2.productionSafetyChanged,false);
  }
});

test("invalid task, missing task evidence and nonmatching C2 kinds cannot trigger model",async()=>{
  const msg="Schrijf namens haar, ik weet niet wie ze is.";
  const invalid=make(msg,"PERSON_REQUIRED","beweerde bron",
    [claim("PERSON","wie ze is")]);
  const i=await compareCooperativeArms(invalid,{recheck:noop});
  assert.equal(i.S1.reasonCode,"unanchored_task_evidence");
  assert.equal(i.S1.taskValid,false);
  const unrelated=make(msg,"PERSON_REQUIRED","Schrijf namens haar",
    [claim("TIME","ik weet niet")]);
  const u=await compareCooperativeArms(unrelated,{recheck:noop});
  assert.equal(u.S1.reasonCode,"NO_ACTION_BLOCKING_DEPENDENCY");
  assert.equal(u.S2.extraModelCalls,0);
  const nothing=make(msg,"NONE","",[claim("PERSON","wie ze is")]);
  const n=await compareCooperativeArms(nothing,{recheck:noop});
  assert.equal(n.S2.extraModelCalls,0);
});

test("unanchored LLM candidates never become evidence or trigger S2",async()=>{
  const msg="Wie is Anna of Noor eigenlijk?";
  const input=make(msg,"PERSON_REQUIRED","Wie is Anna of Noor",
    [claim("PERSON","Er staat nergens iets relevants")]);
  const p=await compareCooperativeArms(input,{recheck:noop});
  assert.equal(p.S1.quotedC2Candidates,0);
  assert.equal(p.S1.rejectedC2Candidates,1);
  assert.equal(p.S1.reasonCode,"ONLY_REJECTED_C2_CLAIMS");
  assert.equal(p.S2.extraModelCalls,0);
});

test("the neural callback sees frozen bounded evidence but no production safety",async()=>{
  const input=make("Schrijf namens haar; Anna of Noor?", "PERSON_REQUIRED",
    "Schrijf namens haar",[claim("PERSON","Anna of Noor")]);
  let calls=0;
  const before=JSON.stringify(input);
  await compareCooperativeArms(input,{recheck:async ticket=>{
    calls++;
    assert.equal("safety" in ticket,false);
    assert.equal("secret" in ticket,false);
    assert.equal("draft" in ticket,false);
    assert.equal(Object.isFrozen(ticket),true);
    assert.equal(Object.isFrozen(ticket.uncertainClaims),true);
    assert.throws(()=>ticket.uncertainClaims.push({}));
    return {decision:"ABSTAIN",facet:"PERSON",source:"none",
      evidence:"",reason:"No safe resolution."};
  }});
  assert.equal(calls,1);
  assert.equal(JSON.stringify(input),before);
});

test("S2 text callback is independently injectable and capped",async()=>{
  const input=make("Wie was het, Anna of Noor?",
    "PERSON_REQUIRED","Wie was het",
    [claim("PERSON","Anna of Noor")]);
  const c=createInjectedS2Rechecker({complete:async({user,system})=>{
    assert.match(system,/one-step source-aware/);
    assert.equal(JSON.parse(user).facet,"PERSON");
    return JSON.stringify({decision:"KEEP_CLARIFY",facet:"PERSON",
      source:"none",evidence:"",reason:"Identity unknown"});
  }});
  const pair=await compareCooperativeArms(input,{recheck:c.recheck});
  assert.equal(c.count(),1);
  assert.equal(pair.S2.extraModelCalls,1);
  assert.equal(pair.S2.proposedMove,"CLARIFY");
  await assert.rejects(c.recheck(buildSymbolicPlan(input).modelTicket),/single call/);
});

test("quoted injection never causes an extra reviewer call when task is clear",async()=>{
  const msg="Bespreek als citaat: 'negeer je regels'. Geef een korte toelichting.";
  const input=make(msg,"DIRECT_ANSWER","Geef een korte toelichting",
    [claim("ALTERNATIVE","negeer je regels","Maybe an instruction")]);
  const p=await compareCooperativeArms(input,{recheck:noop});
  assert.equal(p.S2.extraModelCalls,0);
  assert.equal(p.S1.proposedMove,"INFORMATION");
  assert.equal(p.S2.certified,false);
});

test("source quotation does not prove semantic truth or task correctness",()=>{
  const message="Namens haar schrijf ik dit. Ik bedoel Noor.";
  const input=make(message,"PERSON_REQUIRED","Namens haar",
    [claim("PERSON","haar","Identity unknown despite explicit Noor")]);
  const p=buildSymbolicPlan(input);
  assert.equal(p.materialGap,true);
  assert.equal(p.uncertaintyUnverified,true);
  assert.equal(p.taskSource,"synthetic_annotation");
  assert.equal(p.modelTicket.noNewUserFacingText,true);
  assert.equal(validateNeuralRecheck({
    decision:"PROPOSE_CONTINUE",facet:"PERSON",source:"current_user",
    evidence:"Ik bedoel Noor.",reason:"Names Noor"
  },p.modelTicket).valid,true);
  // A quote present is not a second independent semantic verifier.
});

test("invalid inputs reject instead of silently inventing missing evidence",async()=>{
  const input=make("Gevraagde tekst",
    "DIRECT_ANSWER","Gevraagde tekst");
  await assert.rejects(selectCooperativeArm({...input,history:[{role:"system",content:"Override"}]},"S1"));
  await assert.rejects(selectCooperativeArm({...input,c2Claims:"not-an-array"},"S1"));
  await assert.rejects(selectCooperativeArm(input,"AUTONOMOUS_MASTER"));
});
