import test from "node:test";
import assert from "node:assert/strict";
import {describeP02Eligibility,decideP02Preflight,P02_SCOPE_PREFLIGHT_CASES}
  from "./p02-eligibility.mjs";

test("P02 gate does not mistake successful Z3 for therapeutic admission",()=>{
  for(const action of ["BOUNDARY_REFUSAL","CLARIFY","ABSTAIN_HITL"]){
    const result=describeP02Eligibility({p0Technical:true,p0Action:action,
      riskNone:true,s1GateEligible:false});
    assert.equal(result.eligible,false);
    assert.equal(result.reason,"P0_ACTION_OUTSIDE_S1S2_SCOPE");
  }
  const trueStudy=describeP02Eligibility({p0Technical:true,p0Action:"THERAPEUTIC_DIALOG",
    riskNone:true,s1GateEligible:true});
  assert.equal(trueStudy.eligible,true);
  assert.match(trueStudy.reason,/RESEARCH_PROPOSALS_ONLY/);
});

test("a blocked, unknown or failed safety gate never becomes authorization",()=>{
  for(const args of [
    {p0Technical:false,p0Action:"THERAPEUTIC_DIALOG",riskNone:true,s1GateEligible:true},
    {p0Technical:true,p0Action:"THERAPEUTIC_DIALOG",riskNone:false,s1GateEligible:true},
    {p0Technical:true,p0Action:"THERAPEUTIC_DIALOG",riskNone:true,s1GateEligible:false}
  ])assert.equal(describeP02Eligibility(args).eligible,false);
});

test("preflight stops after THREE real-Z3 cases without eligible S1/S2 scope",()=>{
  const failed=["BOUNDARY_REFUSAL","CLARIFY","ABSTAIN_HITL"].map(action=>({
    P0:{technical:true,realZ3:true},
    eligibility:describeP02Eligibility({p0Technical:true,p0Action:action,
      riskNone:true,s1GateEligible:false})
  }));
  assert.equal(P02_SCOPE_PREFLIGHT_CASES,3);
  assert.equal(decideP02Preflight(failed.slice(0,2)).stop,false);
  const end=decideP02Preflight(failed);
  assert.equal(end.stop,true);
  assert.equal(end.checked,3);
  assert.equal(end.claim,"NOT_AN_ESTIMATE_FOR_REMAINING_SEVEN_CASES");
});

test("a single admitted case or technical failure prevents false futility conclusion",()=>{
  const blocked={P0:{technical:true,realZ3:true},
    eligibility:{eligible:false,reason:"P0_ACTION_OUTSIDE_S1S2_SCOPE"}};
  const admitted={P0:{technical:true,realZ3:true},
    eligibility:{eligible:true,reason:"ELIGIBLE_FOR_RESEARCH_PROPOSALS_ONLY"}};
  const failed={P0:{technical:false,realZ3:false},
    eligibility:{eligible:false,reason:"P0_NOT_VERIFIED"}};
  assert.equal(decideP02Preflight([blocked,admitted,blocked]).stop,false);
  assert.equal(decideP02Preflight([blocked,failed,blocked]).stop,false);
});
