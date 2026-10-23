import test from "node:test";
import assert from "node:assert/strict";
import {makeOpenAISandboxClient,OPENAI_SANDBOX_MODEL}
  from "./openai-sandbox-client.mjs";

const FAKE_KEY="sk-proj-UNIT-TEST-ONLY-DO-NOT-USE";
const REVIEW='{"decision":"KEEP","issue":"NONE","userEvidence":"","draftEvidence":"","move":"QUESTION","reason":"No change needed.","revisedDraft":""}';
const makeResult=(text=REVIEW,override={})=>({
  status:"completed",
  output:[{type:"message",role:"assistant",
    content:[{type:"output_text",text}]}],
  usage:{input_tokens:140,output_tokens:62},
  ...override
});
const respond=(data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{"content-type":"application/json"}
});
const request=()=>({system:"Return strict JSON.",user:'{"test":"fixture"}',
  temperature:0,maxOutputTokens:650});

test("no key and unapproved model fail before any network request",()=>{
  let called=false;
  const fetchFn=async()=>{called=true;throw Error("should not call network");};
  for(const apiKey of [null,"",undefined,"not-a-key"]){
    assert.throws(()=>makeOpenAISandboxClient({apiKey,fetchFn}),/project key/);
  }
  assert.throws(()=>makeOpenAISandboxClient({
    apiKey:FAKE_KEY,model:"gpt-6-astra",fetchFn
  }),/only the approved/);
  assert.equal(called,false);
});

test("OpenAI request uses fixed Responses endpoint, one key in header and store:false",async()=>{
  let calls=0;
  const fetchFn=async(url,opts)=>{
    calls++;
    assert.equal(url,"https://api.openai.com/v1/responses");
    assert.equal(opts.redirect,"error");
    assert.equal(opts.method,"POST");
    assert.equal(opts.headers.Authorization,"Bearer "+FAKE_KEY);
    const sent=JSON.parse(opts.body);
    assert.equal(sent.model,OPENAI_SANDBOX_MODEL);
    assert.equal(sent.store,false);
    assert.equal(sent.stream,false);
    assert.equal(sent.max_output_tokens,800);
    assert.equal(sent.input,request().user);
    assert.equal(sent.instructions,request().system);
    assert.equal(sent.text.format.type,"json_schema");
    assert.equal(sent.text.format.strict,true);
    assert.equal(sent.text.format.schema.additionalProperties,false);
    assert.ok(sent.text.format.schema.required.includes("revisedDraft"));
    assert.equal(sent.tools,undefined);
    return respond(makeResult());
  };
  const client=makeOpenAISandboxClient({apiKey:FAKE_KEY,fetchFn});
  assert.equal(await client.complete(request()),REVIEW);
  assert.equal(calls,1);
  assert.equal(client.snapshot().requests,1);
  assert.equal(client.snapshot().successful,1);
  assert.equal(client.snapshot().failed,0);
  assert.equal(client.snapshot().perCall[0].promptTokens,140);
  assert.equal(client.snapshot().perCall[0].completionTokens,62);
  assert.ok(!JSON.stringify(client.snapshot()).includes(FAKE_KEY));
});

test("a hard two-request maximum blocks any third call without attempting fetch",async()=>{
  let calls=0;
  const client=makeOpenAISandboxClient({
    apiKey:FAKE_KEY,fetchFn:async()=>{calls++;return respond(makeResult());}
  });
  await client.complete(request());
  await client.complete(request());
  await assert.rejects(client.complete(request()),/two-call hard limit/);
  assert.equal(calls,2);
  assert.equal(client.snapshot().requests,2);
});

test("HTTP auth failure leaks no credentials and does not retry",async()=>{
  let calls=0;
  const client=makeOpenAISandboxClient({
    apiKey:FAKE_KEY,
    fetchFn:async()=>{calls++;return respond({error:{message:FAKE_KEY}},401);}
  });
  let message="";
  try {await client.complete(request());}
  catch(e){message=String(e?.message);}
  assert.match(message,/HTTP 401/);
  assert.ok(!message.includes(FAKE_KEY));
  assert.equal(calls,1);
  assert.equal(client.snapshot().failed,1);
});

test("model refusal, incomplete result and malformed data all fail without a second call",async()=>{
  const invalid=[
    makeResult("",{status:"incomplete"}),
    {status:"completed",output:[{type:"message",content:[{type:"refusal",refusal:"No"}]}]},
    {status:"completed",output:"bad"}
  ];
  for(const body of invalid){
    let calls=0;
    const client=makeOpenAISandboxClient({
      apiKey:FAKE_KEY,
      fetchFn:async()=>{calls++;return respond(body);}
    });
    await assert.rejects(client.complete(request()),/OpenAI sandbox/);
    assert.equal(calls,1);
    assert.equal(client.snapshot().failed,1);
  }
});

test("oversized model response, oversized request and invalid timeout are rejected",async()=>{
  assert.throws(()=>makeOpenAISandboxClient({
    apiKey:FAKE_KEY,timeoutMs:60000
  }),/timeout/);
  let calls=0;
  const client=makeOpenAISandboxClient({
    apiKey:FAKE_KEY,
    fetchFn:async()=>{calls++;return respond(makeResult("A".repeat(55000)));}
  });
  await assert.rejects(client.complete(request()),/response too large/);
  assert.equal(calls,1);
  const second=makeOpenAISandboxClient({
    apiKey:FAKE_KEY,
    fetchFn:async()=>{throw Error("should not fetch");}
  });
  await assert.rejects(second.complete({
    system:"S".repeat(7001),user:"x"
  }),/bounded review input/);
  assert.equal(second.snapshot().requests,0);
});
