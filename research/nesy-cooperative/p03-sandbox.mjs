/**
 * P03 research-only counterfactual sandbox.
 * The "sat"/THERAPEUTIC_DIALOG fields below are SYNTHETIC fixtures required
 * by the existing S1/S2 research contract, NOT P0 admission or Z3 results.
 * Never import this adapter into production or reuse for patient/user data.
 */
import {buildSymbolicPlan,compareCooperativeArms} from "./coordinator.mjs";

export const P03_PROTOCOL="EAINESY-P03-2026-10-23";
export const P03_SYNTHETIC_SAFETY=Object.freeze({
  action:"THERAPEUTIC_DIALOG",
  riskAssessment:"NONE",
  riskMemory:"NONE",
  verification:"sat", // **SIMULATED**, not a Z3 certificate
  modelCheckPass:true,  // **SIMULATED**, not a model-checker result
  outputPolicyAllowed:true // **SIMULATED**, never delivered to users
});

export function p03InputFromFixture(c){
  if(!c||c.scope!=="FICTIONAL_SEMANTICS_ONLY_NOT_P0_NOT_Z3"||
     typeof c.userText!=="string"||!Array.isArray(c.history)||
     c.task?.source!=="synthetic_annotation"||
     !Array.isArray(c.c2Claims)||c.baselineMove!=="QUESTION")
    throw Error("Not an approved fictional P03 fixture");
  return {
    userText:c.userText,
    history:structuredClone(c.history),
    task:structuredClone(c.task),
    c2Claims:structuredClone(c.c2Claims),
    base:{move:c.baselineMove},
    safety:{...P03_SYNTHETIC_SAFETY},
    frame:{riskMarkers:[]},
    lexicalMarkers:[]
  };
}

/** Preflight requires known technical opportunity yield BEFORE live costs. */
export function p03OfflinePreflight(cases){
  if(!Array.isArray(cases)||cases.length!==14)
    throw Error("P03 requires exactly 14 immutable cases");
  let triggered=0,controls=0,resolved=0,unresolved=0;
  const rows=[];
  const ids=new Set();
  for(const c of cases){
    if(ids.has(c.id)||!/^P03-[0-9]{2}$/.test(c.id))
      throw Error("non-unique or unbounded P03 id");
    ids.add(c.id);
    if(!["PERSON_REQUIRED","TIME_REQUIRED","DIRECT_ANSWER","LISTEN",
         "CLOSE","CORRECT","NONE"].includes(c.task?.type))
      throw Error("unsupported P03 task");
    if(c.task.evidence && !c.userText.includes(c.task.evidence))
      throw Error("unanchored author task");
    if(!Array.isArray(c.history)||c.history.length!==2||
       c.history.some((h,i)=>h.role!==(i?"assistant":"user")))
      throw Error("unexpected synthetic context");
    if(c.c2Claims.length!==1||
       c.c2Claims[0].source!=="current_user"||
       !c.userText.includes(c.c2Claims[0].evidence))
      throw Error("unanchored C2 claim");
    if(c.authorResolutionQuote && !c.userText.includes(c.authorResolutionQuote))
      throw Error("author gold quote not in input");
    const input=p03InputFromFixture(c);
    const plan=buildSymbolicPlan(input);
    if(plan.eligible!==true||!plan.taskValid||plan.rejectedCount!==0)
      throw Error("fixture fails synthetic research gate");
    const gate=!!plan.modelTicket;
    if(gate!==c.expectedRecheck)
      throw Error("expected S2 ticket mismatch for "+c.id);
    if(gate){
      triggered++;
      if(c.authorExpectedMove==="INFORMATION"){
        if(!c.authorResolutionQuote)throw Error("missing prespecified resolution quote");
        resolved++;
      }else if(c.authorExpectedMove==="CLARIFY"){
        if(c.authorResolutionQuote)throw Error("premature author resolution in unresolved case");
        unresolved++;
      }else throw Error("trigger case has unknown author next move");
      if(plan.move!=="CLARIFY")throw Error("S1 triggered move must stay CLARIFY");
    }else{
      controls++;
      if(plan.move!==c.authorExpectedMove)
        throw Error("control task expected move differs from S1");
    }
    rows.push({id:c.id,triggered:gate,S1Move:plan.move,authorExpectedMove:c.authorExpectedMove});
  }
  if(triggered!==8||controls!==6||resolved!==4||unresolved!==4)
    throw Error("P03 yield insufficient: expected 8 tickets and 4 resolved/4 unresolved");
  return Object.freeze({
    schema:"nesy-p03-free-preflight-v1",
    realP0:false,realZ3:false,syntheticGateOnly:true,
    cases:14,triggered,controls,resolved,unresolved,
    costAuthorized:false,rows
  });
}

/** Uses only locked author labels to assert wiring. Does not validate
 * model semantics, user experience, or independent human preferences. */
export async function p03MockedComparison(cases){
  const preflight=p03OfflinePreflight(cases),rows=[];
  let calls=0;
  for(const c of cases){
    const reply=c.expectedRecheck?
      (c.authorExpectedMove==="INFORMATION"?
        {decision:"PROPOSE_CONTINUE",facet:c.task.type==="PERSON_REQUIRED"?"PERSON":"TIME",
         source:"current_user",evidence:c.authorResolutionQuote,
         reason:"The latest user resolves the explicitly requested facet."}:
        {decision:"KEEP_CLARIFY",facet:c.task.type==="PERSON_REQUIRED"?"PERSON":"TIME",
         source:"none",evidence:"",reason:"This required facet remains unresolved."}):
      null;
    const result=await compareCooperativeArms(p03InputFromFixture(c),{
      recheck:async()=>{
        calls++;
        if(!reply)throw Error("Unexpected model call for negative control");
        return reply;
      }
    });
    if(result.S2.extraModelCalls!==Number(c.expectedRecheck)||
       result.S2.proposedMove!==c.authorExpectedMove||
       result.S1.productionApplied||result.S2.productionApplied||
       result.S1.certified||result.S2.certified)
      throw Error("Synthetic S1/S2 plumbing regression at "+c.id);
    rows.push({id:c.id,S1:result.S1.proposedMove,S2:result.S2.proposedMove,
      calls:result.S2.extraModelCalls,authorTarget:c.authorExpectedMove});
  }
  if(calls!==8)throw Error("P03 mocked model budget mismatch");
  return Object.freeze({
    ...preflight,mockedModelCallbacks:calls,
    mockedMoveDifferences:rows.filter(x=>x.S1!==x.S2).length,
    realLLM:false,independentQualityReview:false
  });
}
