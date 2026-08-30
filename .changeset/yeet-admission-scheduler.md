---
{}
---

No release: land ship-velocity D1 — the machine-wide weighted admission scheduler for
heavyweight repo work.

A full proof no longer fails fast against a busy coordinator. Contenders enqueue a durable
ticket under `${XDG_RUNTIME_DIR}/beep/admit/` and wait with a visible progress line; one
token is ~5 GiB, capacity is `min(10, floor((MemAvailable − 10) / 5))` with a 15 GiB hard
floor, and weights are full-proof 3 / merged-preview 5 / review-fix 1 (class cap 3) /
publish 1. Publish proofs queue with priority and a waiting verify ages to equal priority
after two minutes; running work is never preempted.

The per-origin v3 proof lock is retained unchanged for artifact integrity. A new
non-blocking acquisition (`acquireFullProofLockOrObserve`) turns `refuse-active` into
stay-queued while legacy v2 and unreadable locks keep failing closed. Leases record pid
plus `/proc` start time and heartbeat every 5 seconds; reaping happens only on pid death
or start-time mismatch, and malformed state quarantines visibly. Operators inspect and
repair with `bun run beep quality scheduler status|reap` (reap dry-run by default).
