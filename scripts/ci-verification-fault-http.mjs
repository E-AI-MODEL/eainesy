// CI-only fault injection: modifies only the disposable checkout before rebuilding.
// These fault switches do NOT exist in the published application.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import { PrismaClient } from '@prisma/client';

const z3file='src/lib/eainesy/z3cert.ts';
const modelfile='src/lib/eainesy/modelchecker.ts';
const z3original=await fs.readFile(z3file,'utf8');
const modeloriginal=await fs.readFile(modelfile,'utf8');
// This fault-injection script changes the disposable CI checkout only.
if (process.env.CI !== 'true') throw Error('Fault injection is CI-only');

// A working LOCAL model stub is required to actually reach the intended
// verification faults. Without it the chat API correctly abstains earlier
// with "model_unavailable", making the Z3 tests accidentally test outages.
const providerCalls={parse:0,generate:0,failed:0};
const mockProvider=createServer(async (request,response)=>{
  try {
    assert.equal(request.method,'POST');
    assert.equal(request.url,'/v1/chat/completions');
    assert.equal(request.headers.authorization,'Bearer ci-local-verifier-fixture');
    let raw='';
    for await (const part of request) {
      raw+=part.toString('utf8');
      assert.ok(raw.length<=150_000,'oversized synthetic provider request');
    }
    const body=JSON.parse(raw);
    assert.equal(body.messages?.[0]?.role,'system');
    const prompt=body.messages?.[0]?.content;
    assert.ok(typeof prompt==='string');
    if (!prompt.includes('semantic parser')) {
      providerCalls.generate++;
      // Verification must stop before answer generation in all four cases.
      response.writeHead(503,{'Content-Type':'application/json'});
      response.end('{"error":"unexpected generation during verification fault"}');
      return;
    }
    providerCalls.parse++;
    // Known-neutral, schema-valid *fictional* frame. No human data,
    // model keys, external calls, risk downgrade or safety bypass.
    const frame={
      intent:'GENERAL_VENT',
      emotions:[],
      topics:['softwaretest'],
      riskMarkers:[],
      language:'nl',
      paraphrase:'Een fictief testbericht over verificatie.',
      parseConfidence:0.92,
      changeTalk:false,
      asksForHelp:false,
    };
    response.writeHead(200,{'Content-Type':'application/json'});
    response.end(JSON.stringify({choices:[{message:{content:JSON.stringify(frame)}}]}));
  }catch{
    providerCalls.failed++;
    response.writeHead(500,{'Content-Type':'application/json'});
    response.end('{"error":"invalid local fixture request"}');
  }
});
mockProvider.listen(0,'127.0.0.1');
await once(mockProvider,'listening');
const address=mockProvider.address();
assert.ok(address && typeof address!=='string','local provider must listen on IPv4 loopback');
const providerUrl='http://127.0.0.1:'+address.port+'/v1/chat/completions';
const db=new PrismaClient();
const cases=[['unsat','z3_inconsistent'],['unknown','z3_inconclusive'],['skipped','z3_unavailable'],['modelcheck_failed','modelcheck_failed']];
const code=(mode)=>[
"export interface Z3Certificate { available: boolean; result: 'sat'|'unsat'|'unknown'|'skipped'; ms: number; detail: string; }",
"export const CONFIDENCE_BAND_THRESHOLDS = {HIGH:0.7,MEDIUM:0.45} as const;",
"export const Z3_DEADLINE_MS = 5000;",
"export async function certifyDecision(..._unused:unknown[]):Promise<Z3Certificate> {",
"return { available:"+String(mode!=='skipped')+", result:'"+mode+"', ms:0, detail:'ephemeral CI simulation' };",
"}",
].join('\n');
async function boot(port){
  const logs=[];
  const child=spawn(process.execPath,['.next/standalone/server.js'],{
    env:{
      ...process.env,PORT:String(port),HOSTNAME:'127.0.0.1',NODE_ENV:'production',
      // The real server connects ONLY to the local synthetic provider.
      EAINESY_MODEL_BACKEND:'openai-compatible',
      EAINESY_MODEL_ENDPOINT:providerUrl,
      EAINESY_MODEL_NAME:'ci-verification-fixture',
      EAINESY_MODEL_API_KEY:'ci-local-verifier-fixture',
      EAINESY_ABC_SHADOW_ENABLED:'false',
    },stdio:['ignore','pipe','pipe']});
  for(const s of [child.stdout,child.stderr])s.on('data',b=>logs.push(String(b)));
  const base='http://127.0.0.1:'+port;
  for(let i=0;i<60;i++){
    if(child.exitCode!==null)throw Error('Server exited '+logs.join('').slice(-3000));
    try{const r=await fetch(base+'/api/verify',{signal:AbortSignal.timeout(2500)});if(r.ok)return {child,base,logs};}catch{}
    await sleep(400);
  }
  child.kill('SIGKILL');
  throw Error('Server startup timeout '+logs.join('').slice(-3000));
}
async function stop(child){if(child.exitCode===null)child.kill('SIGKILL');await sleep(200);}
try{
  for(let i=0;i<cases.length;i++){
    const [mode,expected]=cases[i];
    console.log('START fault '+mode);
    await fs.writeFile(z3file,mode==='modelcheck_failed'?z3original:code(mode));
    await fs.writeFile(modelfile,mode==='modelcheck_failed'?modeloriginal.replace('return cachedReport;','return { ...cachedReport, pass:false };'):modeloriginal);
    execFileSync('bun',['run','build'],{stdio:'inherit',timeout:110000});
    const s=await boot(3200+i);
    try{
      const parseBefore=providerCalls.parse;
      const before=await db.turn.count();
      const audit=await db.auditEntry.count({where:{stage:'turn.verification_blocked'}});
      const response=await fetch(s.base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Hallo, controleer dit testbericht.',uiLang:'nl'}),signal:AbortSignal.timeout(13000)});
      const x=await response.json();
      console.log(JSON.stringify({mode,status:response.status,failClosed:x.failClosed,action:x.action,verification:x.verification}));
      assert.equal(response.status,200);
      assert.equal(x.failClosed,true);
      assert.equal(x.action,'ABSTAIN_HITL');
      assert.equal(x.verification?.reason,expected);
      assert.equal(providerCalls.parse,parseBefore+1,
        'Local model parser was not used exactly once before verification');
      assert.equal(providerCalls.generate,0,
        'Verification must stop before model reply generation');
      assert.equal(providerCalls.failed,0,
        'Synthetic provider must not fail or mask verification behavior');
      assert.equal(x.verification?.humanReviewQueued,false);
      assert.ok(!('certificate' in x));
      if(mode!=='modelcheck_failed')assert.equal(x.verification?.z3?.result,mode);
      assert.equal(await db.turn.count(),before,'unverified turn persisted');
      assert.equal(await db.auditEntry.count({where:{stage:'turn.verification_blocked'}}),audit+1,'missing audit entry');
      console.log('PASS HTTP fault '+mode);
    }catch(e){console.error(s.logs.join('').slice(-3000));throw e}
    finally{await stop(s.child)}
  }
  console.log('PASS 4/4 real HTTP abstentions with ephemeral fault injection');
}finally{
  await fs.writeFile(z3file,z3original);
  await fs.writeFile(modelfile,modeloriginal);
  await db.$disconnect();
  await new Promise((resolve,reject)=>mockProvider.close(err=>err?reject(err):resolve()));
}
