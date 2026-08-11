# Codex build-mode census raw report

Date: 2026-08-10

Branch supplied by operator: `research/build-mode-census`

No git command was run. No Yeet command was run.

## Environment

```text
Version 7.0.2+effect-tsgo.0.24.3
Linux workstation 7.1.6-1-cachyos x86_64 GNU/Linux
nproc: 64
RAM: 125 GiB total, 78 GiB available at start
Swap: 125 GiB total, 32 GiB used at start
Start load average: 19.31, 28.27, 35.52
End load average: 32.23, 35.48, 35.26
```

The sandbox process namespace did not expose the host processes responsible for the load.

## Common accepted baseline command

Run from each package directory:

```sh
bunx tsgo --version
bunx tsgo -b tsconfig.json --clean
/usr/bin/time -v timeout --signal=INT --kill-after=30s 1200s \
  bunx tsgo -b tsconfig.json
```

The following blocks preserve the complete `/usr/bin/time -v` output. Successful `tsgo` runs
produced no other output.

## Baseline: @beep/epistemic-server

```text
Version 7.0.2+effect-tsgo.0.24.3
	Command being timed: "timeout --signal=INT --kill-after=30s 1200s bunx tsgo -b tsconfig.json"
	User time (seconds): 165.79
	System time (seconds): 7.16
	Percent of CPU this job got: 468%
	Elapsed (wall clock) time (h:mm:ss or m:ss): 0:36.90
	Average shared text size (kbytes): 0
	Average unshared data size (kbytes): 0
	Average stack size (kbytes): 0
	Average total size (kbytes): 0
	Maximum resident set size (kbytes): 25975680
	Average resident set size (kbytes): 0
	Major (requiring I/O) page faults: 11
	Minor (reclaiming a frame) page faults: 7622736
	Voluntary context switches: 64877
	Involuntary context switches: 146545
	Swaps: 0
	File system inputs: 4368
	File system outputs: 74008
	Socket messages sent: 0
	Socket messages received: 0
	Signals delivered: 0
	Page size (bytes): 4096
	Exit status: 0
```

## Baseline: @beep/types

```text
Version 7.0.2+effect-tsgo.0.24.3
	Command being timed: "timeout --signal=INT --kill-after=30s 1200s bunx tsgo -b tsconfig.json"
	User time (seconds): 0.24
	System time (seconds): 0.04
	Percent of CPU this job got: 496%
	Elapsed (wall clock) time (h:mm:ss or m:ss): 0:00.05
	Average shared text size (kbytes): 0
	Average unshared data size (kbytes): 0
	Average stack size (kbytes): 0
	Average total size (kbytes): 0
	Maximum resident set size (kbytes): 77208
	Average resident set size (kbytes): 0
	Major (requiring I/O) page faults: 0
	Minor (reclaiming a frame) page faults: 32626
	Voluntary context switches: 2593
	Involuntary context switches: 34
	Swaps: 0
	File system inputs: 0
	File system outputs: 456
	Socket messages sent: 0
	Socket messages received: 0
	Signals delivered: 0
	Page size (bytes): 4096
	Exit status: 0
```

## Baseline: @beep/html

```text
Version 7.0.2+effect-tsgo.0.24.3
	Command being timed: "timeout --signal=INT --kill-after=30s 1200s bunx tsgo -b tsconfig.json"
	User time (seconds): 26.53
	System time (seconds): 1.03
	Percent of CPU this job got: 315%
	Elapsed (wall clock) time (h:mm:ss or m:ss): 0:08.74
	Average shared text size (kbytes): 0
	Average unshared data size (kbytes): 0
	Average stack size (kbytes): 0
	Average total size (kbytes): 0
	Maximum resident set size (kbytes): 3444332
	Average resident set size (kbytes): 0
	Major (requiring I/O) page faults: 0
	Minor (reclaiming a frame) page faults: 918931
	Voluntary context switches: 22809
	Involuntary context switches: 3398
	Swaps: 0
	File system inputs: 0
	File system outputs: 69928
	Socket messages sent: 0
	Socket messages received: 0
	Signals delivered: 0
	Page size (bytes): 4096
	Exit status: 0
```

