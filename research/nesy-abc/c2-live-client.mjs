/**
 * C2 research-only one-shot GPT-5-mini candidate generator transport.
 * Never imported by the production application. Exactly one authorized call
 * per fictional case, capped at 10; no retry, tools, redirects, or storage.
 */
const ENDPOINT="https://api.openai.com/v1/chat/completions";
const MODEL="gpt-5-mini";
const MAX_CALLS=10,MAX_INPUT_BYTES=12000,MAX_OUTPUT_BYTES=50000;
const MAX_COMPLETION_TOKENS=1600;
const countInt=x=>Number.isSafeInteger(x)&&x>=0?x:null;
export const C2_LIVE_MODEL=MODEL;
export const C2_LIVE_MAX_CALLS=MAX_CALLS;
export function makeC2LiveClient({apiKey,fetchFn=fetch,timeoutMs=45000}={}){
  if(typeof apiKey!=="string"||!/^sk-[A-Za-z0-9_-]{10,}$/.test(apiKey))
    throw Error("missing GitHub environment API credential");
  if(typeof fetchFn!=="function"||!Number.isSafeInteger(timeoutMs)||
    timeoutMs<1000||timeoutMs>60000)throw Error("invalid C2 transport configuration");
  let calls=0;
  const records=[];
  const complete=async({instructions,input})=>{
    if(calls>=MAX_CALLS)throw Error("C2 hard upstream call cap exceeded");
    if(typeof instructions!=="string"||instructions.length>6000||
       typeof input!=="string"||input.length>6000)
      throw Error("C2 prompt outside bounded contract");
    const body=JSON.stringify({
      model:MODEL,store:false,stream:false,n:1,
      messages:[{role:"system",content:instructions},{role:"user",content:input}],
      reasoning_effort:"minimal",max_completion_tokens:MAX_COMPLETION_TOKENS,
      response_format:{type:"json_object"}
    });
    if(Buffer.byteLength(body)>MAX_INPUT_BYTES)throw Error("C2 request exceeds hard input cap");
    calls++;
    const metric={ok:false,httpStatus:null,ms:null,inputTokens:null,outputTokens:null};
    records.push(metric);
    const start=performance.now();
    try{
      const response=await fetchFn(ENDPOINT,{
        method:"POST",redirect:"error",signal:AbortSignal.timeout(timeoutMs),
        headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json",
          "Accept":"application/json"},
        body
      });
      metric.httpStatus=Number(response?.status)||null;
      if(response?.status!==200)throw Error("C2 upstream HTTP "+String(response?.status||"unknown"));
      const reader=response.body?.getReader();
      if(!reader)throw Error("C2 missing streamed response body");
      const parts=[];let size=0;
      try{
        while(true){
          const {done,value}=await reader.read();
          if(done)break;
          size+=value.byteLength;
          if(size>MAX_OUTPUT_BYTES)throw Error("C2 response exceeds hard size cap");
          parts.push(Buffer.from(value));
        }
      }finally{await reader.cancel().catch(()=>{});}
      let parsed;
      try{parsed=JSON.parse(Buffer.concat(parts).toString("utf8"));}
      catch{throw Error("C2 malformed upstream JSON");}
      const output=parsed?.choices?.[0]?.message?.content;
      if(typeof output!=="string"||!output.trim()||output.length>12000)
        throw Error("C2 missing or oversized completion");
      metric.inputTokens=countInt(parsed?.usage?.prompt_tokens);
      metric.outputTokens=countInt(parsed?.usage?.completion_tokens);
      metric.ok=true;
      return output;
    }finally{metric.ms=Math.round(performance.now()-start);}
  };
  return Object.freeze({
    complete,
    snapshot:()=>({model:MODEL,maxCalls:MAX_CALLS,requests:calls,
      successful:records.filter(x=>x.ok).length,failed:records.filter(x=>!x.ok).length,
      inputTokens:records.every(x=>x.inputTokens!==null)?
        records.reduce((n,x)=>n+x.inputTokens,0):null,
      outputTokens:records.every(x=>x.outputTokens!==null)?
        records.reduce((n,x)=>n+x.outputTokens,0):null,
      perCall:records.map(x=>({...x})),monetaryCostMeasured:false})
  });
}
