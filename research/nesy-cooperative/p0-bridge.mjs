/**
 * Optional research-only read bridge from an actual NeSy processTurn snapshot.
 *
 * No import by the live orchestrator or API route. This bridge cannot rerun,
 * replan, persist or modify P0; it merely points the parallel S1/S2 observers
 * at the very same existing P0 evidence extracted by the A/B/C research bridge.
 */
import {fromVerifiedTurn} from "../nesy-abc/kernel-bridge.mjs";
import {compareCooperativeArms} from "./coordinator.mjs";

const copy=x=>JSON.parse(JSON.stringify(x));
function makeInput(snapshot,{task,c2Claims=[]}={}){
  if(!snapshot?.turnRecord || typeof snapshot.turnRecord.userText!=="string" ||
     !snapshot.turnRecord.userText.trim())
    throw Error("concrete persisted P0 turn record required");
  const source=fromVerifiedTurn(snapshot);
  if(!Array.isArray(source.input.frame?.riskMarkers) ||
     !Array.isArray(source.input.lexicalMarkers))
    throw Error("P0 frame and lexical evidence unavailable");
  if(!task||typeof task!=="object" || !Array.isArray(c2Claims))
    throw Error("explicit research task/claims required");
  return {
    input:{
      userText:source.input.userText,
      history:copy(source.input.history),
      frame:copy(source.input.frame),
      lexicalMarkers:copy(source.input.lexicalMarkers),
      base:copy(source.input.base),
      safety:copy(source.input.safety),
      task:copy(task),
      c2Claims:copy(c2Claims)
    },
    // This flag comes from the EXISTING certificate fields. This bridge
    // never independently executes Z3 or verifies a signed proof.
    P0CertificateFieldsClaimSat:source.verified===true,
    P0Action:source.input.safety.action,
    sourceVerification:source.input.safety.verification
  };
}
export function fromP0TurnEvidence(snapshot,options={}){
  const result=makeInput(snapshot,options);
  return Object.freeze({
    source:"persisted_processTurn_read_only",
    P0CertificateFieldsClaimSat:result.P0CertificateFieldsClaimSat,
    verifiedIndependentlyByThisBridge:false,
    sourceVerification:result.sourceVerification,
    P0Action:result.P0Action,
    input:result.input
  });
}
export async function compareCooperativeFromP0(snapshot,options={}){
  const sourceBefore=JSON.stringify(snapshot);
  const {recheck,task,c2Claims=[]}=options;
  const sourced=fromP0TurnEvidence(snapshot,{task,c2Claims});
  const originalMove=sourced.input.base.move;
  const result=await compareCooperativeArms(sourced.input,{recheck});
  if(JSON.stringify(snapshot)!==sourceBefore)
    throw Error("read-only S1/S2 comparison mutated original P0 snapshot");
  if(result.baselineP0Move!==originalMove)
    throw Error("baseline P0 strategy changed during research comparison");
  return Object.freeze({
    source:"persisted_processTurn_read_only",
    P0Action:sourced.P0Action,P0Move:originalMove,
    P0CertificateFieldsClaimSat:sourced.P0CertificateFieldsClaimSat,
    verifiedIndependentlyByThisBridge:false,
    comparison:result,
    persistedChangesByCooperativeArm:false,
    productionReplyChanged:false
  });
}
