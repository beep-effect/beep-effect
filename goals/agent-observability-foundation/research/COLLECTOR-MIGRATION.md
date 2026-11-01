# Explicit collector cutover and reversal

The reviewed template previously changed the legacy trace receiver from 4318 to
an unpublished metadata-only 4319 receiver when applied. Existing producers could
therefore lose their route without a coordinated cutover. The repaired default
preserves the original trace allowlist and batching on 4318, with no new persistent
raw-trace queue. `monitoring_otel_metadata_route_enabled: true` explicitly selects
the qualified metadata pipeline. Its Compose mapping binds 4319 only to loopback.
Metadata-specific persistence/contract alerts are selected with that mode.

The current monitoring suite passes all 13 tests with pinned-image integration
enabled. A new synthetic runtime case sends exact identities through legacy ->
metadata -> legacy, requires 404 on the old trace endpoint during metadata mode,
and checks that reversing leaves the metadata queue files byte-identical. Queue
exhaustion, process-crash replay, permanent failure and alert semantics pass too.
The first two attempts had test-render fixture errors (missing runtime URL and
nested path values); the actual transition case passed on both attempts. The
final full suite fixes those fixture inputs and passes without skips.

The enabled metadata configuration parses identically to the archived final
retirement canary configuration after its existing project, endpoint and bounded
retry-window substitutions. This bridges the prior installed read-back proof to
the unchanged selected collector behavior; it is not a new live canary or a new
installed-worker source proof. Current source hashes and the comparison input
hash are in `ops/collector-migration-verification.json`.

The Dankserver monitoring test README contains the explicit producer inventory,
pause/drain, destination qualification, visibility check and configuration
reversal procedure. Cross-host transport is not authenticated or published by
this change. One-host local worker transport is loopback only; production
producer enrollment remains separate and requires its own transport proof.
No live collector was changed. The historical forwarder and raw archives remain
held, and rollback never deletes a pending metadata queue or replays old snapshots.
