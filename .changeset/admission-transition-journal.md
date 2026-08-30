---
{}
---

No release: retain admission linkage across the ticket→lease handoff and journal
admission transitions.

Leases now carry the ticket `nonce` and enqueue instant (legacy lease files decode
with `""`/`0` sentinels), and a ring-buffered best-effort NDJSON journal at
`$XDG_RUNTIME_DIR/beep/admit/journal.ndjson` records admitted/released events keyed
by ticket nonce and pid, so granted queue-wait (admittedAt − enqueuedAt) survives
lease release instead of erasing with the ticket and lease files.
