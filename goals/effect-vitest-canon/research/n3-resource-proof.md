# N3 native layer and writer spy ownership

The five codec tests use the public it.layer boundary for N3TurtleCodecLive,
replacing five provisions and their custom Layer.build/scoped helper. The layer
is a stateless Layer.succeed; parsing and serialization allocate per operation.
It needs no container startup budget. The normal sibling tests retain inherited
concurrency. Only the case replacing Writer.prototype.end is nonconcurrent.

The prototype spy is acquired through Effect.acquireRelease in the native test
scope. Its restoration is armed before obtaining the codec or serializing. The
original writer failure message and serializeFailed reason assertions remain.
The vi import comes from Effect Vitest's public re-export; no module mock relies
on static Vitest hoisting. No production source changes.

A private control injects an early defect immediately after spy installation.
The original test leaves Writer.prototype.end replaced; an afterAll restoration
assertion fails the suite with exit 1. The repaired version passes that same
assertion with exit 0. Both runs include the expected-failure test, so the suite
exit and restoration assertion are the evidence, not the failed-test count.
An earlier afterEach probe was insensitive within the expected-failure test and
is excluded from proof. Original file bytes are restored after both probes.

All 15 original assertions and six registrations remain. The two error-equivalence
Boolean assertions use public helpers with unchanged operands and polarity. No
property generator, clock, sample count, seed or test deadline changes. Both
files register through the instrumented runner; generated dependency references
and cache edges are reviewed without cache qualification promotion.
