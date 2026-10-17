/**
 * Timed real-Z3 soak against the unmodified production OS-process boundary.
 * Samples Node and its direct child RSS. Uses only synthetic numeric inputs.
 * Designed to finish within GitHub Actions' job timeout; no external model.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import {certifyDecisionIsolated,z3WorkerStatus,Z3_MAX_CONCURRENT_WORKERS} from '../.next/standalone/z3-isolated-core.mjs';

const durationMs = 180_000;
const deadline = performance.now() + durationMs;
const good = {riskScore:5,claimedLevel:'CRISIS',neuralLevel:'CRISIS',
  lexicalLevel:'NONE',fusedLevel:'CRISIS',confidence:0.8,numericBand:'HIGH'};
const wrong={...good,claimedLevel:'NONE'};
let rounds=0,requests=0,sat=0,unsat=0,skipped=0,wrongResults=0;
let peakChildren=0,peakRssMiB=0,highestQueue=0;
const rssSamples=[];
function sample(){
  const parent = process.memoryUsage().rss;
  const proc = execFileSync('ps',['-eo','ppid=,rss=,args='],{encoding:'utf8'});
  let children=0,childBytes=0;
  for(const row of proc.split('\n')){
    const m=row.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
    if(m&&Number(m[1])===process.pid&&/z3-cert-worker\.mjs/.test(m[3])){
      children++; childBytes+=Number(m[2])*1024;
    }
  }
  const rssMiB=Math.round((parent+childBytes)/1048576);
  peakChildren=Math.max(peakChildren,children);
  peakRssMiB=Math.max(peakRssMiB,rssMiB);
  highestQueue=Math.max(highestQueue,z3WorkerStatus().queued);
  assert.ok(children<=Z3_MAX_CONCURRENT_WORKERS,'Exceeded worker OS process limit');
  assert.ok(rssMiB<2048,'Summed sampled RSS exceeded 2 GiB on CI runner');
  return {children,rssMiB};
}
const start=performance.now();
while(performance.now()<deadline){
  // Exactly 8 concurrent requests keeps the FIFO engaged without overload.
  // Mix positive (SAT) and arithmetic contradiction (UNSAT) verification.
  const tasks=Array.from({length:8},(_,i)=>certifyDecisionIsolated((rounds+i)%4===0?wrong:good));
  await sleep(90);
  if(rounds%10===0)rssSamples.push(sample());
  const results=await Promise.all(tasks);
  assert.equal(results.length,8);
  for(let i=0;i<results.length;i++){
    const expected=(rounds+i)%4===0?'unsat':'sat';
    requests++;
    if(results[i].result==='sat')sat++;
    else if(results[i].result==='unsat')unsat++;
    else if(results[i].result==='skipped')skipped++;
    if(results[i].result!==expected)wrongResults++;
  }
  const st=z3WorkerStatus();
  assert.equal(st.running,0,'Child remained after a complete round');
  assert.equal(st.queued,0,'Queued request remained after a complete round');
  assert.ok(st.peak<=4);
  rounds++;
  if(rounds%50===0){
    console.log('SOAK checkpoint',JSON.stringify({elapsedMs:Math.round(performance.now()-start),rounds,requests,sat,unsat,skipped,wrongResults,peakRssMiB,peakChildren}));
  }
}
const end=sample();
const elapsedMs=Math.round(performance.now()-start);
const firstRss=rssSamples[0]?.rssMiB??end.rssMiB;
const lastRss=end.rssMiB;
console.log('SOAK FINAL',JSON.stringify({
  durationMs:elapsedMs,rounds,requests,sat,unsat,skipped,wrongResults,
  peakRssMiB,firstRssMiB:firstRss,lastRssMiB:lastRss,
  peakChildren,remainingWorkers:z3WorkerStatus().running,
  queued:z3WorkerStatus().queued,samples:rssSamples.length,
}));
assert.ok(rounds>=40,'Too few rounds completed for a valid soak');
assert.equal(wrongResults,0,'Actual Z3 disagreed with deliberately consistent/inconsistent inputs');
assert.equal(skipped,0,'Z3 check was unavailable during continuous moderate load');
assert.equal(z3WorkerStatus().running,0);
assert.equal(z3WorkerStatus().queued,0);
// The sample has natural allocator and OS noise; don't infer a leak from a single delta.
// Report memory trend for human review rather than asserting arbitrary growth thresholds.
console.log('PASS Z3 3-minute real solver soak; memory trend recorded, not certified leak-free');
