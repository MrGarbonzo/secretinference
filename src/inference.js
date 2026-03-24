import axios from 'axios';
import crypto from 'crypto';

export async function callLLM(inferenceReq) {
  const { provider_url, api_key, ...rest } = inferenceReq;

  // Build forwarded body — exclude routing/auth fields, force stream off
  const forwardBody = { ...rest, stream: false };

  try {
    const response = await axios.post(provider_url, forwardBody, {
      headers: {
        'Authorization': `Bearer ${api_key}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });

    const responseBytes = Buffer.byteLength(JSON.stringify(response.data));

    const requestHash = crypto.createHash('sha256').update(JSON.stringify({
      provider_url,
      model: inferenceReq.model,
      messages: inferenceReq.messages,
      timestamp: Date.now(),
    })).digest('hex');

    return {
      status: response.status,
      body: response.data,
      requestHash,
      responseBytes,
    };
  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return { error: true, code: 'upstream_timeout' };
    }
    if (err.response) {
      const status = err.response.status;
      if (status === 401 || status === 403) {
        return { error: true, code: 'auth_error', status };
      }
      return { error: true, code: 'upstream_error', status };
    }
    return { error: true, code: 'upstream_error', status: 500 };
  }
}
