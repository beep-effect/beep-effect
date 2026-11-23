---
title: Journal appends publish outside the write permit, ordered by a baton chain
date: 2026-11-22
reversal: Publish each append's envelopes to the hub while still holding the write permit, and let close publish the terminal Exit after taking the permit, without a timeout.
governs:
  - src/Journal.ts#makeEngine
  - src/Journal.ts#SHUTDOWN_PUBLISH_TIMEOUT
enforcedBy: []
---

The write permit guards only the critical section: reconcile the real tail, validate, write, update the refs. Reconcile runs under it and never waits on a subscriber; local writes and watch pokes both go through it, and it runs before a local write is derived or validated.
While holding the permit, each append or ingest links a fresh Deferred onto `publishBaton`, then awaits its predecessor and publishes outside the permit. Publish order is write order, an append completes only once the hub accepted its envelope, and a stalled subscriber blocks publishers without wedging writers or scope close.
The append installs `Deferred.done` as an ensuring cleanup before the permit can link its Deferred, so interruption during permit release or a suspended publish still releases the chain.
Close has two mechanisms. Refusal: `closed` is set first and read before the permit, so a late append fails fast with `JournalClosed`. Drain: taking the permit waits for the in-flight append and snapshots `publishBaton`, consistent because it is only mutated under that permit. Close then awaits that tail and only then publishes the terminal Exit, which is not on the chain and would otherwise overtake an envelope whose append already completed.
Both halves share `shutdownPublishTimeout` (default `SHUTDOWN_PUBLISH_TIMEOUT`) inside an interruptible region of the uninterruptible finalizer, the only way the timeout can fire. A subscriber that never consumes cannot observe completion, so an unbounded wait would turn one stuck subscriber into a process that cannot shut down.
Rejected: publishing inside the write permit, which lets one slow subscriber wedge every writer and deadlock scope close.
Rejected: an unbounded shutdown wait.
Accepted limit: the end-of-stream ordering guarantee holds for consuming subscribers only.
