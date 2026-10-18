#!/usr/bin/env node
/**
 * One opt-in real SDK access probe, no user data, no model text in logs.
 * Usage: node scripts/glm-access-probe.mjs --live --accept-costs
 */
import {createRequire} from 'node:module';
const flags=new Set(process.argv.slice(2));
if(!flags.has('--live')||!flags.has('--accept-costs')){
  console.error('This makes a real provider call; add --live --accept-costs');
  process.exit(2);
}
const backend=process.env.EAINESY_MODEL_BACKEND||'zai-sdk';
const user=[{role:'assistant',content:'You are a terse software test responder. Reply using one word.'},
  {role:'user',content:'For this fictional test, reply OK.'}];
const time=performance.now();
if(backend==='zai-sdk'){
  const sdk=(await import('z-ai-web-dev-sdk')).default;
  const client=await sdk.create();
  const response=await client.chat.completions.create({messages:user,thinking:{type:'disabled'}});
  const text=response?.choices?.[0]?.message?.content;
  if(typeof text!=='string'||!text.trim())throw Error('Provider returned empty content');
  console.log(JSON.stringify({ok:true,backend,model:response.model||'SDK-managed',
    durationMs:Math.round(performance.now()-time),
    contentRecorded:false,synthetic:true}));
}else if(backend==='openai-compatible'){
  const key=process.env.EAINESY_MODEL_API_KEY;
  const endpoint=process.env.EAINESY_MODEL_ENDPOINT;
  const model=process.env.EAINESY_MODEL_NAME;
  if(!key||!endpoint||!model)throw Error('Missing model server configuration');
  const url=new URL(endpoint);
  if(url.protocol!=='https:')throw Error('Probe requires HTTPS');
  const res=await fetch(url,{method:'POST',redirect:'error',
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({model,messages:[
      {role:'system',content:user[0].content},{role:'user',content:user[1].content}]}),
    signal:AbortSignal.timeout(20000)});
  if(!res.ok)throw Error('Provider HTTP status '+res.status);
  const out=await res.json();
  if(typeof out.choices?.[0]?.message?.content!=='string')throw Error('No model content');
  console.log(JSON.stringify({ok:true,backend,model,
    durationMs:Math.round(performance.now()-time),contentRecorded:false,synthetic:true}));
}else throw Error('Unknown backend');
