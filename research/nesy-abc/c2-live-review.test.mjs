import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const report=JSON.parse(readFileSync(new URL("./c2-live-review-39890442472.json",import.meta.url),"utf8"));
const corpus=JSON.parse(readFileSync(new URL("./c2-live-pilot-input-v1.json",import.meta.url),"utf8"));
test("C2 preliminary audit describes the actual, not blind, sample",()=>{
 assert.equal(report.schema,"nesy-c2-preliminary-analyst-review-v1");
 assert.match(report.label,/UNBLINDED/);
 assert.equal(report.runId,39890442472);
 assert.equal(report.scope.cases,10);
 assert.equal(report.scope.generatedClaims,report.scope.structurallyAccepted+report.scope.structurallyRejected);
 assert.equal(report.scope.generatedClaims,9);
 assert.equal(report.scope.explicitNoClaims,3);
 assert.equal(report.scope.allRejectedCases,3);
 assert.equal(report.scope.mixedAcceptedRejectedCases,1);
 assert.equal(report.scope.qualityOfRejectedClaims,"NOT_EVALUABLE_SOURCE_NOT_RETAINED");
 assert.equal(report.reviews.length,5);
 assert.deepEqual(new Set(report.reviews.map(x=>x.id)),new Set(["C2-L01-C01","C2-L06-C01","C2-L06-C02","C2-L07-C01","C2-L10-C01"]));
 const valid=new Set(corpus.cases.map(x=>x.id));
 for(const row of report.reviews){
   assert(valid.has(row.id.slice(0,6)));
   assert.equal(row.sourceQuotePresent,true);
   assert.match(row.caveat,/No actual next response measured/);
 }
 assert.match(report.conclusion,/does not demonstrate/);
});
