# Yeet review-fixes runtime preparation

A private, unapplied draft covers 13 existing runtime boundaries, including
one parameterized origin case expanded into two tests. The unchanged baseline
passes all 14 tests on Node and Bun, with stable source hashes and zero
temporary residue. Whole-command observations are Node 10.134 seconds and Bun
7.576 seconds; the concurrent package proof precludes causal comparisons.

The draft uses a public serial PlatformLayer fixture and per-case consoles.
Three direct temporary-directory uses and the coordinator helper's directory
acquisition move to a shared scoped constructor. The coordinator helper still
owns lock cleanup and supplies a distinct test runtime root and memory stats;
its separate wrapper finding remains open. The parameterized case becomes
it.effect.each with the original data and title template.

Six resource-using callbacks retain live clocks. They exercise actual Bun proof
subprocesses or native coordinator admission, including explicit 100 ms sleep
and a two-second overlap deadline. Path-normalization and noop-filesystem cases
retain the default test clock.

Initial preview exposed two inline noop filesystem providers after removing
runtime boundaries. The local Effect reference implements layerNoop as
Layer.succeed(FileSystem)(makeNoop(...)); direct service provision therefore
preserves these stateless overrides without a scoped layer wrapper. The draft
uses Effect.provideService(FileSystem.FileSystem, FileSystem.makeNoop({})) for
those two sites, with unchanged surrounding ConfigProvider/runtime overrides.

All 42 assertion trees are preserved with zero exclusions. Historical runtime
line/evidence/title matching identifies all 13 rows uniquely, including the
parameterized registration. Before applying, verify final preview has no new
findings, then exercise runtime/type/ratchet and resource/coordinator controls
against actual source. No ledger rows are closed by preparation.

## Prepared coordinator verification

The private actual-suite probe builder checks four directory-acquisition sites,
expanded to six resource-using cases; 13 console construction sites, expanded
to 14 instances by the parameterized case; and six live-clock overrides.
Failure and interruption probes are prepared for both directory and coordinator
lock lifetimes. The lock probe writes an owned marker, then checks its removal
immediately after the helper release and before the outer temporary root is
released. This prevents enclosing directory cleanup from masking a broken lock
finalizer. A separate counter requires all three coordinator releases to reach
that check. These probes have only been built against the draft, not executed.

The execution harness uses isolated temporary roots, verifies expected failure
counts/messages, rejects unexpected assertion failures, and restores source
bytes in finally. Applied-source assertion, detector, timing and historical
lineage scripts are prepared. Actual application and verification remain gated
on the preceding package proof finishing.

## Applied revision

The initial retained-wrapper plan was superseded after root ratchet verification
exposed its changed fingerprint. Both wrappers are now migrated, with six
explicit directory acquisitions and a shared scoped coordinator acquisition.
Stateless memory services are provided directly. Applied Node/Bun verification,
including lock-before-directory release controls, is recorded in
`cli-yeet-review-runtime-proof.md`; the earlier draft-only statements above
record preparation history, not current proof status.
