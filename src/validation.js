const DEFAULT_PROVIDERS = [
  'api.openai.com',
  'api.anthropic.com',
  'api.groq.com',
  'api.together.xyz',
  'api.mistral.ai',
  'api.cohere.com',
  'generativelanguage.googleapis.com',
  'api.perplexity.ai',
];

function getAllowedProviders() {
  const env = process.env.ALLOWED_PROVIDERS;
  if (env && env.trim().length > 0) {
    return env.split(',').map(h => h.trim()).filter(Boolean);
  }
  return DEFAULT_PROVIDERS;
}

export function validateInferenceRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, detail: 'Request body must be a JSON object' };
  }

  // provider_url
  if (!body.provider_url || typeof body.provider_url !== 'string') {
    return { valid: false, detail: 'provider_url is required' };
  }

  let parsed;
  try {
    parsed = new URL(body.provider_url);
  } catch {
    return { valid: false, detail: 'provider_url must be a valid URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, detail: 'HTTPS required' };
  }

  const allowed = getAllowedProviders();
  if (!allowed.includes(parsed.hostname)) {
    return { valid: false, detail: 'provider_not_allowed' };
  }

  // api_key
  if (!body.api_key || typeof body.api_key !== 'string') {
    return { valid: false, detail: 'api_key is required' };
  }

  // model
  if (!body.model || typeof body.model !== 'string') {
    return { valid: false, detail: 'model is required' };
  }

  // messages
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { valid: false, detail: 'messages must be a non-empty array' };
  }

  for (let i = 0; i < body.messages.length; i++) {
    const msg = body.messages[i];
    if (!msg || typeof msg.role !== 'string' || typeof msg.content !== 'string') {
      return { valid: false, detail: `messages[${i}] must have role (string) and content (string)` };
    }
  }

  // stream
  if (body.stream !== undefined && body.stream !== false) {
    return { valid: false, detail: 'streaming_not_supported' };
  }

  return { valid: true };
}

export { getAllowedProviders };
