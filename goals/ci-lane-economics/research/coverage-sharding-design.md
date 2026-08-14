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
3. Run coverage with `turbo run coverage --only` in eight concurrent,
   single-task shards. The measured `@beep/repo-cli` and `@beep/repo-utils`
   long poles retain two Vitest workers; the six mixed shards use one worker
   each. Aggregate test-process fan-out remains capped at 10, exactly matching
   the merged five-shard candidate; dependency builds are neither skipped nor
   repeated.
4. Collect the disjoint per-package summaries and run the unchanged full
   ratchet comparison.

The workflow appends every Turbo summary from the prebuild and shard processes,
so full-run cache, task-count, duration, and long-pole telemetry remains
complete even though the lane now launches multiple Turbo processes.

Least-loaded placement uses hosted package durations checked into the planner.
The 20 largest durations from PR #707 override the older PR #684 profile and
account for roughly 60% of measured package test time; the older evidence
continues to weight the tail. The 127 current coverage owners resolve to eight
stable shards containing 1, 1, 17, 22, 22, 21, 21, and 22 packages. The two
long poles are isolated at modeled weights of 721 and 605 seconds, while the
six mixed shards are balanced at 450 two-worker-equivalent seconds before
their per-shard worker limit is applied. Every owner appears exactly once.
New packages use a 15-second default and enter the same deterministic
name-tiebroken placement.

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
still size worker pools from the same eight-vCPU host. The next candidate
preserved four weighted shards but capped each Vitest pool at two workers,
bounding aggregate test fan-out at the host's CPU count. A focused local
coverage run under that cap passed all 90 `@beep/repo-cli` files and 1,492
tests (five skipped) in 6m55s without the hosted timeout failures. The forced
full local path then passed with remote cache disabled: the one-time prebuild
took 23 seconds, the four shards completed 5, 32, 44, and 44 tasks in 8m32s,
8m06s, 9m06s, and 9m40s, and the ratchet compared all 124 summaries. Live
retry job `94625871718` confirmed the correctness repair but rejected the
timing shape: all 124 summaries passed, yet a 3m38s prebuild plus shards at
15m32s, 16m58s, 17m26s, and 18m23s produced a 23m23s job. The next candidate
raised the explicit cap to three workers per shard. Its forced full-path proof
passed locally, but live PR #707 job `94641084512` rejected both correctness
and timing after 23m08s: the 3m30s prebuild led into three green mixed shards
at 16m05s-17m16s, while the repo-cli shard failed at 18m16s when CPU
contention pushed a bounded-work assertion to 1026.30ms against 1000ms.

The live phase breakdown exposed the missed boundary: repo-cli's Vitest config
sets `fileParallelism: false`, so raising `maxWorkers` could not shorten its
728.76 seconds of serial imports. A coverage-only override passed the complete
local repo-cli suite without exclusions: three workers completed 90 files and
1,514 tests (five skipped) in 141.26 seconds, and the safer two-worker probe
completed them in 200.86 seconds with identical coverage. The next candidate
therefore uses five stable weighted shards with `--fileParallelism=true` and
`--maxWorkers=2`. It bounds aggregate test-process fan-out at 10 rather than
the rejected three-worker candidate's 12, while the fifth shard reduces each
non-repo-cli weight from about 800 to about 608 seconds. After `origin/main`
advanced twice, a fresh forced local full-path proof passed on exact base
`9c621da122` with remote cache unavailable. The prebuild completed 128/128 tasks
in 2m36s; the five shards completed 1, 18, 35, 36, and 37 tasks in 3m45s, 5m19s,
5m34s, 7m26s, and 6m55s; and the ratchet compared all 126 baseline packages.
Every task was a cache miss, and there was no shutdown or OOM. Local timing
still cannot satisfy the hosted wall-time gate.

Final PR #707 run `31766791221`, job `94664247028`, accepted the five-shard
candidate's correctness but rejected its economics. The job took 23m14s and
the verification step took 22m00s. Its zero-cache 128-task prebuild took
3m39s; all five shards passed in 12m03s, 15m13s, 15m46s, 18m15s, and 17m39s;
and the ratchet compared all 126 baseline packages. There was no timeout,
runner shutdown, or OOM. The live task profile showed that the longest mixed
tail queues, rather than the isolated `@beep/repo-cli` shard, controlled wall
time. The PR was merged externally immediately after the green job, before its
timing could be admitted, so the merged shape remains correctness-green but
economics-rejected.

The successor keeps the same job, VM, file-parallel coverage path, and
aggregate cap of 10 Vitest workers. It isolates `@beep/repo-utils` alongside
`@beep/repo-cli`, then redistributes the remaining tail from four two-worker
queues into six one-worker queues. This changes scheduling granularity without
increasing total worker fan-out: `2 + 2 + (6 × 1) = 10`. The #707 live weights
predict independent mixed queues rather than the observed 18m15s straggler;
hosted wall time remains the admission authority.

The successor's forced local full-path proof passed on exact base
`93e403dac2` with remote cache disabled. The prebuild completed 128/128 tasks
in 55 seconds. Shards 1-8 completed 1, 1, 17, 22, 22, 21, 21, and 22 tasks in
3m42s, 3m21s, 5m50s, 5m21s, 5m36s, 5m37s, 5m08s, and 5m59s. Every task was a
cache miss; the ratchet compared all 126 baseline packages; and there was no
test failure, runner shutdown, or OOM. The proof accepts correctness and the
resource bound only—local wall time is not the fleet admission result.

The live PR admission must prove all summaries, all regression tests, no runner
shutdown/OOM, and complete job wall time below 20 minutes. Any source change
that makes a true regression green, omits a selected summary, or loses a full
owner rejects the design. The change adds no job or VM, so projected fleet
spend remains unchanged.
