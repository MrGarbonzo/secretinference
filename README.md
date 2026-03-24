# SecretInference

Private LLM inference proxy running inside a [SecretVM](https://secretvm.com) TEE (Trusted Execution Environment). Agents send their API key, model choice, and prompt to the enclave — the operator provably cannot log or inspect any of it. The enclave forwards the request to the chosen LLM provider and returns the response. Pay-per-request via [x402](https://www.x402.org/) (HTTP 402 + USDC on Base).

## Privacy guarantee

**What IS sealed:** Your API key, prompt content, and the LLM response are sealed inside the TEE during transport between your agent and the enclave. The operator running this service cannot read, log, or exfiltrate them — this is enforced by hardware (Intel TDX), not policy.

**What is NOT sealed:** The request from the TEE to the LLM provider (OpenAI, Anthropic, etc.) is a standard HTTPS call. The LLM provider still sees your prompt. SecretInference seals the *transport layer* between you and the proxy — it does not seal the inference itself. For fully sealed inference where no one sees the prompt, use [SecretAI](https://secretai.io) (Secret Network's native LLM service).

**What attestation proves:**
- **RTMR3** proves the exact `docker-compose.yaml` (and therefore the exact code version) running in the enclave. Compare against [RELEASES.md](RELEASES.md) to verify.
- **tls_fingerprint** proves the HTTPS connection terminates directly inside the enclave with no MITM.
- **tdx_quote** is the raw Intel TDX attestation quote, verifiable via Intel DCAP.

## Supported providers

| Provider | Example `provider_url` |
|---|---|
| OpenAI | `https://api.openai.com/v1/chat/completions` |
| Anthropic | `https://api.anthropic.com/v1/messages` |
| Groq | `https://api.groq.com/openai/v1/chat/completions` |
| Together.ai | `https://api.together.xyz/v1/chat/completions` |
| Mistral | `https://api.mistral.ai/v1/chat/completions` |
| Cohere | `https://api.cohere.com/v1/chat` |
| Google AI | `https://generativelanguage.googleapis.com/v1beta/chat/completions` |
| Perplexity | `https://api.perplexity.ai/chat/completions` |

Custom providers can be added via the `ALLOWED_PROVIDERS` environment variable. All providers must use HTTPS.

## Setup

```bash
git clone https://github.com/MrGarbonzo/secretinference.git
cd secretinference
npm install
cp .env.example .env
# Edit .env with your PAYMENT_ADDRESS and other config
npm start
```

## Example requests

### Expect 402 (no payment)

```bash
curl -X POST http://localhost:3000/inference \
  -H "Content-Type: application/json" \
  -d '{
    "provider_url": "https://api.openai.com/v1/chat/completions",
    "api_key": "sk-your-key",
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
# Returns HTTP 402 with x402 payment instructions
```

### Request format (with payment)

```bash
curl -X POST http://localhost:3000/inference \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <x402-payment-header>" \
  -d '{
    "provider_url": "https://api.openai.com/v1/chat/completions",
    "api_key": "sk-your-key",
    "model": "gpt-4o",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is the capital of France?"}
    ],
    "temperature": 0.7,
    "max_tokens": 1000
  }'
```

### With attestation

Append `?attest=true` to include a TDX attestation proof in the response:

```bash
curl -X POST "http://localhost:3000/inference?attest=true" \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <x402-payment-header>" \
  -d '{ ... }'
```

## x402 payment

SecretInference uses the [x402 protocol](https://www.x402.org/) for pay-per-request billing. When you send a request without payment, you receive an HTTP 402 response containing payment instructions (amount, recipient, network).

To make paid requests programmatically, use one of:

- **[x402-axios](https://www.npmjs.com/package/@coinbase/x402-axios)** — drop-in axios wrapper that handles 402 negotiation automatically
- **[AgentKit](https://docs.cdp.coinbase.com/agentkit)** — Coinbase's agent toolkit with built-in x402 support

## Pricing

| Request type | Price |
|---|---|
| Base per request | $0.005 |
| + per 10 KB response over 5 KB | $0.001 |
| + attestation (`?attest=true`) | $0.001 |

> **Note:** The x402 gate charges the base price ($0.005) before the LLM call since response size is unknown. The response surcharge is calculated and logged but not enforced via payment in v1. See [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## Verifying the enclave

1. **Get attestation:** `GET /attest` on a running instance
2. **Check RTMR3:** Compare `measurements.rtmr3` against the docker-compose.yaml for the deployed version in [RELEASES.md](RELEASES.md)
3. **Check TLS fingerprint:** Compare `tls_fingerprint` against the certificate fingerprint of your active TLS connection
4. **Optional:** Submit `tdx_quote` (base64) to an Intel DCAP verification service for full hardware attestation verification

## API endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/inference` | POST | x402 | Private LLM inference |
| `/health` | GET | None | Liveness + facilitator status |
| `/attest` | GET | None | Full TDX attestation quote |
| `/providers` | GET | None | List of allowed LLM providers |

## Relationship to SecretRelay

SecretInference is part of the [attestai.io](https://attestai.io) suite of TEE-sealed services built on Secret Network infrastructure. [SecretRelay](https://github.com/MrGarbonzo/secretrelay) is its sister service — a general-purpose private HTTP proxy. SecretInference is purpose-built for LLM APIs with an OpenAI-compatible request schema, LLM-specific validation, and per-request pricing.

## ERC-8004 registration

SecretInference is discoverable via [8004scan.io](https://8004scan.io) as an ERC-8004 registered agent.

- **Agent ID:** TBD (after on-chain registration)
- **x402 support:** Enabled
- **Trust model:** TEE attestation (primary), Reputation

## Deployment note

SecretInference **must** run inside a SecretVM for the privacy guarantee to hold. The TEE hardware ensures the operator cannot inspect memory, logs, or network traffic inside the enclave. Running outside a TEE degrades the service to a standard proxy — attestation endpoints will return mock values, and there is no hardware-enforced privacy.
