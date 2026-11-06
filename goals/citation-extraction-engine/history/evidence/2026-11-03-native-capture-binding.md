# Native slices and raw built-in token capture binding

This private integration adapts pinned eyecite 2.7.6 at
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`, using CPython 3.11.15.
It does not promote the public tokenizer or any regex family to complete.

## Behavior and ownership

`PythonUnicode.ts` measures a native Python-point subrange, calls the existing
allocation-approval port, and only then allocates canonical little-endian
storage. Width can shrink from four to two to one; literal surrogate words
remain distinct from scalar characters. The prepared RegexInput owner validates
bounds and captures the deadline. The 137 independent slice observations cover
empty ranges, width shrinkage, surrogate boundaries and interruptible scans.

`TokenCapture.ts` consumes a transport-owned decoded result cursor, its exact
source owner and compiler group metadata. It selects group one, maps named groups
in ordinal definition order, preserves unmatched/null groups, and applies offsets.
The transport caller must bind source, program and cursor before issuance.
Committed oracle frames are collected/decoded by the target result adapter in
these tests; this is not additional native-worker execution proof.

The existing token store lends its remaining capacity under Effect Semaphore.
Candidate capacity is checked before invoking the producer; every field slice
checks cumulative retained units before allocating. Publication follows complete
construction. The callback must not reenter the same token store. The existing
operation ledger remains responsible for whole-operation output reservations;
the beforeAllocate port is captured service configuration, never request data.
No new generic concurrency, framing or resource manager is introduced.

All 378 built-in constructors, 15 valid Citation extras/offset observations and
54 actual source failures match. Missing capture precedes invalid kwargs, exact
empty keyword dictionaries reject unknown fields, and ordinal sorting restores
source group order despite sorted JSON keys. All 216 earlier merge identity and
truth controls remain required. Concurrent construction under one remaining
candidate slot permits one publication and refuses the other before materializing.
General custom constructors, Python iterable extras, mutation protocols, wider
capture profiles and final public tokenizer composition remain open.

## Reproduction and checks

- Native slice producer SHA-256:
  `36f005738a602418c5cf782154f523d5e10e07bcceb79fe265e3929d0d875895`.
- Native slice fixture SHA-256:
  `8c2e33785c8f38fd84875570f6e293c4e573384926e9bc7ba58b1ce8baccdec3`.
- Token-object producer SHA-256:
  `0e96c350228ac776d863d8300ba7c5c52a41f58670f5aa5273d03fa7a45909d8`.
- Token-object v2 fixture SHA-256:
  `220603353c0c1536be49c48d132abdcfa9b6bbd861b6acba08c2ac68640ddbd2`.

Both fixtures regenerate byte-identically after formatting. The pre-main-merge
checkpoint passes 37 focused tests in nine files, quick server lint/type checks,
scoped Oxlint and new-only Fallow with zero introduced findings. Deadline,
invalid-bound, ownership, preallocation refusal and concurrent capacity controls
are included. Effect 4.1.2 integration requires fresh verification after merging.
Fresh-process edition hash generation is not claimed by frozen-profile replay.

## Policy review and hosted failure repair

Seven fixture suites now use BunFileSystem.layer instead of broad BunServices.
Their seven EV010 resource exceptions authenticate real committed source-oracle
files through the shared fixture loader. A separately populated memory filesystem
would remove that artifact authentication. Owner: citation-extraction-engine.
Exit: replace these layers when an authenticated corpus is injected independently.
No unrelated existing findings are waived.

The RuntimeSet and integration ExtractorSelection codec-advisory exceptions cover
independent source golden replay, corruption and resource controls. Random fixture
values cannot replace the source observations; separate RegexInput properties
exercise generated native values. Owner: citation-extraction-engine. Exit: remove
the golden-only exception if generated laws replace the applicable source replay.
Both inventory checks pass at this checkpoint; no semantic waiver is added.

The Node-only Party boundary suite is excluded only from Bun coverage and kept in
the existing disjoint Node continuation. Four Node tests pass. No production
coverage exclusions or floors change. The reviewed cache writer stamps the server
subject, carries 192 prior reviews, and its audit reports zero blocking findings.
The generated script audit reports 193 manifests and zero drifting script blocks.
Hosted confirmation for the newly published head remains necessary.

## Effect 4.1.2 merge verification

The native capture implementation is committed as `17f15c1f68`. Its merge with
published conflict repair `815ddda047` brings in main `31e2ac20f3` and Effect 4.1.2.
Newly enforced diagnostics require separating yielded values from call arguments
throughout the private server adapters and their tests. The adaptation preserves
left-to-right effect execution, short-circuit conditions and per-iteration work.
Optional results use Effect.asSome; test-only Node bundling uses Effect.promise
because a rejected build is deliberately a defect. No diagnostic is suppressed.

After adaptation, quick server and domain lint/type checks pass. The 57 tests in
14 focused files pass; a final 21-test subset rechecks native admission, capture,
objects and Unicode dictionary mutation. An inherited direct Arbitrary.checkEffect
in ClaimElement.input is moved to the provided it.effect.prop registration with
the same 100 runs and seed; all 14 tests in that file pass. Fallow's new-only audit
passes with zero introduced findings (27 complexity and 59 duplication findings
are inherited). Scoped server source/test Oxlint passes.

Inventory refresh retains the previously reviewed shorter child Scope and fixed
independent race-trial exceptions after inspecting the adapted code. None of the
trials retry a failed outcome, and each child still retires before its slot is
reused. Schema-first refresh updates moved evidence locations while preserving
review reasons and unrelated inventory records. Broader runtime and coverage
verification remains a hosted-CI obligation on the next pushed head.
