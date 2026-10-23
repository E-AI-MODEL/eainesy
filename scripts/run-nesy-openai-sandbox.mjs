/**
 * Manual sandbox smoke test: exactly one fictional DEV case with P0/A/B/C.
 * No production app imports; no sessions, chats, database, server or writes.
 *
 * --dry-run: offline readiness test; no OpenAI key, no network or charges.
 * --connect: one B and one C API review through OpenAI Responses.
 *
 * --connect requires BOTH a secret-injected key and an explicit consent
 * environment variable. It cannot use user messages as input.
 *
 * The fake SAT status is a deliberately non-authoritative research fixture;
 * the outputs must NEVER enter the production safety chain.
 */
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import {selectArchitecture,evidenceWorkspace} from "../research/nesy-abc/architecture-lab.mjs";
import {createContentReviewers} from "../research/nesy-abc/content-supervisor.mjs";
import {makeOpenAISandboxClient,OPENAI_SANDBOX_MODEL}
  from "../research/nesy-abc/openai-sandbox-client.mjs";

const args=process.argv.slice(2);
if(args.length!==1 || !["--dry-run","--connect"].includes(args[0]))
  throw Error("Sandbox requires exactly --dry-run or --connect");
const mode=args[0]==="--connect"?"connect":"dry_run";

const read=(p)=>readFileSync(new URL("../research/nesy-abc/"+p,import.meta.url));
const dataBytes=read("dev-pilot-p01.json");
const observationBytes=read("dev-scripted-dialogue-observations.json");
const pilot=JSON.parse(dataBytes.toString("utf8"));
const observations=JSON.parse(observationBytes.toString("utf8"));
const assert=(ok,msg)=>{if(!ok)throw Error("Sandbox: "+msg);};
assert(pilot.status==="DEV_ONLY_NOT_HOLDOUT","public fictional DEV corpus required");
assert(observations.status==="DEV_SCRIPTED_MODEL_CLAIMS_NOT_LLM_MEASUREMENTS",
  "scripted DEV claims required");

const caseId="DEV-R01";
const sample=pilot.cases.find(x=>x.id===caseId);
const observation=observations.cases[caseId];
assert(sample&&observation,"missing fixed DEV case");
assert(observation.acts.length>0,"source observation required");
assert(observation.acts.every(a=>sample.userText.includes(a.evidence)),
  "scripted evidence not in latest user message");
const priorDraft=sample.history.filter(x=>x.role==="assistant").at(-1)?.content;
assert(typeof priorDraft==="string"&&priorDraft.length>10,"missing fictional draft");

// Exactly the same snapshot offered to all four research arms. This
// explicitly *simulates* an all-clear, never a real certificate.
const input={
  userText:sample.userText,
  draft:priorDraft, // artificial development draft, NOT live P0 output
  history:sample.history,
  frame:{intent:"GENERAL_VENT",riskMarkers:[],paraphrase:"",parseConfidence:0.5},
  dialogueObservation:observation,
  lexicalMarkers:[],
  base:{move:"QUESTION"},
  safety:{
    action:"THERAPEUTIC_DIALOG",riskAssessment:"NONE",verification:"sat",
    modelCheckPass:true,outputPolicyAllowed:true,riskMemory:"NONE"
  },
};

