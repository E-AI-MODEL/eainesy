/**
 * NeSy P0/A/B/C content-review DEV lab.
 *
 * CI usage (local deterministic stand-in, NO LLM):
 *   node scripts/run-nesy-abc-review-lab.mjs --ci-stub
 *
 * Explicit optional local-only real model use (e.g. Ollama):
 *   node scripts/run-nesy-abc-review-lab.mjs \
 *     --endpoint http://127.0.0.1:11434/v1/chat/completions --model llama3.2:3b
 *
 * No live NeSy sessions, user data, providers, production DB or output
 * changes. The 24 known DEV cases and synthetic model-shaped observations
 * are visible development data, NOT independent ground truth.
 *
 * In this laboratory the SAT safety snapshot is deliberately FAKE to
 * exercise the reviewer callbacks. NEVER reuse it in processTurn. This
 * laboratory cannot certify safety, quality, or clinical suitability.
 */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {once} from "node:events";
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import {ARMS,selectArchitecture,evidenceWorkspace} from "../research/nesy-abc/architecture-lab.mjs";
import {createContentReviewers} from "../research/nesy-abc/content-supervisor.mjs";
import {createLoopbackCompletion} from "../research/nesy-abc/loopback-completion.mjs";

const args=process.argv.slice(2);
const ciStub=args.length===1 && args[0]==="--ci-stub";
let endpoint=null,model=null;
if(!ciStub) {
  if(args.length!==4 || args[0]!=="--endpoint" || args[2]!=="--model")
    throw Error("Explicit --ci-stub OR --endpoint http://127.0.0.1:PORT/v1/chat/completions --model MODEL required");
  endpoint=args[1];model=args[3];
}
const load=(name)=>readFileSync(new URL("../research/nesy-abc/"+name,import.meta.url));
const devRaw=load("dev-pilot-p01.json"),claimsRaw=load("dev-scripted-dialogue-observations.json");
const dev=JSON.parse(devRaw.toString("utf8")),claims=JSON.parse(claimsRaw.toString("utf8"));
const digest=(buf)=>createHash("sha256").update(buf).digest("hex");
const check=(ok,why)=>{if(!ok)throw Error("ABC content lab: "+why);};
check(dev.status==="DEV_ONLY_NOT_HOLDOUT","DEV dataset required");
check(claims.status==="DEV_SCRIPTED_MODEL_CLAIMS_NOT_LLM_MEASUREMENTS","DEV observations only");
check(dev.protocol===claims.protocol,"protocol mismatch");
check(dev.cases?.length===24&&Object.keys(claims.cases||{}).length===24,"expected 24 public DEV cases");
check(ARMS.join(",")==="P0,A,B,C","four research arms required");

// These intentionally flawed drafts are CONSTRUCTED TEST PROBES.
// They are not real P0-generated responses. The generic draft for all
// remaining cases is also synthetic, with no implied quality label.
const artificialDrafts={
  "DEV-R01":"Dat klinkt alsof jouw eigen relatie onder druk staat.",
  "DEV-R04":"Hier is een stappenplan: schrijf drie doelen op.",
  "DEV-D01":"Hier zijn wat tips om deze situatie aan te pakken.",
};
const draftFor=(c)=>artificialDrafts[c.id]||
  (c.language==="en"?"Could you tell me a bit more?":"Kun je daar iets meer over vertellen?");

// Each test has exactly the same (fake) all-clear snapshot so that
// callbacks are technically reachable. No such snapshot is accepted by
// live NeSy. No results from this lab are delivered or safety-certified.
const SIMULATED_SAFETY=Object.freeze({
  action:"THERAPEUTIC_DIALOG",riskAssessment:"NONE",
  verification:"sat",modelCheckPass:true,
  outputPolicyAllowed:true,riskMemory:"NONE",
});
function inputFor(c) {
  const observation=claims.cases[c.id];
  check(observation?.version===1&&observation?.origin==="model_claim","invalid claims "+c.id);
  check(Array.isArray(observation.acts),"missing acts "+c.id);
  for(const act of observation.acts)
    check(typeof act.evidence==="string"&&c.userText.includes(act.evidence),
      "claim missing verbatim evidence "+c.id);
  return {
    userText:c.userText,history:c.history,
    draft:draftFor(c),lexicalMarkers:[],
    frame:{intent:"GENERAL_VENT",riskMarkers:[],paraphrase:"",parseConfidence:0.5},
    dialogueObservation:observation,
    base:{move:"QUESTION"},safety:{...SIMULATED_SAFETY},
  };
}

