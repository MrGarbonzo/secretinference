#!/bin/bash
BASE=http://localhost:3000

echo "=== Test 1: 402 gate ==="
curl -s -w "\nHTTP %{http_code}\n" -X POST $BASE/inference \
  -H "Content-Type: application/json" \
  -d '{"provider_url":"https://api.openai.com/v1/chat/completions","api_key":"sk-fake","model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}'
echo "(expect HTTP 402)"

echo ""
echo "=== Test 2: streaming rejection ==="
curl -s -w "\nHTTP %{http_code}\n" -X POST $BASE/inference \
  -H "Content-Type: application/json" \
  -d '{"provider_url":"https://api.openai.com/v1/chat/completions","api_key":"sk-fake","model":"gpt-4o","messages":[{"role":"user","content":"hello"}],"stream":true}'
echo "(expect HTTP 400 streaming_not_supported)"

echo ""
echo "=== Test 3: health ==="
curl -s $BASE/health
echo ""
echo "(expect ok: true)"

echo ""
echo "=== Test 4: attest ==="
curl -s $BASE/attest | python3 -m json.tool 2>/dev/null | grep -E '"mrtd"|"rtmr3"|"tls_fingerprint"'
echo "(expect mrtd and rtmr3 fields)"

echo ""
echo "=== Test 5: providers ==="
curl -s $BASE/providers
echo ""
echo "(expect allowed_providers array)"
