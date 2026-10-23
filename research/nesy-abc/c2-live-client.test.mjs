import test from "node:test";
import assert from "node:assert/strict";
import {makeC2LiveClient,C2_LIVE_MAX_CALLS,C2_LIVE_MODEL} from "./c2-live-client.mjs";
const key="sk-"+"x".repeat(30);
function response(body){
  return new Response(JSON.stringify({choices:[{message:{content:body}}],
    usage:{prompt_tokens:20,completion_tokens:12}}),
    {status:200,headers:{"Content-Type":"application/json"}});
}
test("C2 client uses the exact approved GPT model, no tools, storage or retries",async()=>{
  const inputs=[];
  const c=makeC2LiveClient({apiKey:key,fetchFn:async(url,req)=>{
    inputs.push({url,req});return response('{"claims":[]}');
  }});
  assert.equal(await c.complete({instructions:"Return JSON.",input:'{"current":"Hallo"}'}),'{"claims":[]}');
  assert.equal(inputs.length,1);
  assert.equal(inputs[0].url,"https://api.openai.com/v1/chat/completions");
  assert.equal(inputs[0].req.redirect,"error");
  const b=JSON.parse(inputs[0].req.body);
  assert.equal(b.model,C2_LIVE_MODEL);
  assert.equal(b.store,false);
  assert.equal(b.stream,false);
  assert.equal(b.n,1);
  assert.equal(b.response_format.type,"json_object");
  assert.equal("tools" in b,false);
  assert.equal("temperature" in b,false);
  assert.equal(c.snapshot().requests,1);
  assert.equal(c.snapshot().inputTokens,20);
});
test("C2 client enforces ten calls even if model keeps returning success",async()=>{
  let requests=0;
  const c=makeC2LiveClient({apiKey:key,fetchFn:async()=>{
    requests++;return response('{"claims":[]}');
  }});
  for(let i=0;i<C2_LIVE_MAX_CALLS;i++)
    await c.complete({instructions:"Return JSON.",input:"Hello"});
  await assert.rejects(c.complete({instructions:"Return JSON.",input:"Hello"}),/cap/);
  assert.equal(requests,10);
});
test("C2 client treats upstream errors as failed calls, with no retry",async()=>{
  let requests=0;
  const c=makeC2LiveClient({apiKey:key,fetchFn:async()=>{
    requests++;return new Response("SECRET MUST NOT BE READ",{status:429});
  }});
  await assert.rejects(c.complete({instructions:"Return JSON.",input:"Hello"}),/HTTP 429/);
  assert.equal(requests,1);
  assert.equal(c.snapshot().failed,1);
  assert.equal(c.snapshot().perCall[0].httpStatus,429);
});
test("C2 client rejects unbounded or malformed configuration",async()=>{
  assert.throws(()=>makeC2LiveClient({apiKey:"not-a-key"}));
  const c=makeC2LiveClient({apiKey:key,fetchFn:async()=>response("{}")});
  await assert.rejects(c.complete({instructions:"X".repeat(7000),input:"Hello"}));
  assert.equal(c.snapshot().requests,0);
});
