import test from "node:test";
import assert from "node:assert/strict";
import {createP03Client,P03_LIMITS,P03_MODEL} from "./p03-api-client.mjs";
const key="sk-"+"x".repeat(35);
const response=(s="{}")=>new Response(JSON.stringify({
  choices:[{message:{content:s},finish_reason:"stop"}],
  usage:{prompt_tokens:100,completion_tokens:24}
}),{status:200,headers:{"Content-Type":"application/json"}});
test("one GPT-5 request has JSON mode, store false, no tools or retries",async()=>{
  const seen=[];
  const c=createP03Client({apiKey:key,fetchFn:async(url,request)=>{
    seen.push({url,request});return response();
  }});
  assert.equal(await c.complete({phase:"recheck",system:"Provide an exact citation when known.",input:"Current user said Noor."}),"{}");
  const b=JSON.parse(seen[0].request.body);
  assert.equal(seen.length,1);
  assert.equal(seen[0].url,"https://api.openai.com/v1/chat/completions");
  assert.equal(seen[0].request.redirect,"error");
  assert.equal(b.model,P03_MODEL);
  assert.equal(b.store,false);
  assert.equal(b.stream,false);
  assert.equal(b.reasoning_effort,"minimal");
  assert.equal(b.response_format.type,"json_object");
  assert.equal("tools" in b,false);
  assert.equal("temperature" in b,false);
  assert.equal(c.snapshot().inputTokens,100);
  assert.equal(c.snapshot().outputTokens,24);
});

test("recheck phase limited to eight, reply limited to eight, 16 total",async()=>{
  let n=0;
  const c=createP03Client({apiKey:key,fetchFn:async()=>{n++;return response();}});
  for(let i=0;i<8;i++)await c.complete({phase:"recheck",system:"Return a short structured JSON answer.",input:"String with enough content."});
  await assert.rejects(c.complete({phase:"recheck",system:"Return a short structured JSON answer.",input:"String with enough content."}),/cap/);
  for(let i=0;i<8;i++)await c.complete({phase:"reply",system:"Return a short structured JSON answer.",input:"String with enough content."});
  await assert.rejects(c.complete({phase:"reply",system:"Return a short structured JSON answer.",input:"String with enough content."}),/cap/);
  assert.deepEqual(c.snapshot().perPhase,{recheck:8,reply:8});
  assert.equal(P03_LIMITS.total,16);
  assert.equal(n,16);
});

test("upstream failures are one call and never repeat automatically",async()=>{
  let n=0;
  const c=createP03Client({apiKey:key,fetchFn:async()=>{n++;return new Response("no",{status:429});}});
  await assert.rejects(c.complete({phase:"recheck",system:"Return a short structured JSON answer.",input:"String with enough content."}),/HTTP 429/);
  assert.equal(n,1);
  assert.equal(c.snapshot().failed,1);
  assert.equal(c.snapshot().ledger[0].httpStatus,429);
});

test("invalid phases and oversized inputs fail before a paid request",async()=>{
  const c=createP03Client({apiKey:key,fetchFn:async()=>{throw Error("should never call");}});
  await assert.rejects(c.complete({phase:"judge",system:"Return a short structured JSON answer.",input:"String with enough content."}),/unapproved/);
  await assert.rejects(c.complete({phase:"reply",system:"Return a short structured JSON answer.",input:"a".repeat(9000)}),/bounded/);
  assert.equal(c.snapshot().calls,0);
  assert.throws(()=>createP03Client({apiKey:"sk-invalid"}));
});
