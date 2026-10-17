/**
 * Synthetic end-to-end GLM transport integration:
 * Next.js HTTP -> GLM parser -> symbolic controller -> real isolated Z3 ->
 * GLM generation -> output policy -> recorded certificate.
 *
 * Uses a local OpenAI-compatible HTTP stub. Never sends user data or secrets
 * externally. DOES NOT establish real-model recognition quality.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';

if(process.env.CI!=='true')throw Error('Synthetic HTTP server requires CI');
const stats={total:0,parse:0,generate:0,frameRepair:0};
let corruptOnce=false;
const mock=createServer(async(req,res)=>{
  assert.equal(req.method,'POST');
  assert.equal(req.headers.authorization,'Bearer ci-synthetic-not-a-secret');
  let raw='';
  for await(const chunk of req)raw+=String(chunk);
  const input=JSON.parse(raw);
  const system=input.messages?.[0]?.content||'';
  assert.equal(input.messages?.[0]?.role,'system');
  stats.total++;
  const parser=system.includes('semantic parser');
  if(parser)stats.parse++; else stats.generate++;
  let text;
  if(parser){
    if(corruptOnce){
      corruptOnce=false;stats.frameRepair++;
      text='not valid JSON';
    }else {
      text=JSON.stringify({
        intent:'GENERAL_VENT',emotions:[],topics:['softwaretest'],
        riskMarkers:[],language:'nl',
        paraphrase:'Er is een fictief softwaretestbericht.',
        parseConfidence:0.93,changeTalk:false,asksForHelp:false,
      });
    }
  }else {
    text='Ik heb je technische testbericht ontvangen. Wat wil je hierover delen?';
  }
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({choices:[{message:{content:text}}]}));
});
mock.listen(0,'127.0.0.1');
await once(mock,'listening');
const host=mock.address();
const modelEndpoint='http://127.0.0.1:'+host.port+'/v1/chat/completions';
const stdout=[];
let child;
try{
  child=spawn(process.execPath,['.next/standalone/server.js'],{
    env:{...process.env,PORT:'3000',HOSTNAME:'127.0.0.1',NODE_ENV:'production',
      EAINESY_MODEL_BACKEND:'openai-compatible',EAINESY_MODEL_ENDPOINT:modelEndpoint,
      EAINESY_MODEL_API_KEY:'ci-synthetic-not-a-secret',EAINESY_MODEL_NAME:'synthetic-glm'},
    stdio:['ignore','pipe','pipe'],
  });
  for(const stream of [child.stdout,child.stderr])stream.on('data',x=>{
    stdout.push(String(x));if(stdout.length>100)stdout.shift();
  });
  const base='http://127.0.0.1:3000';
  let ready=false;
  for(let n=0;n<90;n++){
    if(child.exitCode!==null)throw Error('Server exited: '+stdout.join(''));
    try{
      const r=await fetch(base+'/api/verify',{signal:AbortSignal.timeout(1000)});
      if(r.ok){ready=true;break;}
    }catch{}
    await sleep(350);
  }
  assert.ok(ready,'Next.js did not start: '+stdout.join(''));
  for(let n=0;n<2;n++){
    if(n===1)corruptOnce=true;
    const before={...stats};
    const response=await fetch(base+'/api/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:'Fictief testgesprek: ik wil deze demonstratie controleren. '+n,uiLang:'nl'}),
      signal:AbortSignal.timeout(45000),
    });
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.failClosed??false,false,'Unexpected fail-closed result '+JSON.stringify(body));
    assert.equal(body.certificate?.z3?.result,'sat','No real isolated Z3 SAT');
    assert.equal(body.certificate?.z3?.available,true);
    assert.equal(body.certificate?.modelCheck?.pass,true);
    assert.ok(typeof body.reply==='string'&&body.reply.length>0);
    assert.ok(stats.parse>before.parse,'Parser did not call mock GLM transport');
    assert.ok(stats.generate>before.generate,'Generator did not call mock GLM transport');
    if(n===1)assert.equal(stats.frameRepair,1,'Parser repair was not exercised');
    console.log('PASS GLM+real Z3 full HTTP turn',JSON.stringify({
      scenario:n===0?'normal':'schema-repair',z3:body.certificate.z3.result,
      action:body.action,outputPolicy:body.certificate.outputPolicy?.pass,
      repaired:body.certificate.outputPolicy?.repaired,
      mockParseCalls:stats.parse-before.parse,mockGenerateCalls:stats.generate-before.generate,
    }));
  }
  console.log('E2E SYNTHETIC GLM PROVIDER PASS',JSON.stringify(stats));
} catch(error){
  console.error(stdout.join('').slice(-4000));
  throw error;
}finally{
  if(child&&child.exitCode===null)child.kill('SIGKILL');
  mock.close();
}
