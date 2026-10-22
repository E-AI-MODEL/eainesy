import { normalizeDialogueObservation } from "./dialogue-observation.mjs";
/**
 * NeSy A/B/C experimental, offline-only decision architecture laboratory.
 *
 * NOT connected to processTurn, not a clinical classifier or live provider.
 * Production policy may never be weakened. All proposed dialogue moves
 * must still pass through production's controller, Z3 and outputpolicy.
 *
 * P0: existing plan projection supplied by harness (unchanged).
 * A: shared evidence workspace + deterministic semantic dialogue mixer.
 * B: P0 + explicit supervisor callback (must be injected; never network).
 * C: A + conditional metacognitive arbitration (callback injected, bounded).
 */
export const PROTOCOL_ID = "EAINESY-ABC-2026-10-23-P01";
export const ARMS = Object.freeze(["P0", "A", "B", "C"]);
export const VALID_MOVES = Object.freeze(["QUESTION", "RESTATEMENT", "REFLECTION", "AFFIRMATION", "SUMMARY", "SUGGESTION", "INFORMATION", "REPAIR", "SAFETY", "BOUNDARY", "REFERRAL", "CLARIFY"]);
export const SAFETY_ACTIONS = Object.freeze(["CRISIS_PROTOCOL", "SAFETY_RESPONSE", "ABSTAIN_HITL", "BOUNDARY_REFUSAL", "REFERRAL"]);
const HIGH_RISK = new Set(["UNKNOWN", "ELEVATED", "HIGH", "CRISIS"]);
const has = (x) => typeof x === "string" && x.trim().length > 0;
const text = (x) => has(x) ? x : "";
const list = (x) => Array.isArray(x) ? x : [];
const clone = (x) => JSON.parse(JSON.stringify(x));

function unique(values) { return [...new Set(values)]; }
function safetyLocked(input) {
  return HIGH_RISK.has(input.safety.riskAssessment) ||
    SAFETY_ACTIONS.includes(input.safety.action) ||
    input.safety.verification !== "sat" ||
    input.safety.modelCheckPass !== true ||
    input.safety.outputPolicyAllowed !== true ||
    input.safety.riskMemory === "ACTIVE";
}
function validate(input) {
  if (!input || typeof input !== "object") throw new Error("missing input");
  if (!input.safety || typeof input.safety !== "object") throw new Error("missing safety snapshot");
  if (!has(input.safety.action) || !has(input.safety.riskAssessment)) throw new Error("missing safety fields");
  if (!input.base || !has(input.base.move)) throw new Error("missing P0 move");
  if (!VALID_MOVES.includes(input.base.move)) throw new Error("invalid P0 move");
  if (!input.frame || typeof input.frame !== "object") throw new Error("missing frame");
  if (!["NONE","ELEVATED","HIGH","CRISIS","UNKNOWN"].includes(input.safety.riskAssessment)) throw new Error("invalid risk assessment");
  // An invalid checker/verification state may only produce a blocked proposal.
  if (typeof input.safety.modelCheckPass !== "boolean") throw new Error("missing model-check status");
}

