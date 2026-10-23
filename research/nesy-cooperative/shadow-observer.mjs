/**
 * NeSy P03: OBSERVATION-ONLY counterfactual adapter for a low-risk P0 CLARIFY.
 * This does NOT relax S1/S2 production eligibility; the actual P0 action,
 * controller, Z3 and verified response stay untouched. Its surrogate action
 * only permits the existing RESEARCH-ONLY S1/S2 algorithm to compute a
 * hypothesis under an explicitly marked fictional authorization state.
 *
 * NEVER import into a production processTurn or response path.
 */
import {compareCooperativeArms} from "./coordinator.mjs";
const LOW_RISK_OBSERVATION_ACTIONS=new Set([
  "CLARIFY","PSYCHOEDUCATION","THERAPEUTIC_DIALOG"
]);
function safeObservation(input){
 const s=input?.safety;
 return !!s&&LOW_RISK_OBSERVATION_ACTIONS.has(s.action)&&
   s.riskAssessment==="NONE"&&s.riskMemory==="NONE"&&
   s.verification==="sat"&&s.modelCheckPass===true&&
   s.outputPolicyAllowed===true&&
   Array.isArray(input?.frame?.riskMarkers)&&
   input.frame.riskMarkers.length===0&&
   Array.isArray(input?.lexicalMarkers)&&
   input.lexicalMarkers.length===0;
}
export function shadowEligibility(input){
 const eligible=safeObservation(input);
 return Object.freeze({
   observationAllowed:eligible,
   productionAllowedByThisAdapter:false,
   originalP0Action:input?.safety?.action??null,
   originalZ3:input?.safety?.verification??null,
   reason:eligible?"LOW_RISK_SHADOW_ONLY":"PRODUCTION_BOUNDARY_DO_NOT_EXAMINE",
   safetyChanged:false,
   decisionsChanged:false
 });
}
export async function compareShadowCooperativeArms(input,{recheck}={}){
 if(!input||typeof input!=="object"||!input.base||typeof input.base.move!=="string")
   throw Error("real P0 research snapshot required");
 const before=JSON.stringify(input);
 const e=shadowEligibility(input);
 if(!e.observationAllowed){
   return Object.freeze({
     ...e,source:"P0_read_only",researchCounterfactual:false,
     S1:Object.freeze({proposedMove:input.base.move,extraModelCalls:0,productionApplied:false}),
     S2:Object.freeze({proposedMove:input.base.move,extraModelCalls:0,productionApplied:false}),
     actualP0Move:input.base.move,untouched:true,reason:"RESEARCH_NOT_AUTHORIZED"
   });
 }
 // A visibly counterfactual COPY. Never copied back into the original.
 // The existing S1/S2 safeSnapshot gate remains exactly as written.
 const copy=JSON.parse(before);
 const syntheticOriginalAction=copy.safety.action;
 copy.safety.action="THERAPEUTIC_DIALOG";
 const comparison=await compareCooperativeArms(copy,{recheck});
 if(JSON.stringify(input)!==before)throw Error("shadow observation mutated original P0");
 if(comparison.baselineP0Move!==input.base.move)throw Error("P0 move altered");
 if(!comparison.S1.researchOnly && comparison.S1.productionApplied!==false)
   throw Error("untrusted S1 proposal claimed authorization");
 if(comparison.S2.productionApplied!==false||comparison.S2.certified!==false)
   throw Error("untrusted S2 proposal claimed authorization");
 return Object.freeze({
   ...e,source:"P0_read_only",
   researchCounterfactual:true,
   syntheticGateAction:"THERAPEUTIC_DIALOG",
   originalGateAction:syntheticOriginalAction,
   counterfactualGateIsNotRealAuthorization:true,
   S1:comparison.S1,S2:comparison.S2,
   actualP0Move:input.base.move,
   untouched:true,reason:"COUNTERFACTUAL_READ_ONLY_NOT_EXECUTABLE"
 });
}
