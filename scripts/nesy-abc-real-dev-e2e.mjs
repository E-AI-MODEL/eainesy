#!/usr/bin/env node
/**
 * EXPLORATORY DEV only: 24 fictional cases, each a genuine live P0 turn.
 * All A/B/C arms receive the SAME immutable persisted P0 evidence bundle.
 * A uses a deterministic mixer; B gets up to one real post-draft review;
 * C gets up to one real pre-answer review only when triggered.
 *
 * History in this DEV corpus is SCRIPTED and UNVERIFIED. The live CURRENT
 * turn, by contrast, uses actual GPT, isolated Node/Z3 and OutputPolicy.
 *
 * Outputs are enum metadata only: no messages, prompts, response text,
 * plan text, true provider credentials or personal data in report/log.
 * Never applies any research proposal to a user response.
 */
import assert from "node:assert/strict";
import {readFileSync,mkdirSync,writeFileSync,rmSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import {execFileSync,spawn} from "node:child_process";
import {resolve,join} from "node:path";
import {ARMS,selectArchitecture} from "../research/nesy-abc/architecture-lab.mjs";
import {fromVerifiedTurn} from "../research/nesy-abc/kernel-bridge.mjs";
import {createContentReviewers} from "../research/nesy-abc/content-supervisor.mjs";

const ROOT=resolve(import.meta.dirname,"..");
const devPath=join(ROOT,"research/nesy-abc/dev-pilot-p01.json");
const expPath=join(ROOT,"research/nesy-abc/abc-dev-move-expectations-v1.json");
const devBytes=readFileSync(devPath), expBytes=readFileSync(expPath);
const dev=JSON.parse(devBytes.toString("utf8")),expect=JSON.parse(expBytes.toString("utf8"));
const sha=b=>createHash("sha256").update(b).digest("hex");
const known=["QUESTION","RESTATEMENT","REFLECTION","AFFIRMATION","SUMMARY","SUGGESTION","INFORMATION","REPAIR","SAFETY","BOUNDARY","REFERRAL","CLARIFY"];
const rubric=new Map(expect.cases.map(x=>[x.id,x.allowed]));
assert.equal(dev.status,"DEV_ONLY_NOT_HOLDOUT");
assert.equal(dev.cases?.length,24);
assert.equal(expect.status,"DEV_VISIBLE_NON_BLINDED_NON_CLINICAL");
assert.equal(expect.cases?.length,16);
assert.deepEqual(ARMS,["P0","A","B","C"]);
const IDs=new Set();
for(const c of dev.cases){
  assert(!IDs.has(c.id)); IDs.add(c.id);
  assert(typeof c.userText==="string"&&c.userText.length>=10&&c.userText.length<=2000);
  assert(["nl","en","mixed"].includes(c.language));
  assert(Array.isArray(c.history)&&c.history.length>=2&&c.history.length<=6&&c.history.length%2===0);
  for(let j=0;j<c.history.length;j++)
    assert(c.history[j].role===(j%2?"assistant":"user")&&
      typeof c.history[j].content==="string"&&c.history[j].content.length<=2000);
}
for(const e of expect.cases){
  assert(IDs.has(e.id)&&!e.id.startsWith("DEV-U"));
  assert(Array.isArray(e.allowed)&&e.allowed.length>=1&&e.allowed.every(m=>known.includes(m)));
}
if(process.argv.length===3&&process.argv[2]==="--check-cases"){
  console.log("PASS NeSy ABC 24 frozen DEV cases / 16 exploratory move expectations: "+sha(devBytes)+" "+sha(expBytes));
  process.exit(0);
}
assert.deepEqual(process.argv.slice(2),["--live","--accept-costs"]);
assert.equal(process.env.NESY_ABC_LIVE_APPROVED,"APPROVED");
assert.equal(process.env.EAINESY_ABC_SHADOW_ENABLED,"false");
assert.equal(process.env.EAINESY_MODEL_BACKEND,"openai-compatible");
assert.equal(process.env.EAINESY_MODEL_NAME,"gpt-5-mini");
const ENDPOINT=process.env.EAINESY_MODEL_ENDPOINT;
const LOCAL=process.env.EAINESY_MODEL_API_KEY;
const addr=new URL(ENDPOINT);
assert.equal(addr.protocol,"http:");
assert.equal(addr.hostname,"127.0.0.1");
assert.equal(addr.pathname,"/v1/chat/completions");
assert.equal(LOCAL,"nesy-local-fixture-no-secret");
assert(!("nesy" in process.env),"secret must never reach child process");

const OUT=join(ROOT,".research-output","nesy-abc-live-dev");
mkdirSync(OUT,{recursive:true});
const TEMP=join(ROOT,".live-eval");
mkdirSync(TEMP,{recursive:true});
const dbFile=join(TEMP,"abc-live-dev.db");
const APP="http://127.0.0.1:3131";
const env={...process.env,DATABASE_URL:"file:"+dbFile,
  PORT:"3131",HOSTNAME:"127.0.0.1",NODE_ENV:"production",
  NEXT_TELEMETRY_DISABLED:"1",EAINESY_ABC_SHADOW_ENABLED:"false"};
if(existsSync(dbFile))rmSync(dbFile);
let app=null,prisma=null,setupError=null,logFailure=null;
const rows=[],callCounter={B:0,C:0},callbackErrors=[];
const totals={elapsed:0};
let liveP0=0,realZ3=0,verified=0,sessionsIsolated=0;

async function reviewerComplete({system,user,temperature,maxOutputTokens}){
  let request=null;
  try{request=JSON.parse(user);}catch{}
  const arm=request?.phase==="post-concept"?"B":request?.phase==="pre-answer"?"C":null;
  if(!arm)throw Error("unrecognized_reviewer_phase");
  callCounter[arm]++;
  const body=JSON.stringify({
    model:"gpt-5-mini",stream:false,
    messages:[{role:"system",content:system},{role:"user",content:user}],
    temperature:Number(temperature)||0,max_tokens:Math.min(800,Math.max(100,Number(maxOutputTokens)||650))
  });
  if(Buffer.byteLength(body)>28_000)throw Error("review_payload_limit");
  const r=await fetch(ENDPOINT,{method:"POST",
    signal:AbortSignal.timeout(35_000),redirect:"error",
    headers:{"Content-Type":"application/json","Accept":"application/json",
      Authorization:"Bearer "+LOCAL,"X-Nesy-Review-Arm":arm},body});
  if(!r.ok){callbackErrors.push({arm,reason:"review_http_"+r.status});throw Error("review_transport");}
  const b=await r.text();
  if(b.length>55_000){callbackErrors.push({arm,reason:"review_body_limit"});throw Error("review_body_limit");}
  let json;
  try{json=JSON.parse(b);}catch{throw Error("review_invalid_json_transport");}
  const response=json?.choices?.[0]?.message?.content;
  if(typeof response!=="string"||response.length>5_000||!response.trim())
    throw Error("review_missing_text");
  return response;
}
const reviewers=createContentReviewers({complete:reviewerComplete});
const stop=async()=>{
  if(app && app.exitCode===null){app.kill("SIGKILL");}
  if(prisma){try{await prisma.$disconnect();}catch{}}
  for(const suffix of ["","-journal","-wal","-shm"]){
    try{if(existsSync(dbFile+suffix))rmSync(dbFile+suffix);}catch{}
  }
};
async function ready(){
  for(let i=0;i<90;i++){
    if(app.exitCode!==null)return false;
    try{
      const r=await fetch(APP+"/api/verify",{signal:AbortSignal.timeout(1200)});
      if(r.ok)return true;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,400));
  }
  return false;
}
function summaryArm(arm){
  return {
    move:arm.selectedMove,proposal:arm.proposedMove,accepted:arm.accepted===true,
    selectedChanged:arm.selectedMove!==arm.baseMove,
    proposedChanged:arm.proposedMove!==arm.baseMove,
    extraCalls:arm.extraCalls,triggers:arm.triggers||[],
    review:arm.supervisorOutcome?{
      kind:arm.supervisorOutcome.kind||"none",
      status:arm.supervisorOutcome.status||"none",
      issue:arm.supervisorOutcome.issue||"none",
      rejection:arm.supervisorOutcome.rejection||null
    }:null,
    candidateDraftPresent:typeof arm.candidateDraft==="string",
    candidateDraftCertified:arm.candidateDraftCertified===true,
  };
}
try{
  execFileSync("bun",["run","db:generate"],{cwd:ROOT,env,timeout:60_000,stdio:"ignore"});
  execFileSync("bun",["run","db:push"],{cwd:ROOT,env,timeout:60_000,stdio:"ignore"});
  execFileSync("bun",["run","build"],{cwd:ROOT,env,timeout:210_000,stdio:"ignore"});
  const {PrismaClient}=await import("@prisma/client");
  prisma=new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}});
  await prisma.$connect();
  app=spawn(process.execPath,[join(ROOT,".next/standalone/server.js")],{
    cwd:join(ROOT,".next/standalone"),env,stdio:["ignore","ignore","ignore"]
  });
  if(!(await ready()))throw Error("server_not_ready");
  for(const c of dev.cases){
    const ts=performance.now(),session="abc-fiction-"+Date.now().toString(36)+"-"+c.id;
    // No cross-case shared learning. Each case starts with an empty seed table.
    await prisma.seedCandidate.deleteMany();
    await prisma.session.create({data:{id:session,label:"DEV-only ABC research"}});
    const starts=Date.now()-50_000;
    for(let i=0;i<c.history.length;i+=2){
      await prisma.turn.create({data:{
        sessionId:session,userText:c.history[i].content,
        replyText:c.history[i+1].content,action:"THERAPEUTIC_DIALOG",
        riskLevel:"NONE",confidence:0,
        createdAt:new Date(starts+i*1000),
        certificate:"{}",frame:"{}",plan:"{}",trace:"[]"
      }});
    }
    let body={error:"request_not_completed"},httpStatus=0;
    try{
      const r=await fetch(APP+"/api/chat",{
        method:"POST",signal:AbortSignal.timeout(120_000),
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sessionId:session,message:c.userText,
          uiLang:c.language==="en"?"en":"nl"})
      });
      httpStatus=r.status;
      body=await r.json();
    }catch{body={error:"chat_request_failed"};}
    const cert=body.certificate||{};
    const trace=Array.isArray(body.trace)?body.trace:[];
    const frame=trace.find(x=>x.stage==="parse")?.detail;
    const plan=trace.find(x=>x.stage==="plan")?.detail;
    const p0ok=httpStatus===200 && !body.error && !body.failClosed &&
      typeof body.reply==="string"&&body.reply.trim().length>0 &&
      cert.z3?.available===true&&cert.z3?.result==="sat" &&
      cert.modelCheck?.pass===true&&cert.outputPolicy?.pass===true &&
      frame&&Array.isArray(frame.riskMarkers)&&plan&&typeof plan==="object";
    const row={
      id:c.id,suite:c.suite,stratum:c.stratum,language:c.language,
      scriptedHistory:true,historyTurns:c.history.length/2,
      p0:{ok:!!p0ok,action:body.action||null,
        parserIntent:frame?.intent||null,risk:cert.riskLevel||null,
        z3:cert.z3?.result||null,outputPolicy:cert.outputPolicy?.pass===true,
        repaired:cert.outputPolicy?.repaired===true,
        riskMemory:cert.conversation?.riskMemory||null,
        move:cert.conversation?.strategy||null},
      arms:{},persisted:false,
      elapsedMs:null,comparable:false,
      expectedMoveRubric:rubric.has(c.id),
      expectedMoveNote:"Author-defined DEV heuristic only; NOT quality or safety ground truth"
    };
    if(p0ok){
      liveP0++;realZ3++;
      const snapshot=fromVerifiedTurn({
        turnResult:body,
        turnRecord:{
          userText:c.userText,replyText:body.reply,
          frame:JSON.stringify(frame),plan:JSON.stringify(plan),
          certificate:JSON.stringify(cert),trace:JSON.stringify(trace)
        },
        history:c.history
      });
      if(!snapshot.verified)throw Error("real_P0_snapshot_not_verified");
      const immutable=JSON.stringify(snapshot.input);
      for(const arm of ARMS){
        const opts=arm==="B"?{supervisor:reviewers.supervisor}:
                   arm==="C"?{orchestrator:reviewers.orchestrator}:{};
        const choice=await selectArchitecture(snapshot.input,arm,opts);
        assert.equal(JSON.stringify(snapshot.input),immutable,"bridge_modified");
        assert.equal(choice.researchOnly,true);
        assert.equal(choice.candidateDraftCertified,false);
        assert.equal(JSON.stringify(choice.safetyUnchanged),JSON.stringify(snapshot.input.safety));
        assert(arm==="B"||arm==="C"||choice.extraCalls===0);
        assert(choice.extraCalls<=1);
        row.arms[arm]=summaryArm(choice);
        const allowed=rubric.get(c.id);
        row.arms[arm].heuristicAlignment=(choice.accepted&&allowed)?
          allowed.includes(choice.selectedMove):null;
      }
      row.comparable=ARMS.every(a=>row.arms[a]&&row.arms[a].candidateDraftCertified===false);
      verified+=row.comparable?1:0;
    }
    const stored=await prisma.turn.findMany({where:{sessionId:session},
      orderBy:{createdAt:"asc"},select:{certificate:true}});
    row.persisted=stored.length===c.history.length/2+(p0ok?1:0)&&
      (!p0ok||(()=>{
        try{const v=JSON.parse(stored.at(-1).certificate);
          return v.z3?.available===true&&v.z3?.result==="sat"&&v.modelCheck?.pass===true;
        }catch{return false;}
      })());
    sessionsIsolated+=row.persisted?1:0;
    row.elapsedMs=Math.round(performance.now()-ts);
    rows.push(row);
    // Persist metadata only, NEVER the actual case text, response or JSON frame.
    console.log("NESY ABC LIVE CASE "+JSON.stringify({
      id:row.id,technical:row.p0.ok,p0Action:row.p0.action,realZ3:row.p0.z3,
      comparable:row.comparable,persisted:row.persisted,
      A:row.arms.A?.move||null,B:row.arms.B?.move||null,
      C:row.arms.C?.move||null,
      bCalls:row.arms.B?.extraCalls||0,cCalls:row.arms.C?.extraCalls||0
    }));
    await prisma.seedCandidate.deleteMany();
    await prisma.session.delete({where:{id:session}}); // never keep DEV messages
  }
}catch{
  setupError=rows.length===0?"startup_or_first_case_failure":"per_case_harness_failure";
}finally{await stop();}
const allTechnical=rows.length===24&&liveP0===24&&realZ3===24&&verified===24&&
  sessionsIsolated===24 && rows.every(x=>x.comparable);
