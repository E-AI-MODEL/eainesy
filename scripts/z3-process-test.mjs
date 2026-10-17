// Ephemeral GitHub Actions worker fault/load tests, using the actual production
// parent boundary compiled from src/lib/eainesy/z3-isolated.ts.
// Never injects or exposes worker overrides in the live HTTP endpoint.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';
import {certifyDecisionIsolated,z3WorkerStatus,Z3_MAX_CONCURRENT_WORKERS,Z3_WORKER_TIMEOUT_MS,Z3_MAX_QUEUED_REQUESTS,Z3_QUEUE_WAIT_MS} from '../.next/standalone/z3-isolated-core.mjs';

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
  assert.equal(Z3_MAX_QUEUED_REQUESTS,8);
  assert.equal(Z3_QUEUE_WAIT_MS,2000);
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
  await check('FIFO cap and queue wait deadline with 14 simultaneous hangs',async()=>{
    const start=now();
    const certs=await Promise.all(Array.from({length:14},()=>certifyDecisionIsolated(good)));
    assert.equal(certs.length,14);
    assert.ok(certs.every(c=>c.result==='skipped'));
    const full=certs.filter(c=>/queue at capacity/.test(c.detail)).length;
    const waited=certs.filter(c=>/queue wait deadline/.test(c.detail)).length;
    const killed=certs.filter(c=>/worker exceeded/.test(c.detail)).length;
    assert.equal(full,2,'Queue may hold only eight requests after four active workers');
    assert.equal(waited,8,'Every queued request has a finite 2000ms wait');
    assert.equal(killed,4,'Four workers must be killed after their 5000ms deadline');
    assert.ok(now()-start<7000,'Worker hangs and queue waits must not serialize');
    assert.ok(z3WorkerStatus().peak<=4);
    console.log('Hanging burst:',JSON.stringify({full,waited,killed,elapsedMs:Math.round(now()-start)}));
  });
  await fs.writeFile(worker,original);
  await check('recovery after killed processes (real Z3 SAT)',async()=>{
    const c=await certifyDecisionIsolated(good);
    assert.equal(c.result,'sat',JSON.stringify(c));
  });
  const stub=[
    "let text='';",
    "for await (const c of process.stdin) text+=c.toString();",
    "const input=JSON.parse(text);",
    "setTimeout(()=>process.stdout.write(JSON.stringify({available:true,result:'sat',ms:0,detail:'synthetic FIFO test id '+input.riskScore})+'\\n',()=>process.exit(0)),130);",
  ].join('\n');
  await fs.writeFile(worker,stub);
  await check('short burst is queued FIFO rather than dropped',async()=>{
    const started=now();
    const certs=await Promise.all(Array.from({length:12},(_,i)=>
      certifyDecisionIsolated({...good,riskScore:i+1})));
    assert.equal(certs.length,12);
    assert.ok(certs.every(c=>c.result==='sat'));
    assert.ok(certs.every((c,i)=>c.detail==='synthetic FIFO test id '+(i+1)));
    assert.ok(now()-started<Z3_QUEUE_WAIT_MS+1500);
    console.log('Synthetic FIFO burst:',JSON.stringify({sat:certs.length,elapsedMs:Math.round(now()-started)}));
  });
  await fs.writeFile(worker,original);
  await check('12 real concurrent requests: SAT or explicit bounded abstention',async()=>{
    const start=now();
    const certs=await Promise.all(Array.from({length:12},()=>certifyDecisionIsolated(good)));
    const sat=certs.filter(c=>c.result==='sat').length;
    const unavailable=certs.filter(c=>c.result==='skipped').length;
    assert.equal(sat+unavailable,12);
    assert.ok(sat>=4,'The initial four workers should produce real certificates');
    assert.ok(certs.every(c=>c.result!=='sat'||c.available));
    assert.ok(z3WorkerStatus().peak<=4);
    console.log('Real concurrent:',JSON.stringify({sat,unavailable,elapsedMs:Math.round(now()-start),rssMiB:Math.round(process.memoryUsage().rss/1048576)}));
  });
  await check('soak: 20 rounds of 8 real worker requests, no active children left',async()=>{
    const start=now();
    const rssBefore=process.memoryUsage().rss;
    let sat=0, skipped=0;
    for(let round=0;round<20;round++){
      const results=await Promise.all(Array.from({length:8},()=>certifyDecisionIsolated(good)));
      sat += results.filter(c=>c.result==='sat'&&c.available).length;
      skipped += results.filter(c=>c.result==='skipped').length;
      assert.equal(results.length,8);
      assert.ok(results.every(c=>c.result==='sat'||c.result==='skipped'));
      await drained();
      assert.equal(z3WorkerStatus().queued,0);
      assert.equal(z3WorkerStatus().running,0);
      assert.ok(z3WorkerStatus().peak<=4);
    }
    const rssAfter=process.memoryUsage().rss;
    console.log('Real worker soak:',JSON.stringify({
      rounds:20,requests:160,sat,skipped,
      elapsedMs:Math.round(now()-start),
      parentRssBeforeMiB:Math.round(rssBefore/1048576),
      parentRssAfterMiB:Math.round(rssAfter/1048576),
      peakWorkers:z3WorkerStatus().peak,remainingWorkers:z3WorkerStatus().running,
    }));
    assert.ok(sat>=140,'Too many genuine Z3 abstentions in modest repeated load');
    // Parent RSS excludes children. This is a regression observation, not a
    // total memory guarantee for a different host or deployment.
    assert.ok(rssAfter<1024*1024*1024,'Node parent RSS exceeded 1 GiB in the CI soak');
  });
  console.log('Z3 ISOLATION: ALL TESTS PASSED');
}finally{
  await fs.writeFile(worker,original);
}
