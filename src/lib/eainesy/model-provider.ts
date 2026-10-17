/**
 * EAInesy model transport boundary (server only).
 *
 * "zai-sdk" preserves the research host's original SDK. An explicitly
 * configured "openai-compatible" transport enables external GLM deployments
 * without changing the parser or symbolic decision-making.
 *
 * No provider is authorized to choose the verification policy. A missing,
 * invalid or failing provider returns null and upstream code fails closed.
 * Never log model prompts, model output or API credentials here.
 */
import ZAI from 'z-ai-web-dev-sdk';

export type ModelMessage = { role: 'assistant' | 'user'; content: string };
export type ModelBackend = 'zai-sdk' | 'openai-compatible';
export const MODEL_REQUEST_TIMEOUT_MS = 20_000;

let sdk: Awaited<ReturnType<typeof ZAI.create>> | null = null;
async function getSdk() {
  if (!sdk) sdk = await ZAI.create();
  return sdk;
}

function configuredBackend(): ModelBackend | null {
  const value = process.env.EAINESY_MODEL_BACKEND?.trim() || 'zai-sdk';
  return value === 'zai-sdk' || value === 'openai-compatible' ? value : null;
}

function endpointFromEnvironment(): URL | null {
  const raw = process.env.EAINESY_MODEL_ENDPOINT;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.hash) return null;
    if (url.protocol === 'https:') return url;
    // HTTP localhost is allowed ONLY for local CI contract checks, not public hosts.
    if (process.env.CI === 'true' && url.protocol === 'http:' &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost')) return url;
    return null;
  } catch {
    return null;
  }
}

async function requestCompatible(messages: ModelMessage[], temperature: number): Promise<string | null> {
  const endpoint = endpointFromEnvironment();
  const token = process.env.EAINESY_MODEL_API_KEY;
  const model = process.env.EAINESY_MODEL_NAME;
  if (!endpoint || !token || !model) return null;

  // Original call-site stores the instruction in the first assistant message;
  // transmit it as system instruction on the standard compatible API.
  const formatted = messages.map((msg, index) => ({
    role: index === 0 && msg.role === 'assistant' ? 'system' : msg.role,
    content: msg.content,
  }));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(MODEL_REQUEST_TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: formatted,
          temperature,
        }),
      });
      if (response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) {
        if (attempt === 2) return null;
        await new Promise((done) => setTimeout(done, 250 * (attempt + 1)));
        continue;
      }
      if (!response.ok) return null;
      if (Number(response.headers.get('content-length') || 0) > 262_144) return null;
      const body = await response.text();
      if (body.length > 262_144) return null;
      const parsed: unknown = JSON.parse(body);
      if (!parsed || typeof parsed !== 'object') return null;
      const choices = (parsed as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
      const content = choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim() || content.length > 20_000) return null;
      return content;
    } catch {
      // No request bodies or secrets in diagnostic messages. Aborts and errors
      // must not silently fall back to another model or transport.
      return null;
    }
  }
  return null;
}

async function requestSdk(messages: ModelMessage[], temperature: number): Promise<string | null> {
  const instance = await getSdk();
  const retries = [1200, 2800];
  for (let attempt = 0; ; attempt++) {
    try {
      const completion = await instance.chat.completions.create({
        messages,
        temperature,
        thinking: { type: 'disabled' },
      } as Parameters<typeof instance.chat.completions.create>[0]);
      const content = completion.choices[0]?.message?.content;
      return typeof content === 'string' && content.trim() ? content : null;
    } catch (err) {
      // Provider error messages are intentionally not logged or returned.
      const retriable = attempt < retries.length && /429|Too many|5\d\d/.test(String(err));
      if (!retriable) return null;
      await new Promise((done) => setTimeout(done, retries[attempt]));
    }
  }
}

export async function completeModel(messages: ModelMessage[], temperature: number): Promise<string | null> {
  const backend = configuredBackend();
  if (!backend) return null; // invalid explicit configuration never falls back
  if (!messages.length || messages.some(m => m.content.length > 12_000)) return null;
  try {
    return backend === 'openai-compatible'
      ? await requestCompatible(messages, temperature)
      : await requestSdk(messages, temperature);
  } catch {
    return null;
  }
}
