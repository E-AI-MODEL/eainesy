#!/usr/bin/env node
/**
 * Read-only, one-shot live NeSy integration experiment.
 *
 * Existing Next.js -> GLM parser -> controller -> REAL isolated Z3 worker
 * -> GLM generation -> output policy -> persisted certificate.
 * Uses scripts/live-http-e2e.mjs and its four fictional cases unchanged.
 *
 * A loopback-only proxy provides a HARD upstream request/token bound without
 * altering production provider code, and keeps the actual OpenAI key out of
 * the Next.js process, logs, source, reports and test artifacts.
 *
 * This is NOT a clinical/semantic validation or production authorization.
 */
import {createServer} from "node:http";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {mkdirSync,writeFileSync} from "node:fs";
import {resolve,join} from "node:path";

const flags=process.argv.slice(2);
const p0Baseline=flags.includes("--p0-baseline");
if(flags.length!==(p0Baseline?3:2) || !flags.includes("--live") ||
   !flags.includes("--accept-costs") ||
   flags.some(x=>!["--live","--accept-costs","--p0-baseline"].includes(x)))
  throw Error("Live test requires --live --accept-costs [--p0-baseline]");
if(process.env.NESY_FULLCHAIN_APPROVED!=="ONE_SHOT_LIVE_APPROVED")
  throw Error("Missing one-shot cost consent");
const key=process.env.nesy;
if(typeof key!=="string" || !key.startsWith("sk-") || key.length<30)
  throw Error("Missing or malformed GitHub Environment secret nesy");
delete process.env.nesy; // real key is held ONLY by the parent/proxy

const MODEL="gpt-5-mini"; // same model as the earlier successful B/C connection
const MAX_CALLS=p0Baseline?48:12; // hard total upstream attempts incl. retries
const MAX_COMPLETION_TOKENS=1600; // hard per-request generated-token limit
const MAX_INPUT_BYTES=90_000; // bounded prompt bytes, no attachments or tools
const MAX_RESPONSE_BYTES=300_000;
const LOCAL_BEARER="nesy-local-fixture-no-secret";
const UPSTREAM="https://api.openai.com/v1/chat/completions";
const metrics={
  model:MODEL,maxCalls:MAX_CALLS,maxCompletionTokens:MAX_COMPLETION_TOKENS,
  requests:0,successful:0,budgetDenied:0,transportErrors:0,
  statusCodes:{},promptTokens:0,completionTokens:0
};
function reply(res,status,reason){
  res.writeHead(status,{"Content-Type":"application/json"});
  res.end(JSON.stringify({error:{message:reason,type:reason}}));
}
const proxy=createServer(async(req,res)=>{
  if(req.method!=="POST" || req.url!=="/v1/chat/completions" ||
     req.headers.authorization!=="Bearer "+LOCAL_BEARER)
    return reply(res,403,"proxy_request_disallowed");
  try{
    const pieces=[];let bytes=0;
    for await(const piece of req){
      bytes+=piece.length;
      if(bytes>MAX_INPUT_BYTES)return reply(res,413,"input_limit");
      pieces.push(piece);
    }
    let input;
    try{input=JSON.parse(Buffer.concat(pieces).toString("utf8"));}
    catch{return reply(res,400,"invalid_json");}
    if(input?.model!==MODEL || !Array.isArray(input.messages) ||
       input.messages.length<2 || input.messages.length>16 ||
       input.messages.some(m=>!["system","user","assistant"].includes(m?.role) ||
         typeof m?.content!=="string" || m.content.length>12000))
      return reply(res,400,"bad_chat_shape");
    if(metrics.requests>=MAX_CALLS){
      metrics.budgetDenied++;
      return reply(res,403,"upstream_call_budget_exhausted");
    }
    metrics.requests++;
    let remote;
    try{
      remote=await fetch(UPSTREAM,{
        method:"POST",redirect:"error",
        signal:AbortSignal.timeout(26_000),
        headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json",
          "Accept":"application/json"},
        // Model provider sends temperature, but GPT-5-mini does not support
        // that parameter. Do not pass through temperature or unknown fields.
        body:JSON.stringify({model:MODEL,messages:input.messages,
          reasoning_effort:"minimal",max_completion_tokens:MAX_COMPLETION_TOKENS,
          store:false,n:1,stream:false})
      });
    }catch{
      metrics.transportErrors++;
      return reply(res,502,"upstream_transport_error");
    }
    const status=String(remote.status);
    metrics.statusCodes[status]=(metrics.statusCodes[status]||0)+1;
    if(!remote.ok)return reply(res,remote.status===429?429:502,"upstream_http_error");
    const body=await remote.text();
    if(body.length>MAX_RESPONSE_BYTES)return reply(res,502,"upstream_response_limit");
    let parsed;
    try{parsed=JSON.parse(body);}
    catch{return reply(res,502,"upstream_invalid_json");}
    if(typeof parsed.choices?.[0]?.message?.content!=="string")
      return reply(res,502,"upstream_invalid_completion");
    metrics.successful++;
    metrics.promptTokens+=Number(parsed.usage?.prompt_tokens||0);
    metrics.completionTokens+=Number(parsed.usage?.completion_tokens||0);
    res.writeHead(200,{"Content-Type":"application/json"});
    // Contents are passed only in-process to the real NeSy server, never logged.
    res.end(body);
  }catch{
    metrics.transportErrors++;
    reply(res,502,"proxy_internal_error");
  }
});
proxy.listen(0,"127.0.0.1");
await once(proxy,"listening");
const port=proxy.address().port;
const env={...process.env,
  CI:"true",
  EAINESY_MODEL_BACKEND:"openai-compatible",
  EAINESY_MODEL_ENDPOINT:"http://127.0.0.1:"+port+"/v1/chat/completions",
  EAINESY_MODEL_NAME:MODEL,
  EAINESY_MODEL_API_KEY:LOCAL_BEARER
};
const ROOT=resolve(import.meta.dirname,"..");
const child=spawn(process.execPath,[p0Baseline?"scripts/nesy-p0-baseline-e2e.mjs":
  "scripts/live-http-e2e.mjs","--live","--accept-costs"],{
  cwd:ROOT,env,stdio:["ignore","pipe","pipe"]
});
const turns=[];
const p0Events=[];
let p0Summary=null;
let safePassSummary=false,buffer="";
function parseSafeLine(line){
  if(p0Baseline){
    if(line.startsWith("NESY P0 CASE ")){
      try{
        const entry=JSON.parse(line.slice("NESY P0 CASE ".length));
        if(typeof entry.id==="string" && entry.id.length<80) p0Events.push({
          id:entry.id,technical:entry.technical===true,
          semanticPass:entry.semanticPass===true,
          z3:entry.z3||null,action:entry.finalAction||null
        });
      }catch{}
    }else if(line.startsWith("NESY P0 BASELINE ")){
      try{p0Summary=JSON.parse(line.slice("NESY P0 BASELINE ".length));}catch{}
    }
    return;
  }
  let prefix=null;
  if(line.startsWith("LIVE HTTP TURN "))prefix="LIVE HTTP TURN ";
  else if(line.startsWith("LIVE HTTP E2E PASS "))prefix="LIVE HTTP E2E PASS ";
  if(!prefix)return;
  let value;
  try{value=JSON.parse(line.slice(prefix.length));}catch{return;}
  if(prefix==="LIVE HTTP TURN "){
    const item={id:String(value.id||"").slice(0,50),ok:value.ok===true,
      action:String(value.action||"").slice(0,40),
      z3:String(value.z3||"").slice(0,20),
      failClosed:value.failClosed===true,
      durationMs:Number(value.durationMs||0)};
    turns.push(item);
    console.log("NESY LIVE CASE "+JSON.stringify(item));
  }else{
    safePassSummary=value.turns===4 && value.persisted===4 &&
      value.backend==="openai-compatible" && value.data==="fictional";
  }
}
child.stdout.on("data",chunk=>{
  buffer+=String(chunk);
  if(buffer.length>64_000)buffer=buffer.slice(-32_000);
  let index;
  while((index=buffer.indexOf("\n"))!==-1){
    const line=buffer.slice(0,index).trim();
    buffer=buffer.slice(index+1);
    parseSafeLine(line);
  }
});
child.stderr.resume(); // NEVER print raw framework/provider stderr
const outcome=await new Promise(resolve=>{
  child.once("close",(code,signal)=>resolve({code,signal}));
  child.once("error",()=>resolve({code:1,signal:"spawn_error"}));
});
await new Promise(resolve=>proxy.close(resolve));
const passed=p0Baseline ?
  (outcome.code===0 && p0Events.length===14 && p0Summary?.technicalPass===14 &&
   p0Summary?.semanticContractPass===14 && p0Summary?.realZ3Sat===14 &&
   p0Summary?.persistencePass===13 &&
   metrics.requests>0 && metrics.requests<=MAX_CALLS) :
  (outcome.code===0 && safePassSummary && turns.length===4 &&
   turns.every(t=>t.ok && t.z3==="sat" && !t.failClosed) &&
   metrics.requests>0 && metrics.requests<=MAX_CALLS);
