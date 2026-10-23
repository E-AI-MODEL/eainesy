/**
 * OpenAI-only transport for the isolated NeSy research sandbox.
 *
 * This module is NEVER imported by processTurn or a production API route.
 * It can call only https://api.openai.com/v1/responses. Calls must be
 * explicitly authorized by the caller, which supplies an environment secret.
 * A fresh instance is capped at TWO total paid HTTP requests, with NO retry,
 * NO redirects, a bounded timeout and a bounded response. Model responses
 * are not stored by the Responses API (store:false).
 *
 * Real model outcomes are only unverified research candidates. This is not
 * a production/safety decision and no actual user data is ever accepted by
 * the sandbox entrypoint.
 */
const API_URL = "https://api.openai.com/v1/responses";
const ONLY_MODEL = "gpt-5-mini";
const MAX_CALLS = 2;
const MAX_BODY_BYTES = 35_000;
const MAX_RESPONSE_BYTES = 50_000;
const MAX_OUTPUT_TOKENS = 800;

const ISSUES = [
  "NONE","PERSON_ATTRIBUTION","TIME_ATTRIBUTION","NEGATION",
  "MISSED_CORRECTION","UNWANTED_ADVICE","MISSED_DIRECT_REQUEST",
  "CLOSURE_OR_REOPENING","UNRESOLVED_AMBIGUITY"
];
const MOVES = [
  "QUESTION","RESTATEMENT","REFLECTION","AFFIRMATION","SUMMARY",
  "SUGGESTION","INFORMATION","REPAIR","CLARIFY"
];
// Strict JSON schema. Actual meaning is still checked independently by
// existing validateContentReview, including exact-source spans.
const REVIEW_SCHEMA = {
  type:"object",
  additionalProperties:false,
  properties:{
    decision:{type:"string",enum:["KEEP","REVISE","VETO"]},
    issue:{type:"string",enum:ISSUES},
    userEvidence:{type:"string"},
    draftEvidence:{type:"string"},
    move:{type:"string",enum:MOVES},
    reason:{type:"string"},
    revisedDraft:{type:"string"}
  },
  required:[
    "decision","issue","userEvidence","draftEvidence",
    "move","reason","revisedDraft"
  ]
};

const int = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
function textPartFromResponse(result) {
  if(result?.status!=="completed" || !Array.isArray(result.output))
    throw Error("OpenAI sandbox: model response not completed");
  const texts=[];
  for(const item of result.output){
    if(item?.type!=="message" || !Array.isArray(item.content))continue;
    for(const part of item.content){
      if(part?.type==="output_text" && typeof part.text==="string")texts.push(part.text);
    }
  }
  const combined=texts.join("");
  if(!combined.trim() || combined.length>5000)
    throw Error("OpenAI sandbox: no valid review text");
  return combined;
}
async function readLimitedBody(response){
  const len=Number(response.headers?.get?.("content-length"));
  if(Number.isFinite(len)&&len>MAX_RESPONSE_BYTES)
    throw Error("OpenAI sandbox: response too large");
  const reader=response.body?.getReader();
  if(!reader)throw Error("OpenAI sandbox: response body absent");
  let n=0;
  const chunks=[];
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      n+=value.byteLength;
      if(n>MAX_RESPONSE_BYTES)throw Error("OpenAI sandbox: response too large");
      chunks.push(value);
    }
  }finally{
    await reader.cancel().catch(()=>{});
  }
  return Buffer.concat(chunks.map(b=>Buffer.from(b))).toString("utf8");
}
export function makeOpenAISandboxClient({
  apiKey,model=ONLY_MODEL,fetchFn=fetch,timeoutMs=30000
}={}) {
  if(typeof apiKey!=="string" || !/^sk-[A-Za-z0-9_-]{10,}$/.test(apiKey))
    throw Error("OpenAI sandbox: add a separate project key to the environment secret");
  if(model!==ONLY_MODEL)
    throw Error("OpenAI sandbox: only the approved low-cost model is allowed");
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>45000)
    throw Error("OpenAI sandbox: invalid timeout");
  if(typeof fetchFn!=="function")throw Error("OpenAI sandbox: invalid fetch function");
  let calls=0;
  const metrics=[];
  const complete=async({system,user})=>{
    if(calls>=MAX_CALLS)throw Error("OpenAI sandbox: two-call hard limit reached");
    if(typeof system!=="string"||system.length>7000 ||
       typeof user!=="string"||user.length>8000)
      throw Error("OpenAI sandbox: bounded review input required");
    // Only the two fixed content-review messages, no tools or file access.
    const body=JSON.stringify({
      model,
      instructions:system,
      input:user,
      store:false,
      stream:false,
      max_output_tokens:MAX_OUTPUT_TOKENS,
      text:{format:{
        type:"json_schema",name:"nesy_content_review",
        strict:true,schema:REVIEW_SCHEMA
      }}
    });
    if(Buffer.byteLength(body)>MAX_BODY_BYTES)throw Error("OpenAI sandbox: input too large");
    calls++;
    const start=performance.now();
    const run={ok:false,ms:null,promptTokens:null,completionTokens:null};
    metrics.push(run);
    try{
      const response=await fetchFn(API_URL,{
        method:"POST",redirect:"error",
        headers:{
          "Content-Type":"application/json",
          "Authorization":"Bearer "+apiKey,
          "Accept":"application/json"
        },
        body,signal:AbortSignal.timeout(timeoutMs)
      });
      // No response body in error output: it could contain echoed secrets.
      if(response.status!==200)throw Error("OpenAI sandbox: HTTP "+response.status);
      let json;
      try{json=JSON.parse(await readLimitedBody(response));}
      catch(error){
        if(error?.message?.startsWith("OpenAI sandbox:"))throw error;
        throw Error("OpenAI sandbox: malformed provider response");
      }
      const output=textPartFromResponse(json);
      run.promptTokens=int(json?.usage?.input_tokens);
      run.completionTokens=int(json?.usage?.output_tokens);
      run.ok=true;
      return output;
    }finally{
      run.ms=Math.round(performance.now()-start);
    }
  };
  return Object.freeze({
    complete,
    snapshot:()=>({
      model,requests:calls,maxRequests:MAX_CALLS,
      successful:metrics.filter(r=>r.ok).length,
      failed:metrics.filter(r=>!r.ok).length,
      perCall:metrics.map(r=>({...r})),
      monetaryCostMeasured:false
    })
  });
}
export const OPENAI_SANDBOX_MODEL=ONLY_MODEL;