const reviewerSuccess=rows.filter(x=>x.arms.B?.review?.kind==="error"||
  x.arms.C?.review?.kind==="error").length===0 && callbackErrors.length===0;
const armNames=["P0","A","B","C"];
const counts=Object.fromEntries(armNames.map(a=>[a,{
  selectedChanges:rows.filter(r=>r.arms[a]?.selectedChanged===true).length,
  proposedChanges:rows.filter(r=>r.arms[a]?.proposedChanged===true).length,
  accepted:rows.filter(r=>r.arms[a]?.accepted===true).length,
  modelCalls:rows.reduce((n,r)=>n+(r.arms[a]?.extraCalls||0),0),
  moveHeuristicEligible:rows.filter(r=>r.arms[a]?.heuristicAlignment!==null&&r.arms[a]?.heuristicAlignment!==undefined).length,
  moveHeuristicAligned:rows.filter(r=>r.arms[a]?.heuristicAlignment===true).length,
  revisions:rows.filter(r=>r.arms[a]?.review?.kind==="revise").length,
  vetoes:rows.filter(r=>r.arms[a]?.review?.kind==="veto").length,
  rejectedReviews:rows.filter(r=>r.arms[a]?.review?.status==="rejected").length
}]));
const result={
  schema:"nesy-abc-real-p0-shared-snapshot-dev-v1",
  status:!allTechnical?"INCOMPLETE_TECHNICAL":
    !reviewerSuccess?"PARTIAL_REVIEW_FAILURE":"PASS_EXPLORATORY_WIRING_ONLY",
  protocol:dev.protocol,model:"gpt-5-mini",
  dataStatus:"VISIBLE_DEV_ONLY",confirmatory:false,
  humanReview:false,independentClinicalGold:false,
  armsAppliedToUser:false,productionBehaviorChanged:false,
  genuineP0CurrentTurn:true,realIsolatedZ3:true,
  seededHistoryWasUnverified:true,sharedP0EvidenceForAllArms:true,
  qualityRankingSupported:false,
  datasetSha256:sha(devBytes),moveAuditSha256:sha(expBytes),
  totalCases:24,processed:rows.length,realP0Verified:realZ3,
  comparisons:verified,persistedIsolated: sessionsIsolated,
  reviewerRequests:callCounter,
  aggregated:counts,callbackErrors,
  infrastructureError:setupError,
  cases:rows,rawContentIncluded:false,
  timestamp:new Date().toISOString()
};
writeFileSync(join(OUT,"summary.json"),JSON.stringify(result,null,2)+"\n");
console.log("NESY ABC LIVE DEV "+JSON.stringify({
  status:result.status,processed:rows.length,realZ3,comparisons:verified,
  B:counts.B,C:counts.C,A:counts.A,P0:counts.P0,
  reviewerRequests:callCounter,setupError
}));
if(!allTechnical||!reviewerSuccess)process.exitCode=1;
