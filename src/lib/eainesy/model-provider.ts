/**
 * EAInesy server-side GLM transport.
 * Exposes a typed transport result so rate limits and outages cannot be
 * mistaken for a semantically unreadable (but delivered) model response.
 * The legacy nullable helper remains for existing callers and evaluations.
 */
import ZAI from 'z-ai-web-dev-sdk';

export type ModelMessage = { role: 'assistant' | 'user'; content: string };
export type ModelBackend = 'zai-sdk' | 'openai-compatible';
export const MODEL_REQUEST_TIMEOUT_MS = 20_000;
export type ModelTransportReason =
  | 'invalid_configuration'
  | 'rate_limited'
  | 'timeout'
  | 'provider_error'
  | 'invalid_response';

export type ModelCompletion =
  | { status: 'ok'; text: string }
  | { status: 'unavailable'; reason: ModelTransportReason };

export class ModelProviderUnavailable extends Error {
  constructor(public readonly reason: ModelTransportReason) {
    super('Model provider unavailable: ' + reason);
    this.name = 'ModelProviderUnavailable';
  }
}

const unavailable = (reason: ModelTransportReason): ModelCompletion =>
  ({ status: 'unavailable', reason });
const successful = (text: string): ModelCompletion => ({ status: 'ok', text });
const SDK_DELAYS = [1200, 2800];

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
    if (process.env.CI === 'true' && url.protocol === 'http:' &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost')) return url;
    return null;
  } catch { return null; }
}

function errorKind(error: unknown): ModelTransportReason {
  const text = String(error);
  if (/429|too many|rate.limit|quota/i.test(text)) return 'rate_limited';
  if (/timed?out|timeout|abort/i.test(text)) return 'timeout';
  return 'provider_error';
}

async function requestCompatible(messages: ModelMessage[], temperature: number): Promise<ModelCompletion> {
  const endpoint = endpointFromEnvironment();
  const token = process.env.EAINESY_MODEL_API_KEY;
  const model = process.env.EAINESY_MODEL_NAME;
  if (!endpoint || !token || !model) return unavailable('invalid_configuration');
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
        body: JSON.stringify({ model, messages: formatted, temperature }),
      });
      if ([429, 502, 503, 504].includes(response.status)) {
        if (attempt === 2) return unavailable(response.status === 429 ? 'rate_limited' : 'provider_error');
        await new Promise((done) => setTimeout(done, 250 * (attempt + 1)));
        continue;
      }
      if (response.status === 408) return unavailable('timeout');
      if (!response.ok) return unavailable('provider_error');
      if (Number(response.headers.get('content-length') || 0) > 262_144) return unavailable('invalid_response');
      const body = await response.text();
      if (body.length > 262_144) return unavailable('invalid_response');
      let parsed: unknown;
      try { parsed = JSON.parse(body); } catch { return unavailable('invalid_response'); }
      if (!parsed || typeof parsed !== 'object') return unavailable('invalid_response');
      const choices = (parsed as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
      const text = choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim() || text.length > 20_000)
        return unavailable('invalid_response');
      return successful(text);
    } catch (error) {
      // Never reveal remote error details (may contain tokens or prompt text).
      return unavailable(errorKind(error));
    }
  }
  return unavailable('provider_error');
}

async function requestSdk(messages: ModelMessage[], temperature: number): Promise<ModelCompletion> {
  let instance: Awaited<ReturnType<typeof ZAI.create>>;
  try { instance = await getSdk(); }
  catch (error) { return unavailable(errorKind(error)); }
  for (let attempt = 0; ; attempt++) {
    try {
      const completion = await instance.chat.completions.create({
        messages,
        temperature,
        thinking: { type: 'disabled' },
      } as Parameters<typeof instance.chat.completions.create>[0]);
      const text = completion.choices[0]?.message?.content;
      return typeof text === 'string' && text.trim()
        ? successful(text)
        : unavailable('invalid_response');
    } catch (error) {
      const kind = errorKind(error);
      const retriable = attempt < SDK_DELAYS.length &&
        (kind === 'rate_limited' || /5\d\d/.test(String(error)));
      if (!retriable) return unavailable(kind);
      await new Promise((done) => setTimeout(done, SDK_DELAYS[attempt]));
    }
  }
}

/** The detailed result is mandatory for any safety-relevant parsing decision. */
export async function completeModelWithStatus(messages: ModelMessage[], temperature: number): Promise<ModelCompletion> {
  const backend = configuredBackend();
  if (!backend || !messages.length || messages.some(m => m.content.length > 12_000))
    return unavailable('invalid_configuration');
  try {
    return backend === 'openai-compatible'
      ? await requestCompatible(messages, temperature)
      : await requestSdk(messages, temperature);
  } catch (error) {
    return unavailable(errorKind(error));
  }
}

/** Backwards-compatible nullable helper for generation and research fixtures. */
export async function completeModel(messages: ModelMessage[], temperature: number): Promise<string | null> {
  const result = await completeModelWithStatus(messages, temperature);
  return result.status === 'ok' ? result.text : null;
}
