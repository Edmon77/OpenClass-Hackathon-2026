#!/usr/bin/env bash
# Campus Assistant V2 scenario runner (manual verification).
#
# Usage:
#   export API_URL=http://localhost:3000
#   export JWT=<bearer-token>
#   ./server/scripts/ai-v2-scenarios.sh
#
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
JWT="${JWT:?Set JWT to a valid bearer token}"

say() {
  printf '\n\033[1;34m# %s\033[0m\n' "$1"
}

call_chat() {
  local payload="$1"
  curl -sS -X POST "${API_URL}/ai/chat" \
    -H "Authorization: Bearer ${JWT}" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

say "1) Building-name ambiguity (Gion)"
call_chat '{
  "messages":[{"role":"user","content":"What class is free in Gion building right now?"}],
  "client_context":{"screen":"scenario","platform":"script","route":"/assistant","timezone":"Africa/Addis_Ababa"}
}' | jq .

say "2) Time-window availability check"
call_chat '{
  "messages":[{"role":"user","content":"Check if room B-201 is free from 2026-04-08T06:00:00.000Z to 2026-04-08T08:00:00.000Z"}],
  "client_context":{"screen":"scenario","platform":"script","timezone":"Africa/Addis_Ababa"}
}' | jq .

say "3) Role rules (teacher/CR event types)"
call_chat '{
  "messages":[{"role":"user","content":"What event types can I book as my current role?"}],
  "client_context":{"screen":"scenario","platform":"script"}
}' | jq .

say "4) Propose write action (booking) and extract proposal_id"
RESP="$(call_chat '{
  "messages":[{"role":"user","content":"Create a booking proposal for room 00000000-0000-0000-0000-000000000000 and offering 00000000-0000-0000-0000-000000000000 from 2026-04-08T06:00:00.000Z to 2026-04-08T08:00:00.000Z"}],
  "client_context":{"screen":"scenario","platform":"script"}
}')"
echo "$RESP" | jq .
PROPOSAL_ID="$(echo "$RESP" | jq -r '.proposal.proposal_id // empty')"

if [[ -n "${PROPOSAL_ID}" ]]; then
  say "5) Cancel proposal (idempotency baseline)"
  curl -sS -X POST "${API_URL}/ai/confirm" \
    -H "Authorization: Bearer ${JWT}" \
    -H "Content-Type: application/json" \
    -d "{\"proposal_id\":\"${PROPOSAL_ID}\",\"confirmed\":false}" | jq .

  say "6) Confirming the cancelled proposal should fail"
  curl -sS -X POST "${API_URL}/ai/confirm" \
    -H "Authorization: Bearer ${JWT}" \
    -H "Content-Type: application/json" \
    -d "{\"proposal_id\":\"${PROPOSAL_ID}\",\"confirmed\":true}" | jq .
else
  say "No proposal_id returned (expected if UUID placeholders are invalid)."
fi

say "Done"
