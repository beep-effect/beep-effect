# Compiled sidecar IPC resource ownership

The test now waits for the native child's exit promise after signalling it. A
child scope registered before process acquisition owns the stderr drain, so
teardown joins process exit, finishes the stderr reader and releases its lock,
then removes the temporary database and ontology directories.

Readiness uses a scoped Effect stream and Deferred. Until boot, the retained
buffer is limited to the marker overlap needed across chunks; after boot, no log
buffer is accumulated. Stderr continues to be forwarded throughout the process
lifetime. Premature EOF and reader failure still fail readiness.

The original 20-second boot and 30-second RPC deadlines now use the public live
tester because the compiled child and OS pipes run on real time. This is a
reasoned native-process exception, not a waiver of the deadlines. The existing
resource-wrapper/public-layer finding retains its open status after an exact
evidence identity refresh.

The canonical IPC command built the real sidecar and ran the enabled fixture
streaming case under Bun. Both the original baseline and repaired ordinary case
pass. This is actual opt-in execution, not the default zero-registration gate.

A before/after control records child-exit state when directory finalizers start.
For safety, even the old control then waits for actual exit before deleting the
directories. The old order is `[false, true]`; the corrected order is
`[true, true]`, and the corrected stderr stream is unlocked after scope closure.
The first stream conversion exposed a retained reader lock; adding explicit
`releaseLockOnEnd` made the combined control pass. All probes were removed.

The Desktop package audit, including Bun unit tests, and Docgen pass (14.1 and
12.4 seconds respectively). RPC subjects and assertions remain unchanged. The
remaining public-layer migration is separate from this resource/clock repair.
