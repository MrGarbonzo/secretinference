import 'dotenv/config';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import axios from 'axios';
import { validateInferenceRequest, getAllowedProviders } from './validation.js';
import { callLLM } from './inference.js';
import { calculatePrice } from './pricing.js';
import { getAttestation, getFullAttestation } from './attestation.js';
import { buildHeaders } from './secretvm.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const VERSION = '1.0.0';

async function main() {
  const app = express();
  app.use(express.json());

  // Validation middleware — runs before x402 so malformed requests don't consume payment
  function validationMiddleware(req, res, next) {
    const result = validateInferenceRequest(req.body);
    if (!result.valid) {
      if (result.detail === 'streaming_not_supported') {
        return res.status(400).json({ error: 'streaming_not_supported' });
      }
      if (result.detail === 'HTTPS required') {
        return res.status(400).json({ error: 'invalid_provider', detail: 'HTTPS required' });
      }
      if (result.detail === 'provider_not_allowed') {
        return res.status(400).json({ error: 'provider_not_allowed' });
      }
      return res.status(400).json({ error: 'invalid_request', detail: result.detail });
    }
    next();
  }

  // Inference route handler
  async function inferenceHandler(req, res) {
    const reqId = uuidv4();
    const start = Date.now();

    try {
      const result = await callLLM(req.body);

      if (result.error) {
        const latency = Date.now() - start;
        if (result.code === 'upstream_timeout') {
          console.log(`[${reqId}] error=upstream_timeout latency=${latency}ms`);
          return res.status(504).json({ error: 'upstream_timeout' });
        }
        if (result.code === 'auth_error') {
          console.log(`[${reqId}] error=auth_error provider_status=${result.status} latency=${latency}ms`);
          return res.status(401).json({ error: 'auth_error', detail: 'Check your api_key' });
        }
        console.log(`[${reqId}] error=upstream_error provider_status=${result.status} latency=${latency}ms`);
        return res.status(502).json({ error: 'upstream_error', status: result.status });
      }

      const price = calculatePrice(req, result.responseBytes);
      const latency = Date.now() - start;
      console.log(`[${reqId}] price=${price} provider_status=${result.status} response_bytes=${result.responseBytes} latency=${latency}ms`);

      const response = {
        status: 200,
        model: result.body.model,
        usage: result.body.usage || {},
        choices: result.body.choices || [],
      };

      if (req.query.attest === 'true') {
        response.attestation = await getAttestation(result.requestHash);
      }

      return res.json(response);
    } catch (err) {
      const latency = Date.now() - start;
      console.log(`[${reqId}] error=enclave_error latency=${latency}ms`);
      return res.status(500).json({ error: 'enclave_error' });
    }
  }

  // Wire up /inference with optional x402 payment gate
  if (process.env.DISABLE_PAYMENT === 'true') {
    app.post('/inference', validationMiddleware, inferenceHandler);
    console.log('WARNING: Payment gating disabled (DISABLE_PAYMENT=true)');
  } else {
    const networkMap = {
      'base': 'eip155:8453',
      'base-sepolia': 'eip155:84532',
    };
    const network = networkMap[process.env.NETWORK] || 'eip155:84532';

    const facilitatorClient = new HTTPFacilitatorClient({ url: 'https://x402.org/facilitator' });
    const resourceServer = new x402ResourceServer(facilitatorClient)
      .register(network, new ExactEvmScheme());

    const x402Middleware = paymentMiddleware(
      {
        'POST /inference': {
          accepts: {
            scheme: 'exact',
            price: '$0.005',
            network,
            payTo: process.env.PAYMENT_ADDRESS,
          },
          description: 'SecretInference private LLM inference',
        },
      },
      resourceServer,
    );

    app.post('/inference', validationMiddleware, x402Middleware, inferenceHandler);
  }

  // Health check
  app.get('/health', async (_req, res) => {
    let facilitatorReady = false;
    let secretvmConnected = false;

    try {
      await axios.get('https://x402.org/facilitator', { timeout: 5000, maxRedirects: 5 });
      facilitatorReady = true;
    } catch {
      // facilitator unreachable
    }

    if (process.env.SECRETVM_AGENT_PRIVATE_KEY && process.env.SECRETVM_VM_ID) {
      try {
        const vmId = process.env.SECRETVM_VM_ID;
        const path = `/api/v1/vm/${vmId}/agent/balance`;
        const headers = buildHeaders(process.env.SECRETVM_AGENT_PRIVATE_KEY, 'GET', path, '');
        await axios.get(`https://secretvm-api.scrtlabs.com${path}`, {
          headers,
          timeout: 5000,
        });
        secretvmConnected = true;
      } catch {
        // SecretVM unreachable
      }
    }

    res.json({
      ok: true,
      facilitatorReady,
      secretvmConnected,
      service: 'SecretInference',
      version: VERSION,
    });
  });

  // Full attestation
  app.get('/attest', async (_req, res) => {
    try {
      const attestation = await getFullAttestation();
      res.json({
        ...attestation,
        code_version: VERSION,
        secretvm_endpoints: {
          cpu: 'https://inference.attestai.io:29343/cpu',
          docker_compose: 'https://inference.attestai.io:29343/docker-compose',
        },
      });
    } catch (err) {
      console.log('[attest] error fetching attestation');
      res.status(500).json({ error: 'enclave_error' });
    }
  });

  // Providers list
  app.get('/providers', (_req, res) => {
    res.json({
      allowed_providers: getAllowedProviders(),
      note: 'All providers require HTTPS. Custom providers can be added via ALLOWED_PROVIDERS env var.',
    });
  });

  app.listen(PORT, HOST, () => {
    console.log(`SecretInference v${VERSION} listening on ${HOST}:${PORT}`);
  });
}

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
