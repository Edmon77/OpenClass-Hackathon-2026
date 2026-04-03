#!/usr/bin/env bash
# Example: call Campus Assistant after signing in (replace TOKEN and API host).
# Obtain TOKEN from login response or SecureStore in dev.
#
#   export API_URL=http://localhost:3000
#   export JWT=eyJhbGciOiJIUzI1NiIs...
#
set -euo pipefail
API_URL="${API_URL:-http://localhost:3000}"
JWT="${JWT:?Set JWT to a valid Bearer token}"

curl -sS -X POST "${API_URL}/ai/chat" \
  -H "Authorization: Bearer ${JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{ "role": "user", "content": "Who am I and what can you help with?" }],
    "client_context": { "screen": "curl", "platform": "script" }
  }' | jq .
