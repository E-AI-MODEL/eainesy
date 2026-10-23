/**
 * NeSy S1/S2 research-only cooperative coordination.
 *
 * S1: symbolic relevance and dependency checks, zero model calls.
 * S2: same S1 input and plan -> at most ONE injected neural recheck ->
 *     symbolic provenance/shape validation of the neural reply.
 *
 * These are UNTRUSTED proposals only. This module is not imported by
 * processTurn, the API, the safety controller, or the certificate code.
 * Checking a quotation does NOT verify its meaning.
 */
import {observeC2} from "../nesy-abc/c2-uncertainty.mjs";

export const COOP_PROTOCOL = "EAINESY-COOP-S1S2-2026-10-23-DEV-01";
export const COOP_ARMS = Object.freeze(["S1","S2"]);
const TASK_TYPES = new Set([
  "NONE","DIRECT_ANSWER","LISTEN","CLOSE","CORRECT",
  "PERSON_REQUIRED","TIME_REQUIRED"
]);
const MOVES = new Set([
  "QUESTION","RESTATEMENT","REFLECTION","AFFIRMATION","SUMMARY",
  "SUGGESTION","INFORMATION","REPAIR","SAFETY","BOUNDARY",
  "REFERRAL","CLARIFY"
]);
const kindsForTask = Object.freeze({
  PERSON_REQUIRED:["PERSON","ALTERNATIVE","CONTRADICTION"],
  TIME_REQUIRED:["TIME","CONTRADICTION","ALTERNATIVE"]
});
const priorityMove = Object.freeze({
  DIRECT_ANSWER:"INFORMATION",LISTEN:"REFLECTION",CLOSE:"AFFIRMATION",
  CORRECT:"REPAIR"
});
const copy = x => JSON.parse(JSON.stringify(x));
const short = (x,max=240)=>typeof x==="string"&&x.trim().length>0&&x.length<=max;
const noAuthority = Object.freeze({productionApplied:false,certified:false,
  weight:0,semanticValidityConfirmed:false,productionSafetyChanged:false});
function freezeDeep(value){
  if(value && typeof value==="object"&&!Object.isFrozen(value)){
    for(const item of Object.values(value))freezeDeep(item);
    Object.freeze(value);
  }
  return value;
}
function safeSnapshot(safety,frame,lexical){
  return !!safety && safety.action==="THERAPEUTIC_DIALOG" &&
    safety.riskAssessment==="NONE" && safety.riskMemory==="NONE" &&
    safety.verification==="sat" && safety.modelCheckPass===true &&
    safety.outputPolicyAllowed===true &&
    Array.isArray(frame?.riskMarkers) && frame.riskMarkers.length===0 &&
    Array.isArray(lexical) && lexical.length===0;
}
function getTask(input){
  const task=input.task;
  if(!task || typeof task!=="object"||Array.isArray(task)||
     !TASK_TYPES.has(task.type))return {valid:false,reason:"invalid_task"};
  if(!["synthetic_annotation","model_claim"].includes(task.source))
    return {valid:false,reason:"invalid_task_source"};
  if(task.type==="NONE")
    return task.evidence==null || task.evidence==="" ?
      {valid:true,type:"NONE",evidence:"",source:task.source} :
      {valid:false,reason:"none_task_cannot_claim_evidence"};
  if(!short(task.evidence,200) || !input.userText.includes(task.evidence))
    return {valid:false,reason:"unanchored_task_evidence"};
  return {valid:true,type:task.type,evidence:task.evidence,source:task.source};
}
function validate(input){
  if(!input||typeof input!=="object"||Array.isArray(input)||
    !short(input.userText,6000))throw Error("bounded current message required");
  if(!Array.isArray(input.history)||input.history.length>6||
    input.history.some(t=>!["user","assistant"].includes(t?.role)||
      typeof t.content!=="string"||t.content.length>1500))
    throw Error("bounded user/assistant history required");
  if(!input.base||!MOVES.has(input.base.move))throw Error("P0 move required");
  if(!input.safety||typeof input.safety!=="object")
    throw Error("explicit immutable safety snapshot required");
  if(!input.frame||typeof input.frame!=="object"||
    !Array.isArray(input.frame.riskMarkers)||
    !Array.isArray(input.lexicalMarkers))
    throw Error("explicit marker arrays required");
  if(!Array.isArray(input.c2Claims)||input.c2Claims.length>12)
    throw Error("bounded C2 claims array required");
  return true;
}
function baseline(input){return {
  move:input.base.move,caseReason:"RETAIN_P0",status:"NONE",
  modelTicket:null,materialGap:false
};}

