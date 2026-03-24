import axios from 'axios';

const ATTESTATION_ENDPOINT = process.env.ATTESTATION_ENDPOINT || 'http://172.17.0.1:29343/cpu';

export async function getAttestation(requestHash) {
  try {
    const res = await axios.post(ATTESTATION_ENDPOINT, { data: requestHash }, {
      timeout: 10000,
    });
    return {
      enclave_id: res.data.enclave_id || res.data.id,
      request_hash: requestHash,
      timestamp: res.data.timestamp || Date.now(),
      sig: res.data.sig || res.data.signature,
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
    const res = await axios.get(ATTESTATION_ENDPOINT, { timeout: 10000 });
    const data = res.data;

    // Extract TLS fingerprint from reportdata if present
    let tls_fingerprint = 'unknown';
    if (data.reportdata) {
      // reportdata typically contains the sha256 of the TLS cert
      tls_fingerprint = 'sha256:' + data.reportdata.substring(0, 64);
    }

    return {
      enclave_id: data.enclave_id || data.id || 'unknown',
      measurements: {
        mrtd: data.mrtd ? 'sha384:' + data.mrtd : undefined,
        rtmr0: data.rtmr0 ? 'sha384:' + data.rtmr0 : undefined,
        rtmr1: data.rtmr1 ? 'sha384:' + data.rtmr1 : undefined,
        rtmr2: data.rtmr2 ? 'sha384:' + data.rtmr2 : undefined,
        rtmr3: data.rtmr3 ? 'sha384:' + data.rtmr3 : undefined,
      },
      tls_fingerprint,
      tdx_quote: data.tdx_quote || data.quote,
      timestamp: data.timestamp || Date.now(),
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
