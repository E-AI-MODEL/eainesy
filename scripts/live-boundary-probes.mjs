#!/usr/bin/env node
/**
 * Opt-in GENERALISATION probe runner: real GLM calls against the
 * pre-registered probe set in live-boundary-probes-cases.mjs (frozen
 * BEFORE any call). Fictional texts only. Real provider calls can cost.
 *
 *   Free inventory: node scripts/live-boundary-probes.mjs --dry-run
 *   Live run:       node scripts/live-boundary-probes.mjs --live --accept-costs
 *   New measurement: add --fresh (otherwise completed probes are reused).
 *
 * Mirrors live-glm-eval.mjs conventions: bundles the UNMODIFIED production
 * parser via bun build; typed provider outages never count as results; no
 * total-score claim — every probe is reported individually. Probe criteria
 * were written before any live call (see PROBE_VERSION) and are NOT changed
 * after observing results.
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync,renameSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {PROBES,PROBE_VERSION,TOTAL_PROBES} from './live-boundary-probes-cases.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const DIR=join(ROOT,'.live-eval');
const stateFile=join(DIR,'probes-state.json');
const args=process.argv.slice(2);
const flags=new Set(args.filter(a=>a.startsWith('--')&&!a.includes('=')));
const dry=flags.has('--dry-run');
if(!dry&&!(flags.has('--live')&&flags.has('--accept-costs'))){
  console.error('Real provider calls require BOTH --live and --accept-costs; --dry-run is free.');
  process.exit(2);
}
if(PROBES.length!==TOTAL_PROBES)throw Error('Probe fixture integrity failure');
if(dry){
  console.log(JSON.stringify({mode:'offline probe inventory',externalCalls:0,
    version:PROBE_VERSION,total:TOTAL_PROBES,
    series:{A:PROBES.filter(p=>p.serie==='A').length,
            B:PROBES.filter(p=>p.serie==='B').length,
            C:PROBES.filter(p=>p.serie==='C').length},
    humanReviewIds:PROBES.filter(p=>p.humanReview).map(p=>p.id),
    ids:PROBES.map(p=>p.id)},null,2));
  process.exit(0);
}
const signature=createHash('sha256');
for(const p of [readFileSync(join(ROOT,'scripts/live-boundary-probes-cases.mjs')),
  ...['src/lib/eainesy/glm.ts','src/lib/eainesy/model-provider.ts','scripts/live-boundary-probes.mjs']
    .map(f=>readFileSync(join(ROOT,f)))])signature.update(p);
const digest=signature.digest('hex');
mkdirSync(DIR,{recursive:true});
if(flags.has('--fresh')&&existsSync(stateFile))rmSync(stateFile);
let state={metadata:{signature:digest,probeVersion:PROBE_VERSION,backend:process.env.EAINESY_MODEL_BACKEND||'zai-sdk',
  model:process.env.EAINESY_MODEL_NAME||'SDK-managed',createdAt:new Date().toISOString()},results:{}};
if(existsSync(stateFile)){
  const previous=JSON.parse(readFileSync(stateFile,'utf8'));
  if(previous.metadata?.signature!==digest)throw Error('Checkpoint for different probes/code: use --fresh');
  state=previous;
}
function persist(){writeFileSync(stateFile+'.tmp',JSON.stringify(state,null,2),{mode:0o600});renameSync(stateFile+'.tmp',stateFile);}
for(const [src,out] of [['src/lib/eainesy/glm.ts','glm.mjs']])
  execFileSync('bun',['build',join(ROOT,src),'--target=node','--format=esm',
   '--external','z-ai-web-dev-sdk','--outfile',join(DIR,out)],{cwd:ROOT,stdio:'pipe',timeout:45000});
const glm=await import(pathToFileURL(join(DIR,'glm.mjs')).href);
function judge(frame,p){
  if(!frame)return {problems:['frame-unparseable'],intent:'FRAME_NULL',markers:[]};
  const markers=frame.riskMarkers.map(m=>m.type),problems=[];
  const c=p.expect;
  if(c.intents&&!c.intents.includes(frame.intent))problems.push('intent-family');
  if(c.forbiddenIntents?.includes(frame.intent))problems.push('forbidden-intent');
  if((c.requiredMarkers||[]).some(m=>!markers.includes(m)))problems.push('required-marker');
  if((c.forbiddenMarkers||[]).some(m=>markers.includes(m)))problems.push('forbidden-marker');
  if(frame.language!==p.lang)problems.push('language');
  return {problems,intent:frame.intent,markers};
}
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const cooldown=Number(args.find(a=>a.startsWith('--cooldown-ms='))?.slice(14)||30000);
if(!Number.isFinite(cooldown)||cooldown<0||cooldown>120000)throw Error('Invalid cooldown');
async function attempt(fn,id){
  for(let i=0;i<3;i++){
    try{return await fn();}
    catch(err){
      if(err?.name!=='ModelProviderUnavailable')throw err;
      const reason=err.reason||'provider_error';
      if(reason==='rate_limited'&&i<2){
        console.log('TRANSPORT-OUTAGE',JSON.stringify({id,reason,attempt:i+1,cooldownMs:cooldown}));
        await sleep(cooldown);
        continue;
      }
      return {status:'OUTAGE',problems:['provider-unavailable'],providerReason:reason};
    }
  }
}
let newChecks=0,cachedChecks=0;
for(const p of PROBES){
  if(state.results[p.id]&&state.results[p.id].status!=='OUTAGE'){
    cachedChecks++;
    console.log('CACHED',JSON.stringify({id:p.id,status:state.results[p.id].status}));
    continue;
  }
  const runner=()=>{
    const t=performance.now();
    return glm.parseFrame(p.user,p.history||[]).then(frame=>({...judge(frame,p),elapsedMs:Math.round(performance.now()-t)}));
  };
  const rec=await attempt(runner,p.id);
  const status=rec.status==='OUTAGE'?'OUTAGE':rec.problems.length?'DEVIATION':'PASS';
  newChecks++;
  state.results[p.id]={...rec,status,humanReview:p.humanReview===true,
    recordMarkerTypes:p.expect.recordMarkerTypes||[]};
  persist();
  console.log('PROBE',JSON.stringify({id:p.id,serie:p.serie,status,
    intent:rec.intent,markers:rec.markers,
    ...(rec.problems.length?{problems:rec.problems}:{}),
    ...(rec.providerReason?{providerReason:rec.providerReason}:{}),
    humanReview:p.humanReview===true,elapsedMs:rec.elapsedMs??null}));
  if(!status.startsWith('PASS')&&!state.results[p.id].neverCooled){
    state.results[p.id].neverCooled=true;persist();
    await sleep(cooldown);
  }
}
const result=PROBES.map(p=>state.results[p.id]).filter(Boolean);
const count=s=>result.filter(x=>x.status===s).length;
console.log('GENERALISATION PROBE SUMMARY',JSON.stringify({
  total:TOTAL_PROBES,pass:count('PASS'),deviation:count('DEVIATION'),outage:count('OUTAGE'),
  newChecks,cachedChecks,probeVersion:PROBE_VERSION,
  humanReviewIds:PROBES.filter(p=>p.humanReview).map(p=>p.id),
  criteriaFrozenBeforeRun:true,
  fixture58Untouched:true,checkpoint:'.live-eval/probes-state.json',
  clinicalValidity:'not established'}));
if(count('OUTAGE'))process.exitCode=2;
