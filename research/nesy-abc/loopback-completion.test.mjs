import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {once} from "node:events";
import {createLoopbackCompletion,validateLoopbackEndpoint} from "./loopback-completion.mjs";

async function withServer(handler,fn) {
  const srv=createServer(handler);
  srv.listen(0,"127.0.0.1");
  await once(srv,"listening");
  const addr=srv.address();
  assert.ok(addr && typeof addr!=="string");
  const endpoint="http://127.0.0.1:"+addr.port+"/v1/chat/completions";
  try {await fn(endpoint);}
  finally {await new Promise((resolve,reject)=>srv.close(err=>err?reject(err):resolve()));}
}
const REQUEST={system:"Research-only instructions",user:'{"phase":"post-concept"}',
  temperature:0,maxOutputTokens:650};
const ok=(review="{}")=>JSON.stringify({choices:[{message:{content:review}}]});

test("only explicit literal loopback URLs allowed; disallow external networks and redirects to them",()=>{
  assert.equal(validateLoopbackEndpoint("http://127.0.0.1:11434/v1/chat/completions").hostname,"127.0.0.1");
  for(const url of [
    "https://api.openai.com/v1/chat/completions",
    "https://127.0.0.1:11434/v1/chat/completions",
    "http://localhost:11434/v1/chat/completions",
    "http://10.0.0.1:11434/v1/chat/completions",
    "http://127.0.0.1:11434/v1/other",
    "http://user:pass@127.0.0.1:11434/v1/chat/completions",
    "http://127.0.0.1:11434/v1/chat/completions?token=secret",
    "http://127.0.0.1:11434/v1/chat/completions#fragment",
  ]) assert.throws(()=>validateLoopbackEndpoint(url),/endpoint/);
  assert.throws(()=>createLoopbackCompletion({
    endpoint:"http://127.0.0.1:11434/v1/chat/completions",model:"x\ninjected"
  }),/model name/);
});

test("one HTTP request per content-review callback, explicit model, correct usage and no secrets",async()=>{
  let called=0;
  await withServer(async(req,res)=>{
    called++;
    assert.equal(req.method,"POST");
    assert.equal(req.url,"/v1/chat/completions");
    assert.equal(req.headers.authorization,undefined);
    const parts=[];for await(const chunk of req)parts.push(chunk);
    const input=JSON.parse(Buffer.concat(parts).toString());
    assert.equal(input.model,"test-local-model");
    assert.equal(input.stream,false);
    assert.equal(input.messages[0].role,"system");
    assert.equal(input.messages[0].content,REQUEST.system);
    assert.equal(input.messages[1].role,"user");
    assert.equal(input.messages[1].content,REQUEST.user);
    assert.equal(input.max_tokens,650);
    res.writeHead(200,{"Content-Type":"application/json"});
    res.end(JSON.stringify({choices:[{message:{content:'{"decision":"KEEP"}'}}],
      usage:{prompt_tokens:101,completion_tokens:17}}));
  },async endpoint=>{
    const transport=createLoopbackCompletion({endpoint,model:"test-local-model"});
    assert.equal(await transport.complete(REQUEST),'{"decision":"KEEP"}');
    assert.equal(called,1);
    assert.deepEqual(transport.snapshot().usage,[{prompt:101,completion:17,total:118}]);
    assert.equal(transport.snapshot().calls,1);
    assert.equal(transport.snapshot().failed,0);
  });
});

test("HTTP 503 is a single failed request, never retried silently",async()=>{
  let count=0;
  await withServer((_req,res)=>{count++;res.writeHead(503);res.end("unavailable");},
    async endpoint=>{
      const transport=createLoopbackCompletion({endpoint,model:"stub"});
      await assert.rejects(transport.complete(REQUEST),/HTTP 503/);
      assert.equal(count,1);
      assert.equal(transport.snapshot().calls,1);
      assert.equal(transport.snapshot().failed,1);
    });
});

test("HTTP redirects are blocked, including redirect to a non-local host",async()=>{
  let count=0;
  await withServer((_req,res)=>{
    count++;
    res.writeHead(307,{location:"https://example.org/v1/chat/completions"});
    res.end();
  },async endpoint=>{
    const transport=createLoopbackCompletion({endpoint,model:"stub"});
    await assert.rejects(transport.complete(REQUEST));
    assert.equal(count,1);
    assert.equal(transport.snapshot().failed,1);
  });
});

test("oversized responses and bad model content fail closed",async()=>{
  await withServer((_req,res)=>{
    res.writeHead(200,{"Content-Type":"application/json"});
    res.end(ok("X".repeat(70000)));
  },async endpoint=>{
    const transport=createLoopbackCompletion({endpoint,model:"stub"});
    await assert.rejects(transport.complete(REQUEST),/maximum size/);
    assert.equal(transport.snapshot().failed,1);
  });
  await withServer((_req,res)=>{
    res.writeHead(200,{"Content-Type":"application/json"});
    res.end('{"choices":[{"message":{"content":""}}]}');
  },async endpoint=>{
    const transport=createLoopbackCompletion({endpoint,model:"stub"});
    await assert.rejects(transport.complete(REQUEST),/invalid response content/);
  });
});

test("local HTTP timeout is bounded; no implicit second call",async()=>{
  let called=0;
  await withServer((_req,res)=>{called++;setTimeout(()=>{
    if(!res.writableEnded){res.writeHead(200,{"Content-Type":"application/json"});res.end(ok());}
  },300);},async endpoint=>{
    const transport=createLoopbackCompletion({endpoint,model:"stub",timeoutMs:100});
    await assert.rejects(transport.complete(REQUEST));
    assert.equal(called,1);
    assert.equal(transport.snapshot().failed,1);
  });
});
