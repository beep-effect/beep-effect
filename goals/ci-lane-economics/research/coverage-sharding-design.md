# Coverage Regression scope and sharding design — 2026-08-13

## Accepted input evidence

PR #684 run `31727475076`, job `94539333691`, is the accepted zero-cache
source profile: 227/227 tasks passed, 0 were cached, the Turbo graph took
27m02s, and the ratchet compared all 124 packages. The complete job took
28m23s. Package-reported coverage durations total 3,140 seconds across 123
packages; the one package without a duration receives a conservative 15-second
default. The long poles are `@beep/repo-cli` (768s), `@beep/repo-utils` (449s),
`@beep/lexical-schema` (126s), and `@beep/professional-desktop` (87s).

## Pull-request scope

Affected coverage resolves each changed path against the current workspace
owners that define a `coverage` script.

- Directly changed coverage owners become exact Turbo filters.
- Every selected owner must emit `coverage-summary.json`; omission is a hard
  failure even when the owner is new to the committed baseline.
- Root/global coverage inputs, unknown paths, deleted workspaces, and package
  manifests that may have removed a coverage task force a complete fallback.
- Goal, research, exploration, changeset, allowlisted root-documentation, and packages
  without a coverage task are a successful no-op.

The committed regression comparison is unchanged: a real metric regression
still fails. The only previous behavior removed is the unsafe equation of
"scoped" with "every missing summary is acceptable."

## Complete-run shape

Complete fallback and push runs remain one `Coverage Regression` fleet job:

1. Clean stale coverage outputs once.
2. Prebuild the workspace once with the existing fleet concurrency of four.
3. Run coverage with `turbo run coverage --only` in five concurrent,
   single-task shards, so dependency builds are neither skipped nor repeated.
4. Collect the disjoint per-package summaries and run the unchanged full
   ratchet comparison.

Least-loaded placement uses the accepted hosted package durations checked into
the planner. Current baseline owners resolve to five stable shards containing
1, 18, 34, 35, and 36 packages with modeled weights of 768, 599, 598, 598, and
598 seconds. All 124 owners appear exactly once. New packages use a 15-second
default and enter the same deterministic name-tiebroken placement.

## Admission and rollback

The local full-path proof passed on 2026-08-13 with remote cache disabled.
All five shards completed without shutdown or OOM in 5m00s, 5m01s, 5m12s,
6m02s, and 8m24s; the last shard was the intentionally isolated
`@beep/repo-cli` long pole. The ratchet collected and compared all 124 package
summaries. This proves the execution shape and completeness invariant, but it
does not replace the live fleet timing admission.

The live PR admission must prove all summaries, all regression tests, no runner
shutdown/OOM, and complete job wall time below 20 minutes. Any source change
that makes a true regression green, omits a selected summary, or loses a full
owner rejects the design. The change adds no job or VM, so projected fleet
spend remains unchanged.
