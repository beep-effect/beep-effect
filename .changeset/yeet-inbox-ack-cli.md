---
"@beep/repo-cli": minor
---

Add the `yeet inbox` porcelain — `list`, `ack`, and `append` — over the checkout
failure inbox (ship-velocity A2, PR-1 of the hook-mutex series). `yeet-ack/v1`
receipts record what was done about a row (fix SHA, reasoned wontfix, or review
thread URL) under `.beep/inbox/acks/<id>`; the shared inbox view joins each row
with its ack state and its liveness against the `yeet-dispatch/v1` wave record,
so the CLI and the upcoming harness hook adapters provably read the same
contract. `append` validates deterministic row-id integrity for external
writers.