/** Model claims are *claims*, never verified semantics or permission to downgrade. */
export function evidenceWorkspace(input) {
  validate(input);
  const frame = input.frame;
  const rawMarkers = list(input.lexicalMarkers);
  const modelMarkers = list(frame.riskMarkers);
  const evidence = [
    ...rawMarkers.map((m, index) => ({origin:"lex",index,type:text(m.type),source:text(m.evidence),scope: null,status:"unverified"})),
    ...modelMarkers.map((m, index) => ({origin:"llm",index,type:text(m.type),source:text(m.evidence),
      scope:m.scope && typeof m.scope === "object" ? clone(m.scope) : null,status:"model_claim"}))
  ];
  const lexTypes=new Set(rawMarkers.map(x=>x.type)),llmTypes=new Set(modelMarkers.map(x=>x.type));
  const conflictingMarkers=unique([...lexTypes].filter(t=>!llmTypes.has(t)).concat([...llmTypes].filter(t=>!lexTypes.has(t))));
  const raw = text(input.userText), past = list(input.history).filter(x=>x?.role==="user").map(x=>text(x.content));
  for (const item of evidence) {
    item.provenance = item.source && raw.includes(item.source) ? "latest_exact" :
      item.source && past.some(t=>t.includes(item.source)) ? "prior_exact" : "unanchored";
  }
  const observed = normalizeDialogueObservation(input.dialogueObservation,raw);
  const acts = new Set(observed.anchored.map(x=>x.type));
  const explicitCorrections = /\b(nee|niet wat ik bedoel|dat klopt niet|je begrijpt|ik bedoel|no[,]?\s+i|that's not|you misunderstood|not what i)\b/i.test(raw);
  const currentNeed = text(frame.paraphrase);
  const mismatchedScope = evidence.some(e=>e.scope && (e.scope.experiencer==="other" || e.scope.experiencer==="quoted" || e.scope.temporality==="past_resolved" || e.scope.polarity==="negated"));
  const questionableEvidence = evidence.some(e=>e.provenance==="unanchored");
  const breakdown = list(input.history).length>0 && explicitCorrections;
  const reopened = /\b(toch nog|nog een ding|one more thing|actually one more)\b/i.test(raw);
  const requestDirect = /\b(zonder.*vragen|geen vragen|no questions|just give me|kun je.*(uitleggen|voorbeeld|zin)|could you give me)\b/i.test(raw);
  const noAdvice = /\b(geen tips|geen stappenplan|alleen.*(vertellen|kwijt)|no advice|just listen)\b/i.test(raw);
  const termination = /\b(ik wil stoppen|laat maar|genoeg voor vandaag|we kunnen stoppen|that's enough|i want to stop)\b/i.test(raw);
  const reasons=unique([
    ...((conflictingMarkers.length>0)?["T1"]:[]),
    ...(acts.has("CORRECT_ASSUMPTION")?["T2"]:[]),
    ...(acts.has("UNCERTAIN_ATTRIBUTION")?["T3"]:[]),
    ...((acts.has("REOPEN_CONVERSATION"))?["T4"]:[]),
    ...(breakdown?["T2"]:[]),
    ...((mismatchedScope||questionableEvidence)?["T3"]:[]),
    ...((reopened)?["T4"]:[])
  ]);
  return Object.freeze({
    protocol:PROTOCOL_ID,
    evidence,
    dialogueObservation: observed,
    bindingPlan:input.bindingPlan && typeof input.bindingPlan==='object' ? clone(input.bindingPlan) : null,
    grounding:input.grounding && typeof input.grounding==='object' ? clone(input.grounding) : null,
    conflictingMarkers,
    flags:{explicitCorrections,breakdown,reopened,requestDirect,noAdvice,termination,mismatchedScope,questionableEvidence},
    triggerCodes:reasons,
    userText:raw,
    history:list(input.history).filter(x=>x && (x.role==="user"||x.role==="assistant") && typeof x.content==="string").slice(-6).map(x=>({role:x.role,content:x.content})),
    paraphrase:currentNeed,
    baseMove:input.base.move,
    safety:clone(input.safety)
  });
}

function proposeMixer(workspace) {
  const f=workspace.flags;
  let move=workspace.baseMove,reason="retain P0 proposal";
  const acts=new Set(workspace.dialogueObservation.anchored.map(x=>x.type));
  if(acts.has("CORRECT_ASSUMPTION")){move="REPAIR";reason="explicit grounded semantic correction claim";}
  else if(acts.has("DECLINE_ADVICE")){move="REFLECTION";reason="grounded preference to avoid advice";}
  else if(acts.has("END_CONVERSATION")){move="AFFIRMATION";reason="grounded request to close";}
  else if(acts.has("REQUEST_ANSWER")){move="INFORMATION";reason="grounded request for direct answer";}
  else if(acts.has("REOPEN_CONVERSATION")){move="QUESTION";reason="grounded reopening";}
  else if(f.explicitCorrections && f.breakdown){move="REPAIR";reason="explicit correction: repair before technique";}
  else if(f.noAdvice){move="REFLECTION";reason="explicit preference not to receive advice";}
  else if(f.termination){move="AFFIRMATION";reason="respect stated closure";}
  else if(f.requestDirect){move="INFORMATION";reason="respond directly to explicit request";}
  else if(f.reopened){move="QUESTION";reason="acknowledge reopened subject";}
  else if(f.mismatchedScope||f.questionableEvidence){move="CLARIFY";reason="scope/source uncertain; ask rather than invent attribution";}
  return {move,reason};
}
function guard(input,workspace,proposal) {
  if(safetyLocked(input)) return {move:input.base.move,allowed:false,reason:"binding safety or verification boundary"};
  if(!VALID_MOVES.includes(proposal.move)) return {move:input.base.move,allowed:false,reason:"invalid suggested move"};
  if(workspace.flags.noAdvice && proposal.move==="SUGGESTION") return {move:input.base.move,allowed:false,reason:"incompatible with explicit user preference"};
  // This is only a research recommendation: any future production action
  // must still pass the existing controller, Z3 and output policy independently.
  return {move:proposal.move,allowed:true,reason:proposal.reason ?? "candidate move"};
}
function normalizeSupervisorReply(value) {
  if(!value || typeof value!=="object") return {kind:"keep",reason:"no supervisor result"};
  if(value.kind==="veto")return {kind:"veto",reason:text(value.reason),status:text(value.status),issue:text(value.issue)};
  if(value.kind==="revise" && VALID_MOVES.includes(value.move)){
    const candidateDraft = typeof value.candidateDraft==="string" && value.candidateDraft.length<=1400
      ? value.candidateDraft : null;
    return {kind:"revise",move:value.move,reason:text(value.reason),
      status:text(value.status),issue:text(value.issue),candidateDraft,
      candidateRequiresOutputPolicy:value.candidateRequiresOutputPolicy===true};
  }
  return {kind:"keep",reason:text(value.reason)||"unchanged",status:text(value.status),issue:text(value.issue),rejection:text(value.rejection)};
}

/** Async callbacks are dependency-injected; this module never contacts a model. */
export async function selectArchitecture(input,arm,options={}) {
  if(!ARMS.includes(arm))throw new Error("unsupported arm");
  const workspace=evidenceWorkspace(input);
  const locked=safetyLocked(input);
  let proposal={move:input.base.move,reason:"P0 unchanged"},triggered=false,extraCalls=0,supervisorOutcome=null;
  if(arm==="A"||arm==="C") proposal=proposeMixer(workspace);
  if(arm==="B" && !locked && typeof options.supervisor==="function" && has(input.draft)){
    triggered=true;extraCalls=1;
    try {
      supervisorOutcome=normalizeSupervisorReply(await options.supervisor({
        input:clone(input),workspace:clone(workspace),proposal:clone(proposal),callBudget:1,phase:"post-concept"
      }));
      if(supervisorOutcome.kind==="revise") proposal={move:supervisorOutcome.move,reason:"B supervisor: "+supervisorOutcome.reason};
      if(supervisorOutcome.kind==="veto") proposal={move:"CLARIFY",reason:"B supervisor veto: "+supervisorOutcome.reason};
    }catch(error){supervisorOutcome={kind:"error",reason:"supervisor failed; retain P0"};}
  }
  if(arm==="C" && !locked && workspace.triggerCodes.length>0 && typeof options.orchestrator==="function"){
    triggered=true;extraCalls=1;
    try {
      supervisorOutcome=normalizeSupervisorReply(await options.orchestrator({
        workspace:clone(workspace),proposal:clone(proposal),callBudget:1,phase:"pre-answer"
      }));
      if(supervisorOutcome.kind==="revise")proposal={move:supervisorOutcome.move,reason:"C orchestrator: "+supervisorOutcome.reason};
      if(supervisorOutcome.kind==="veto")proposal={move:"CLARIFY",reason:"C orchestrator veto: "+supervisorOutcome.reason};
    }catch(error){supervisorOutcome={kind:"error",reason:"orchestrator failed; retain deterministic A proposal"};}
  }
  const decision=guard(input,workspace,proposal);
  return Object.freeze({
    protocol:PROTOCOL_ID,arm,baseMove:input.base.move,
    proposedMove:proposal.move,selectedMove:decision.move,
    accepted:decision.allowed,reason:decision.reason,
    triggers:arm==="C"?workspace.triggerCodes:[],
    triggered,extraCalls,
    supervisorOutcome,
    // B's in-call replacement remains a proposal ONLY; never silently send
    // this text without independent output policy and fresh safety checks.
    candidateDraft:arm==="B" && decision.allowed ? (supervisorOutcome?.candidateDraft ?? null) : null,
    candidateDraftCertified:false,
    safetyUnchanged:clone(input.safety),
    researchOnly:true
  });
}
