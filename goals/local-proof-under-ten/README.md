# Local Proof Under Ten

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make local publish and verify predictable under agent fan-out by extending the existing QualityScheduler: lane or package admission units with measured weights, final-check and agent-shell heavy work admitted, a bounded in-publish advisory coverage ratchet, hosted Test Unit partitions run locally in shadow, readiness monitors that back off and reuse one live job per PR, and time-to-certainty's C4.2 enforcement and wave re-seed re-homed here.

Packet 6 of 6 from [`explorations/ten-minute-certainty`](../../explorations/ten-minute-certainty/README.md); requires
[`certainty-scorecard`](../certainty-scorecard/README.md) and
[`route-soundness-repair`](../route-soundness-repair/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/local-proof-under-ten/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P1 Implement — in progress. P0 closed with the baseline checkpoint
(`decisions/2026-11-10-p0-baseline.md`). Slices 1 (PERIL-13), 2 (PERIL-10 summary and archive), 3 (SCHE-08, the
admission unit schema, #3308), 4 (the beep-heavy retirement, which completes PERIL-10, #3312), 5 (PERIL-02, one
live readiness monitor per pull request and readiness argv, #3316), 6 (SCHE-08, the scheduler service facade and
the Cache work kind, #3317) and 9 (TURB-05: the force reason, the narrowed-force shadow, and forcing patch-only
and override-only commits, #3331) are merged. Slice 7 (PERIL-09, the review-window anchor kept across a push that
only merges the base, with the AGENTS.md mergeable amendment) is open as #3329.

## Latest Evidence

- 2026-11-10: P0 baseline checkpoint against `origin/main` `b757bd0400f`: fleet economics (pre-push p95 39.8 min,
  cheap-gates p95 10.0 min), scheduler status (2068 quarantine lines, 3/5 tokens) and the seven upstream
  prerequisites (SCHE-09, MEAS-02, MEAS-07, PERIL-11, COVE-02, COVE-03, COVE-04) all still open.
- 2026-11-10: slice 1 (PERIL-13) marks `yeet verify --merged` supported and dormant in the yeet skill's
  `references/gates-and-proof.md` (no merged-preview run since 2026-10-05; kept, removal needs an operator ruling).
- 2026-11-12: slice 2 (PERIL-10) renders the scheduler quarantine as one status line (count, oldest age, archive
  dir; `--json` keeps the paths) and archives entries older than 7 days to `quarantine-archive` in the reap pass
  under a claims lock; status stays read-only and leases and tickets are untouched. The beep-heavy retirement
  stays open (slice 4).
- 2026-11-12 prerequisite drift: COVE-02 landed in #3115 and MEAS-01 with MEAS-04 in #3118; SCHE-09, MEAS-02 and
  MEAS-07 are still open. PLAN's HOST-01 co-carry note is moot: HOST-01 part a landed alone in #3111. #3130
  (`goals/yeet-async-merge-and-stacks`, merged 2026-11-12) adds `Yeet/internal/PatchIdentity.ts` and carries the review window
  across GitHub-made unchanged rewrites (cascade, restack); merges fail closed there, so PERIL-09 (a
  diff-preserving merge of main) stays open and should build on that classifier.
- 2026-11-13: slice 3 (SCHE-08) adds optional `unit`, `weightSource` and `owner` keys to tickets, leases and the
  enqueue, admission, release and withdrawal rows, read by a tolerant decoder: a newer writer's work kind stays
  charged instead of quarantined and an unreadable new key reads as absent. Writers add the keys only behind a
  `units` key on `protocol.json` (`quality scheduler protocol --units on`), off by default; with it off the bytes
  match origin/main's. The ciops frozen-journal replay stays 41 of 41, with and without the keys on every row.
  SCHE-09 slice 1 (#3227) and MEAS-07 (#3228) landed on main.
- 2026-11-14: slice 4 (PERIL-10) retires the `beep-heavy` wrapper rule. The orchestrate skill's gate poller and
  hand-off use `systemd-run --user` or a T3 scheduled task; its "Where to launch" section says Yeet's proofs take
  quality-scheduler admission on their own and other commands run directly. The practice-contacts runbook and
  `goals/design-figure-review-loop`'s plan drop the wrapper. PERIL-10 is complete.
- 2026-11-14: slice 5 (PERIL-02) makes `yeet monitor --until-ready --detach` hand back a live readiness monitor
  submitted from the same branch with the same readiness argv instead of submitting a second job. The key drops
  launch, output and cadence flags (`--detach`, `--job-max-runtime`, `--json`, `--summary`, `--poll-interval`)
  and keeps every other flag, so a stricter request still gets its own job. A reused job's time left under its
  runtime cap must be at least what `--job-max-runtime` asks for (`none` asks for no cap). A record whose runner process is gone
  is skipped. Publish keys its reuse on the same argv, and `yeet ready` no longer names a dead-runner job as the
  monitor still watching (the defect at the old `ReadyGate.ts:565`). Tests use a fake registry and runner probe,
  on Node and Bun.
- 2026-11-14: slice 6 (SCHE-08) puts the scheduler behind one `QualityScheduler` service (`admit`, `observe`,
  `reap`, the protocol gates, history, archive, worker route rows) with a live Layer over the existing functions,
  and moves Yeet, Cache, `quality scheduler`, Palantiri and the quality concurrency plan onto it. Cache commands
  request their own `cache` kind at weight 1, kept in the review-fix class cap. With the units gate off a Cache
  admission writes origin/main's `review-fix` bytes (fixture captured from its encoder); with it on, `cache`.
  The scheduler suites pass on Node and Bun.
- 2026-11-14: slice 9 (TURB-05) records why a run forced Turbo and closes a stale-green hole. Patch-only commits
  (`patches/` or the root `patchedDependencies`, as #2873 was) and override-only commits (root `overrides` or
  `resolutions`) are now forced; before, only a `bun.lock` change forced, and nothing else about the forced set
  changed. The decision moved into `Yeet/internal/TurboForce.ts`, with one `git diff --name-only` and the root
  `package.json` read only when it is in that diff (43 to 55 ms). Every repair, verify and publish attempt-started row
  carries `turboForce`: the reasons that applied and a shadow of the narrowed decision (no force for a lockfile-only
  change), with each package's locked installed-tree digest at the merge base and HEAD on lockfile attempts (0.62 s
  under load on this repo's 209 packages). The shadow drives nothing (D14).
- 2026-11-14: slice 7 (PERIL-09) keeps the review-window anchor across a push that only merges the base.
  #3130's `YeetHeadMoveClassifier` gains `classifyBaseMerge`: the head is one two-parent commit on the old head,
  the merged commit is on `base.sha`, the pushed tree is git's clean automatic merge, and the PR's three-dot patch
  has the same identity before and after. `ReviewWindow.ts` walks push rows back across such merges to the first
  push that changed the patch. It learns whether the head is a merge commit from the timeline it already reads, or
  else the local object store, so an ordinary push costs no new request and no fetch; only a two-parent head reads
  the ref activity, and it is fetched when the checkout lacks it, once per head per process, within 60 seconds.
  A conflict resolution, an edited merge, a moved hunk context, a force push, a shallow history, a failed read or
  fetch and any unknown verdict re-arm. AGENTS.md's
  mergeable definition and the yeet and orchestrate skills state the rule. Replay fixtures recorded from git 2.56.1
  (`test/support/YeetBaseMergeReplay.ts`) run the real classifier through `Git.layerTest` and a scripted spawner,
  on Node and Bun.

## Notes

- Source exploration: [`explorations/ten-minute-certainty`](../../explorations/ten-minute-certainty/README.md)
  (packet 6, move 5 of the brief). Lever ids refer to
  `explorations/ten-minute-certainty/research/phase2/PLAN.md`; the status of each, checked
  2026-11-09 and re-verified against `origin/main` c90929b1ff1, is the Levers table in [`SPEC.md`](./SPEC.md).
- Startable now, before either prerequisite lands: PLAN.md slices 1 to 3 (merged-preview dormancy note PERIL-13,
  quarantine summary and archive PERIL-10, the `AdmissionUnit` schema SCHE-08 with a tolerant decoder), then
  slices 4 to 6 (the beep-heavy retirement, PERIL-02, the scheduler facade) as those merge, and slices 7 to 9
  (PERIL-09, the PERIL-03 back-off, the TURB-05 shadow) next.
- Waits: weights and the admission of final-check and agent-shell work wait on certainty-scorecard's
  admission history retention (SCHE-09, owned there, D23); the WaveOrder re-seed on its attribution fix
  (MEAS-02); final-check lane-proof reuse and C4.2 enforcement on MEAS-07 and ruling 80's bar, shadow under the
  R2 pause. COVE-01 waits on route-soundness-repair's COVE-02, COVE-03 and COVE-04; TEST-04 on COVE-03.
- Already landed elsewhere: LINT-01 and LINT-04 (#3019), which YEET-02 needed; it now waits on ROUT-07 and on the receipt-grain
  fixture landing in YEET-05 and YEET-06 (PLAN.md slices 21 and 22).
- Already landed: part of PERIL-03 in #3032 (90 s default poll, rate-limit sleep); #3008 made bare local
  coverage default to `--affected`, which COVE-01 narrows further to direct owners.
- The monitor's GitHub reads, its identity and the REST reserve belong to `goals/github-state-worker`,
  `goals/yeet-monitor-app-identity` and `goals/github-budget-ledger`; this goal keeps one monitor per PR, the
  loop's back-off and the yeet skill's budgeting rule (decision file `monitor-work-split-with-github-goals`, D27).
- Enforced reuse stays shadow under the R2 pause (D14). `goals/time-to-certainty` stays paused; its pointer to
  this goal landed with the graduation, and no slice edits it (D13).
