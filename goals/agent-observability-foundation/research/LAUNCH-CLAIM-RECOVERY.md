# Independent launch claims and collector recovery

The new `observation-launch-claims` service records a launch intention before any
process-start effect. A replayed telemetry receipt is never launch permission.
The claim is consumed even if submission fails, the producer dies, or the child
never starts. This deliberately prefers an explicit unresolved attempt over an
unrecorded duplicate agent run.

## Storage and ownership

Provisioning is explicit. The claim directory must be separate from (and neither
inside nor an ancestor of) the collector journal directory. Both locations and
the claim directory parent are canonical owner-only directories. Enrollment pins
host, namespace, fence identity and capacity. Opening an absent or changed store
fails; it never provisions a replacement automatically.

The store has 1–256 fixed slots, each at most 8192 bytes, plus an anchor of at most
8192 bytes. Exclusive file creation resolves concurrent producers. Each claim is
checksummed, written and synced, and the directory is synced before the operation
is invoked. Incomplete records and capacity exhaustion refuse further work.
No directory scan, automatic deletion, retention reset, or epoch-based retry can
recover permission. Per-instance contention refuses without a waiting queue.
Reading a snapshot is evidence only. A claim does not prove that a child started.

The independent store must survive collector restoration and evidence retirement.
It is not protected against rollback of the claim store itself, malicious changes
by its owning user, or media loss. Loss or uncertain recovery of that store requires
a launch hold and external reconciliation. Never restore an old claim snapshot
and treat it as fresh launch authority. Production ownership, aggregate disk
budget, enrollment and lifecycle are still to be connected and verified.

## Evidence

Twelve focused tests cover ordinary failures, same-attempt rejection across
epochs, concurrent service instances, fixed capacity, missing/overlapping stores,
changed enrollment/permissions/directory identity, torn records, and file/directory
sync failures. Three actual producer processes are killed at controlled boundaries:
before writing the claim, after syncing it, and after performing the operation.
Fresh producer processes cannot repeat those attempts. Two independent producers
racing one attempt execute the synthetic operation exactly once.

An actual SQLite backup is captured before a claim. After the claim and Prepared
fact are recorded, the old backup is restored into a separate collector directory.
The restored collector correctly has no launch facts, but the retained independent
claim still refuses the same launch. This tests the real backup/restore APIs;
changing a mocked journal string is not the supporting restore evidence.

The actual worker verifier now provisions a separate synthetic claim store and
wraps workspace creation, Prepared submission, managed child start, identity
binding and close with `runOnce`. One real child speaks a synthetic Codex protocol;
no provider executable or model request is involved. After the worker restarts,
a new producer refuses the same launch as claimed, while replaying its four
telemetry records returns their original receipts. The worker retains 12 total
facts (eight earlier marked-fixture facts plus four actual-child facts). Native
telemetry retains the matching source-session hash. All owned units are stopped.

Exact source fingerprints and verification results are recorded in
`ops/history/launch-claims-verification.json` and
`ops/history/launch-claims-entrypoint-verification.json`.

## Lifecycle outbox follow-through

Immutable observations and exact acknowledgment reconciliation now compose in the
same independent claim owner. The bounded footprint includes three fact and four
receipt slots per claim in addition to the original claim slot. See
[durable lifecycle outbox](LAUNCH-OUTBOX-RECOVERY.md) for current semantics, actual
crash/lost-ack/restore proof and residual production boundaries. The original claim
receipt remains historical evidence for its captured revision.

Production controller wiring, explicit enrollment, real CLI and desktop canaries,
backup policy, external alerts, final independent review and repository delivery
remain required. The historical forwarder and all historical stores are unchanged.
