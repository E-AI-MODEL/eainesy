import { describe, expect, test, afterEach } from 'bun:test';
import {configuredHttpModel, configuredProviderIds, defaultModelProvider, resolveModelRoute, selectableProviders} from '../src/lib/eainesy/model-routing';
import {ChatRequestSchema} from '../src/lib/eainesy/types';
import {completeModelWithStatus} from '../src/lib/eainesy/model-provider';

const keys=['EAINESY_MODEL_BACKEND','EAINESY_ALLOWED_PROVIDERS','EAINESY_OPENAI_MODEL','EAINESY_OPENAI_API_KEY','EAINESY_GEMINI_MODEL','EAINESY_GEMINI_API_KEY','EAINESY_CLAUDE_MODEL','EAINESY_CLAUDE_API_KEY','EAINESY_OLLAMA_MODEL','EAINESY_OLLAMA_LOOPBACK_ENABLED','EAINESY_MODEL_ENDPOINT','EAINESY_MODEL_NAME','EAINESY_MODEL_API_KEY'];
const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
function reset() { for(const key of keys) {const val=original[key]; if(val===undefined)delete process.env[key];else process.env[key]=val;} }
afterEach(reset);

describe('server allowlisted model selection',()=>{
  test('default still uses original Z.ai backend',()=>{
    process.env.EAINESY_MODEL_BACKEND='zai-sdk';delete process.env.EAINESY_ALLOWED_PROVIDERS;
    expect(defaultModelProvider()).toBe('zai');
    expect(resolveModelRoute()).toEqual({parser:'zai',generator:'zai'});
  });
  test('explicit model selection cannot bypass allowlist',()=>{
    process.env.EAINESY_ALLOWED_PROVIDERS='zai';
    expect(resolveModelRoute({parser:'openai',generator:'zai'})).toBeNull();
    expect(selectableProviders()).toEqual(['zai']);
  });
  test('OpenAI, Gemini, Claude each require credentials and model',()=>{
    process.env.EAINESY_ALLOWED_PROVIDERS='openai,gemini,claude';
    expect(selectableProviders()).toEqual([]);
    for (const provider of ['openai','gemini','claude'] as const) {
      process.env['EAINESY_'+provider.toUpperCase()+'_MODEL']='test-model';
      process.env['EAINESY_'+provider.toUpperCase()+'_API_KEY']='test-key';
      expect(configuredHttpModel(provider)?.endpoint.protocol).toBe('https:');
    }
    expect(selectableProviders()).toEqual(['openai','gemini','claude']);
    expect(configuredHttpModel('claude')?.sendTemperature).toBe(false);
  });
  test('parser and generator can be different authorized providers',()=>{
    process.env.EAINESY_ALLOWED_PROVIDERS='zai,openai';
    process.env.EAINESY_OPENAI_MODEL='test-model';process.env.EAINESY_OPENAI_API_KEY='test-key';
    expect(resolveModelRoute({parser:'openai',generator:'zai'})).toEqual({parser:'openai',generator:'zai'});
  });
  test('Ollama cannot be selected unless loopback explicitly enabled',()=>{
    process.env.EAINESY_ALLOWED_PROVIDERS='ollama';process.env.EAINESY_OLLAMA_MODEL='test-local';
    expect(configuredHttpModel('ollama')).toBeNull();
    process.env.EAINESY_OLLAMA_LOOPBACK_ENABLED='true';
    const config=configuredHttpModel('ollama');
    expect(config?.endpoint.hostname).toBe('127.0.0.1');
    expect(config?.apiKey).toBeNull();
  });
  test('a custom provider uses legacy HTTPS endpoint only',()=>{
    process.env.EAINESY_ALLOWED_PROVIDERS='custom';process.env.EAINESY_MODEL_BACKEND='openai-compatible';
    process.env.EAINESY_MODEL_NAME='model';process.env.EAINESY_MODEL_API_KEY='secret';
    process.env.EAINESY_MODEL_ENDPOINT='http://remote.example/v1/chat/completions';
    expect(configuredHttpModel('custom')).toBeNull();
    process.env.EAINESY_MODEL_ENDPOINT='https://api.example/v1/chat/completions';
    expect(configuredHttpModel('custom')?.model).toBe('model');
  });
  test('provider IDs are accepted but arbitrary endpoints and names are not in request schema',()=>{
    const parsed=ChatRequestSchema.safeParse({message:'Test',modelRoute:{parser:'gemini',generator:'claude'},endpoint:'https://evil.example',apiKey:'secret'});
    expect(parsed.success).toBe(true);
    if(parsed.success){expect('endpoint' in parsed.data).toBe(false);expect('apiKey' in parsed.data).toBe(false);}
    expect(ChatRequestSchema.safeParse({message:'Test',modelRoute:{parser:'attacker',generator:'zai'}}).success).toBe(false);
  });
  test('unknown/disabled provider fails closed without a request',async()=>{
    process.env.EAINESY_ALLOWED_PROVIDERS='zai';
    const result=await completeModelWithStatus([{role:'user',content:'hello'}],0.1,'gemini');
    expect(result).toEqual({status:'unavailable',reason:'invalid_configuration'});
  });
});

