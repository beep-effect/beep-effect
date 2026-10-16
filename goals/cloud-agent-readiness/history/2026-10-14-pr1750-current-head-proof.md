# PR 1750 current-head proof and first CI triage — 2026-10-14

## Clean worker proof at ae91b527c5

Created a disposable detached worker checkout at exact PR head
ae91b527c5f7e5acac173397303d763c615b0eb7.
Frozen Bun 1.4.2 install passes. No active worker proof jobs existed beforehand.
Submitted serial cheap gates through beep-worker-yeet, with --base HEAD,
--detach and a 20-minute ceiling, preserving the existing worker slice limits.
Fallow's actual audit base was origin/main at
c6c9acb7a20f7555e8ebb8198d003bd73ea32237. The clean branch tree, not the dirty
worker readiness checkout, supplied the proof source. Turbo cache reuse was
allowed; this is not a cache-free rerun.

Job 1c0946b4-aa8c-40ed-b1eb-0b858bdc0e1a finished success in 539,442 ms. Normal
systemd finalization records success, exit 0, invocation
eb30ccf4459949efb69ceca5e4c0df92; job wait exits zero. All collected cheap lanes
pass. Uncached Fallow audit and health report zero findings, with health taking
168,779 ms. Observed MemoryPeak=6,101,340,160 bytes stays below unchanged worker
limits; this is an observation, not a final maximum after unit collection.
The source remains ae91b527c5; a later test-fixture fix must have its own proof.

## Hosted CI triage at the same head

Three Vercel contexts explicitly report the daily deployment limit, not source
failures. Their statuses are optional deployment failures, not proof of deployed
applications. CodeRabbit says draft PR not reviewed; its success status is not
a code-review result. No review threads existed at the first inspection.

Heavy jobs were admitted but queued for the organization beep-ec2-heavy pool.
The organization runner API showed one online busy runner and two offline
registrations at inspection; repository-scoped runner listing alone was empty.
Existing runner sizing/budget policy was not changed. Pending jobs are unknown,
not green or inherited source failures.

Test Unit (repo-cli-2), job 116047944365 in run 38620930203, completed red:
2996 passed, seven skipped, two failed in yeet-wave-rerun.test.ts. Both failures
were unexpected systemctl calls querying detailed recovery properties. This
branch adds that recovery observation; the wave fixture only knew LoadState.
The failures reproduce locally: nine pass, two fail in the 11-test wave file.

Updated only the fake systemd process response to represent the existing live
monitor job: active/running, nonzero main PID and task count. Unknown commands
still fail. Production recovery behavior and the wave assertions are unchanged.
The wave file and full proof-job regressions then pass: 115 tests in two files,
22.12 seconds. This is the fix for an introduced fixture integration gap, not an
inherited main failure or a relaxed recovery predicate.

Private logs and plan remain under local ~/.cache/beep/pr1750/. Worker job logs,
verdict and Turbo summaries remain in its disposable proof checkout until
archived. Full/heavy hosted checks and remaining shard/property results were
still pending when this receipt was written; no merge-ready claim is made.

## Fixed wave-fixture head 10d3daa28b

The new wave fixture passes on beep-worker: all 115 wave/proof-job tests in
45.17 seconds, under the existing worker slice. Fresh full serial cheap gates
at 10d3daa28bbbe2bd403eb3473efd096fb7744122 pass in 589,793 ms. Job
4229a558-f84f-46bc-94f8-dd4e68acbb59 records normal systemd success, exit zero,
invocation 07f793e6060e41c6afa65376291b00fb; job wait exits zero. The actual
import-law scan takes 97,883 ms and schema-first 121,677 ms; observed peak
7,180,320,768 bytes remains under unchanged worker limits. Cache reuse remains
allowed. Hosted repo-cli shards, aggregate Test Unit and Property Laws are green
at this head, closing the original stale-wave-fixture CI failures.

Hosted Heavy Check then identifies ten TS2345 errors in models-check.test.ts:
expected raw strings were supplied to assertions over branded ModelId values.
Use the existing exported ModelId schema and decodeEffect inside the test's
Effect generator to construct expected values. All identifiers remain identical;
main-owned seeds/schema/service and installed routing manifests are unchanged.
A first decodeSync draft triggered the test checker's effect(schemaSync) rule;
it was replaced before committing. Model runtime tests pass (17), and the full
local test-tsgo command checks 348 test files and exits zero. The broader three
focused files also passed 132 runtime tests before the effectful decode change;
model tests were rerun after that change. Hosted merge-preview tests additionally
include newer main files, so fresh hosted Check remains required.

## Stale hosted heavy jobs attributed to Spot reclamation

At 10d3daa28b, all unit/property runs and Heavy Build, Docgen, Doctest and
Integration were green. Heavy Check's ten branded-ID test errors were the
remaining known source failure. Lint Policy (job 116056002704) and Coverage
Regression (116056002649) still reported in_progress on runners
beep-ci-i-0e90d82b87e47f1bd and beep-ci-i-08cb700f80e496458.

Using the already approved worker op run AWS environment, read-only EC2
instance status identified both as terminated. Spot request records identify
both closed with instance-terminated-no-capacity, updated
2026-10-14T19:48:28+00:00. This attributes loss to Spot capacity reclamation,
not a source assertion or an unexplained OOM. The workflow was canceled only
after confirming these were its sole remaining jobs and both assigned instances
were gone. The fixes will get fresh hosted qualification; canceled lost-runner
jobs remain unknown rather than being waived or counted green. No runner cap,
instance type, Spot policy, budget, state or infrastructure deployment changed.
