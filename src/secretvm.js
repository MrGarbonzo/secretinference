import crypto from 'crypto';
import { ethers } from 'ethers';

export function buildHeaders(privateKey, method, path, body) {
  const timestamp = Date.now().toString();
  const payload = `${method}${path}${body}${timestamp}`;
  const requestHash = crypto.createHash('sha256').update(payload).digest('hex');

  const wallet = new ethers.Wallet(privateKey);
  const messageBytes = ethers.getBytes('0x' + requestHash);
  const signature = wallet.signMessageSync(messageBytes);

  return {
    'x-agent-address': wallet.address,
    'x-agent-signature': signature,
    'x-agent-timestamp': timestamp,
  };
}
