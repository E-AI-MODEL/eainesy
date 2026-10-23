import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 P03_PROTOCOL,P03_SYNTHETIC_SAFETY,p03InputFromFixture,
 p03OfflinePreflight,p03MockedComparison
} from "./p03-sandbox.mjs";
const corpus=JSON.parse(readFileSync(new URL("./p03-sandbox-corpus-v1.json",import.meta.url),"utf8"));

test("P03 corpus is locked, visibly synthetic, and separate from P0 and Z3",()=>{
  assert.equal(corpus.protocol,P03_PROTOCOL);
  assert.match(corpus.status,/LOCKED_BEFORE_FIRST_LIVE_CALL/);
  assert.equal(corpus.realP0,false);
  assert.equal(corpus.realZ3,false);
  assert.equal(corpus.cases.length,14);
  const f=p03InputFromFixture(corpus.cases[0]);
  assert.equal(f.safety.verification,"sat");
  assert.equal(P03_SYNTHETIC_SAFETY.verification,"sat");
  assert.equal(f.safety.action,"THERAPEUTIC_DIALOG");
  assert.equal(f.task.source,"synthetic_annotation");
  assert.equal("certificate" in f,false);
  assert.equal("p0ActuallyInvoked" in f,false);
});

test("offline gate produces eight real S2 opportunities, four resolved and four unresolved",()=>{
  const r=p03OfflinePreflight(corpus.cases);
  assert.equal(r.cases,14);
  assert.equal(r.triggered,8);
  assert.equal(r.controls,6);
  assert.equal(r.resolved,4);
  assert.equal(r.unresolved,4);
  assert.equal(r.realP0,false);
  assert.equal(r.realZ3,false);
  assert.equal(r.costAuthorized,false);
});

test("synthetic mock validates plumbing but no model-quality or safety claim",async()=>{
  const r=await p03MockedComparison(corpus.cases);
  assert.equal(r.mockedModelCallbacks,8);
  assert.equal(r.mockedMoveDifferences,4);
  assert.equal(r.realLLM,false);
  assert.equal(r.independentQualityReview,false);
});

test("reject fabricated source, mutated annotations, and attempted mixed production input",()=>{
  const f=structuredClone(corpus.cases[0]);
  f.c2Claims[0].evidence="unanchored hallucinated sentence";
  assert.throws(()=>p03OfflinePreflight([f,...corpus.cases.slice(1)]));
  const g=structuredClone(corpus.cases[0]);
  g.scope="ACTUAL_PRODUCTION_P0";
  assert.throws(()=>p03InputFromFixture(g));
  const h=structuredClone(corpus.cases[0]);
  h.authorResolutionQuote="invented quote";
  assert.throws(()=>p03OfflinePreflight([h,...corpus.cases.slice(1)]));
});
