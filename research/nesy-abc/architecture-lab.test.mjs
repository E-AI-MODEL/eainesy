import test from "node:test";
import assert from "node:assert/strict";
import { selectArchitecture, evidenceWorkspace, ARMS } from "./architecture-lab.mjs";

const make=(message="Ik wil even praten.",overrides={})=>({
  userText:message,
  draft:overrides.draft ?? "Ik hoor je. Vertel maar.",
  history:[{role:"user",content:"Ik zit met iets."},{role:"assistant",content:"Wil je vertellen wat er speelt?"}],
  frame:{intent:"GENERAL_VENT",paraphrase:"Gebruiker wil praten.",riskMarkers:[],...overrides.frame},
  lexicalMarkers:overrides.lexicalMarkers??[],
  base:{move:overrides.move??"QUESTION"},
  safety:{action:"THERAPEUTIC_DIALOG",riskAssessment:"NONE",verification:"sat",modelCheckPass:true,outputPolicyAllowed:true,riskMemory:"NONE",...overrides.safety}
});

test("four arms exist and P0 retains P0 decision",async()=>{
  assert.deepEqual(ARMS,["P0","A","B","C"]);
  const result=await selectArchitecture(make("Ik wil geen tips.",{move:"SUGGESTION"}),"P0");
  assert.equal(result.selectedMove,"SUGGESTION");
  assert.equal(result.extraCalls,0);
});
test("A honors explicit no-advice without another model call",async()=>{
  const r=await selectArchitecture(make("Ik wil geen tips. Ik wil alleen vertellen.",{move:"SUGGESTION"}),"A");
  assert.equal(r.selectedMove,"REFLECTION");
  assert.equal(r.extraCalls,0);
});
test("A repairs correction of assistant assumption",async()=>{
  const r=await selectArchitecture(make("Nee, je begrijpt me niet. Ik bedoel mijn kind.",{move:"SUGGESTION"}),"A");
  assert.equal(r.selectedMove,"REPAIR");
});
test("A answers direct request without forced phase",async()=>{
  const r=await selectArchitecture(make("Kun je een voorbeeld geven zonder eerst vragen te stellen?"),"A");
  assert.equal(r.selectedMove,"INFORMATION");
});
test("workspace preserves evidence and distinguishes unverified model scope",()=>{
  const q=make("Mijn broer had vroeger last van angst.",{
    frame:{riskMarkers:[{type:"HOPELESSNESS",evidence:"last van angst",scope:{experiencer:"other",temporality:"past_resolved",polarity:"affirmed"}}]},
    lexicalMarkers:[{type:"HOPELESSNESS",evidence:"last van angst"}]});
  const w=evidenceWorkspace(q);
  assert.equal(w.evidence.length,2);
  assert.equal(w.evidence[1].status,"model_claim");
  assert.deepEqual(w.triggerCodes,[]);
  assert.equal(w.flags.contextualScope,true);
  assert.equal(w.flags.uncertainScope,false);
});
test("C never calls orchestrator for ordinary, untriggered message",async()=>{
  let calls=0;
  const r=await selectArchitecture(make("Vandaag heb ik een leuke dag gehad."),"C",{orchestrator:async()=>{calls++;return {kind:"revise",move:"INFORMATION"};}});
  assert.equal(calls,0);assert.equal(r.extraCalls,0);assert.equal(r.selectedMove,"QUESTION");
});
test("C fires on correction, calls injected orchestrator once and records triggers",async()=>{
  let calls=0;
  const r=await selectArchitecture(make("Nee, je begrijpt me niet. Ik bedoel mijn moeder."),"C",{orchestrator:async({workspace,callBudget})=>{calls++;assert.equal(callBudget,1);assert.deepEqual(workspace.triggerCodes,["T2"]);return {kind:"revise",move:"REPAIR",reason:"correct attribution"};}});
  assert.equal(calls,1);assert.equal(r.extraCalls,1);assert.equal(r.selectedMove,"REPAIR");
});
test("B can revise P0 with exactly one injected supervisor callback",async()=>{
  let calls=0;
  const r=await selectArchitecture(make("Ik wil alleen vertellen.",{move:"SUGGESTION"}),"B",{supervisor:async()=>{calls++;return {kind:"revise",move:"REFLECTION",reason:"no-advice request"};}});
  assert.equal(calls,1);assert.equal(r.selectedMove,"REFLECTION");assert.equal(r.extraCalls,1);
});
test("C and B cannot downgrade safety, use model callback, or bypass blocked verification",async()=>{
  for(const arm of ["A","B","C"]){
    let calls=0;
    const r=await selectArchitecture(make("Nee, je begrijpt me niet.",{move:"SAFETY",safety:{action:"CRISIS_PROTOCOL",riskAssessment:"CRISIS"}}),arm,{supervisor:async()=>{calls++;return {kind:"revise",move:"INFORMATION"};},orchestrator:async()=>{calls++;return {kind:"revise",move:"INFORMATION"};}});
    assert.equal(r.selectedMove,"SAFETY");assert.equal(r.accepted,false);assert.equal(calls,0);
  }
  for(const verification of ["unsat","unknown","skipped"]){
    const r=await selectArchitecture(make("Kun je een voorbeeld geven?",{safety:{verification}}),"A");
    assert.equal(r.accepted,false);assert.equal(r.selectedMove,"QUESTION");
  }
});
test("untrusted supervisor proposal cannot invent or bypass allowed moves",async()=>{
  const r=await selectArchitecture(make("Ik wil een antwoord"),"B",{supervisor:async()=>({kind:"revise",move:"DISABLE_SAFETY"})});
  assert.equal(r.selectedMove,"QUESTION");
  assert.equal(r.extraCalls,1);
});
test("C handles callback exception without extra implicit retries",async()=>{
  let calls=0;
  const r=await selectArchitecture(make("Nee, dat klopt niet."),"C",{orchestrator:async()=>{calls++;throw Error("offline failure");}});
  assert.equal(calls,1);assert.equal(r.extraCalls,1);assert.equal(r.supervisorOutcome.kind,"error");
  assert.equal(r.selectedMove,"REPAIR");
});
test("all safety snapshots are read-only research outputs",async()=>{
  const inp=make("Geen tips",{safety:{riskAssessment:"ELEVATED",action:"SAFETY_RESPONSE"},move:"SAFETY"});
  const before=JSON.stringify(inp.safety);
  for(const arm of ARMS){
    const r=await selectArchitecture(inp,arm);
    assert.equal(JSON.stringify(inp.safety),before);
    assert.equal(JSON.stringify(r.safetyUnchanged),before);
  }
});