export function buildSymbolicPlan(input){
  validate(input);
  // Both arms consume precisely the same original evidence.
  const evidence=observeC2({
    userText:input.userText,history:input.history,claims:input.c2Claims
  });
  const anchored=evidence.candidates;
  const task=getTask(input);
  const policyAllowed=safeSnapshot(input.safety,input.frame,input.lexicalMarkers);
  const initial=baseline(input);
  if(!policyAllowed)return freezeDeep({
    ...initial,caseReason:"LOCKED_BY_SAFETY_OR_UNVERIFIED_CHECK",
    eligible:false,anchoredCount:anchored.length,rejectedCount:evidence.rejected.length,
    taskValid:task.valid,taskSource:task.source??null,
    selectedClaimIds:[],uncertaintyUnverified:true
  });
  if(!task.valid)return freezeDeep({
    ...initial,caseReason:task.reason,eligible:false,
    anchoredCount:anchored.length,rejectedCount:evidence.rejected.length,
    taskValid:false,taskSource:null,selectedClaimIds:[],uncertaintyUnverified:true
  });
  if(anchored.length===0)return freezeDeep({
    ...initial,caseReason:evidence.rejected.length>0?"ONLY_REJECTED_C2_CLAIMS":"NO_C2_CLAIMS",
    eligible:true,anchoredCount:0,rejectedCount:evidence.rejected.length,
    taskValid:true,taskSource:task.source,selectedClaimIds:[],uncertaintyUnverified:true
  });
  // Explicit task priorities stop the system inventing a missing detail.
  // These task labels remain upstream claims; their source quotes alone
  // do not establish that their meaning is correct.
  if(Object.hasOwn(priorityMove,task.type)){
    return freezeDeep({
      ...initial,move:priorityMove[task.type],caseReason:"EXPLICIT_TASK_PRIORITY_NO_RECHECK",
      status:"FOLLOW_EXPLICIT_REQUEST",eligible:true,
      anchoredCount:anchored.length,rejectedCount:evidence.rejected.length,
      taskValid:true,taskSource:task.source,selectedClaimIds:[],uncertaintyUnverified:true
    });
  }
  const desiredKinds=kindsForTask[task.type]||[];
  const matching=anchored.map((claim,index)=>({claim,index})).filter(
    x=>desiredKinds.includes(x.claim.kind)).slice(0,2);
  if(matching.length===0 || !short(task.evidence,200)){
    return freezeDeep({
      ...initial,caseReason:"NO_ACTION_BLOCKING_DEPENDENCY",
      status:"NOTE_ONLY",eligible:true,
      anchoredCount:anchored.length,rejectedCount:evidence.rejected.length,
      taskValid:true,taskSource:task.source,selectedClaimIds:[],uncertaintyUnverified:true
    });
  }
  const facet=task.type==="PERSON_REQUIRED"?"PERSON":"TIME";
  const ticket={
    version:1,facet,question:"Is the missing "+facet+" actually required for the stated next task?",
    taskEvidence:task.evidence,userText:input.userText,
    history:copy(input.history),
    uncertainClaims:matching.map(x=>({kind:x.claim.kind,source:x.claim.source,
      evidence:x.claim.evidence,hypothesis:x.claim.hypothesis,
      authority:"unverified_model_claim"})),
    noNewUserFacingText:true,maxModelCalls:1
  };
  return freezeDeep({
    ...initial,move:"CLARIFY",caseReason:"TASK_REQUIRES_UNRESOLVED_FACET",
    status:"MATERIAL_UNCERTAINTY_HYPOTHESIS",eligible:true,materialGap:true,
    modelTicket:ticket,anchoredCount:anchored.length,rejectedCount:evidence.rejected.length,
    taskValid:true,taskSource:task.source,selectedClaimIds:matching.map(x=>x.index),
    uncertaintyUnverified:true
  });
}

