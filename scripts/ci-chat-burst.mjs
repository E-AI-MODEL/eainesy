// Live built Next.js HTTP concurrency check. Synthetic input only.
// A successful automated response MUST have a real Z3 SAT certificate.
// Abstentions remain explicit; unknown generic server errors fail the test.
import assert from 'node:assert/strict';

const url='http://127.0.0.1:3000/api/chat';
const count=12;
const start=performance.now();
const entries=await Promise.all(Array.from({length:count},async(_,i)=>{
  const at=performance.now();
  const response=await fetch(url,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message:'Hallo, ik probeer een gelijktijdige test van de gespreksketen: '+(i+1)+'.',uiLang:'nl'}),
    signal:AbortSignal.timeout(15000),
  });
  assert.equal(response.status,200,'Unexpected HTTP status for request '+i);
  const value=await response.json();
  const duration=Math.round(performance.now()-at);
  if(value.failClosed){
    assert.equal(value.action,'ABSTAIN_HITL','Unclassified fail-closed path for request '+i+': '+JSON.stringify(value));
    assert.equal(value.verification?.status,'blocked','Generic pipeline error for request '+i+': '+JSON.stringify(value));
    assert.ok(['z3_unavailable','z3_inconsistent','z3_inconclusive','modelcheck_failed'].includes(value.verification.reason));
    assert.equal(value.verification.humanReviewQueued,false);
    return {i,kind:'blocked',reason:value.verification.reason,ms:duration};
  }
  assert.equal(value.certificate?.z3?.available,true,'Unverified success '+i);
  assert.equal(value.certificate?.z3?.result,'sat','Unverified success '+i);
  assert.equal(value.certificate?.modelCheck?.pass,true,'Modelcheck failure on success '+i);
  return {i,kind:'certified',ms:duration};
}));
const certified=entries.filter(e=>e.kind==='certified').length;
const blocked=entries.filter(e=>e.kind==='blocked').length;
const elapsed=Math.round(performance.now()-start);
console.log('HTTP concurrency summary:',JSON.stringify({requests:count,certified,blocked,elapsedMs:elapsed,maxLatencyMs:Math.max(...entries.map(e=>e.ms)),entries}));
assert.equal(certified+blocked,count);
assert.ok(certified>0,'No requests were processed');
assert.ok(elapsed<17000,'Requests took too long');
console.log('PASS HTTP concurrency: every response is certified or explicitly abstained');
