/**
 * P02 research-scope preflight. This is NOT an alternate permission gate.
 * It only decides whether continuing a PAID trial has scientific value;
 * it cannot authorize any S1/S2 work or change a P0 decision.
 */
export const P02_SCOPE_PREFLIGHT_CASES=3;

export function describeP02Eligibility({p0Technical,p0Action,
  riskNone,s1GateEligible}={}){
  if(p0Technical!==true)return Object.freeze({
    eligible:false,reason:"P0_NOT_VERIFIED",p0Action:p0Action||null
  });
  if(riskNone!==true)return Object.freeze({
    eligible:false,reason:"RISK_OR_MEMORY_NOT_CLEAR",p0Action:p0Action||null
  });
  if(p0Action!=="THERAPEUTIC_DIALOG")return Object.freeze({
    eligible:false,reason:"P0_ACTION_OUTSIDE_S1S2_SCOPE",
    p0Action:p0Action||null
  });
  if(s1GateEligible!==true)return Object.freeze({
    eligible:false,reason:"S1_GATE_NOT_SATISFIED",p0Action
  });
  return Object.freeze({
    eligible:true,reason:"ELIGIBLE_FOR_RESEARCH_PROPOSALS_ONLY",p0Action
  });
}

/** Do not spend on cases 4-10 if ALL first three technical P0 turns
 * are out of the permitted research route. Prespecified economic futility
 * check, not proof about the other seven cases or model capabilities. */
export function decideP02Preflight(rows){
  if(!Array.isArray(rows))throw Error("P02 preflight rows required");
  if(rows.length<P02_SCOPE_PREFLIGHT_CASES)return Object.freeze({
    stop:false,reason:"AWAIT_FIRST_THREE_CASES",checked:rows.length
  });
  const early=rows.slice(0,P02_SCOPE_PREFLIGHT_CASES);
  const everyValidP0=early.every(r=>r?.P0?.technical===true&&r.P0.realZ3===true);
  const allBlocked=early.every(r=>r?.eligibility?.eligible===false);
  if(everyValidP0&&allBlocked)return Object.freeze({
    stop:true,reason:"ZERO_ELIGIBLE_FIRST_THREE_P02_FUTILITY",
    checked:P02_SCOPE_PREFLIGHT_CASES,
    eligibilityReasons:early.map(r=>r.eligibility.reason),
    claim:"NOT_AN_ESTIMATE_FOR_REMAINING_SEVEN_CASES"
  });
  return Object.freeze({
    stop:false,reason:everyValidP0?"CONTINUE_STUDY":"P0_FAILURE_NOT_SCOPE_EVIDENCE",
    checked:P02_SCOPE_PREFLIGHT_CASES
  });
}
