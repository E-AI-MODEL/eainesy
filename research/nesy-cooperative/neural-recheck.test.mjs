import test from "node:test";
import assert from "node:assert/strict";
import {createInjectedS2Rechecker,S2_RECHECK_INSTRUCTION} from "./neural-recheck.mjs";

const T=Object.freeze({version:1,facet:"PERSON",question:"Does this block an answer?",
  taskEvidence:"Schrijf de brief namens haar",
  userText:"Schrijf de brief namens haar. Ik bedoel Noor.",
  history:[],uncertainClaims:[{kind:"PERSON",source:"current_user",
  evidence:"namens haar",hypothesis:"The referent is ambiguous",
  authority:"unverified_model_claim"}],noNewUserFacingText:true,maxModelCalls:1});

test("injected S2 recheck uses exactly one call and no real transport",async()=>{
  const observations=[];
  const rechecker=createInjectedS2Rechecker({complete:async input=>{
    observations.push(input);
    return JSON.stringify({decision:"PROPOSE_CONTINUE",facet:"PERSON",
      source:"current_user",evidence:"Ik bedoel Noor.",reason:"User specified Noor"});
  }});
  const ans=await rechecker.recheck(T);
  assert.equal(ans.decision,"PROPOSE_CONTINUE");
  assert.equal(rechecker.count(),1);
  assert.equal(rechecker.hasTransport,false);
  assert.equal(observations.length,1);
  assert.equal(observations[0].temperature,0);
  assert.ok(observations[0].maxOutputTokens<=350);
  assert.match(observations[0].system,/quoted/);
  assert.equal(JSON.parse(observations[0].user).facet,"PERSON");
  await assert.rejects(rechecker.recheck(T),/single call/);
  assert.equal(observations.length,1);
});

test("invalid neural JSON, prompt leakage or unexpected fields fail rather than rewrite",async()=>{
  const payloads=["not JSON",JSON.stringify({
    decision:"PROPOSE_CONTINUE",facet:"PERSON",source:"current_user",
    evidence:"Noor",reason:"yes",tools:["danger"]})];
  for(const output of payloads){
    const c=createInjectedS2Rechecker({complete:async()=>output});
    await assert.rejects(c.recheck(T));
    assert.equal(c.count(),1);
  }
});
test("missing ticket, no callback and truncated ticket blocked",async()=>{
  assert.throws(()=>createInjectedS2Rechecker({}));
  const c=createInjectedS2Rechecker({complete:async()=>`{"decision":"ABSTAIN"}`});
  await assert.rejects(c.recheck({...T,maxModelCalls:10}),/malformed/);
  assert.equal(c.count(),0);
});
