# QA round pipeline migration preparation

This is a private-draft checkpoint, not an applied migration or package proof.
The existing inventory selects qa-round-pipeline.test.ts. Current source has
17 whole-callback runPromise boundaries, 12 existing Effect registrations,
27 temporary-directory wrapper calls and seven scoped-layer providers.

All 29 baseline tests pass on Node and Bun with identical source hashes and
zero temporary residue. Whole-command observations are 7.737 seconds on Node
and 4.878 seconds on Bun. The lifecycle package proof runs concurrently;
load and pressure receipts are retained, and these are not controlled speed
comparisons. No source changes occurred during the timing cohort.

SessionStore construction captures filesystem and path services and returns
its method table. The audited constructor has no per-test mutable cache.
The draft uses a serial public fixture for that stable layer, with an explicit
five-second hook timeout. Its native filesystem status is retained; this is
not a Memory filesystem promotion.

The draft replaces 17 runtime boundaries and removes the temporary-directory
callback wrapper. Twenty-one resource uses occupy the whole callback.
Six others occur inside Effect.exit followed by assertions: those need a
shorter scope so cleanup completes, including any cleanup defect, before
the captured Exit is asserted. The draft retains this ordering explicitly.
Five FFmpeg layers contain only service values and become direct providers;
the separate inner console boundary remains explicit. Fresh console defaults
are drafted for all 29 callbacks.

Extracted draft-constructor controls pass on Node and Bun for success, body
failure, interruption and cleanup failure. Every control observes acquisition,
body, cleanup, then continuation. Successful cleanup removes the directory;
injected cleanup failure remains a failed Exit and leaves the directory for
the control harness to remove. These controls are not the applied test suite.

The final draft detector preview retains one native-filesystem judgment and
introduces six shorter-scope judgments while removing 17 runtime, five
wrapper and one provider findings. The initial missing hook-timeout finding
was corrected in the private draft. Baseline membership includes judgment
findings even when marked exception; a reason alone does not authorize a new
membership. Reconcile the six deliberate lifetimes through the packet's
judgment and ratchet policy before applying this draft. Do not erase a needed
scope or hide it from the detector to manufacture a passing ratchet.

No draft has been applied, no inventory row closed, and no baseline changed.
The running lifecycle package proof keeps the package source frozen.