## Baseline: @beep/md

```text
Version 7.0.2+effect-tsgo.0.24.3
	Command being timed: "timeout --signal=INT --kill-after=30s 1200s bunx tsgo -b tsconfig.json"
	User time (seconds): 28.45
	System time (seconds): 1.19
	Percent of CPU this job got: 297%
	Elapsed (wall clock) time (h:mm:ss or m:ss): 0:09.97
	Average shared text size (kbytes): 0
	Average unshared data size (kbytes): 0
	Average stack size (kbytes): 0
	Average total size (kbytes): 0
	Maximum resident set size (kbytes): 3947452
	Average resident set size (kbytes): 0
	Major (requiring I/O) page faults: 0
	Minor (reclaiming a frame) page faults: 1056362
	Voluntary context switches: 26770
	Involuntary context switches: 3225
	Swaps: 0
	File system inputs: 0
	File system outputs: 69056
	Socket messages sent: 0
	Socket messages received: 0
	Signals delivered: 0
	Page size (bytes): 4096
	Exit status: 0
```

## Baseline: @beep/agents-server

```text
Version 7.0.2+effect-tsgo.0.24.3
	Command being timed: "timeout --signal=INT --kill-after=30s 1200s bunx tsgo -b tsconfig.json"
	User time (seconds): 41.82
	System time (seconds): 1.55
	Percent of CPU this job got: 346%
	Elapsed (wall clock) time (h:mm:ss or m:ss): 0:12.53
	Average shared text size (kbytes): 0
	Average unshared data size (kbytes): 0
	Average stack size (kbytes): 0
	Average total size (kbytes): 0
	Maximum resident set size (kbytes): 4408736
	Average resident set size (kbytes): 0
	Major (requiring I/O) page faults: 0
	Minor (reclaiming a frame) page faults: 1179517
	Voluntary context switches: 46037
	Involuntary context switches: 5352
	Swaps: 0
	File system inputs: 0
	File system outputs: 93432
	Socket messages sent: 0
	Socket messages received: 0
	Signals delivered: 0
	Page size (bytes): 4096
	Exit status: 0
```

## Baseline: @beep/ontology-ui

```text
Version 7.0.2+effect-tsgo.0.24.3
	Command being timed: "timeout --signal=INT --kill-after=30s 1200s bunx tsgo -b tsconfig.json"
	User time (seconds): 56.66
	System time (seconds): 2.17
	Percent of CPU this job got: 421%
	Elapsed (wall clock) time (h:mm:ss or m:ss): 0:13.97
	Average shared text size (kbytes): 0
	Average unshared data size (kbytes): 0
	Average stack size (kbytes): 0
	Average total size (kbytes): 0
	Maximum resident set size (kbytes): 6226484
	Average resident set size (kbytes): 0
	Major (requiring I/O) page faults: 0
	Minor (reclaiming a frame) page faults: 1658827
	Voluntary context switches: 72733
	Involuntary context switches: 8064
	Swaps: 0
	File system inputs: 96
	File system outputs: 120848
	Socket messages sent: 0
	Socket messages received: 0
	Signals delivered: 0
	Page size (bytes): 4096
	Exit status: 0
```

## Baseline: @beep/db-admin

```text
Version 7.0.2+effect-tsgo.0.24.3
	Command being timed: "timeout --signal=INT --kill-after=30s 1200s bunx tsgo -b tsconfig.json"
	User time (seconds): 113.18
	System time (seconds): 4.18
	Percent of CPU this job got: 476%
	Elapsed (wall clock) time (h:mm:ss or m:ss): 0:24.60
	Average shared text size (kbytes): 0
	Average unshared data size (kbytes): 0
	Average stack size (kbytes): 0
	Average total size (kbytes): 0
	Maximum resident set size (kbytes): 12433868
	Average resident set size (kbytes): 0
	Major (requiring I/O) page faults: 0
	Minor (reclaiming a frame) page faults: 3952310
	Voluntary context switches: 149558
	Involuntary context switches: 14921
	Swaps: 0
	File system inputs: 0
	File system outputs: 123072
	Socket messages sent: 0
	Socket messages received: 0
	Signals delivered: 0
	Page size (bytes): 4096
	Exit status: 0
```

