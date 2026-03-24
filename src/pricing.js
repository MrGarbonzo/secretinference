export function calculatePrice(req, responseBytes) {
  const base = 0.005;
  const responseSurchargeUnits = Math.max(0, Math.ceil((responseBytes - 5120) / 10240));
  const responseSurcharge = responseSurchargeUnits * 0.001;
  const attest = req.query.attest === 'true' ? 0.001 : 0;
  const total = base + responseSurcharge + attest;
  return '$' + total.toFixed(3);
}
