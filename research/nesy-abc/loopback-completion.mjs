/**
 * Explicit, research-only OpenAI-compatible localhost completion adapter.
 *
 * NEVER reads an API key, provider configuration, production session or
 * external endpoint from the environment. The caller MUST explicitly supply
 * a loopback URL and model identifier. No retries and no redirects.
 * Supported: Ollama's opt-in OpenAI-compatible /v1/chat/completions route
 * and a matching synthetic CI stub. No paid cloud providers.
 */
const MAX_BYTES = 64 * 1024;
const MAX_REQUEST_BYTES = 32 * 1024;

export function validateLoopbackEndpoint(endpoint) {
  if(typeof endpoint !== "string" || !endpoint.trim()) throw Error("explicit endpoint required");
  let url;
  try { url = new URL(endpoint); }
  catch { throw Error("invalid endpoint URL"); }
  // Literal loopback only: DNS names, remote networks, HTTPS frontends,
  // credentials, fragments and query strings are intentionally forbidden.
  if (url.protocol !== "http:" ||
      !["127.0.0.1","[::1]"].includes(url.hostname) ||
      url.username || url.password || url.hash || url.search ||
      !url.port || !url.pathname.endsWith("/chat/completions"))
    throw Error("endpoint must be an explicit literal loopback chat/completions URL");
  return url;
}
function exactPositiveInt(n) {
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
async function readBoundedText(response) {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BYTES)
    throw Error("model response exceeds maximum size");
  const reader = response.body?.getReader();
  if (!reader) throw Error("missing response body");
  let size=0;
  const parts=[];
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MAX_BYTES)throw Error("model response exceeds maximum size");
      parts.push(value);
    }
  }finally{
    await reader.cancel().catch(()=>{});
  }
  return new TextDecoder().decode(Buffer.concat(parts.map(p=>Buffer.from(p))));
}

/**
 * Returns {complete, snapshot}; complete has the exact interface expected by
 * createContentReviewers. Every callback makes EXACTLY ONE request.
 * Usage counters remain NULL when the local model does not expose them.
 */
export function createLoopbackCompletion({endpoint,model,timeoutMs=30000}) {
  const url=validateLoopbackEndpoint(endpoint);
  if(typeof model!=="string" || !/^[A-Za-z0-9._:/-]{1,128}$/.test(model))
    throw Error("explicit bounded model name required");
  if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>120000)
    throw Error("timeout must be between 100ms and 120s");
  const measurements=[];
  const complete=async({system,user,temperature,maxOutputTokens})=>{
    if(typeof system!=="string"||typeof user!=="string")
      throw Error("invalid research messages");
    const payload=JSON.stringify({
      model,stream:false,
      messages:[{role:"system",content:system},{role:"user",content:user}],
      temperature:Math.max(0,Math.min(1,Number(temperature)||0)),
      max_tokens:Math.min(800,Math.max(100,Number(maxOutputTokens)||650)),
    });
    if(Buffer.byteLength(payload)>MAX_REQUEST_BYTES)throw Error("review input too long");
    const started=performance.now();
    let status="error",tokens=null;
    try{
      const response=await fetch(url,{
        method:"POST",redirect:"error",signal:AbortSignal.timeout(timeoutMs),
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:payload
      });
      if(response.status!==200)throw Error("local provider returned HTTP "+response.status);
      const raw=await readBoundedText(response);
      let parsed;
      try{parsed=JSON.parse(raw);}catch{throw Error("invalid provider JSON");}
      const content=parsed?.choices?.[0]?.message?.content;
      if(typeof content!=="string" || !content.trim() || content.length>5000)
        throw Error("invalid response content");
      const prompt=exactPositiveInt(parsed?.usage?.prompt_tokens);
      const completion=exactPositiveInt(parsed?.usage?.completion_tokens);
      if(prompt!==null && completion!==null)
        tokens={prompt,completion,total:prompt+completion};
      status="ok";
      return content;
    }finally{
      measurements.push({status,ms:Math.round(performance.now()-started),tokens});
    }
  };
  return Object.freeze({
    complete,
    snapshot:()=>({
      calls:measurements.length,
      ok:measurements.filter(x=>x.status==="ok").length,
      failed:measurements.filter(x=>x.status!=="ok").length,
      latencyMs:measurements.map(x=>x.ms),
      usage:measurements.map(x=>x.tokens),
      // A local model may still use compute resources, not report monetary
      // cost. We intentionally NEVER infer dollars from tokens.
      monetaryCostMeasured:false
    })
  });
}