test("anchored semantic correction can drive A when literal correction phrase is absent",async()=>{
  const input=make("That refers to my sister, not me.");
  input.dialogueObservation={version:1,origin:"model_claim",acts:[
    {type:"CORRECT_ASSUMPTION",evidence:"my sister, not me"}
  ]};
  const result=await selectArchitecture(input,"A");
  assert.equal(result.proposedMove,"REPAIR");
  assert.equal(result.selectedMove,"REPAIR");
  assert.equal(result.extraCalls,0);
});
test("invented semantic observation cannot change the dialogue choice",async()=>{
  const input=make("A neutral comment.");
  input.dialogueObservation={version:1,origin:"model_claim",acts:[
    {type:"CORRECT_ASSUMPTION",evidence:"my sister, not me"}
  ]};
  const result=await selectArchitecture(input,"A");
  assert.equal(result.proposedMove,"QUESTION");
});
test("grounded semantic claim still cannot override safety",async()=>{
  const input=make("I mean my sister, not me.",{move:"SAFETY",safety:{action:"CRISIS_PROTOCOL",riskAssessment:"CRISIS"}});
  input.dialogueObservation={version:1,origin:"model_claim",acts:[
    {type:"CORRECT_ASSUMPTION",evidence:"my sister, not me"}
  ]};
  const result=await selectArchitecture(input,"C",{orchestrator:async()=>{throw new Error("should not call");}});
  assert.equal(result.selectedMove,"SAFETY");
  assert.equal(result.accepted,false);
  assert.equal(result.extraCalls,0);
});

test("B requires a concrete P0 draft and does not invoke callback when missing",async()=>{
  let calls=0;
  const input=make("Kun je dat uitleggen?",{draft:"",move:"QUESTION"});
  const r=await selectArchitecture(input,"B",{supervisor:async()=>{calls++;return {kind:"revise",move:"INFORMATION"};}});
  assert.equal(calls,0);
  assert.equal(r.extraCalls,0);
  assert.equal(r.candidateDraft,null);
  assert.equal(r.selectedMove,"QUESTION");
});

test("real scope uncertainty triggers T3; correctly known other/past does not",async()=>{
  const input=make("Mijn moeder was vroeger ziek.",{
    frame:{riskMarkers:[{type:"ISOLATION",evidence:"Mijn moeder was vroeger ziek",
      scope:{experiencer:"other",temporality:"past_resolved",polarity:"affirmed"}}]},
    lexicalMarkers:[{type:"ISOLATION",evidence:"Mijn moeder was vroeger ziek"}]
  });
  const r=await selectArchitecture(input,"C",{orchestrator:async()=>{throw Error("unnecessary C call");}});
  assert.deepEqual(r.triggers,[]);
  assert.equal(r.extraCalls,0);
  const uncertain=make("We weten niet van wie dit verslag is.",{
    frame:{riskMarkers:[{type:"ISOLATION",evidence:"dit verslag",
      scope:{experiencer:"unknown",temporality:"unknown",polarity:"uncertain"}}]},
    lexicalMarkers:[{type:"ISOLATION",evidence:"dit verslag"}]
  });
  const workspace=evidenceWorkspace(uncertain);
  assert.deepEqual(workspace.triggerCodes,["T3"]);
  assert.equal(workspace.flags.uncertainScope,true);
});
