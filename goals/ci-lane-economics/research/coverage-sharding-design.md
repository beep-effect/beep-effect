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
- Rename detection is disabled for the changed-path census so a cross-package
  move selects both the source and destination owners.
- Tracked repository fixtures consumed by coverage tests map to their consuming
  owner; current goal-backed repo-cli fixtures select `@beep/repo-cli`.
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
3. Run coverage with `turbo run coverage --only` in four concurrent,
   single-task shards, capping each Vitest process at two workers so aggregate
   test fan-out fits the fleet worker's eight vCPUs; dependency builds are
   neither skipped nor repeated.
4. Collect the disjoint per-package summaries and run the unchanged full
   ratchet comparison.

The workflow appends every Turbo summary from the prebuild and shard processes,
so full-run cache, task-count, duration, and long-pole telemetry remains
complete even though the lane now launches multiple Turbo processes.

Least-loaded placement uses the accepted hosted package durations checked into
the planner. The 125 current owners resolve to four stable shards containing
5, 32, 44, and 44 packages with modeled weights of 793 seconds each. Every
owner appears exactly once; `@beep/shacl` is the one current owner not yet in
the 124-package committed baseline. New packages use a 15-second default and
enter the same deterministic name-tiebroken placement.

## Admission and rollback

The first local full-path proof passed on 2026-08-13 with remote cache disabled.
All five candidate shards completed without shutdown or OOM in 5m00s, 5m01s,
5m12s, 6m02s, and 8m24s; the last shard was the intentionally isolated
`@beep/repo-cli` long pole. The ratchet collected and compared all 124 package
summaries. Live fleet job `94583467537` then rejected that five-way shape: the
job passed correctness in 22m18s, but the four mixed shards took 14m59s to
15m54s and the isolated `@beep/repo-cli` shard took 20m16s under aggregate
five-way contention. The first four-shard fleet attempt, job `94608048289`,
then ran for 24m10s and failed: its three mixed shards passed in
15m30s-16m46s, while the `@beep/repo-cli` shard took 19m13s and produced ten
5-second timeout failures plus one 1-second timing-bound failure. One Turbo
task per shard did not bound the Vitest subprocesses, so four packages could
still size worker pools from the same eight-vCPU host. The revised candidate
preserves four weighted shards but caps each Vitest pool at two workers,
bounding aggregate test fan-out at the host's CPU count. A focused local
coverage run under that cap passed all 90 `@beep/repo-cli` files and 1,492
tests (five skipped) in 6m55s without the hosted timeout failures. The forced
full local path then passed with remote cache disabled: the one-time prebuild
took 23 seconds, the four shards completed 5, 32, 44, and 44 tasks in 8m32s,
8m06s, 9m06s, and 9m40s, and the ratchet compared all 124 summaries. That is
the candidate submitted for live fleet admission; local timing alone does not
satisfy the hosted wall-time gate.

The live PR admission must prove all summaries, all regression tests, no runner
shutdown/OOM, and complete job wall time below 20 minutes. Any source change
that makes a true regression green, omits a selected summary, or loses a full
owner rejects the design. The change adds no job or VM, so projected fleet
spend remains unchanged.
