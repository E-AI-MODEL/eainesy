/**
 * P03 fictional semantic sandbox GPT-5 transport. Never part of processTurn.
 * The existing GitHub Environment 'nesy' key is injected ONLY by Actions.
 * One POST per call, no retries, tools, redirects, storage or real user data.
 */
const ENDPOINT="https://api.openai.com/v1/chat/completions";
export const P03_MODEL="gpt-5";
export const P03_LIMITS=Object.freeze({
  total:16,recheck:8,reply:8,
  inputBytes:16000,outputBytes:40000,timeoutMs:65000
});
const count=x=>Number.isSafeInteger(x)&&x>=0?x:null;

export function createP03Client({apiKey,fetchFn=fetch}={}){
  if(typeof apiKey!=="string"||!/^sk-[A-Za-z0-9_-]{10,}$/.test(apiKey))
    throw Error("GitHub Environment secret 'nesy' required");
  if(typeof fetchFn!=="function")throw Error("fetch callback required");
  let calls=0;
  const perPhase={recheck:0,reply:0};
  const ledger=[];
  const complete=async({phase,system,input})=>{
    if(!["recheck","reply"].includes(phase))
      throw Error("unapproved P03 phase");
    if(calls>=P03_LIMITS.total || perPhase[phase]>=P03_LIMITS[phase])
      throw Error("P03 research model cap reached");
    if(typeof system!=="string"||system.length<20||system.length>6500||
       typeof input!=="string"||input.length<10||input.length>7500)
      throw Error("P03 bounded prompt rejected");
    const body=JSON.stringify({
      model:P03_MODEL,n:1,stream:false,store:false,
      reasoning_effort:"minimal",
      max_completion_tokens:phase==="recheck"?1200:1400,
      response_format:{type:"json_object"},
      messages:[{role:"system",content:system},{role:"user",content:input}]
    });
    if(Buffer.byteLength(body)>P03_LIMITS.inputBytes)
      throw Error("P03 request byte cap reached");
    calls++;
    perPhase[phase]++;
    const metric={phase,ok:false,httpStatus:null,inputTokens:null,
      outputTokens:null,finishReason:null};
    ledger.push(metric);
    try{
      const r=await fetchFn(ENDPOINT,{
        method:"POST",redirect:"error",
        signal:AbortSignal.timeout(P03_LIMITS.timeoutMs),
        headers:{Authorization:"Bearer "+apiKey,
          "Content-Type":"application/json",Accept:"application/json"},
        body
      });
      metric.httpStatus=Number(r?.status)||null;
      if(r.status!==200)throw Error("P03 upstream HTTP "+String(r.status));
      if(!r.body?.getReader)throw Error("P03 response body missing");
      const chunks=[];let n=0;
      const reader=r.body.getReader();
      try{
        while(true){
          const {done,value}=await reader.read();
          if(done)break;
          n+=value.byteLength;
          if(n>P03_LIMITS.outputBytes)
            throw Error("P03 response bytes exceeded");
          chunks.push(Buffer.from(value));
        }
      }finally{
        await reader.cancel().catch(()=>{});
      }
      let envelope;
      try{envelope=JSON.parse(Buffer.concat(chunks).toString("utf8"))}
      catch{throw Error("P03 API payload is not JSON");}
      const raw=envelope?.choices?.[0]?.message?.content;
      if(typeof raw!=="string"||!raw.trim()||raw.length>10000)
        throw Error("P03 empty model content");
      metric.inputTokens=count(envelope?.usage?.prompt_tokens);
      metric.outputTokens=count(envelope?.usage?.completion_tokens);
      metric.finishReason=envelope?.choices?.[0]?.finish_reason||null;
      metric.ok=true;
      return raw;
    }catch(err){
      const msg=String(err?.message||"");
      throw Error(/^P03 upstream HTTP [0-9]{3}$/.test(msg)?msg:
        "P03 model call failed (no retry)");
    }
  };
  const snapshot=()=>{
    const totalIfKnown=k=>ledger.every(x=>x[k]!==null)?
      ledger.reduce((n,x)=>n+x[k],0):null;
    return {
      model:P03_MODEL,calls,perPhase:{...perPhase},
      succeeded:ledger.filter(x=>x.ok).length,
      failed:ledger.filter(x=>!x.ok).length,
      inputTokens:totalIfKnown("inputTokens"),
      outputTokens:totalIfKnown("outputTokens"),
      monetaryCostMeasured:false,
      ledger:ledger.map(x=>({...x}))
    };
  };
  return Object.freeze({complete,snapshot,hasProductionWrites:false});
}
