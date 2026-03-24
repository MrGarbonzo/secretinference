import https from 'https';
import axios from 'axios';

const ATTESTATION_ENDPOINT = process.env.ATTESTATION_ENDPOINT || 'https://172.17.0.1:29343/cpu';

// Axios instance that skips TLS verification (self-signed cert inside TEE)
const teeClient = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  timeout: 10000,
});

// TDX Quote v4 field offsets (after 48-byte header)
const HEADER_LEN = 48;
const MRTD_OFFSET = HEADER_LEN + 136;
const MRTD_LEN = 48;
const RTMR0_OFFSET = HEADER_LEN + 328;
const RTMR1_OFFSET = HEADER_LEN + 376;
const RTMR2_OFFSET = HEADER_LEN + 424;
const RTMR3_OFFSET = HEADER_LEN + 472;
const RTMR_LEN = 48;
const REPORTDATA_OFFSET = HEADER_LEN + 520;
const REPORTDATA_LEN = 64;

function parseQuote(raw) {
  // Endpoint returns hex-encoded text — decode to binary
  let buf;
  if (typeof raw === 'string' && /^[0-9a-f]+$/i.test(raw.trim())) {
    buf = Buffer.from(raw.trim(), 'hex');
  } else if (Buffer.isBuffer(raw)) {
    // Check if buffer contains hex ASCII
    const asText = raw.toString('utf8').trim();
    if (/^[0-9a-f]+$/i.test(asText)) {
      buf = Buffer.from(asText, 'hex');
    } else {
      buf = raw;
    }
  } else {
    return null;
  }

  if (buf.length < REPORTDATA_OFFSET + REPORTDATA_LEN) {
    return null;
  }

  const mrtd = buf.subarray(MRTD_OFFSET, MRTD_OFFSET + MRTD_LEN).toString('hex');
  const rtmr0 = buf.subarray(RTMR0_OFFSET, RTMR0_OFFSET + RTMR_LEN).toString('hex');
  const rtmr1 = buf.subarray(RTMR1_OFFSET, RTMR1_OFFSET + RTMR_LEN).toString('hex');
  const rtmr2 = buf.subarray(RTMR2_OFFSET, RTMR2_OFFSET + RTMR_LEN).toString('hex');
  const rtmr3 = buf.subarray(RTMR3_OFFSET, RTMR3_OFFSET + RTMR_LEN).toString('hex');
  const reportdata = buf.subarray(REPORTDATA_OFFSET, REPORTDATA_OFFSET + REPORTDATA_LEN).toString('hex');

  return { mrtd, rtmr0, rtmr1, rtmr2, rtmr3, reportdata, raw: buf };
}

export async function getAttestation(requestHash) {
  try {
    const res = await teeClient.get(ATTESTATION_ENDPOINT, { responseType: 'text' });
    const parsed = parseQuote(res.data);
    return {
      enclave_id: parsed ? parsed.mrtd : 'unknown',
      request_hash: requestHash,
      timestamp: Date.now(),
      sig: parsed ? parsed.raw.toString('base64').substring(0, 64) : 'unknown',
    };
  } catch (err) {
    console.warn('[attestation] Failed to get attestation, returning dev mock:', err.message);
    return {
      enclave_id: 'dev-mock',
      request_hash: requestHash,
      timestamp: Date.now(),
      sig: 'dev-mock',
    };
  }
}

export async function getFullAttestation() {
  try {
    const res = await teeClient.get(ATTESTATION_ENDPOINT, { responseType: 'text' });
    const parsed = parseQuote(res.data);

    if (!parsed) {
      throw new Error('TDX quote too short or invalid format');
    }

    // TLS fingerprint is first 32 bytes of reportdata (sha256 of TLS cert)
    const tls_fingerprint = 'sha256:' + parsed.reportdata.substring(0, 64);

    return {
      enclave_id: parsed.mrtd,
      measurements: {
        mrtd: 'sha384:' + parsed.mrtd,
        rtmr0: 'sha384:' + parsed.rtmr0,
        rtmr1: 'sha384:' + parsed.rtmr1,
        rtmr2: 'sha384:' + parsed.rtmr2,
        rtmr3: 'sha384:' + parsed.rtmr3,
      },
      tls_fingerprint,
      tdx_quote: parsed.raw.toString('base64'),
      timestamp: Date.now(),
    };
  } catch (err) {
    console.warn('[attestation] Failed to get full attestation, returning dev mock:', err.message);
    return {
      enclave_id: 'dev-mock',
      measurements: {
        mrtd: 'dev-mock',
        rtmr0: 'dev-mock',
        rtmr1: 'dev-mock',
        rtmr2: 'dev-mock',
        rtmr3: 'dev-mock',
      },
      tls_fingerprint: 'dev-mock',
      tdx_quote: 'dev-mock',
      timestamp: Date.now(),
    };
  }
}
