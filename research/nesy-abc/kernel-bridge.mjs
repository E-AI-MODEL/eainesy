/**
 * Research-only bridge from an actual processTurn result to A/B/C.
 * It never mutates the turn, plan, certificate, session, or response.
 * This deliberately is NOT imported by the production orchestrator.
 */
import { selectArchitecture, ARMS } from "./architecture-lab.mjs";

const safeJson=(v)=>{try{return typeof v==="string"?JSON.parse(v):v??null;}catch{return null;}};
const stage=(trace,key)=>Array.isArray(trace)?trace.find(x=>x.stage===key):null;
const STRATEGIES=new Set(["QUESTION","RESTATEMENT","REFLECTION","AFFIRMATION","SUMMARY","SUGGESTION","INFORMATION","REPAIR","SAFETY","BOUNDARY","REFERRAL","CLARIFY"]);
export function fromVerifiedTurn({turnResult,turnRecord,history=[]}){
  if(!turnResult || typeof turnResult!=="object")throw Error("missing processTurn result");
  const certificate=safeJson(turnRecord?.certificate)??turnResult.certificate;
  const trace=safeJson(turnRecord?.trace)??turnResult.trace;
  const frame=safeJson(turnRecord?.frame)??stage(trace,"parse")?.detail;
  const plan=safeJson(turnRecord?.plan)??stage(trace,"plan")?.detail;
  const lexical=stage(trace,"lexical")?.detail;
  const safe=certificate?.z3?.result==="sat" && certificate?.modelCheck?.pass===true && certificate?.outputPolicy?.pass===true;
  // A skip/mock/invalid verification can be inspected but never approved.
  const verification=certificate?.z3?.result??"missing";
  const safety={
    action:certificate?.action??turnResult.action??"UNKNOWN",
    riskAssessment:certificate?.riskLevel??"UNKNOWN",
    verification,
    modelCheckPass:certificate?.modelCheck?.pass===true,
    outputPolicyAllowed:certificate?.outputPolicy?.pass===true,
    riskMemory:certificate?.conversation?.riskMemory??"UNKNOWN",
  };
  const input={
    userText:turnRecord?.userText??"",
    history:Array.isArray(history)?history:[],
    frame:frame && typeof frame==="object" && !frame.error ?frame:{intent:"UNKNOWN",paraphrase:"",riskMarkers:[]},
    lexicalMarkers:Array.isArray(lexical?.lexicalMarkers)?lexical.lexicalMarkers:[],
    base:{move:STRATEGIES.has(plan?.strategy)?plan.strategy:
      STRATEGIES.has(certificate?.conversation?.strategy)?certificate.conversation.strategy:"CLARIFY"},
    safety,
  };
  return {source:"processTurn", verified:safe, input, certificate, plan, trace};
}
export async function compareVerifiedTurn(snapshot,options={}){
  const bridged=fromVerifiedTurn(snapshot);
  const arms={};
  for(const arm of ARMS)arms[arm]=await selectArchitecture(bridged.input,arm,options);
  const sameSafety=ARMS.every(arm=>JSON.stringify(arms[arm].safetyUnchanged)===JSON.stringify(bridged.input.safety));
  if(!sameSafety)throw Error("research proposal modified core safety evidence");
  return {
    source:"NeSy processTurn snapshot",verified:bridged.verified,
    mode:"research-read-only", arms,
    baselineAction:bridged.input.safety.action,
    baselineMove:bridged.input.base.move,
    note:"Proposed moves were NOT applied to the actual response or stored conversation.",
  };
}
