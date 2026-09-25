# Re-record the baseline after merging `main` into `perf/vitest-cache-levers`

`perf/vitest-cache-levers` re-recorded the reviewed baseline to accept the
`!.fallow/**` input negation on every root task that hashes `$TURBO_DEFAULT$`
(`fallow-input-exclusion-baseline-review.md`). Meanwhile `main` re-recorded the
same file to accept the `@beep/fc-runs` and `@beep/test-runner` development
dependency edges the identity Effect Vitest wave added
(`effect-vitest-identity-runner-dependency-baseline-review.md`, PR #1216).

Both sides replaced the single-line generated projection, so merging `main`
into the branch conflicts on `standards/cache-qualification-baseline.json`. The
projection is a deterministic census of the merged tree, so the resolution is a
fresh `beep cache baseline` run on the merged checkout rather than a hand-merged
JSON. The merged projection carries both accepted deltas: the narrowed input
sets from the fallow exclusion and the two new identity dependency edges. No
command, cache flag, output declaration or global configuration changed beyond
what those two reviews already accepted.

Accept the merged projection in the legacy configuration baseline. This review
grants no runtime qualification. Retain the identity/types scope,
`local-linux-x64-bun1.4.2` profile and `qualification-v2` epoch; the
qualification ledger is untouched.
