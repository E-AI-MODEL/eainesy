// Ephemeral GitHub Actions worker fault/load tests, using the actual production
// parent boundary compiled from src/lib/eainesy/z3-isolated.ts.
// Never injects or exposes worker overrides in the live HTTP endpoint.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';
import {certifyDecisionIsolated,z3WorkerStatus,Z3_MAX_CONCURRENT_WORKERS,Z3_WORKER_TIMEOUT_MS} from '../.next/standalone/z3-isolated-core.mjs';

if(process.env.CI!=='true')throw Error('This script changes the built worker: CI only');
const worker='.next/standalone/z3-cert-worker.mjs';
const original=await fs.readFile(worker,'utf8');
const good={
  riskScore:5,claimedLevel:'CRISIS',neuralLevel:'CRISIS',
  lexicalLevel:'NONE',fusedLevel:'CRISIS',confidence:0.8,numericBand:'HIGH',
};
const invalid={...good,claimedLevel:'NONE'};
const now=()=>performance.now();
async function drained(){
  for(let i=0;i<50;i++){
    if(z3WorkerStatus().running===0)return;
    await sleep(20);
  }
  throw Error('Child process count did not drain: '+JSON.stringify(z3WorkerStatus()));
}
async function check(name,task){
  const start=now();
  await task();
  await drained();
  console.log('PASS '+name+' '+Math.round(now()-start)+'ms; active='+z3WorkerStatus().running);
}
try{
  assert.equal(Z3_MAX_CONCURRENT_WORKERS,4);
  assert.equal(Z3_WORKER_TIMEOUT_MS,5000);
  await check('real Z3 certificate: consistent -> SAT',async()=>{
    const c=await certifyDecisionIsolated(good);
    assert.equal(c.available,true,JSON.stringify(c));
    assert.equal(c.result,'sat',JSON.stringify(c));
  });
  await check('real Z3 certificate: inconsistent -> UNSAT',async()=>{
    const c=await certifyDecisionIsolated(invalid);
    assert.equal(c.result,'unsat',JSON.stringify(c));
  });
  await fs.writeFile(worker,"process.stderr.write('synthetic crash\\n');process.exit(72);");
  await check('unexpected worker exit is isolated',async()=>{
    const c=await certifyDecisionIsolated(good);
    assert.equal(c.result,'skipped');
    assert.match(c.detail,/terminated/);
  });
  await fs.writeFile(worker,"process.stdout.write('{not-json}\\n',()=>process.exit(0));");
  await check('malformed worker certificate rejected',async()=>{
    const c=await certifyDecisionIsolated(good);
    assert.equal(c.result,'skipped');
    assert.match(c.detail,/malformed/);
  });
  await fs.writeFile(worker,"setInterval(()=>{},1000);");
  await check('hung worker force-killed on deadline; no orphan',async()=>{
    const start=now();
    const c=await certifyDecisionIsolated(good);
    assert.equal(c.result,'skipped');
    assert.match(c.detail,/deadline/);
    assert.ok(now()-start<7000);
  });
  await check('parallelism cap during 12 simultaneous hanging requests',async()=>{
    const start=now();
    const certs=await Promise.all(Array.from({length:12},()=>certifyDecisionIsolated(good)));
    assert.equal(certs.length,12);
    assert.ok(certs.every(c=>c.result==='skipped'));
    const overloaded=certs.filter(c=>/busy/.test(c.detail)).length;
    const killed=certs.filter(c=>/deadline/.test(c.detail)).length;
    assert.equal(overloaded,8,'Expected 8 fast overload abstentions');
    assert.equal(killed,4,'Expected exactly 4 bounded workers');
    assert.ok(now()-start<7000,'Parallel timeouts should not serialize');
    console.log('Worker overload details:',JSON.stringify({overloaded,killed,elapsedMs:Math.round(now()-start)}));
  });
  await fs.writeFile(worker,original);
  await check('recovery after killed processes (real Z3 SAT)',async()=>{
    const c=await certifyDecisionIsolated(good);
    assert.equal(c.result,'sat',JSON.stringify(c));
  });
  await check('12 real concurrent requests are bounded and never trusted without SAT',async()=>{
    const start=now();
    const certs=await Promise.all(Array.from({length:12},()=>certifyDecisionIsolated(good)));
    const sat=certs.filter(c=>c.result==='sat').length;
    const unavailable=certs.filter(c=>c.result==='skipped').length;
    assert.equal(sat+unavailable,12);
    assert.equal(sat,4,'Exactly four workers should run at once');
    assert.equal(unavailable,8,'Overload should abstain, not queue indefinitely');
    assert.ok(certs.every(c=>c.result!=='sat'||c.available));
    console.log('Real concurrent worker stats:',JSON.stringify({sat,unavailable,elapsedMs:Math.round(now()-start),rssMiB:Math.round(process.memoryUsage().rss/1048576)}));
  });
  console.log('Z3 ISOLATION: ALL TESTS PASSED');
}finally{
  await fs.writeFile(worker,original);
}
