/**
 * Trusted, server-only model catalog. Request bodies may contain only a
 * provider ID from this fixed list: never a URL, model name or API secret.
 * No automatic failover: an unavailable provider blocks the turn.
 */
import type { ModelProviderId } from './types';

export type ModelRoute = { parser: ModelProviderId; generator: ModelProviderId };
export type HttpModelConfig = {
  provider: Exclude<ModelProviderId, 'zai'>;
  endpoint: URL;
  model: string;
  apiKey: string | null;
  sendTemperature: boolean;
};

const PROVIDERS: readonly ModelProviderId[] = ['zai','openai','gemini','claude','ollama','custom'];
const KNOWN_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  claude: 'https://api.anthropic.com/v1/chat/completions',
  ollama: 'http://127.0.0.1:11434/v1/chat/completions',
} as const;

const isProvider = (value: string): value is ModelProviderId =>
  (PROVIDERS as readonly string[]).includes(value);

export function defaultModelProvider(): ModelProviderId | null {
  const backend = process.env.EAINESY_MODEL_BACKEND?.trim() || 'zai-sdk';
  if (backend === 'zai-sdk') return 'zai';
  if (backend === 'openai-compatible') return 'custom';
  return null;
}

/**
 * Administrators opt providers in using EAINESY_ALLOWED_PROVIDERS.
 * Legacy default remains available when no allowlist is set.
 * Explicit routes other than the default require the allowlist.
 */
export function configuredProviderIds(): ModelProviderId[] {
  const selected = process.env.EAINESY_ALLOWED_PROVIDERS;
  if (!selected) {
    const fallback = defaultModelProvider();
    return fallback ? [fallback] : [];
  }
  const names = selected.split(',').map(s => s.trim());
  return [...new Set(names.filter(isProvider))];
}

function secureEndpoint(raw: string, localOnly = false): URL | null {
  try {
    const endpoint = new URL(raw);
    if (endpoint.username || endpoint.password || endpoint.hash || endpoint.search) return null;
    if (localOnly) {
      return endpoint.protocol === 'http:' &&
        (endpoint.hostname === '127.0.0.1' || endpoint.hostname === 'localhost') &&
        endpoint.port === '11434' && endpoint.pathname === '/v1/chat/completions'
        ? endpoint : null;
    }
    if (endpoint.protocol === 'https:') return endpoint;
    if (process.env.CI === 'true' && endpoint.protocol === 'http:' &&
      ['127.0.0.1','localhost'].includes(endpoint.hostname)) return endpoint;
    return null;
  } catch { return null; }
}

export function configuredHttpModel(provider: Exclude<ModelProviderId, 'zai'>): HttpModelConfig | null {
  const names: Record<Exclude<ModelProviderId, 'zai'>, [string, string]> = {
    openai: ['EAINESY_OPENAI_MODEL','EAINESY_OPENAI_API_KEY'],
    gemini: ['EAINESY_GEMINI_MODEL','EAINESY_GEMINI_API_KEY'],
    claude: ['EAINESY_CLAUDE_MODEL','EAINESY_CLAUDE_API_KEY'],
    ollama: ['EAINESY_OLLAMA_MODEL',''],
    custom: ['EAINESY_MODEL_NAME','EAINESY_MODEL_API_KEY'],
  };
  const [modelVar, keyVar] = names[provider];
  const model = process.env[modelVar]?.trim();
  if (!model || model.length > 150 || /[\r\n]/.test(model)) return null;
  const key = keyVar ? process.env[keyVar]?.trim() : null;
  if (provider !== 'ollama' && !key) return null;
  if (provider === 'ollama' && process.env.EAINESY_OLLAMA_LOOPBACK_ENABLED !== 'true') return null;
  const raw = provider === 'custom' ? process.env.EAINESY_MODEL_ENDPOINT : KNOWN_ENDPOINTS[provider];
  const endpoint = raw ? secureEndpoint(raw, provider === 'ollama') : null;
  if (!endpoint) return null;
  // Anthropic's compatibility shim has model-specific temperature constraints.
  return { provider, endpoint, model, apiKey: key || null, sendTemperature: provider !== 'claude' };
}

export function providerIsConfigured(provider: ModelProviderId): boolean {
  if (!configuredProviderIds().includes(provider)) return false;
  return provider === 'zai' ? true : configuredHttpModel(provider) !== null;
}

export function selectableProviders(): ModelProviderId[] {
  return configuredProviderIds().filter(providerIsConfigured);
}

/**
 * A selection is pinned by the orchestration layer per conversation.
 * Check both parser and generator BEFORE any model is called.
 */
export function resolveModelRoute(requested?: ModelRoute): ModelRoute | null {
  const defaultProvider = defaultModelProvider();
  if (!defaultProvider) return null;
  const route = requested ?? { parser: defaultProvider, generator: defaultProvider };
  if (!PROVIDERS.includes(route.parser) || !PROVIDERS.includes(route.generator)) return null;
  if (!providerIsConfigured(route.parser) || !providerIsConfigured(route.generator)) return null;
  return { parser: route.parser, generator: route.generator };
}
