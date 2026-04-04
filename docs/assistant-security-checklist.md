# Assistant Security Checklist

Use this checklist before releasing assistant changes.

## Identity and Isolation

- Assistant local history is scoped per signed-in user ID.
- Logging out clears assistant state for the current account.
- Legacy global assistant cache keys are removed/migrated safely.
- Assistant requests always use the current JWT identity.

## Authorization and Role Scope

- Non-CR students cannot create/cancel bookings via assistant proposals.
- CR users can only create/cancel bookings within active CR scope.
- Teachers can only create/cancel bookings for offerings assigned to them.
- Admin users can perform booking proposal actions across campus scope.
- Confirm endpoints revalidate role/scope before mutating data.

## Proposal Lifecycle

- Proposal owner is always checked on confirm/cancel.
- Proposal expiry blocks stale confirm actions.
- Client UI disables expired confirm/cancel actions.

## Reliability and Error Semantics

- Assistant chat failures return categorized error codes (`rate_limit`, `timeout`, `upstream_error`, `tool_error`).
- Client retries transient failures once before showing terminal error.
- In-flight assistant requests are canceled on account switch/unmount.

## Observability

- Server logs include request id, rounds, used tools, and proposal action outcomes.
- Failures include category and enough context to debug without leaking PII.
