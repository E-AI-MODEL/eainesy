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