## Baseline: @beep/repo-cli

```text
Version 7.0.2+effect-tsgo.0.24.3
	Command being timed: "timeout --signal=INT --kill-after=30s 1200s bunx tsgo -b tsconfig.json"
	User time (seconds): 54.49
	System time (seconds): 1.88
	Percent of CPU this job got: 405%
	Elapsed (wall clock) time (h:mm:ss or m:ss): 0:13.91
	Average shared text size (kbytes): 0
	Average unshared data size (kbytes): 0
	Average stack size (kbytes): 0
	Average total size (kbytes): 0
	Maximum resident set size (kbytes): 5335988
	Average resident set size (kbytes): 0
	Major (requiring I/O) page faults: 0
	Minor (reclaiming a frame) page faults: 1492628
	Voluntary context switches: 62051
	Involuntary context switches: 6224
	Swaps: 0
	File system inputs: 0
	File system outputs: 145904
	Socket messages sent: 0
	Socket messages received: 0
	Signals delivered: 0
	Page size (bytes): 4096
	Exit status: 0
```

## Baseline: @beep/professional-desktop, initial

```text
Version 7.0.2+effect-tsgo.0.24.3
	Command being timed: "timeout --signal=INT --kill-after=30s 1200s bunx tsgo -b tsconfig.json"
	User time (seconds): 443.27
	System time (seconds): 15.27
	Percent of CPU this job got: 398%
	Elapsed (wall clock) time (h:mm:ss or m:ss): 1:54.97
	Average shared text size (kbytes): 0
	Average unshared data size (kbytes): 0
	Average stack size (kbytes): 0
	Average total size (kbytes): 0
	Maximum resident set size (kbytes): 38647076
	Average resident set size (kbytes): 0
	Major (requiring I/O) page faults: 0
	Minor (reclaiming a frame) page faults: 13386335
	Voluntary context switches: 205763
	Involuntary context switches: 86162
	Swaps: 0
	File system inputs: 3880
	File system outputs: 191864
	Socket messages sent: 0
	Socket messages received: 0
	Signals delivered: 0
	Page size (bytes): 4096
	Exit status: 0
```

## Baseline: @beep/professional-desktop, rerun

```text
Version 7.0.2+effect-tsgo.0.24.3
	Command being timed: "timeout --signal=INT --kill-after=30s 1200s bunx tsgo -b tsconfig.json"
	User time (seconds): 446.58
	System time (seconds): 16.48
	Percent of CPU this job got: 378%
	Elapsed (wall clock) time (h:mm:ss or m:ss): 2:02.43
	Average shared text size (kbytes): 0
	Average unshared data size (kbytes): 0
	Average stack size (kbytes): 0
	Average total size (kbytes): 0
	Maximum resident set size (kbytes): 49898372
	Average resident set size (kbytes): 0
	Major (requiring I/O) page faults: 13
	Minor (reclaiming a frame) page faults: 14801639
	Voluntary context switches: 173688
	Involuntary context switches: 291545
	Swaps: 0
	File system inputs: 39552
	File system outputs: 192160
	Socket messages sent: 0
	Socket messages received: 0
	Signals delivered: 0
	Page size (bytes): 4096
	Exit status: 0
```

## P2 override

The target-only override was:

```json
{
  "composite": false,
  "declaration": false,
  "declarationMap": false
}
```

After closure clean, target cleanup reported:

```text
target_dist_files=0
target_buildinfo=absent
```

## P2: @beep/epistemic-server

```text
Version 7.0.2+effect-tsgo.0.24.3
	Command being timed: "timeout --signal=INT --kill-after=30s 1200s bunx tsgo -b tsconfig.json"
	User time (seconds): 152.89
	System time (seconds): 7.14
	Percent of CPU this job got: 492%
	Elapsed (wall clock) time (h:mm:ss or m:ss): 0:32.48
	Average shared text size (kbytes): 0
	Average unshared data size (kbytes): 0
	Average stack size (kbytes): 0
	Average total size (kbytes): 0
	Maximum resident set size (kbytes): 25253908
	Average resident set size (kbytes): 0
	Major (requiring I/O) page faults: 4
	Minor (reclaiming a frame) page faults: 7480948
	Voluntary context switches: 99392
	Involuntary context switches: 24397
	Swaps: 0
	File system inputs: 1104
	File system outputs: 16120
	Socket messages sent: 0
	Socket messages received: 0
	Signals delivered: 0
	Page size (bytes): 4096
	Exit status: 0
```

