import test from "node:test";
import assert from "node:assert/strict";
import {observeC2,summarizeC2} from "./c2-uncertainty.mjs";

test("C2 keeps opposing grounded hypotheses weightless",()=>{
 const r=observeC2({userText:"Ik wil geen tips, ik wil alleen vertellen.",claims:[
  {kind:"NEGATION",source:"current_user",evidence:"geen tips",
   hypothesis:"A proposal to give advice conflicts with this utterance.",
   question:"Should the next reply just acknowledge the story?"},
  {kind:"ALTERNATIVE",source:"current_user",evidence:"alleen vertellen",
   hypothesis:"The user may be requesting space to talk."}
 ]});
 assert.equal(r.candidates.length,2);
 assert.equal(r.candidates[0].weight,0);
 assert.equal(r.candidates[0].authority,false);
 assert.equal(r.outputChanged,false);
 assert.equal(r.safetyChanged,false);
 assert.equal(r.certified,false);
 assert.equal(r.modelCalls,0);
 assert.equal(summarizeC2(r).candidates,2);
});
test("C2 rejects fabricated quotations and invented history",()=>{
 const r=observeC2({userText:"Mijn zus is hersteld.",history:[{role:"assistant",content:"Heeft je zus pijn?"}],claims:[
  {kind:"TIME",source:"current_user",evidence:"gisteren was er een crisis",hypothesis:"Historical crisis"},
  {kind:"PERSON",source:"prior_user",evidence:"mijn zus was ziek",hypothesis:"Past statement"},
  {kind:"PERSON",source:"prior_assistant",evidence:"Heeft je zus pijn?",hypothesis:"An earlier assistant question"}
 ]});
 assert.equal(r.candidates.length,1);
 assert.deepEqual(r.rejected.map(x=>x.reason),["unanchored_evidence","unanchored_evidence"]);
});
test("C2 rejects missing sources, invalid kind, invalid envelope and duplicate",()=>{
 assert.throws(()=>observeC2({userText:"ja",claims:Array(13).fill({})}));
 const r=observeC2({userText:"Nee, ik bedoel mijn vader.",claims:[
  {kind:"PERSON",source:"current_user",evidence:"mijn vader",hypothesis:"The referent may be the father"},
  {kind:"PERSON",source:"current_user",evidence:"mijn vader",hypothesis:"The referent may be the father"},
  {kind:"PROMOTE",source:"current_user",evidence:"mijn vader",hypothesis:"Trust me"}
 ]});
 assert.equal(r.candidates.length,1);
 assert.deepEqual(r.rejected.map(x=>x.reason),["duplicate_candidate","invalid_candidate"]);
});
