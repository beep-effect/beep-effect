# CLI test scheduling measurements, 2026-11-06

Two independent scheduling changes preserve test selection, assertions and worker
isolation. Hosted follow-up measurements are required before claiming a CI saving.

## Deep property sweep

The CLI property configuration previously forced `fileParallelism: false`. The
same suites already run concurrently in the ordinary unit lane. The deep sweep
now retains its exact content-selected include list and `isolate: true`, while
using at most three workers. Doctests retain serial execution. Property iteration
floors and seeds are unchanged.

On [#2754's Property Laws job](https://github.com/beep-effect/beep-effect/actions/runs/42219820232/job/127898786821),
the CLI ran 116 files / 4,152 tests in 1,165.11 seconds. Its whole job took 20m45s.
These are before-change hosted observations, including different setup scopes.

A local optimized run on the earlier base before merging #2754 passed 116 files / 4,149
tests in 265.79 seconds (whole command 266.47 seconds). GNU time reported
2,753,744 KiB peak RSS, which is not an aggregate of concurrent child processes.
The serial local control exceeded the ten-minute compute cutoff and was stopped;
it is not a complete passing baseline. The runs briefly overlapped on a shared
workstation, so no controlled local percentage improvement is claimed. The three
additional tests on the later hosted head came from #2754, not a selection change.

After merging main, a second optimized run with the CI seed passed all 116 files /
4,152 tests in 268.77 seconds. Full CLI package verification passed (audit 191.7s,
docgen 42.8s). This establishes preserved test counts; hosted timing remains pending.

Reproduce from `packages/tooling/tool/cli` on each revision:

```sh
BEEP_FC_NUM_RUNS=400 BEEP_FC_SEED=20260708 \
  /usr/bin/time -v bunx --bun vitest run --maxWorkers=3
```

## Six measured unit shards

The [green #2751 run](https://github.com/beep-effect/beep-effect/actions/runs/42207995910)
at `4324aa1dd81afc4093f453f5255a38f08b7e73cc` supplies 412 per-file test durations
across its six CLI shards. Their sums ranged from 125.580 to 511.996 seconds.
These sums exclude import/setup overhead and are not elapsed job times.

`vitest.shards.json` records a deterministic assignment: sort observed files by
duration descending, break ties by path, and assign each to the least-loaded
bucket, breaking ties by index. The resulting six estimated totals are each
approximately 336.563 seconds. This reduces the largest *historical assigned
weight* by about 34%; it is a scheduling estimate, not a measured CI speedup.

The sequencer changes only sharding. It retains Vitest's normal sorting within a
shard. Each collected file appears exactly once; files missing from the plan use
Vitest's default hash partition over the unknown set. Removed files never enter
collection. Shard counts other than six retain Vitest's original implementation.
The property sweep is unsharded and does not use the assignment.

Validation against the actual collected specifications found all 412 files once,
with shard counts 63/70/70/69/70/70, no omissions and no duplicates. An added-file
control remained present once; a three-shard control matched the base sequencer.
`vitest list --shard` itself does not apply the sequencer, so comparing its output
alone is not proof of shard membership.

Refresh the committed plan from complete green runs after substantial test-cost
changes. Retain the source run and commit, include every observed file once, and
repeat the union/disjointness and unknown-file controls. Timing estimates do not
control test admission, coverage scope, assertions or pass/fail policy.

To reverse, restore the serial property configuration and remove the custom
sequencer plus its assignment file. No persistent cache or migration is involved.

## Bound stalled native-tool setup

The [CLI shard 1 job on #2754](https://github.com/beep-effect/beep-effect/actions/runs/42219820232/job/127898787055)
reached its one-hour limit while `apt-get update` waited on the Ubuntu mirror.
It never reached test execution. This is setup failure, not a slow test suite.

Native PDF setup now bounds apt metadata refresh to 180 seconds and installation
to 300 seconds, with 15 seconds of termination grace for each. HTTP/HTTPS waits
are 20 seconds, retries are two, and package-lock waits are 30 seconds. Any failed
repository refresh fails the step instead of silently using incomplete indexes.
The dnf alternative has a 300-second limit and bounded network retries too.
`timeout` runs inside the privilege wrapper so it can terminate package-manager
children. Existing installations still run `pdftotext -v`; missing or broken PDF
tools never produce a passing setup.

Eleven shell fixture cases passed, covering apt/dnf success, update/install error
propagation, stalls, preinstalled tools and unsupported managers. Accelerated real
GNU timeout controls killed both a TERM-ignoring process and its child. Workflow
lint and shell syntax checks passed. This bounds wasted time on a failed setup;
it does not claim faster normal installation or a hosted saving yet. Slow but
healthy mirrors can now fail earlier and require a job retry. Reversal restores
the previous package-manager commands.

The initial hosted config check also caught two Effect policy violations in the
sequencer boundary. The repair uses the platform Path service and Effect promise
boundary. Config type checking, package lint/check and the 412-file partition
controls pass after that repair.
