import test from "node:test";
import assert from "node:assert/strict";
import {summarizeC2LiveOutcomes} from "./c2-live-metrics.mjs";

test("five accepted and four rejected does not imply six model abstentions",()=>{
  const rows=[
    {jsonParsed:true,claimCount:1,accepted:1,rejected:0},
    {jsonParsed:true,claimCount:1,accepted:0,rejected:1},
    {jsonParsed:true,claimCount:1,accepted:0,rejected:1},
    {jsonParsed:true,claimCount:0,accepted:0,rejected:0},
    {jsonParsed:true,claimCount:1,accepted:0,rejected:1},
    {jsonParsed:true,claimCount:2,accepted:2,rejected:0},
    {jsonParsed:true,claimCount:1,accepted:1,rejected:0},
    {jsonParsed:true,claimCount:0,accepted:0,rejected:0},
    {jsonParsed:true,claimCount:0,accepted:0,rejected:0},
    {jsonParsed:true,claimCount:2,accepted:1,rejected:1}
  ];
  const s=summarizeC2LiveOutcomes(rows);
  assert.equal(s.generatedProposals,9);
  assert.equal(s.structurallyAccepted,5);
  assert.equal(s.structurallyRejected,4);
  assert.equal(s.explicitModelNoProposalCases,3);
  assert.equal(s.casesWithoutAccepted,6);
  assert.equal(s.casesAllProposalsRejected,3);
  assert.equal(s.casesWithBothAcceptedAndRejected,1);
});

test("unparseable call is unknown, not an abstention",()=>{
  const s=summarizeC2LiveOutcomes([
    {jsonParsed:false,claimCount:null,accepted:0,rejected:0},
    {jsonParsed:true,claimCount:0,accepted:0,rejected:0}
  ]);
  assert.equal(s.processedCases,2);
  assert.equal(s.structurallyParsedCases,1);
  assert.equal(s.explicitModelNoProposalCases,1);
  assert.equal(s.casesWithoutAccepted,1);
});
