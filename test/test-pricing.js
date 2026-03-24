import { calculatePrice } from '../src/pricing.js';

const mockReq = (attest) => ({ query: { attest: attest ? 'true' : 'false' } });

const tests = [
  { desc: 'small response no attest',   req: mockReq(false), bytes: 1000,  expected: '$0.005' },
  { desc: '20kb response no attest',    req: mockReq(false), bytes: 20480, expected: '$0.007' },
  { desc: 'small response with attest', req: mockReq(true),  bytes: 1000,  expected: '$0.006' },
  { desc: '20kb response with attest',  req: mockReq(true),  bytes: 20480, expected: '$0.008' },
];

let passed = 0;
for (const t of tests) {
  const result = calculatePrice(t.req, t.bytes);
  const ok = result === t.expected;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${t.desc}: got ${result}, expected ${t.expected}`);
  if (ok) passed++;
}
console.log(`\n${passed}/${tests.length} passed`);
if (passed !== tests.length) process.exit(1);