let client=null;
let fakeCalls=0;
if(mode==="connect"){
  assert(process.env.NESY_SANDBOX_EXPLICIT_CONSENT==="TWO_CALLS_AUTHORIZED",
    "explicit two-request consent is required");
  // ONLY source of the API key. Never print, log, store, hash, or commit it.
  const key=process.env.NESY_OPENAI_API_KEY;
  client=makeOpenAISandboxClient({apiKey:key,model:OPENAI_SANDBOX_MODEL});
}
const complete=mode==="connect" ? client.complete : async()=>{
  fakeCalls++;
  return JSON.stringify({
    decision:"KEEP",issue:"NONE",
    userEvidence:"",draftEvidence:"",move:"QUESTION",
    reason:"Local in-process fixture; no semantic judgment.",revisedDraft:""
  });
};
const reviewer=createContentReviewers({complete});
const moves={};
const variants={};
let failed=null;
try{
  for(const arm of ["P0","A","B","C"]){
    const options=arm==="B"?{supervisor:reviewer.supervisor}:
      arm==="C"?{orchestrator:reviewer.orchestrator}:{};
    const value=await selectArchitecture(input,arm,options);
    moves[arm]=value.proposedMove;
    variants[arm]={
      selectedMove:value.selectedMove,
      calls:value.extraCalls,
      reviewed:value.supervisorOutcome?.status==="reviewed",
      rejected:value.supervisorOutcome?.status==="rejected",
      triggered:value.triggered,
      triggerCodes:value.triggers,
      // Do not serialize any suggested reply or actual model content.
      candidateDraftPresent:value.candidateDraft!==null,
      candidateDraftCertified:false,
      productionApplied:false
    };
  }
}catch{failed="research_architecture_error";}
const expectedCalls=2;
const actualCalls=mode==="connect"?client.snapshot().requests:fakeCalls;
if(failed===null && (actualCalls!==expectedCalls||
   variants.B?.calls!==1||variants.C?.calls!==1||
   evidenceWorkspace(input).triggerCodes.length===0)){
  failed="call_budget_or_trigger_failure";
}
if(failed===null && mode==="connect" &&
   (client.snapshot().failed!==0 || !variants.B.reviewed || !variants.C.reviewed)){
  failed="model_review_not_validated";
}
const responseMetrics=mode==="connect"?client.snapshot():{
  model:"in-process-stub",requests:fakeCalls,maxRequests:2,
  successful:fakeCalls,failed:0,perCall:[],monetaryCostMeasured:false
};
const result={
  schema:"eainesy-openai-sandbox-v1",
  status:failed===null?"PASS":"FAIL",
  errorCode:failed,
  mode:mode==="connect"?"EXPLICIT_OPENAI_API_CALL":"OFFLINE_NO_NETWORK",
  model:mode==="connect"?OPENAI_SANDBOX_MODEL:"none",
  gitSha:process.env.GITHUB_SHA||"local",
  scenario:caseId,
  fixtureHashSha256:createHash("sha256").update(dataBytes).digest("hex"),
  openaiResponseStorageDisabled:mode==="connect",
  testOnlyFictionalData:true,
  artificialDraft:true,
  syntheticSafetySnapshot:true,
  realZ3Used:false,
  actualProductionUserData:false,
  actualProductionResponseChanged:false,
  reviewerCalls:actualCalls,
  tokens:responseMetrics.perCall.map(x=>({
    input:x.promptTokens,output:x.completionTokens
  })),
  latencyMs:responseMetrics.perCall.map(x=>x.ms),
  monetaryCostMeasured:false,
  comparativeQualityMeasured:false,
  armMoves:moves,
  arms:variants
};
const dir=resolve(process.env.NESY_SANDBOX_REPORT_DIR||".research-output/nesy-openai-sandbox");
mkdirSync(dir,{recursive:true});
writeFileSync(resolve(dir,"sandbox-result.json"),JSON.stringify(result,null,2)+"\n");
const md=[
  "# NeSy OpenAI API-sandbox",
  "",
  "Status: "+result.status,
  "Modus: "+result.mode,
  "Model: "+result.model,
  "Synthetische casus: "+caseId,
  "",
  "| Route | Voorstel | Reviewer-calls | Modeloutput gevalideerd |",
  "| --- | --- | ---: | --- |",
  ...["P0","A","B","C"].map(a=>"| "+a+" | "+(moves[a]||"-")+
    " | "+(variants[a]?.calls??0)+" | "+(variants[a]?.reviewed?"ja":"nee")+" |"),
  "",
  "HTTP/API calls: "+actualCalls,
  "API-tokens (indien beschikbaar): "+JSON.stringify(result.tokens),
  "",
  "Dit is geen echte Z3-controle. De fictieve SAT-status is alleen een lab-fixture.",
  "De concepttekst en parserobservaties zijn vooraf geschreven. Geen winnaar of kwaliteitswinst aangetoond.",
  "Geen productieantwoorden gewijzigd. Geen gebruikersgegevens of sleutel opgeslagen.",
  failed?"Foutcode: "+failed:"",
  ""
].join("\n");
writeFileSync(resolve(dir,"sandbox-result.md"),md);
if(process.env.GITHUB_STEP_SUMMARY)
  writeFileSync(process.env.GITHUB_STEP_SUMMARY,[
    "## NeSy OpenAI sandbox — "+result.status,
    "Modus: "+result.mode,
    "Casus: "+caseId,
    "Reviewer-calls B / C: "+(variants.B?.calls??0)+" / "+(variants.C?.calls??0),
    "Modelreviews geldig B / C: "+Boolean(variants.B?.reviewed)+" / "+Boolean(variants.C?.reviewed),
    "De rapporten bevatten uitsluitend classificaties en geaggregeerde gebruiksdata.",
    "Geen onafhankelijke inhoudelijke kwaliteits- of veiligheidsmeting.",
    failed?"Foutcode: "+failed:"",
    ""
  ].join("\n"),{flag:"a"});
console.log("NeSy OpenAI sandbox "+result.status+
  " mode="+mode+" calls="+actualCalls+" case="+caseId);
if(failed!==null)process.exitCode=1;