// A strictly local fake OpenAI-compatible model returns valid fixed
// source-anchored content reviews. These are not empirical model judgments.
function answerStub(request) {
  const u=request.userText||"", d=request.draftText||"";
  if(request.phase==="post-concept" &&
     u.includes("Nee, het gaat over mijn zus.") && d.includes("jouw eigen relatie"))
    return {decision:"REVISE",issue:"PERSON_ATTRIBUTION",
      userEvidence:"het gaat over mijn zus",draftEvidence:"jouw eigen relatie",
      move:"REPAIR",reason:"Scripted wrong-person correction.",
      revisedDraft:"Ik begreep je verkeerd: het gaat om je zus, niet je eigen relatie."};
  if(request.phase==="post-concept" &&
     u.includes("Ik wil geen stappenplan.") && d.includes("stappenplan"))
    return {decision:"REVISE",issue:"UNWANTED_ADVICE",
      userEvidence:"Ik wil geen stappenplan",draftEvidence:"stappenplan",
      move:"REFLECTION",reason:"Scripted advice-refusal case.",
      revisedDraft:"Je wilt geen stappenplan. Vertel gerust je verhaal."};
  if(request.phase==="pre-answer" &&
     u.includes("Nee, het gaat over mijn zus."))
    return {decision:"REVISE",issue:"MISSED_CORRECTION",
      userEvidence:"het gaat over mijn zus",draftEvidence:"",
      move:"REPAIR",reason:"Scripted correction of person.",revisedDraft:""};
  if(request.phase==="pre-answer" &&
     u.includes("Niet nu. Dat speelde drie jaar geleden"))
    return {decision:"REVISE",issue:"TIME_ATTRIBUTION",
      userEvidence:"Dat speelde drie jaar geleden",draftEvidence:"",
      move:"REPAIR",reason:"Scripted correction of time.",revisedDraft:""};
  return {decision:"KEEP",issue:"NONE",userEvidence:"",draftEvidence:"",
    move:"QUESTION",reason:"Scripted no intervention.",revisedDraft:""};
}
let server=null;
let stubRequests=0;
if(ciStub) {
  server=createServer(async(req,res)=>{
    try {
      assert.equal(req.method,"POST");
      assert.equal(req.url,"/v1/chat/completions");
      const chunks=[];let bytes=0;
      for await(const part of req){
        bytes+=part.byteLength;
        check(bytes<32768,"stub request exceeds limit");
        chunks.push(part);
      }
      const data=JSON.parse(Buffer.concat(chunks).toString("utf8"));
      assert.equal(data.stream,false);
      assert.equal(data.messages?.[0]?.role,"system");
      assert.equal(data.messages?.[1]?.role,"user");
      const review=JSON.parse(data.messages[1].content);
      check(["post-concept","pre-answer"].includes(review.phase),"unexpected review phase");
      stubRequests++;
      res.writeHead(200,{"Content-Type":"application/json"});
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(answerStub(review))}}]}));
    }catch(error){
      res.writeHead(500,{"Content-Type":"application/json"});
      res.end('{"error":"invalid synthetic review request"}');
    }
  });
  server.listen(0,"127.0.0.1");
  await once(server,"listening");
  const addr=server.address();
  check(addr && typeof addr!=="string","loopback mock must bind");
  endpoint="http://127.0.0.1:"+addr.port+"/v1/chat/completions";
  model="ci-scripted-review";
}
const transport=createLoopbackCompletion({endpoint,model,timeoutMs:ciStub?10000:120000});
const reviewers=createContentReviewers({complete:transport.complete});
const rows=[],errors=[];
let expectedCCalls=0,bCalls=0,cCalls=0;
try{
  for(const c of dev.cases){
    try{
      const input=inputFor(c);
      const triggers=evidenceWorkspace(input).triggerCodes;
      const p0=await selectArchitecture(input,"P0");
      const a=await selectArchitecture(input,"A");
      const b=await selectArchitecture(input,"B",{supervisor:reviewers.supervisor});
      const cArm=await selectArchitecture(input,"C",{orchestrator:reviewers.orchestrator});
      expectedCCalls+=triggers.length>0?1:0;
      bCalls+=b.extraCalls;cCalls+=cArm.extraCalls;
      check(p0.extraCalls===0&&a.extraCalls===0,"P0/A must use no review call "+c.id);
      check(b.extraCalls===1,"B must review precisely one scripted draft "+c.id);
      check(cArm.extraCalls===(triggers.length>0?1:0),"C must call exactly when triggered "+c.id);
      check(!b.candidateDraftCertified&&!cArm.candidateDraftCertified,
        "reviewer cannot self-certify draft "+c.id);
      check(cArm.candidateDraft===null,"C must not generate a reply "+c.id);
      check(p0.safetyUnchanged.verification==="sat"&&
            cArm.safetyUnchanged.verification==="sat","synthetic fixture altered "+c.id);
      rows.push({
        id:c.id,suite:c.suite,language:c.language,scriptedClaimCount:input.dialogueObservation.acts.length,
        syntheticDraft:true,syntheticSafetySnapshot:true,
        moves:Object.fromEntries([p0,a,b,cArm].map(x=>[x.arm,x.proposedMove])),
        b:{calls:b.extraCalls,decision:b.supervisorOutcome?.kind??"none",
          reviewStatus:b.supervisorOutcome?.status??"none",
          candidateDraftProvided:b.candidateDraft!==null,
          certified:false},
        c:{triggerCodes:cArm.triggers,calls:cArm.extraCalls,
          decision:cArm.supervisorOutcome?.kind??"not_triggered",
          reviewStatus:cArm.supervisorOutcome?.status??"not_triggered",
          certified:false},
        servedToUser:false,
      });
    }catch(error) {
      errors.push({id:c.id,reason:error instanceof Error?error.message:"unknown"});
    }
  }
}finally{
  if(server)await new Promise((resolve,reject)=>
    server.close(err=>err?reject(err):resolve()));
}
const usage=transport.snapshot(),latencies=[...usage.latencyMs].sort((a,b)=>a-b);
const percentile=(arr,p)=>arr.length?arr[Math.max(0,Math.ceil(arr.length*p)-1)]:null;
const completeTokens=usage.usage.filter(Boolean);
const tokenTotals=completeTokens.length===usage.calls?{
  prompt:completeTokens.reduce((t,u)=>t+u.prompt,0),
  completion:completeTokens.reduce((t,u)=>t+u.completion,0),
}:null;
const result={
  schema:"eainesy-abc-review-callback-lab-v1",
  protocol:dev.protocol,
  status:errors.length===0&&rows.length===24&&bCalls===24&&
    cCalls===expectedCCalls&&usage.calls===bCalls+cCalls&&usage.failed===0&&
    (ciStub?(stubRequests===usage.calls &&
      rows.filter(r=>r.b.candidateDraftProvided).length>=2 &&
      rows.filter(r=>r.c.decision==="revise").length>=2):true)
    ?"PASS_DEV_REVIEW_WIRING":"FAIL_DEV_REVIEW_WIRING",
  sourceCommit:process.env.GITHUB_SHA||"local",
  devCorpusSha256:digest(devRaw),
  scriptedClaimSha256:digest(claimsRaw),
  transport:ciStub?"LOCAL_SCRIPTED_HTTP_STUB":"EXPLICIT_USER_LOCAL_MODEL",
  modelId:model,
  researchOnly:true,
  syntheticSafetySnapshot:true,
  syntheticP0Draft:true,
  realZ3Used:false,
  productionDataUsed:false,
  liveProductionModified:false,
  confirmatory:false,
  modelAnswerQualityMeasured:false,
  independentAnnotations:false,
  clinicalSafetyValidated:false,
  explicitLoopbackOnly:true,
  costMeasured:false,
  metrics:{
    cases:rows.length,
    expected:24,
    bCalls,cCalls,expectedCCalls,
    cSavedVsAlwaysCalling:24-cCalls,
    totalHttpCalls:usage.calls,
    successfulHttpCalls:usage.ok,
    failedHttpCalls:usage.failed,
    bCandidateCount:rows.filter(r=>r.b.candidateDraftProvided).length,
    meanLatencyMs:latencies.length?Math.round(latencies.reduce((a,b)=>a+b,0)/latencies.length):null,
    p95LatencyMs:percentile(latencies,0.95),
    tokenUsageIfReported:tokenTotals,
    cOverBCallRatio:bCalls?Math.round(cCalls/bCalls*1000)/1000:null,
    errors:errors.length,
  },
  cases:rows,
  errors
};
const out=resolve(process.env.NESY_ABC_REPORT_DIR||".research-output/nesy-abc-review-lab");
mkdirSync(out,{recursive:true});
writeFileSync(resolve(out,"review-lab.json"),JSON.stringify(result,null,2)+"\n");
const m=result.metrics;
const md=[
  "# NeSy B/C — automatische inhoudelijke reviewer-koppeling (DEV)",
  "",
  "Status: "+result.status,
  "Modelroute: "+result.transport+" / "+model,
  "Broncommit: "+result.sourceCommit,
  "DEV SHA-256: "+result.devCorpusSha256,
  "",
  "**Geen bewijs voor betere antwoorden.** De 24 DEV-gevallen en parserclaims zijn bekend.",
  "Alle B-conceptantwoorden zijn fictieve proefteksten, niet door P0 gegenereerd.",
  "Het SAT-label is uitsluitend een synthetische onderzoeksfixture; echte Z3 is niet gebruikt.",
  "Deze runner verandert geen productieantwoord. Er worden geen echte gebruikersgegevens verzonden.",
  ciStub?"De CI gebruikt uitsluitend een lokale regelgestuurde HTTP-stub, geen taalmodel.":
    "Een expliciet lokaal model is aangeroepen. De uitkomsten zijn nog niet onafhankelijk beoordeeld.",
  "",
  "| Meetpunt | Resultaat |","| --- | ---: |",
  "| Verwerkte gevallen | "+m.cases+"/24 |",
  "| B review-aanroepen | "+m.bCalls+" |",
  "| C review-aanroepen | "+m.cCalls+" |",
  "| C bespaarde review-aanroepen tegenover altijd-call | "+m.cSavedVsAlwaysCalling+" |",
  "| B kandidaatteksten (niet gecertificeerd) | "+m.bCandidateCount+" |",
  "| HTTP-reviewverzoeken | "+m.totalHttpCalls+" |",
  "| Fouten | "+m.errors+" |",
  "| Gemiddelde lokale HTTP-latentie (ms) | "+m.meanLatencyMs+" |",
  "| P95 lokale HTTP-latentie (ms) | "+m.p95LatencyMs+" |",
  "| Tokenverbruik | "+(m.tokenUsageIfReported===null?"niet beschikbaar":
      m.tokenUsageIfReported.prompt+" prompt + "+m.tokenUsageIfReported.completion+" completion")+" |",
  "",
  "| Casus | A | B | C | C-trigger | Review B/C |",
  "| --- | --- | --- | --- | --- | --- |",
  ...rows.map(r=>"| "+r.id+" | "+r.moves.A+" | "+r.moves.B+" | "+r.moves.C+
    " | "+(r.c.triggerCodes.join(",")||"-")+" | "+r.b.decision+" / "+r.c.decision+" |"),
  "",
  "**Geen onafhankelijke waarheidstoets:** dezelfde bronfragmenten zijn vooraf bekend en",
  "het lokale model/de stub beoordeelt alleen een scenario, geen gevalideerde gesprekskwaliteit.",
  "",
  ...errors.map(e=>"ERROR "+e.id+": "+e.reason),""
].join("\n");
writeFileSync(resolve(out,"review-lab.md"),md);
if(process.env.GITHUB_STEP_SUMMARY){
  writeFileSync(process.env.GITHUB_STEP_SUMMARY,[
    "## NeSy B/C — automatische lokale reviewerproef",
    "",
    "| Meetpunt | Resultaat |","| --- | ---: |",
    "| Fictieve gevallen | "+m.cases+"/24 |",
    "| B reviewcalls | "+m.bCalls+" |",
    "| C selectieve reviewcalls | "+m.cCalls+" |",
    "| HTTP-fouten | "+m.failedHttpCalls+" |",
    "| Niet-gecertificeerde concepten, nooit verzonden | "+m.bCandidateCount+" |",
    "| Modus | "+result.transport+" |",
    "",
    "Alleen DEV-fixtures. Virtuele SAT, geen echte Z3 of onafhankelijke kwaliteitsmeting.",
    ""
  ].join("\n"),{flag:"a"});
}
console.log("ABC reviewer DEV: "+result.status+" cases="+m.cases+
  " B="+m.bCalls+" C="+m.cCalls+" C-saved="+m.cSavedVsAlwaysCalling+
  " HTTP="+m.totalHttpCalls+" errors="+m.errors);
if(result.status!=="PASS_DEV_REVIEW_WIRING")process.exitCode=1;