## P2: @beep/md

```text
Version 7.0.2+effect-tsgo.0.24.3
clean_exit_status=0
target_dist_files=0
target_buildinfo=absent
	Command being timed: "timeout --signal=INT --kill-after=30s 1200s bunx tsgo -b tsconfig.json"
	User time (seconds): 30.82
	System time (seconds): 1.37
	Percent of CPU this job got: 276%
	Elapsed (wall clock) time (h:mm:ss or m:ss): 0:11.62
	Average shared text size (kbytes): 0
	Average unshared data size (kbytes): 0
	Average stack size (kbytes): 0
	Average total size (kbytes): 0
	Maximum resident set size (kbytes): 4178720
	Average resident set size (kbytes): 0
	Major (requiring I/O) page faults: 0
	Minor (reclaiming a frame) page faults: 1125293
	Voluntary context switches: 22262
	Involuntary context switches: 3281
	Swaps: 0
	File system inputs: 0
	File system outputs: 71424
	Socket messages sent: 0
	Socket messages received: 0
	Signals delivered: 0
	Page size (bytes): 4096
	Exit status: 0
```

## P3: @beep/fc-runs isolated declarations

Config override:

```json
{
  "isolatedDeclarations": true
}
```

Raw output:

```text
Version 7.0.2+effect-tsgo.0.24.3
	Command being timed: "timeout --signal=INT --kill-after=30s 1200s bunx tsgo -b tsconfig.json"
	User time (seconds): 0.55
	System time (seconds): 0.10
	Percent of CPU this job got: 686%
	Elapsed (wall clock) time (h:mm:ss or m:ss): 0:00.09
	Average shared text size (kbytes): 0
	Average unshared data size (kbytes): 0
	Average stack size (kbytes): 0
	Average total size (kbytes): 0
	Maximum resident set size (kbytes): 144132
	Average resident set size (kbytes): 0
	Major (requiring I/O) page faults: 0
	Minor (reclaiming a frame) page faults: 59704
	Voluntary context switches: 4589
	Involuntary context switches: 87
	Swaps: 0
	File system inputs: 0
	File system outputs: 376
	Socket messages sent: 0
	Socket messages received: 0
	Signals delivered: 0
	Page size (bytes): 4096
	Exit status: 0
```

No diagnostics were emitted, so the isolated-declarations error count is zero.

## Anomalies and discarded attempts

1. The first multi-row shell preflight used zsh's special `path` and `status` variable names.
   Assigning `path` replaced `PATH`, so `bunx` was not found; assigning `status` then failed
   because it is read-only. No compiler measurement ran and no datum was accepted. The variables
   were renamed to `pkg_dir` and `row_code` before the sweep.
2. The first epistemic P2 attempt showed that `tsgo --clean` under the no-declarations override
   leaves old target `.d.ts` files because they are no longer in that config's output set. The
   timed attempt was interrupted and discarded. Only the generated target `dist` contents and
   target build-info were then deleted; zero files/state were confirmed before the accepted run.
3. Professional desktop varied from 38,647,076 kB to 49,898,372 kB peak under high host load.
   Both complete cold runs are retained. The rerun is the main-table value.
4. No accepted measurement failed, timed out, or exceeded 20 minutes.

## Restoration evidence

The final target config hashes matched the hashes recorded before probes:

```text
bac781d5...  packages/epistemic/server/tsconfig.json
5fdf33eb...  packages/foundation/modeling/md/tsconfig.json
5e909f29...  packages/tooling/test-kit/fc-runs/tsconfig.json
```

The full final hash check also matched every baseline target config. Probe state was cleaned after
restoration. Baseline measurements left generated build outputs and build-info for their closures,
as an ordinary successful cold build does.