const RECHECK_DECISIONS=new Set(["KEEP_CLARIFY","PROPOSE_CONTINUE","ABSTAIN"]);
export function validateNeuralRecheck(value,ticket){
  const fail=reason=>({valid:false,reason,decision:"ABSTAIN",move:"CLARIFY"});
  if(!ticket||ticket.version!==1||!["PERSON","TIME"].includes(ticket.facet))
    return fail("missing_symbolic_ticket");
  if(!value||typeof value!=="object"||Array.isArray(value)||
     !RECHECK_DECISIONS.has(value.decision) || value.facet!==ticket.facet ||
     !short(value.reason,280))return fail("invalid_neural_recheck_shape");
  if(value.decision==="ABSTAIN")return {
    valid:true,decision:"ABSTAIN",reason:"neural_abstained",move:"CLARIFY"};
  if(value.decision==="KEEP_CLARIFY")return {
    valid:true,decision:"KEEP_CLARIFY",reason:"neural_confirms_gap_unverified",
    move:"CLARIFY"};
  // Exact-source anchoring is an evidence pointer only, not semantic truth.
  // Proposing to continue is strictly a NON-AUTHORITATIVE research move.
  if(value.source!=="current_user"||!short(value.evidence,200)||
     !ticket.userText.includes(value.evidence))
    return fail("no_latest_source_for_claimed_resolution");
  return {valid:true,decision:"PROPOSE_CONTINUE",
    reason:"source_anchored_resolution_claim_unverified",
    evidence:value.evidence,move:"INFORMATION"};
}

function result(arm,input,plan,{called=false,validation=null}={}){
  const initial=plan.move;
  let proposed=initial;
  if(arm==="S2"&&validation?.valid===true&&
     validation.decision==="PROPOSE_CONTINUE")
    proposed=validation.move;
  return freezeDeep({
    protocol:COOP_PROTOCOL,arm,
    P0Move:input.base.move,S1Move:initial,
    proposedMove:proposed,reasonCode:plan.caseReason,
    taskSource:plan.taskSource??null,taskValid:plan.taskValid,
    eligible:plan.eligible,materialGapHypothesis:plan.materialGap,
    trigger:plan.modelTicket?"SYMBOLIC_MATERIAL_GAP":null,
    neuralCalled:called,extraModelCalls:called?1:0,
    neuralValidation:validation?copy(validation):null,
    quotedC2Candidates:plan.anchoredCount,rejectedC2Candidates:plan.rejectedCount,
    // Not a production decision. Semantic correctness and necessity remain untested.
    ...noAuthority
  });
}

/** S1 = symbolic only; S2 = strictly one optional injected model recheck. */
export async function selectCooperativeArm(input,arm,{recheck}={}){
  if(!COOP_ARMS.includes(arm))throw Error("unknown cooperative arm");
  const plan=buildSymbolicPlan(input);
  if(arm==="S1"||!plan.modelTicket||typeof recheck!=="function")
    return result(arm,input,plan);
  let validation=null;
  try{
    // No safety snapshot, API key, writable state or user response passed.
    const ticket=freezeDeep(copy(plan.modelTicket));
    const value=await recheck(ticket);
    validation=validateNeuralRecheck(value,ticket);
  }catch{
    validation={valid:false,decision:"ABSTAIN",move:"CLARIFY",
      reason:"neural_callback_failed_no_retry"};
  }
  return result(arm,input,plan,{called:true,validation});
}

/** Both variants receive the same immutable P0/C2 evidence. */
export async function compareCooperativeArms(input,options={}){
  validate(input);
  const before=JSON.stringify(input);
  const s1=await selectCooperativeArm(input,"S1");
  const s2=await selectCooperativeArm(input,"S2",options);
  if(JSON.stringify(input)!==before)throw Error("cooperative arm mutated baseline evidence");
  if(s1.P0Move!==s2.P0Move || s1.S1Move!==s2.S1Move)
    throw Error("S1/S2 have unequal starting proposals");
  return freezeDeep({
    protocol:COOP_PROTOCOL,mode:"read_only_synthetic_research",
    baselineP0Move:input.base.move,
    S1:s1,S2:s2,caseContentChanged:false,storedStateChanged:false,
    verificationClaim:"NONE",independentQualityReview:"NOT_PERFORMED"
  });
}
