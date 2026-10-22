/**
 * Research-only semantic dialogue contract.
 *
 * This module does NOT infer intentions from words and does NOT contact a
 * model. It validates observations provided by an upstream parser. Any
 * quoted evidence must occur in the current user message, otherwise the
 * claim is not eligible for dialogue steering. Safety decisions always stay
 * with the unchanged production controller + output/Z3 gates.
 *
 * A future GLM/OpenAI/Ollama parser adapter may populate these observations
 * automatically. Missing/invalid data is made explicit, not fabricated.
 */
export const DIALOGUE_ACTS = Object.freeze([
  "CORRECT_ASSUMPTION", "DECLINE_ADVICE", "REQUEST_ANSWER",
  "END_CONVERSATION", "REOPEN_CONVERSATION", "UNCERTAIN_ATTRIBUTION",
]);
const known = new Set(DIALOGUE_ACTS);
const nonempty = (v) => typeof v === "string" && v.trim().length > 0;

export function normalizeDialogueObservation(value, userText) {
  if (value == null) {
    return {provided:false, valid:true, anchored:[], rejected:[], source:null};
  }
  // Refuse open-ended instructions disguised as a structured observation.
  if (!value || typeof value !== "object" || Array.isArray(value)
      || value.version !== 1 || value.origin !== "model_claim"
      || !Array.isArray(value.acts) || value.acts.length > 8) {
    return {provided:true, valid:false, anchored:[], rejected:[{reason:"invalid_envelope"}], source:"model_claim"};
  }
  const anchored=[],rejected=[];
  for (let i=0;i<value.acts.length;i++) {
    const act=value.acts[i];
    const type=act?.type;
    const excerpt=act?.evidence;
    if(!known.has(type)) { rejected.push({index:i,reason:"unknown_type"}); continue; }
    if(!nonempty(excerpt) || excerpt.length>200) {
      rejected.push({index:i,reason:"missing_or_long_evidence"}); continue;
    }
    if(!userText.includes(excerpt)) {
      rejected.push({index:i,reason:"unanchored_evidence"}); continue;
    }
    const proposed={type,evidence:excerpt,source:"current_user_utterance",authority:"model_claim"};
    if(anchored.every(x=>x.type!==type))anchored.push(proposed);
  }
  return {provided:true,valid:true,anchored,rejected,source:"model_claim"};
}

export function deriveDialogueObservation(frame, userText) {
  // Only explicit FrameSchema dialogueObservation is eligible.
  // Never infer a correction, goal or source excerpt from paraphrase,
  // confidence, asksForHelp, or the research author's expectations.
  const claim = frame?.dialogueObservation == null ? null
    : normalizeDialogueObservation(frame.dialogueObservation, userText);
  return {observation:claim,readableFrame:{
    intent:typeof frame?.intent==="string"?frame.intent:"UNKNOWN",
    asksForHelp:frame?.asksForHelp===true,
    parseConfidence:typeof frame?.parseConfidence==="number"?frame.parseConfidence:null,
    paraphrase:typeof frame?.paraphrase==="string"?frame.paraphrase:""
  }};
}