describe('per-provider transport contract (mocked, no external model calls)',()=>{
  test('OpenAI, Gemini and Claude use their fixed HTTPS endpoints without cross-provider credentials',async()=>{
    const originalFetch=globalThis.fetch;
    const calls: {url:string;headers:Record<string,string>;body:Record<string,unknown>}[]=[];
    globalThis.fetch=(async(url: string | URL | Request,init?:RequestInit)=>{
      calls.push({url:String(url),headers:(init?.headers || {}) as Record<string,string>,body:JSON.parse(String(init?.body)) as Record<string,unknown>});
      return new Response(JSON.stringify({choices:[{message:{content:'mock response'}}]}),{status:200,headers:{'Content-Type':'application/json'}});
    }) as typeof fetch;
    try{
      process.env.EAINESY_ALLOWED_PROVIDERS='openai,gemini,claude';
      for(const p of ['openai','gemini','claude'] as const){
        process.env['EAINESY_'+p.toUpperCase()+'_MODEL']='test-'+p;
        process.env['EAINESY_'+p.toUpperCase()+'_API_KEY']='key-'+p;
        const response=await completeModelWithStatus([{role:'assistant',content:'system'},{role:'user',content:'hello'}],0.1,p);
        expect(response).toEqual({status:'ok',text:'mock response'});
      }
      expect(calls.map(x=>new URL(x.url).hostname)).toEqual(['api.openai.com','generativelanguage.googleapis.com','api.anthropic.com']);
      expect(calls.map(x=>x.headers.Authorization)).toEqual(['Bearer key-openai','Bearer key-gemini','Bearer key-claude']);
      expect(calls.every(x=>x.body.model === 'test-'+new URL(x.url).hostname.split('.')[1])).toBe(false);
      expect(calls.map(x=>x.body.model)).toEqual(['test-openai','test-gemini','test-claude']);
      expect(calls[0].body.temperature).toBe(0.1);
      expect(calls[1].body.temperature).toBe(0.1);
      expect('temperature' in calls[2].body).toBe(false);
      expect((calls[0].body.messages as {role:string}[])[0].role).toBe('system');
    }finally{globalThis.fetch=originalFetch;}
  });

  test('local Ollama uses loopback only and sends no Authorization',async()=>{
    const originalFetch=globalThis.fetch;
    let url='', headers:Record<string,string>={};
    globalThis.fetch=(async(u:string | URL | Request,init?:RequestInit)=>{
      url=String(u);headers=init?.headers as Record<string,string>;
      return new Response(JSON.stringify({choices:[{message:{content:'local'}}]}),{status:200});
    }) as typeof fetch;
    try{
      process.env.EAINESY_ALLOWED_PROVIDERS='ollama';
      process.env.EAINESY_OLLAMA_LOOPBACK_ENABLED='true';
      process.env.EAINESY_OLLAMA_MODEL='local-test';
      expect(await completeModelWithStatus([{role:'user',content:'hello'}],0,'ollama')).toEqual({status:'ok',text:'local'});
      expect(new URL(url).hostname).toBe('127.0.0.1');
      expect('Authorization' in headers).toBe(false);
    }finally{globalThis.fetch=originalFetch;}
  });
});
