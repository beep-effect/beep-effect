# Verified runtime identity in the native task key

Changing an installed dependency can change identity lint's verdict without
changing its previous native Turbo hash. Both exact clients replayed cached
success after the imported Effect export became deprecated, while forced
fresh execution failed. The
[counterexample](./installed-dependency-cache-counterexample.json) retains all
six observations. The task configuration, selected source and lockfile were
unchanged. Keeping a toolchain digest only in a receipt did not prevent reuse.

## Native repair experiments

Two isolated experiments each perform four observations per client: seed a
successful cache entry, change installed bytes and request reuse, execute
fresh against the change, then restore the original bytes and request reuse.
The original retained dependency tree is verified before and after each
experiment; the controlled export changes use separate read-only overlays.

- The [installed-tree experiment](./installed-dependency-keyed-observation.json)
  calculates the effective mounted tree's digest inside the namespace and
  declares that value as `BEEP_CACHE_DEPENDENCY_DIGEST`.
- The [toolchain experiment](./runtime-keyed-invalidation-observation.json)
  inserts the effective tree into the reviewed toolchain and calculates its
  digest with the existing fingerprint function. It declares
  `BEEP_CACHE_TOOLCHAIN_DIGEST` as a native task input.

Both experiments invalidate the native hash, observe fresh failure for the
deprecated export and safely reuse the original success after restoration.
All five assertions per client pass. The toolchain prototype retains the
reviewed stable client pin when calculating its value for both channels;
the durable runner's requested-client substitution is a separate addition.

## Durable runner

Identity's child task now declares `BEEP_CACHE_TOOLCHAIN_DIGEST` and retains
`cache: false`. Its `^lint` edge remains present; types lint remains excluded
and fresh. The canonical baseline writer accepts this single declaration
change without changing the executable population, task command or edge.
The immutable [baseline review](./runtime-key-baseline-review.md),
[delta](./runtime-key-baseline-delta.json) and
[request](./runtime-key-baseline-request.json) preserve that writer input.

The pilot verifies the installed tree, derives the runtime digest from its
observed toolchain with the requested native Turbo pin, then places the value
after scenario environment overrides. Both initial dry plans and selected
run summaries must contain its native hashed environment observation.
Receipts use `cache-pilot-local/v5` with
`runtimeKeying: toolchain-sha256-env/v1`. `toolchainDigest` describes the
reviewed normal source runtime; `runtimeKeyDigest` binds the requested client.

The first full stable/canary runs stop at the metadata guard. Source review
found that the existing child-config perturbation replaces the entire env
list, deleting the new key. It now appends its test variable. The named
missing-child control continues to remove the declaration deliberately, and
its per-run metadata observation receives no correctly-keyed credit. The
failed full attempts receive no complete-matrix credit.

## Current validation

The corrected [stable](./pilot-runtime-key-v5-stable.json) and
[canary](./pilot-runtime-key-v5-canary.json) matrices each pass all 40 checks
across 67 observations and ten local shadow decisions. Native runtime-key
metadata is present in 65 observations per client; only the named missing-child
changed/replay controls omit it. Each client records 44 successful fresh
selected executions, 19 local hits and four expected fresh failures, with
65 fresh dependency executions.

Stable's runtime key equals the reviewed toolchain digest
`cd534958140e4c797791a78b5cb25cef090ea20154b396734914fdb5f1552964`.
Canary's runtime key is
`717a7a3b4ad97b3e6570092ac3e2f099c7f7115d92d936ef1f03d8111c5ca4c7`.
Reconstructing the reviewed toolchain serialization reproduces its original
digest; substituting each receipt's requested version and binary hash then
reproduces that client's runtime key exactly.

Final CLI
package verification passes its audit in 411.4 seconds and docgen in 26.9
seconds. Source typechecking and formatting pass. The preceding full CLI
package run passed its audit in 525.6 seconds and docgen in 18.1 seconds,
before the child-control correction. Identity's complete package gate passes
in 5.2 seconds for audit and 2.5 seconds for docgen. The focused fingerprint,
dependency and pilot tests pass all 20 cases; the fingerprint regression now
also verifies that native client bytes alter runtime identity independently
of configuration identity.

The earlier [queued checkpoint](./runtime-key-queued-checkpoint.json) preserves
the requests, immutable admission snapshots, observer sources and completed
package checks as observed before either matrix completed. It retains that
historical pending state. The [final checkpoint](./runtime-key-checkpoint.json)
binds both completed receipts, the corrected observer sources and the current
verification results.

The [entrypoint review](./runtime-key-entrypoint-review.md) and
[request](./runtime-key-entrypoint-request.json) bind 294 source files and six
complete snapshots. All five planner/workflow projections are byte-identical
to their retained predecessors, as verified by the
[parity receipt](./runtime-key-planner-parity.json). The command groups bind
the new census. These attachments establish source identity only.

## Remaining authority

Ordinary CI, Quality and Yeet invocations do not yet calculate and seed the
verified runtime key. The [entrypoint seam review](./runtime-key-entrypoint-seams.md)
records the existing owners and required execution-boundary tests. The new
task declaration and local runner are insufficient for live activation.

The installed-tree adversary is retained as a bounded native experiment;
complete durable runtime-mutation coverage, shared-library and ambient-input
semantics, read/write/capture adversaries, signed conformance/trust integration,
dynamic entrypoint execution, adoption handoff and final Yeet/reflect closeout
remain required. No tuple qualifies and no live reuse is enabled by this work.
