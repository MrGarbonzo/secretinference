# Known Issues

## IA004 — registrations array missing
ERC-8004 validator shows IA004 warning: missing registrations array in agent
metadata JSON. This file is hosted by the SecretVM platform, not this repo.
Fix: SecretVM dashboard needs to add the agentId and registry to the agent
metadata after on-chain registration. Same issue as SecretRelay.

## Response surcharge not enforced via x402
The x402 gate charges the base price ($0.005) before the LLM call because
response size is unknown pre-call. The response size surcharge is calculated
and logged post-call but not enforced via payment. This will be addressed
in a future version with session-based billing.

## Streaming not supported
stream: true is rejected with 400. Streaming requires chunked transfer
encoding through the TEE which adds complexity. Planned for v2.

## LLM provider sees the request
The TEE seals transport between agent and enclave only. The forwarded
request to the LLM provider (OpenAI, etc.) is a standard HTTPS call —
the provider still sees the prompt. For fully sealed inference, use
SecretAI (Secret Network's native LLM service).
