#!/usr/bin/env node
/**
 * Opt-in evaluation using the 58 fictional cases recovered from a SHA-256
 * verified GLM Agent patch. REAL GLM requests can incur provider charges.
 *
 * First: node scripts/import-live-glm-patch.mjs /path/to/eainesy-glm-live-integration.patch
 * No calls: node scripts/live-glm-eval.mjs --dry-run
 * Live run: node scripts/live-glm-eval.mjs --live --accept-costs
 * Trial: node scripts/live-glm-eval.mjs --live --accept-costs --max=3
 * New measurement: add --fresh (otherwise cached results are reused).
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync,renameSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const DIR=join(ROOT,'.live-eval');
const fixture=join(DIR,'fixtures.mjs');
const origin=join(DIR,'fixture-origin.json');
const stateFile=join(DIR,'state.json');
const args=process.argv.slice(2);
const flags=new Set(args.filter(a=>a.startsWith('--')&&!a.includes('=')));
const maxFlag=args.find(a=>a.startsWith('--max='));
const max=maxFlag?Number(maxFlag.slice(6)):Infinity;
if(max!==Infinity&&(!Number.isInteger(max)||max<1))throw Error('Invalid --max');
const filterFlag=args.find(a=>a.startsWith('--ids='));
const ids=filterFlag?new Set(filterFlag.slice(6).split(',').filter(Boolean)):null;
const dry=flags.has('--dry-run');
if(!dry&&!(flags.has('--live')&&flags.has('--accept-costs'))){
  console.error('Real provider calls require BOTH --live and --accept-costs; --dry-run is free.');
  process.exit(2);
}
if(!existsSync(fixture)||!existsSync(origin)){
  console.error('Import verified GLM Agent patch first with scripts/import-live-glm-patch.mjs');
  process.exit(2);
}
const metadata=JSON.parse(readFileSync(origin,'utf8'));
const data=readFileSync(fixture);
const dataHash=createHash('sha256').update(data).digest('hex');
if(dataHash!==metadata.fixtureSha256||
   metadata.patchSha256!=='556ce49f9d0b4608afc87e295df3d0027cf28695baa46ab892fe13d42248902a')
  throw Error('Original case corpus integrity failure');
const {PARSE_CASES,SEQUENCE_CASES,GENERATION_CASES,TOTAL_CHECKS}=
  await import(pathToFileURL(fixture).href+'?sha='+dataHash);
const all=[
  ...PARSE_CASES.map(c=>({id:c.id,kind:'parse',case:c})),
  ...SEQUENCE_CASES.flatMap(c=>c.turns.map((turn,i)=>({
    id:c.id+'#'+(i+1),kind:'turn',case:c,turn,position:i}))),
  ...GENERATION_CASES.map(c=>({id:c.id,kind:'generation',case:c})),
];
if(PARSE_CASES.length!==39||SEQUENCE_CASES.reduce((n,c)=>n+c.turns.length,0)!==13||
  GENERATION_CASES.length!==6||TOTAL_CHECKS!==58||all.length!==58||
  new Set(all.map(c=>c.id)).size!==58)throw Error('Expected exactly 58 unique cases');
if(ids&&[...ids].some(id=>!all.some(c=>c.id===id)))throw Error('Unknown case ID');
const selected=all.filter(c=>!ids||ids.has(c.id)).slice(0,max);
const reviewIds=selected.filter(c=>c.case.humanReview).map(c=>c.id);
if(dry){
  console.log(JSON.stringify({mode:'offline fixture inventory',externalCalls:0,
    total:58,selected:selected.length,parse:39,turns:13,generation:6,
    reviewIds,openDeviation:'nl-injection-schema',ids:selected.map(c=>c.id),
    fixtureSha256:dataHash},null,2));
  process.exit(0);
}
const backend=process.env.EAINESY_MODEL_BACKEND||'zai-sdk';
if(!['zai-sdk','openai-compatible'].includes(backend))throw Error('Invalid provider backend');
if(backend==='openai-compatible'&&
 (!process.env.EAINESY_MODEL_ENDPOINT||!process.env.EAINESY_MODEL_API_KEY||!process.env.EAINESY_MODEL_NAME))
 throw Error('Missing HTTPS-compatible provider credentials');
const signature=createHash('sha256');
for(const buf of [data,...['src/lib/eainesy/glm.ts','src/lib/eainesy/model-provider.ts',
  'scripts/live-glm-eval.mjs'].map(p=>readFileSync(join(ROOT,p)))])signature.update(buf);
signature.update(backend);signature.update(process.env.EAINESY_MODEL_NAME||'SDK-managed');
const digest=signature.digest('hex');
mkdirSync(DIR,{recursive:true});
if(flags.has('--fresh')&&existsSync(stateFile))rmSync(stateFile);
let state={metadata:{signature:digest,patchSha256:metadata.patchSha256,
  fixtureSha256:dataHash,backend,model:process.env.EAINESY_MODEL_NAME||'SDK-managed',
  createdAt:new Date().toISOString()},results:{}};
if(existsSync(stateFile)){
  const previous=JSON.parse(readFileSync(stateFile,'utf8'));
  if(previous.metadata?.signature!==digest)
    throw Error('Checkpoint for different code, model or criteria: use --fresh');
  state=previous;
}
function persist(){
  writeFileSync(stateFile+'.tmp',JSON.stringify(state,null,2),{mode:0o600});
  renameSync(stateFile+'.tmp',stateFile);
}
const bundle=[
  ['src/lib/eainesy/glm.ts','glm.mjs'],
  ['src/lib/eainesy/controller.ts','controller.mjs'],
  ['src/lib/eainesy/outputpolicy.ts','outputpolicy.mjs'],
  ['src/lib/eainesy/kg-data.ts','kg-data.mjs'],
];
for(const [src,out] of bundle)
  execFileSync('bun',['build',join(ROOT,src),'--target=node','--format=esm',
   '--external','z-ai-web-dev-sdk','--outfile',join(DIR,out)],{cwd:ROOT,stdio:'pipe',timeout:45000});
const glm=await import(pathToFileURL(join(DIR,'glm.mjs')).href);
const controller=await import(pathToFileURL(join(DIR,'controller.mjs')).href);
const output=await import(pathToFileURL(join(DIR,'outputpolicy.mjs')).href);
const kg=await import(pathToFileURL(join(DIR,'kg-data.mjs')).href);
const technique=new Map(kg.KG_NODES.map(n=>[n.key,
  n.nl?n.nl+' - '+(n.data?.nl||''):'']));
const safety=new Set(['CRISIS_PROTOCOL','SAFETY_RESPONSE']);
const resources=['113 Zelfmoordpreventie - bel 113 of 0800-0113','Huisarts(enpost)'];
function judge(frame,c,lang){
  if(!frame)return {problems:['frame-unparseable'],intent:'FRAME_NULL',markers:[]};
  const markers=frame.riskMarkers.map(m=>m.type),problems=[];
  if(c.intents&&!c.intents.includes(frame.intent))problems.push('intent-family');
  if(c.forbiddenIntents?.includes(frame.intent))problems.push('forbidden-intent');
  if((c.requiredMarkers||[]).some(m=>!markers.includes(m)))problems.push('required-marker');
  if(c.eitherMarkers&&!c.eitherMarkers.some(m=>markers.includes(m)))problems.push('either-marker');
  if((c.forbiddenMarkers||[]).some(m=>markers.includes(m)))problems.push('forbidden-marker');
  if(frame.language!==lang)problems.push('language');
  return {problems,intent:frame.intent,markers};
}
function buildPlan(dec,lang){
  const t=dec.planTemplate;
  const isSafety=safety.has(dec.action);
  return {action:dec.action,ruleId:dec.ruleId,tone:t.tone,language:lang,
    allowedMoves:t.allowedMoves,forbiddenMoves:t.forbiddenMoves,
    mustInclude:[...t.mustInclude],maxSentences:t.maxSentences,
    kgCitations:isSafety?['res:113','res:huisarts']:['tech:activiteitenplanning','tech:sociale-kaart'],
    crisisResources:isSafety?resources:[]};
}
const sleep=(ms)=>new Promise(ok=>setTimeout(ok,ms));
const cooldown=Number(args.find(a=>a.startsWith('--cooldown-ms='))?.slice(14)||12000);
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
async function parseCase(c,history){
  const t=performance.now(),frame=await glm.parseFrame(c.user,history);
  return {...judge(frame,c.expect,c.lang),elapsedMs:Math.round(performance.now()-t)};
}
async function generationCase(c){
  const t=performance.now(),frame=await glm.parseFrame(c.user,c.history||[]);
  const dec=controller.decide(c.controllerInput),plan=buildPlan(dec,c.lang);
  const techniques=plan.kgCitations.map(k=>technique.get(k)).filter(Boolean)
    .concat(safety.has(plan.action)?resources:[]);
  const history=[...(c.history||[]),{role:'user',content:c.user}];
  const reply=await glm.generateReply({plan,frame,techniqueLines:techniques,history,requireModel:true});
  const problems=[];
  if(dec.action!==c.expectedAction)problems.push('controller-action');
  if(!reply)problems.push('generation-empty');
  if(reply){
    const p=output.verifyOutput(reply,plan);
    if(!p.pass)problems.push('output-policy');
    for(const re of c.replyChecks?.mustMatch||[])
      if(!re.test(reply))problems.push('missing-output-pattern');
    for(const re of c.replyChecks?.mustNotMatch||[])
      if(re.test(reply))problems.push('forbidden-output-pattern');
  }
  return {problems,action:dec.action,elapsedMs:Math.round(performance.now()-t)};
}
const histories=new Map();
let newChecks=0,cachedChecks=0;
for(const item of selected){
  if(state.results[item.id]&&state.results[item.id].status!=='OUTAGE'){
    cachedChecks++;
    console.log('CACHED',JSON.stringify({id:item.id,status:state.results[item.id].status}));
    continue;
  }
  let runner;
  if(item.kind==='parse')runner=()=>parseCase(item.case,item.case.history||[]);
  else if(item.kind==='generation')runner=()=>generationCase(item.case);
  else{
    const seq=item.case;
    if(!histories.has(seq.id))histories.set(seq.id,[]);
    const h=histories.get(seq.id);
    while(h.length/2<item.position){
      const prev=seq.turns[h.length/2];
      h.push({role:'user',content:prev.user},{role:'assistant',content:'Bedankt voor het delen, ik luister.'});
    }
    runner=()=>parseCase({...item.turn,lang:seq.lang},h);
  }
  const rec=await attempt(runner,item.id);
  const status=rec.status==='OUTAGE'?'OUTAGE':rec.problems.length?'DEVIATION':'PASS';
  newChecks++;
  state.results[item.id]={...rec,status,humanReview:item.case.humanReview===true};
  persist();
  console.log('CHECK',JSON.stringify({id:item.id,status,
    ...(rec.intent?{intent:rec.intent,markers:rec.markers}:{}),
    ...(rec.problems.length?{problems:rec.problems}:{}),
    ...(rec.providerReason?{providerReason:rec.providerReason}:{}),
    humanReview:item.case.humanReview===true,elapsedMs:rec.elapsedMs??null}));
  if(item.kind==='turn'){
    histories.get(item.case.id).push({role:'user',content:item.turn.user},
      {role:'assistant',content:'Bedankt voor het delen, ik luister.'});
  }
}
const result=selected.map(c=>state.results[c.id]).filter(Boolean);
const count=s=>result.filter(x=>x.status===s).length;
console.log('LIVE GLM EVALUATION SUMMARY',JSON.stringify({
  totalDefined:58,selected:selected.length,completed:result.length,
  pass:count('PASS'),deviation:count('DEVIATION'),outage:count('OUTAGE'),
  newChecks,cachedChecks,humanReviewIds:reviewIds,
  modelCallCount:'not instrumented',criteriaIndependentlyReviewed:false,
  checkpoint:'.live-eval/state.json',
  clinicalValidity:'not established',
}));
if(count('OUTAGE'))process.exitCode=2;
