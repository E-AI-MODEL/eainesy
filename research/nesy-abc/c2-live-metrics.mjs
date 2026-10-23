/**
 * C2 research-only bookkeeping. No inference of semantic quality here.
 * Explicitly distinguish a genuine zero-proposal model response from
 * one where proposals existed but every mechanical gate rejected them.
 */
export function summarizeC2LiveOutcomes(rows) {
  if(!Array.isArray(rows))throw Error("C2 case metadata array required");
  const parsed=rows.filter(r=>r?.jsonParsed===true);
  const integer=(x)=>Number.isSafeInteger(x)&&x>=0?x:0;
  return Object.freeze({
    processedCases:rows.length,
    structurallyParsedCases:parsed.length,
    generatedProposals:parsed.reduce((n,r)=>n+integer(r.claimCount),0),
    structurallyAccepted:parsed.reduce((n,r)=>n+integer(r.accepted),0),
    structurallyRejected:parsed.reduce((n,r)=>n+integer(r.rejected),0),
    explicitModelNoProposalCases:parsed.filter(r=>r.claimCount===0).length,
    casesWithoutAccepted:parsed.filter(r=>integer(r.accepted)===0).length,
    casesAllProposalsRejected:parsed.filter(r=>integer(r.claimCount)>0 &&
      integer(r.accepted)===0 && integer(r.rejected)>0).length,
    casesWithBothAcceptedAndRejected:parsed.filter(r=>
      integer(r.accepted)>0 && integer(r.rejected)>0).length
  });
}
