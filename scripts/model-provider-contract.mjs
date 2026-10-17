/**
 * Offline adapter contract. No provider credentials, no external requests, no
 * real users. Uses the actual bundled model-provider.ts and glm.ts with a
 * loopback OpenAI-compatible mock server (CI-only HTTP exception).
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {completeModel,completeModelWithStatus,ModelProviderUnavailable} from '../.provider-ci/provider.mjs';
import {parseFrame,generateReply} from '../.provider-ci/glm.mjs';

if(process.env.CI!=='true')throw Error('Contract requires CI=true for local HTTP allowlist');
const stats={parse:0,generate:0,retries:0,repair:0,apiCalls:0};
let providerMode='normal';
let maxReceived=0;
const server=createServer(async(req,res)=>{
  assert.equal(req.method,'POST');
  assert.equal(req.url,'/v1/chat/completions');
  assert.equal(req.headers.authorization,'Bearer ci-local-placeholder');
  let body='';
  for await(const part of req)body+=part.toString();
  assert.ok(body.length<16000,'Unexpectedly large model request');
  const data=JSON.parse(body);
  assert.equal(data.model,'glm-ci-synthetic');
  assert.equal(data.messages[0]?.role,'system');
  stats.apiCalls++;
  maxReceived=Math.max(maxReceived,body.length);
  const isParser=data.messages[0].content.includes('semantic parser');
  if(isParser)stats.parse++;else stats.generate++;
  if(providerMode==='http429'&&stats.retries++===0) {
    res.writeHead(429,{'Content-Type':'application/json'});res.end('{"error":"synthetic rate limit"}');return;
  }
  if(providerMode==='always429') {
    res.writeHead(429,{'Content-Type':'application/json'});res.end('{"error":"synthetic rate limit"}');return;
  }
  if(providerMode==='always-schema-invalid'&&isParser) {
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({choices:[{message:{content:'{"not_a_frame":true}'}}]}));return;
  }
  if(providerMode==='invalid-json-response') {
    res.writeHead(200,{'Content-Type':'application/json'});res.end('not-json');return;
  }
  if(providerMode==='invalid-frame-once'&&isParser&&stats.repair++===0){
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({choices:[{message:{content:'{"wrong":"schema"}'}}]}));return;
  }
  const value=isParser?JSON.stringify({
    intent:'GENERAL_VENT',emotions:[],topics:['technische test'],riskMarkers:[],
    language:'nl',paraphrase:'De gebruiker test fictieve software.',
    parseConfidence:0.91,changeTalk:false,asksForHelp:false,
  }):'Ik heb je technische testbericht ontvangen.';
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({choices:[{message:{content:value}}]}));
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const port=server.address().port;
const saved={...process.env};
process.env.EAINESY_MODEL_BACKEND='openai-compatible';
process.env.EAINESY_MODEL_ENDPOINT='http://127.0.0.1:'+port+'/v1/chat/completions';
process.env.EAINESY_MODEL_NAME='glm-ci-synthetic';
process.env.EAINESY_MODEL_API_KEY='ci-local-placeholder';
const chat=[{role:'assistant',content:'system synthetic instruction'}, {role:'user',content:'hello'}];
try {
  const raw=await completeModel(chat,0.1);
  assert.equal(raw,'Ik heb je technische testbericht ontvangen.');
  console.log('PASS compatible transport with system instruction and bearer-only environment');
  providerMode='http429';stats.retries=0;
  assert.equal(await completeModel(chat,0.1),'Ik heb je technische testbericht ontvangen.');
  assert.equal(stats.retries,2);
  console.log('PASS explicit 429 retry');
  providerMode='always429';
  assert.deepEqual(await completeModelWithStatus(chat,0.1),
    {status:'unavailable',reason:'rate_limited'});
  await assert.rejects(parseFrame('Fictief bericht met uitgevallen provider.',[]),
    e=>e instanceof ModelProviderUnavailable && e.reason==='rate_limited');
  console.log('PASS repeated 429 reports provider unavailable, not a semantically invalid frame');
  providerMode='invalid-json-response';
  assert.equal(await completeModel(chat,0.1),null);
  console.log('PASS malformed provider response fails closed');
  assert.deepEqual(await completeModelWithStatus(chat,0.1),
    {status:'unavailable',reason:'invalid_response'});
  providerMode='always-schema-invalid';
  assert.equal(await parseFrame('Fictief bericht met schemafout.',[]),null);
  console.log('PASS delivered but semantically invalid JSON remains unreadable, NOT an outage');
  providerMode='normal';
  const parsed=await parseFrame('Dit is een technische proef, zonder echte personen.',[]);
  assert.equal(parsed?.intent,'GENERAL_VENT');
  assert.equal(parsed?.language,'nl');
  console.log('PASS real parseFrame validates local provider frame against FrameSchema');
  providerMode='invalid-frame-once';stats.repair=0;
  const repaired=await parseFrame('Dit is een tweede technische proef.',[]);
  assert.equal(repaired?.intent,'GENERAL_VENT');
  assert.equal(stats.repair,2);
  console.log('PASS invalid provider frame triggers one schema repair retry');
  providerMode='normal';
  const gen=await generateReply({
    plan:{action:'LISTEN',tone:'warm',language:'nl',allowedMoves:['reflect'],
      forbiddenMoves:[],kgCitations:[],crisisResources:[],mustInclude:[],maxSentences:3},
    frame:repaired,techniqueLines:[],history:[{role:'user',content:'Testbericht'}],
  });
  assert.equal(gen,'Ik heb je technische testbericht ontvangen.');
  console.log('PASS real generateReply sends binding plan through compatible transport');
  process.env.EAINESY_MODEL_ENDPOINT='http://example.invalid/v1/chat/completions';
  assert.equal(await completeModel(chat,0.1),null);
  console.log('PASS non-loopback plain HTTP endpoint rejected before connection');
  process.env.EAINESY_MODEL_ENDPOINT='http://127.0.0.1:'+port+'/v1/chat/completions';
  delete process.env.EAINESY_MODEL_API_KEY;
  assert.equal(await completeModel(chat,0.1),null);
  assert.deepEqual(await completeModelWithStatus(chat,0.1),
    {status:'unavailable',reason:'invalid_configuration'});
  console.log('PASS missing key fails closed without silently contacting default Z.ai SDK');
  process.env.EAINESY_MODEL_API_KEY='ci-local-placeholder';
  process.env.EAINESY_MODEL_BACKEND='invalid-provider';
  assert.equal(await completeModel(chat,0.1),null);
  console.log('PASS invalid backend fails closed');
  assert.ok(stats.parse>=3);
  assert.ok(stats.generate>=1);
  console.log('MODEL PROVIDER CONTRACT PASS',JSON.stringify({...stats,maxReceived,externalCalls:0}));
}finally {
  for(const key of ['EAINESY_MODEL_BACKEND','EAINESY_MODEL_ENDPOINT','EAINESY_MODEL_API_KEY','EAINESY_MODEL_NAME']){
    if(saved[key]===undefined)delete process.env[key]; else process.env[key]=saved[key];
  }
  server.close();
}