const result={
  schema:p0Baseline?"nesy-p0-proxy-v1":"nesy-real-model-real-z3-one-shot-v1",
  status:passed?"PASS":"FAIL",
  model:MODEL,
  route:"real Next.js API > GLM parser > controller > isolated Z3 > generator > output policy",
  realExternalModel:true,isolatedNodeZ3Used:true,
  syntheticCasesOnly:true,clinicalValidation:false,productionChanged:false,
  baselineOnly:p0Baseline,abcArmsInvoked:false,
  api:{...metrics},
  turns:p0Baseline?p0Events:turns,
  persistedCertificatesVerified:p0Baseline?p0Summary?.persistencePass===13:safePassSummary,
  childExitCode:outcome.code,
  secretsLogged:false,
  promptOrReplyTextStoredInReport:false,
  timestamp:new Date().toISOString()
};
const output=join(ROOT,".research-output",p0Baseline?"nesy-p0-baseline":"nesy-full-chain-live");
mkdirSync(output,{recursive:true});
writeFileSync(join(output,p0Baseline?"proxy-summary.json":"summary.json"),
  JSON.stringify(result,null,2)+"\n");
console.log((p0Baseline?"NESY P0 PROXY ":"NESY FULL CHAIN ")+result.status+" "+JSON.stringify({
  cases:p0Baseline?p0Events.length:turns.length,
  realZ3Sat:(p0Baseline?p0Events:turns).filter(x=>x.z3==="sat").length,
  upstreamCalls:metrics.requests,httpStatuses:metrics.statusCodes,
  tokens:{input:metrics.promptTokens,output:metrics.completionTokens},
  failedClosed:p0Baseline?null:turns.filter(x=>x.failClosed).length,
  boundedBy:MAX_CALLS
}));
if(!passed)process.exitCode=1;
