---
title: "TURB-05 force receipt rides the attempt-started row"
date: 2026-11-14
lane: "perf/local-proof-force-reason"
reversal: "Drop the turboForce key from YeetAttemptStarted and the receipt call in runYeet; rows that carry it still decode on revisions without the key."
---

Every repair, verify and publish attempt writes a `turboForce` key on its `attempt-started` journal row: a `TurboForceReceipt` whose `reasons` is the actual decision (forced exactly when non-empty) and whose `shadow` is the narrowed TURB-05 decision. Monitor, closeout and status attempts never decide a force and write no key. The reasons come from the closed `TurboForceReason` kit, and each one forces every dependency-sensitive step:

- `lockfile-changed`: `bun.lock` differs between the merge base and HEAD.
- `patches-changed`: a file under `patches/` or the root `patchedDependencies` changed.
- `overrides-changed`: the root `overrides` or `resolutions` changed.

The attempt row is the per-attempt receipt Yeet economics already reads, and the exploration found no receipt that records the force. Its optional keys decode on older revisions: they ignore keys they do not know, and rows written before this key decode with it absent. The force decision moved from `Handler.ts` into `decideTurboForce` in `Yeet/internal/TurboForce.ts`, kept the same modes, lockfile log line and tolerance of a failed diff, and gained the patch and override triggers (decision file `turb-05-patch-only-commits-unforced-today`). `runYeet` builds the receipt after the `--plan` return, so a plan render reads no lockfile for the shadow and prints no shadow line.

Rejected: a new ProofLedger row kind, because older readers count an unknown row as malformed and YEET-06 needs zero malformed rows; and a separate shadow file, which would need a second writer and its own retention for one field.
