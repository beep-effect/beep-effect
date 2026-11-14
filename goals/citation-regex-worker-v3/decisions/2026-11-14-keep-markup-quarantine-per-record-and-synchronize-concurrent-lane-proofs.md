---
title: "Keep markup quarantine per record and synchronize concurrent lane proofs"
date: 2026-11-14
reversal: "Restore aggregate bookkeeping only with an equivalent per-record confirmation proof; retain deterministic overlap."
---

Each markup job owns its quarantine contribution. Remove reap's aggregate reset:
a concurrently registered record must remain quarantined until its own confirmed
retirement. NativeProcess retirement rechecks isRunning, closes the child Scope,
then invokes binding.release; the standalone binding invokes notification.confirm,
which drains its listeners once. A successful record.retire(true) therefore runs
that record's Markup onRetired callback. The callback decrements only when the
same record's uncertain flag was set by its failed retirement. If confirmation
wins the race, acknowledged prevents the increment; otherwise one increment is
matched by one callback decrement. No saturation clamp or blanket reset is needed.

A real-process regression holds reap on captured record A, lets B's retirement
expire, confirms A and checks B remains quarantined with starts refused. B's late
confirmation restores zero; repeated reap stays zero and started equals confirmed.
The test fails against the old reset for both Bun and Node children.

Force the first two composition spawns through a test-only Deferred barrier so
two admitted requests have live children before either proceeds. Keep exact peak
2. The other lane peak-2 proof already gates its two live child bodies on a
Deferred; serial peak-1 proofs do not depend on scheduling.

Respect the owner's reverted parent-runtime tests and restored producer-recovery
comment. Correct the evidence to 165 green Node-parent files / 740 tests, plus
three Node-parent red files with six passes / 26 failures due to Bun.version.
Existing goal references are retained; no new test goal-path reference is added.
