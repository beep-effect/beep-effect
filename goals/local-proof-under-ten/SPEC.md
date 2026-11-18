# Local Proof Under Ten Spec

## Objective

Make local `yeet publish` and `yeet verify` predictable when many agents run at once, by extending the existing
`QualityScheduler` instead of adding a second authority. Concretely:

- The admission unit becomes a lane or a package (an `AdmissionUnit` schema with a weight source and an owner),
  weights are calibrated from measured per-wave memory envelopes (raise-only), and the closed work-kind literal
  is opened through a tolerant decoder so mixed-revision worktrees sharing one journal keep decoding.
- Work that runs unadmitted today is admitted in small units: `yeet final-check` gates per step,
  `quality package-verify`, and agent-shell coverage, test and docgen commands with an inherited capability, so
  earlyoom stops killing proofs that the scheduler never saw.
- Leases resize under one proof nonce, long units are backfilled with a conditional starvation bound and
  per-origin fairness, and a waiting caller gets typed backpressure with a 600 s deadline outcome.
- Before the push, publish may run a bounded advisory coverage ratchet on directly touched packages (ruling
  D15). Verify runs the hosted Test Unit producer partitions locally as admitted units, in shadow, as the single
  carrier of the local coverage shape.
- Receipts record their grain. Same-head cheap-lane reuse in final-check, ProofLedger C4.2 enforcement for
  cheap-tier lanes, a narrowed local `TURBO_FORCE` and fleet cache-reuse attribution land as shadow receipts
  under the R2 pause (ruling D14); WaveOrder is re-seeded from current economics after the attribution fix.
- Readiness monitors run one live job per PR per checkout and back off in states only a push can change; a
  clean merge of `origin/main` keeps the review-window anchor (ruling D12); merged-preview is documented as
  dormant and the scheduler's quarantine residue is summarized and archived.

The baseline the goal moves (from `explorations/ten-minute-certainty/BRIEF.md`): local `yeet publish` p50 4 and
p95 11.6 minutes, `yeet verify` p50 14.5 and p95 57 minutes; the coverage ratchet is skipped in 61% of
final-check receipts because its only local form takes 18 to 20 minutes; the scheduler is idle 73% of the time
and governs only `yeet` tiers. These figures are censored to the workstation's surviving checkouts until
certainty-scorecard retains journals across retire and the fleet (ruling D18).

Source exploration: [`explorations/ten-minute-certainty`](../../explorations/ten-minute-certainty/README.md) —
[`BRIEF.md`](../../explorations/ten-minute-certainty/BRIEF.md) (move 5),
[`MAP.md`](../../explorations/ten-minute-certainty/MAP.md) (packet 6 and its capability check),
[`DECISIONS.md`](../../explorations/ten-minute-certainty/DECISIONS.md) (D3, D12 to D17, D19),
[`research/phase2/PLAN.md`](../../explorations/ten-minute-certainty/research/phase2/PLAN.md) (lever rows and the
cross-area critique).

## Non-Goals

- No second scheduler, queue, lock, result cache or "checker agent" (BRIEF rabbit hole, ruling D3).
- No force pushes or history rewrites (BRIEF no-go), including in PERIL-09's merge-of-main anchor.
- No proof-depth reduction presented as efficiency: property run floors and seeds, coverage floors, the canonical
  test census, the full corpus replay per PR and the required contexts stay as they are. Advisory coverage in
  publish never replaces hosted Coverage Regression, which stays on the Yeet mergeable gate.
- No enforced reuse and no cached coverage results while the R2 pause holds (ruling D14): TURB-05, TURB-10 and
  YEET-05 stay shadow receipts and attribution; enforced reuse beyond cheap lanes is a gated candidate that
  reopens only when the pause lifts.
- File-level test selection as a receipt (TEST-08 stays advisory; gated on 100% recall over at least 50 red
  episodes).
- Hub `^transit` narrowing on tests (TEST-07, gated on module-graph evidence plus a qualified refinement).
- Retiring `yeet verify --merged` (ruling D17), or editing time-to-certainty's artifacts (ruling D13).
- Changing the review-window length (ruling D12 changes only the anchor).
- The GitHub read path: the per-host state worker and PR snapshots (`goals/github-state-worker`), the request
  ledger, call-site attribution and the 15% reserve signal (`goals/github-budget-ledger`), and the monitor's
  identity (`goals/yeet-monitor-app-identity`). See Constraints for the split.
- Measurement owned by certainty-scorecard: admission history retention (SCHE-09), the attribution fix
  (MEAS-02), the final-check journal (MEAS-07), journal retention and fleet roots (PERIL-11), and the nightly
  scorecard itself. Soundness owned by route-soundness-repair: the Node 22.23.4 local coverage pin (COVE-03), the
  bare-coverage self-judge (COVE-02), the labelled coverage failure rows (COVE-04), the `@beep/glob` setup closure (TEST-10) and the classifier differential
  (ROUT-07).
- Plan rows with no goal home, which this goal may adopt only by a new decision file:
  - PERIL-06: keep Biome's scanner out of sibling worktrees in nested lanes (reproduce first).
  - PERIL-07: pre-commit typos on staged files only, with a full scan on config changes.
  - PERIL-08: record duplicate Fallow audit identities within an attempt, then share an exact computation.
  - PERIL-12: characterize changeset-status undeclared-input misses. YEET-05 excludes changeset-status until
    PERIL-12 closes.
  - TEST-09: measure the local cold doctest makespan.
  - YEET-09: record worker-substitution provenance (zero credit).
  - COVE-09: a row-wise three-way merge driver for the coverage baseline.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- Scheduler (`@beep/repo-cli`, `packages/tooling/tool/cli/src/internal/repo-run`):
  - `QualityScheduler.schemas.ts`: `AdmissionWorkKind` is a closed four-literal kit (`full-proof`,
    `merged-preview`, `review-fix`, `publish`) and `admissionTokenWeight` a static table; no `AdmissionUnit`
    exists. SCHE-08 adds the unit union (tier, lane, package with Turbo task id), a weight-source kit, the
    owner fields and new kinds, with optional keys and decoding defaults.
  - `QualityScheduler.ts`: `withQualityAdmission` is a free function; SCHE-08 wraps it in a `Context.Service`
    facade with admit, resize, observe and withdraw. Backfill, fairness and backpressure land here.
  - `AdmissionJournal.ts` (read-only consumer of SCHE-09's retention), `MemoryStats.service.ts` (per-wave anon
    and file samples for SCHE-07), `RunScope.ts` (one proof cgroup under a resized lease).
- Admission callers: `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts` (the three
  `withQualityAdmission` wrappers for full-proof or merged-preview, merged-preview and review-fix tiers),
  `packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck.ts` (no admission today; it spawns
  cheap-gates), the five Cache sites that borrow `review-fix` (for example
  `packages/tooling/tool/cli/src/commands/Cache/Cache.workflow.ts`), and the package-verify and agent-shell
  entry points under `packages/tooling/tool/cli/src/commands/Quality`.
- Coverage and partitions: `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts`
  (`changedCoverageOwners`, `CoverageScopeMode` affected, full, explicit since #3008),
  `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts`,
  `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageEnvironment.ts`,
  `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`, and the hosted producer plan in
  `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` and
  `packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts`.
- Receipts and reuse: `packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck.schemas.ts`,
  `packages/tooling/tool/cli/src/commands/Quality/internal/LaneProofReuse.ts` (`BEEP_YEET_PROOF_BASE`),
  `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofLedger.ts`,
  `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofShadow.ts`,
  `packages/tooling/tool/cli/src/commands/Yeet/internal/WaveOrder.ts`,
  `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts` (`TURBO_FORCE` step env) and the bun.lock
  force in `Handler.ts`.
- Monitors and the review window: `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts`,
  `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorPolicy.ts`,
  `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofJobLauncher.ts`,
  `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofJob.ts` (`isLiveReadyMonitorJob`),
  `packages/tooling/tool/cli/src/commands/Yeet/internal/ReadyGate.ts`,
  `packages/tooling/tool/cli/src/commands/Yeet/internal/ReviewWindow.ts` and its 20-minute twin in
  `packages/tooling/tool/cli/src/commands/Yeet/internal/GhOps.ts`.
- Scheduler status rendering: `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts` (one quarantine
  summary line since slice 2; `--json` keeps every path).
- Simulation lab for backfill and fairness: `apps/labs/ciops`.
- Docs: `.claude/skills/yeet/SKILL.md`, `.claude/skills/yeet/references/detached-jobs.md`,
  `.claude/skills/orchestrate/SKILL.md` (the `beep-heavy` doctrine PERIL-10 retired), and the AGENTS.md
  Quality Operator lines that D12 and D15 amend.
- Gate-order handoff: a new handoff document under this packet's `research/` for the re-seed; the existing
  `goals/time-to-certainty/research/gate-order-handoff.json` is read, never edited.
- Tests under `packages/tooling/tool/cli/test/`, for example `quality-scheduler.test.ts`,
  `yeet-final-check.test.ts`, `yeet-monitor-loop.test.ts`, `yeet-monitor-ready.test.ts`, `yeet.test.ts`,
  `proof-ledger.test.ts`, `proof-shadow.test.ts`, `gate-order-handoff.test.ts`, `yeet-review-window.test.ts` and
  `yeet-merged-preview.test.ts`.
- This packet (`goals/local-proof-under-ten/`).

No new workspace package is planned. If one becomes necessary it is bootstrapped with `bun run beep create-package`.

### Levers

Status from the 2026-11-09 check of this lane, re-verified on `origin/main` at c90929b1ff1 (cited files changed between 6eb2e0588e2
and it, among them the hosted partition plans in `CiLane.ts` and `CiLanePartitions.ts` that TEST-04's row reflects;
every citation below was re-checked at c90929b1ff1). Ids are the rows in
`explorations/ten-minute-certainty/research/phase2/PLAN.md`.

| Id | What | Status (evidence) | Gate before landing | Depends on |
| --- | --- | --- | --- | --- |
| SCHE-08 | `AdmissionUnit`, weight source and owner schema; scheduler service facade; Cache uses its own kind | open (`QualityScheduler.schemas.ts:43` closed kit, no unit type; Cache sites pass `kind: "review-fix"`, e.g. `Cache.workflow.ts:811`) | Mixed-version decode fixture; ciops replay stays 41/41 | SCHE-09 for the journal fields; the schema itself is startable |
| SCHE-07 | Calibrate unit weights from measured envelopes, raise-only | open (`admissionTokenWeight` static, `QualityScheduler.schemas.ts:262`) | Two-week shadow with zero undercharges | SCHE-08, SCHE-09, per-wave anon census |
| SCHE-02 | Admit final-check gates, package-verify and agent-shell heavy commands (absorbs YEET-03 slice 1) | open (`FinalCheck.ts` has no `withQualityAdmission`; in Yeet only `Handler.ts:632,653,674` admit, and the five Cache sites borrow `review-fix`) | Late failure gives no ready receipt; killed producer gives an incomplete receipt; mid-run mutation refused; nested capability does not deadlock; mixed-version decode; A/B with a journald kill census: zero kills of admitted gates, no more `--skip` steps per receipt, wait p95 below each gate's p50 | SCHE-08, SCHE-06, SCHE-07 |
| SCHE-01 | Resizable lease units under one proof nonce | open | Lifecycle and hold-and-wait fixtures; shadow bar needs per-wave peaks and SCHE-09 | SCHE-08, SCHE-07, SCHE-09, SCHE-06 |
| SCHE-06 | Conditional starvation bound with EASY backfill and per-origin fairness | open | Property laws in the ciops lab under adversarial streams, then an A/B on tail waits | SCHE-08, SCHE-09 |
| SCHE-05 | Typed admission backpressure with a 600 s deadline outcome | open | Pure-fold fixtures; push-to-hosted only at 600 s or later (#131) | SCHE-08, SCHE-09 |
| COVE-01 | Advisory direct-owner coverage scope, bounded inside publish | open (#3008, 4b69a5e4b1f, made bare local coverage `--affected`; no direct mode in `CoverageScope.ts:576`) | Local direct run prints rows byte-identical to hosted on Node 22.23.4; cold/warm A/B: cheap-gates p95 does not rise, at most 2 min added; then at least 50 paired publishes for the ledger | COVE-02, COVE-03, COVE-04 (route-soundness-repair, D23) |
| TEST-04 | Verify runs the hosted Test Unit producer partitions as admitted units (shadow); single carrier for local coverage (folds YEET-01 and the TEST-05 census) | open (hosted plans moved in #3007, #3028, #3029, #3030, #3040 and #3043, which runs Test Unit as 24 jobs with repo-cli and law-practice-server shards on two Vitest workers; #3046 caps shard timeouts at 20 min; the local shape must follow) | Shadow parity on at least 10 heads (at least 3 LPS-affected) against hosted Test Unit plus Coverage Regression on Node 22.23.4 with a local run identity; A/B including queue time: p95 under 10 min, no deadline reds | COVE-03, SCHE-01, SCHE-08 |
| TEST-08 | Advisory related-tests lane with a read-graph recorder and recall audit | open | None for advisory use; any gating use needs 100% recall over at least 50 red episodes | TEST-10, COVE-03 |
| YEET-02 | File-scope effect-imports in the publish cheap tier with full escalation; jsdoc half parked | open | Route replay with the full escalation list at 100% recall; a receipt-grain fixture refused by YEET-05 and YEET-06; selector-overhead A/B | ROUT-07 (route-soundness-repair); LINT-01 and LINT-04 landed in #3019 (027664ba178), residuals in heavy-pool-diet |
| YEET-05 | final-check reuses same-head cheap-lane proofs, pinned base, shadow first | open (`LaneProofReuse.ts:47` `BEEP_YEET_PROOF_BASE` seam exists) | Shadow with the base pinned: hits above 0, zero disagreements; a modified tracked file, an untracked file and a moved `origin/main` all miss; changeset-status non-reusable until PERIL-12 | MEAS-07 |
| YEET-06 | ProofLedger C4.2 enforcement for cheap-tier lanes after C5 fixtures pass on the flip HEAD | open (`ProofLedger.ts:8`: the module never skips or enforces) | C5 must-fail fixtures green on the flip HEAD; official report with 0 malformed rows; narrowed receipts rejected; ruling 80 bar after ruling 83's instant | YEET-05; carries the receipt-grain refusal fixture itself and lands before YEET-02 slice 1 (critique; reverses the plan row's YEET-06-after-YEET-02 order); D14 |
| YEET-07 | Re-seed WaveOrder from current economics | open (handoff seed `measurementAsOf` 2026-09-03) | Trace-replay simulation that preserves first-red identity on a fresh post-MEAS-02 snapshot | MEAS-02 |
| TURB-05 | Scope local `TURBO_FORCE` to path-detected patches and overrides, shadow first | shadow landed (slice 9: `decideTurboForce` in `Yeet/internal/TurboForce.ts` forces every dependency-sensitive step on a bun.lock change as before and, from this slice, on a patch-only (`patches/` or root `patchedDependencies`) or override-only (root `overrides` or `resolutions`) change, closing that stale-green hole; nothing else in the forced set changed. Every repair, verify and publish attempt-started row carries `turboForce`: the actual reasons, the narrowed shadow (the reasons without `lockfile-changed`) and, on lockfile attempts, each package's locked installed-tree digest at the merge base and HEAD. Open: the undeclared-import invariant, the shadow ledger over lockfile attempts in both layouts, and the flip) | Shadow receipts with the narrowed decision and a per-package installed-tree digest; undeclared-import invariant; patch-only commits still forced | D14 |
| TURB-10 | Attribute first-cold cross-host cache reuse on fleet hosts | open | Same-head hashes across hosts | D14, PERIL-11 fleet roots |
| PERIL-02 | One readiness monitor per PR in a checkout, reuse keyed on normalized readiness argv | landed (slice 5: `monitor --until-ready --detach` hands back a live monitor with the same branch and `readyMonitorArgvKey` through `submitProofJobReusingReadyMonitor` in `ProofJobLauncher.ts`; publish keys its reuse on the same argv; `yeet ready`'s watcher hint, formerly `ReadyGate.ts:565`, runs the shared runner check `pickLiveReadyMonitor`) | Two submissions with the same PR and argv yield one job; stricter argv not reused; a dead-runner record skipped; `ReadyGate.ts:565` fixed in the same PR | none |
| PERIL-03 | State-aware monitor cadence with a wake on a local ref change | partly landed (#3032, fda98a2c4bd: 90 s default at `MonitorLoop.ts:210`, rate-limit sleep in `MonitorRateLimit.ts`) | TestClock mutation fixtures: the first terminal after each mutation follows a full read taken after it; a dirty-file re-edit still flags stale gates; then a 7-day A/B of polls per monitor-hour | PERIL-02 |
| PERIL-09 | Keep the review-window anchor across a diff-preserving merge of main | landed (slice 7: `classifyBaseMerge` on #3130's `YeetHeadMoveClassifier` in `HeadMove.ts` proves a push only merged the synchronized base with the PR's patch identity unchanged, and `ReviewWindow.ts` walks the push anchor back across such merges; the monitor, status, merge gate, gate table and REST gate read that one anchor) | Ruling D12 (given); replay fixtures: clean merge keeps, conflict touching PR lines re-arms | none |
| PERIL-10 | Summarize scheduler quarantine in status, archive-reap aged entries, retire the `beep-heavy` doctrine (merges SCHE-10) | landed (slice 2: `quality scheduler status` prints one quarantine summary line, and the reap pass archives entries older than 7 days to `<admission root>/quarantine-archive` before any delete; slice 4: the `beep-heavy` rule is retired from `.claude/skills/orchestrate/SKILL.md` and `docs/runbooks/practice-m365-contacts-seeding.md`) | Renderer and reaper age-gate tests, an archive-restore fixture; live lease count unchanged | none |
| PERIL-13 | Mark merged-preview admission dormant | landed (dormancy note in `.claude/skills/yeet/references/gates-and-proof.md`) | Ruling D17 (given) | none |

SCHE-09 (admission history retention) was listed under this goal in MAP.md's first draft; D23 assigns it to
certainty-scorecard and this goal consumes it.

## Constraints

- **One admission shape, one owner (D3).** Every admission change extends `QualityScheduler`. YEET-03 is folded
  into SCHE-01 and SCHE-02 and credits no minutes. Final-check spawns `quality github-checks cheap-gates`, so
  inner wave admission under an outer final-check lease can deadlock: SCHE-02 ships the nested-capability
  fixture before it admits final-check. Admitting final-check makes 27-minute coverage steps 3-token holders that
  compete with publish; treat that half as trust only.
- **Scheduler order (critique, dependency order item 7).** SCHE-09 (certainty-scorecard) and SCHE-08 with a
  tolerant decoder first, because the persisted work-kind literal is closed and the journal is shared by
  mixed-revision worktrees; new fields are written only after `quality scheduler protocol` reports every live
  reader at the new version. Then SCHE-07 (per-wave anon measurement, raise-only), then SCHE-06 backfill (the ciops
  model, then `selfMayAttempt`), then SCHE-02 and SCHE-01, which both depend on SCHE-06 so that no long
  final-check coverage unit is admitted before backfill exists, then SCHE-05. Critique item 7 lists SCHE-01/02
  before SCHE-06; the row dependencies, which carry its backfill-before-long-units condition, bind.
- **Local coverage shape (item 8).** TEST-04 is the single carrier; YEET-01 and TEST-05 fold into it. COVE-01,
  TEST-04 and TEST-08 land only after route-soundness-repair's COVE-03 (Node 22.23.4 pin with a shared pin source
  or drift test); COVE-01 also after COVE-02 and COVE-04 (labelled coverage rows, D23). TEST-04 rebases on the hosted partition plans as they stand
  (#3007, #3028, #3029, #3030, #3040, #3043: nine repo-cli and eight law-practice-server shards on two
  Vitest workers plus seven unit bins, 24 jobs; #3046: 20-minute shard timeouts) before it lands.
- **Receipt grain.** Receipts record whether they are narrowed or full. YEET-05 and YEET-06 reject narrowed
  receipts, and that fixture lands in both before YEET-02 slice 1.
- **TEST-08 is advisory only.** It never writes a receipt; file-level selection as a receipt is a gated
  candidate (100% recall over at least 50 red episodes).
- **Re-seed only after attribution (item 10).** YEET-07 runs on a fresh snapshot after certainty-scorecard's
  MEAS-02 fix. Time-to-certainty's rulings 76 to 83 bind the re-seed and the enforcement (D13): a new seed
  literal, pinned provenance, one fixture-guarded `gate-order-handoff/v1` document written under this packet,
  and ruling 80's bar counted from ruling 83's merge instant. Its frozen fixtures are not edited. Under ruling 80
  the enforcement flip PR (YEET-06) keeps ruling 82's ruling-69 root-input lock (#2625, f5552fcd812) green among
  the C5 fixtures, then deletes LaneProofReuse.ts and the lane-proofs.json store with a retirement receipt and re-runs the economics
  close; YEET-05's shadow therefore moves onto the ProofLedger path before or in that PR.
- **R2 pause (item 11, D14).** TURB-05, TURB-10 and YEET-05 land as shadow receipts and attribution only; no
  reuse is enforced and no cache-policy re-record is requested for them until the pause lifts. YEET-06
  enforcement also stays shadow while the pause holds.
- **Advisory coverage in publish (D15).** Direct owners only, `@beep/law-practice-server` and `@beep/repo-cli`
  excluded, a hard cap of about 60 s, Node 22.23.4, the merge-base three-document judge, labelled rows, admitted
  through the scheduler, never a receipt, never blocking the push. The push-first D1/D2 amendment is recorded as
  this packet's decision says (the push-first packet is archived).
- **Review window (D12).** PERIL-09 changes only the anchor; the length stays 20 minutes. Its PR amends the
  AGENTS.md mergeable definition and lands the replay fixture with it; an unknown patch identity re-arms.
- **Merge doctrine as it stands (D28).** PERIL-09 and the monitor levers (PERIL-02, PERIL-03) land against the
  mergeable definition and merge path as they stand today. The gated `merge-queue-activation` candidate in
  `explorations/github-merge-queue` (gated on `goals/merge-queue-lab`'s verdict) would rewrite the merge doctrine in
  AGENTS.md and the orchestrate and yeet skills, and its `yeet-queue-states` candidate adds queue states to
  Yeet's merge path; when it opens, its owner inherits the patch-id anchor rule. Nothing in this goal waits on
  the queue, and no queue work is added here.
- **Shared with main-verdict-every-commit.** `AGENTS.md` (PERIL-09's mergeable amendment) and
  `.claude/skills/orchestrate/SKILL.md` (PERIL-10's beep-heavy retirement) are also edited by
  main-verdict-every-commit's HOST-01 (cancel ban; Red check and Queue starved rows). The PERIL-09 PR may carry
  the one-clause cancel ban when both are ready the same day; otherwise whichever lands second merges `main`
  first. `merge-queue-activation`'s owner is a later editor of the same `AGENTS.md` mergeable definition and
  the orchestrate and yeet skills.
- **Monitor split with the GitHub read-path goals.** `goals/github-state-worker` owns the monitor's GitHub reads
  and the worker cadence, `goals/github-budget-ledger` owns per-call-site attribution and the 15% reserve signal,
  `goals/yeet-monitor-app-identity` owns the identity (D27); `MonitorLoop.ts` is also edited by
  `goals/github-state-worker` and `goals/yeet-monitor-app-identity`, so whichever PR lands second merges `main`
  first. This goal keeps PERIL-02, the monitor loop's state-aware sleep
  and ref-change wake, and the D16 budgeting rule in the yeet skill written against the ledger's signal. PERIL-03
  lands after PERIL-02 and its saving is measured after it (the two multiply, they do not add).
- **Lever dependencies outside the manifest.** YEET-02 waits on route-soundness-repair's ROUT-07 and the
  receipt-grain fixture (heavy-pool-diet's LINT-01 and LINT-04 landed in #3019; the parked jsdoc half stays
  behind LINT-01's residual fixture suite);
  YEET-05 on certainty-scorecard's MEAS-07; TEST-08 on route-soundness-repair's TEST-10; TURB-10 on
  certainty-scorecard's PERIL-11 fleet roots.
- **Earlyoom census.** SCHE-02's gate and this goal's acceptance need a journald earlyoom and SIGKILL census of
  admitted gates (a measurement prerequisite the plan lists without an owner). This goal builds it in the SCHE-02
  slice unless certainty-scorecard ships one first, in which case it is reused.
- **Numbers without a primary source.** SCHE-01's 40 to 80 wait-min/week depends on an unmeasured light-wave
  fraction; PERIL-03's CPU and REST figures had a mislabelled basis and are unmeasured; fleet volume figures are
  censored until PERIL-11 lands. None of them is a target; each lever is judged on its own gate.
- **Hosted workflow rules.** `.github/workflows/heavy.yml` is called at `@main`, so any change to a hosted heavy
  lane's inputs is two PRs. Any `turbo.json`, `bun.lock` or workflow change freezes coverage rows and needs a
  cache-policy baseline re-record (`standards/cache-baseline/`,
  `docs/runbooks/turbo-cache-inputs.md`) in the same PR; the three paused cache levers must not need one.
- **Compute profile.** `goals/compute-profile-gate-routing` owns the worker-host refusal in the scheduler; new
  admission kinds keep that refusal and the `--force-local` receipt field.
- **Code laws.** Schema first (`effect/Schema`, `LiteralKit` for new kinds), then the `Context.Service` contract,
  then implementation; Effect v4 only; `effect/HashMap` and `HashSet`, never native `Map` or `Set`; `Effect.fn`
  or `Effect.fnUntraced` for generators. Repo-cli tests pass on Node and Bun.
- **Separate problems (BRIEF rabbit hole, D3).** The retired 2026-08 per-origin lock era and the 2026-10-31
  pkill incident are separate problems from the token scheduler; neither justifies a scheduler lever.
- **Packet rule (D19).** At most three open PRs across this packet's lanes.

## Acceptance Criteria

- [ ] **Target, reported by certainty-scorecard over 7 days:** local `yeet publish` p95 at most 8 min and local
      `yeet verify` p50 at most 10 min on the fleet census read from the scorecard's retained journals. Until
      those journals land the figures are censored to the workstation's surviving checkouts, and the report says
      so beside the number.
- [ ] **Zero earlyoom-killed admitted gates over 7 days**, from the journald census (baseline: 11 of 161
      final-check receipts lost to earlyoom or SIGKILL), with no increase in `--skip` steps per final-check
      receipt and admission wait p95 below each admitted gate's p50.
- [ ] **No stale-green fixture fails:** the receipt-grain fixture is refused by YEET-05 and YEET-06; the C5
      must-fail fixtures are green on the YEET-06 flip HEAD; a modified tracked file, an untracked file and a moved
      `origin/main` all miss YEET-05 reuse; patch-only commits are still forced under TURB-05; the PERIL-03
      mutation fixtures put every terminal after a full read taken after the mutation; a conflict resolution
      touching PR lines re-arms the window under PERIL-09.
- [ ] SCHE-08 lands with a mixed-version decode fixture and the ciops replay at 41/41; Cache commands use their
      own kind.
- [ ] SCHE-07 weights pass a two-week shadow with zero undercharges against the measured per-wave peaks (today's
      15 GiB charge sits below the measured 22.9 GiB p50 lease peak).
- [ ] SCHE-06, SCHE-02, SCHE-01 and SCHE-05 pass their gates in the order of the PLAN.md Slices table, and backpressure suggests
      a hosted push only at 600 s or later.
- [ ] COVE-01 prints advisory rows byte-identical to hosted on Node 22.23.4, adds at most 2 min, never blocks the
      push, and the ledger has at least 50 paired publishes.
- [ ] TEST-04 shows shadow parity on at least 10 heads (at least 3 LPS-affected) and p95 under 10 min including
      queue time with no deadline reds.
- [ ] YEET-07 re-seeds WaveOrder from a post-MEAS-02 snapshot into a new handoff document under this packet,
      with a trace replay that preserves first-red identity; time-to-certainty's files are byte-identical.
- [x] PERIL-02: two submissions with the same PR and argv yield one job (landed with PLAN.md slice 5).
- [ ] PERIL-03: the 7-day A/B of polls per monitor-hour is recorded under `history/`.
- [x] PERIL-09 lands with its replay fixtures and the AGENTS.md amendment in the same PR (PLAN.md slice 7).
- [x] PERIL-10: `quality scheduler status` renders the quarantine as one summary line, aged entries are archived
      before reaping, the live lease count is unchanged, and the `beep-heavy` doctrine is retired from the
      orchestrate skill (landed with PLAN.md slices 2 and 4).
- [x] PERIL-13: the yeet skill documents merged-preview as supported and dormant (landed with PLAN.md slice 1).
- [ ] TURB-05, TURB-10 and YEET-05 record shadow receipts and attribution only, while the R2 pause holds.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/local-proof-under-ten/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/local-proof-under-ten/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/local-proof-under-ten` | Passes |
| Decision log | `bun run beep goals decisions check --slug local-proof-under-ten` | No drift |
| CLI package | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Scheduler tests (Node) | `bunx vitest run packages/tooling/tool/cli/test/quality-scheduler.test.ts packages/tooling/tool/cli/test/quality-scheduler-drift.test.ts packages/tooling/tool/cli/test/quality-scheduler-degraded-inputs.test.ts` | Passes |
| Scheduler tests (Bun) | `cd packages/tooling/tool/cli && bunx --bun vitest run test/quality-scheduler.test.ts test/quality-scheduler-drift.test.ts test/quality-scheduler-degraded-inputs.test.ts` | Passes |
| Yeet surfaces (Node) | `bunx vitest run packages/tooling/tool/cli/test/yeet-final-check.test.ts packages/tooling/tool/cli/test/yeet-monitor-loop.test.ts packages/tooling/tool/cli/test/yeet-monitor-ready.test.ts packages/tooling/tool/cli/test/yeet-review-window.test.ts packages/tooling/tool/cli/test/yeet-review-window-base-merge.test.ts packages/tooling/tool/cli/test/proof-ledger.test.ts packages/tooling/tool/cli/test/proof-shadow.test.ts packages/tooling/tool/cli/test/gate-order-handoff.test.ts packages/tooling/tool/cli/test/yeet-merged-preview.test.ts` | Passes |
| Yeet surfaces (Bun) | `cd packages/tooling/tool/cli && bunx --bun vitest run test/yeet-final-check.test.ts test/yeet-monitor-loop.test.ts test/yeet-monitor-ready.test.ts test/yeet-review-window.test.ts test/yeet-review-window-base-merge.test.ts test/proof-ledger.test.ts test/proof-shadow.test.ts test/gate-order-handoff.test.ts test/yeet-merged-preview.test.ts` | Passes |
| Admission state | `bun run beep quality scheduler status --json` | Live leases unchanged by PERIL-10; new kinds and units decode |
| Shadow bar | `bun run beep yeet proof-report --since <ruling 83 merge instant>` | Ready under ruling 80 before YEET-06 enforces |
| Local economics | `bun run beep yeet economics --fleet --json` | Publish p95 and verify p50 per the acceptance; censoring stated |
| Final gate | `bun run beep yeet final-check` | Passing receipt for each PR head |
| Target | certainty-scorecard's nightly report over 7 days | Publish p95 at most 8 min, verify p50 at most 10 min, zero killed admitted gates |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.
- A lever's gate can only pass by reducing proof depth, or a fixture shows a stale green that the lever cannot
  close: stop that lever and record it.
- A lever needs enforced cache reuse or a cache-policy re-record while the R2 pause holds, or removing
  merged-preview: these need an operator ruling.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add local-proof-under-ten --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug local-proof-under-ten`; add a `kind: decision` file there, never edit this block._

### A bounded in-publish advisory coverage ratchet on direct owners (push-first D1/D2 amendment), 2026-11-09

`yeet publish` may run an advisory coverage ratchet before the push (COVE-01) only in this bounded form: direct coverage owners only, the two long poles (`@beep/law-practice-server`, `@beep/repo-cli`) excluded, a hard time cap of about 60 s, Node 22.23.4, the merge-base three-document judge, rows labelled advisory, admitted through the scheduler, never written as a receipt and never blocking the push. It lands only after route-soundness-repair's Node 22.23.4 pin (COVE-03), bare-coverage self-judge fix (COVE-02) and labelled coverage failure rows (COVE-04). It amends push-first D1 and D2; the amendment is recorded where the push-first rulings are read when the lever lands (see this packet's decision on the push-first amendment home). Rejected: keeping D2 as is (reds keep arriving 15 to 40 min after push) and making the run blocking (local false reds from contention or runtime drift must not block publishing).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D15).

Reverse: Remove the publish step and the direct scope mode; publish returns to cheap-gates only and the push-first rulings stand unamended.

### Admission work extends the existing QualityScheduler; no second scheduler, queue or checker agent, 2026-11-09

Every admission change in this goal extends the existing `QualityScheduler` (`packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts`): the admission unit becomes a lane or a package, weights come from measured peaks, and final-check, package-verify and agent-shell heavy commands are admitted in small units. No second scheduler, queue, lock or "checker agent" is built, and one owner (this goal's scheduler slices) holds the one admission shape: the old YEET-03 is folded into SCHE-01 and SCHE-02 and credits no minutes. Rejected: a checker agent or single scheduling service (a second authority), and leaving admission alone (the deepest memory dip on 2026-11-09 happened with one admitted lease, so unadmitted work is the exposure).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D3).

Reverse: Supersede with a new decision that names a different admission authority; no code to revert while the levers are unlanded.

### yeet verify --merged stays supported and is marked dormant; quarantine residue is archived, nothing retired, 2026-11-09

`yeet verify --merged` (the merged-preview admission kind, weight 5, no grant since early October) stays supported and is documented as dormant (PERIL-13). The capability and its admission kind are kept; the scheduler's quarantine residue is summarized in status and archived before any reap (PERIL-10); nothing is retired. Removing the capability needs a new operator ruling. Rejected: retiring it (zero grants does not make the only merged-tree proof dead code).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D17).

Reverse: Remove the dormancy note; restore archived quarantine entries from the archive if a reaped lease is needed.

### State-aware monitor cadence, one live monitor per PR per checkout, and a REST budgeting rule, 2026-11-09

Readiness monitors get a state-aware cadence: they back off to 2 to 5 minutes in push-blocked and window-only states and wake on a local ref change; one live monitor runs per PR per checkout and is reused on `monitor --detach`; agents budget the shared REST token across monitors, the nightly scorecard and corpus capture, written as a budgeting rule in the yeet skill (PERIL-02, PERIL-03). Which parts of this the GitHub read-path goals already own is recorded in this packet's monitor-work split decision. Rejected: keeping a fixed short interval (load unchanged) and backing off without a budgeting rule (census aborts recur).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D16).

Reverse: Restore the fixed --poll-interval default and drop the reuse check and the yeet skill budgeting rule.

### Monitor work split: the GitHub read-path goals own reads, cadence of the worker and budget; this goal keeps the residual, 2026-11-09

Checked against the live checkout: #3032 (commit fda98a2c4bd) landed part of PERIL-03, a 90 s default poll (`MonitorLoop.ts:210`) and a rate-limit sleep (`MonitorRateLimit.ts`); state-aware back-off and a wake on a local ref change are not landed. `goals/github-state-worker` owns the monitor's GitHub reads (the monitor stops polling while a fresh snapshot exists; the worker's cycle cadence is its decision), `goals/github-budget-ledger` owns per-call-site attribution and the 15% reserve signal (so PERIL-03 slice 1 and the REST saving of the back-off are theirs), and `goals/yeet-monitor-app-identity` owns the monitor's identity. This goal keeps only the residual: PERIL-02 (one live monitor per PR per checkout, reuse on `monitor --until-ready --detach` keyed on normalized readiness argv, a dead runner skipped, the liveness gap at `ReadyGate.ts:565` fixed), the monitor loop's state-aware sleep with a wake on a local ref change (local CPU and notice lag, applied to snapshot reads and to the direct-read fallback), and the D16 budgeting rule in the yeet skill written against the ledger's reserve signal with no counter of its own. Rejected: claiming the snapshot worker's cadence or a second REST budget here.

Source: this packet's lever status check (git log fda98a2c4bd; the three goals' SPEC Objective, Non-Goals and Target Surfaces); exploration `explorations/ten-minute-certainty/DECISIONS.md` (D16, D27).

Reverse: Move the residual monitor levers to github-state-worker by a decision in both packets.

### PERIL-09 and TURB-10 are assigned to this goal; SCHE-09 goes to certainty-scorecard, 2026-11-09

The first draft of the exploration MAP.md table omitted two levers that rulings name, so the graduation assigns them to this goal. PERIL-09 (keep the review-window anchor across a diff-preserving merge of main) is the lever ruling D12 adopts, and it lives beside this goal's other Yeet review-path work. TURB-10 (attribute first-cold cross-host cache reuse on fleet hosts) is one of the three levers ruling D14 binds to shadow and attribution, with TURB-05 and YEET-05 already here. SCHE-09, listed under this goal in MAP.md's first draft, is owned by certainty-scorecard instead; this goal consumes the retained admission history. Rejected: leaving PERIL-09 and TURB-10 without a home.

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D12, D14, D23).

Reverse: Move PERIL-09 or TURB-10 to another goal by a decision in both packets.

### The push-first D1/D2 amendment is recorded here and in AGENTS.md, not in the archived push-first packet, 2026-11-09

Ruling D15 says to record the COVE-01 amendment beside push-first D1 to D12, but `goals/push-first-publish` is archived as a generated tombstone (its README says not to edit it by hand), and AGENTS.md cites the rulings as push-first-publish D1 to D11. When COVE-01 lands, its PR therefore records the amendment as a decision file in this packet and updates the AGENTS.md Quality Operator line that names push-first-publish D1 to D11 and the yeet skill's publish section, so a reader of the push-first rulings finds the amendment. The archived packet is not edited. Rejected: editing the tombstone (overwritten by `goals archive --write`) and leaving the amendment only in this packet (agents read AGENTS.md, not this packet).

Source: this packet's lever status check (`goals/push-first-publish/README.md`, AGENTS.md); exploration `explorations/ten-minute-certainty/DECISIONS.md` (D15).

Reverse: Record the amendment wherever the push-first rulings are next restored, and drop the AGENTS.md line.

### The R2 cache pause binds TURB-05, TURB-10 and YEET-05 to shadow receipts and attribution, 2026-11-09

The 2026-11-08 R2 cache pause (`goals/turborepo-quality-cache-adoption` is paused) binds TURB-05, TURB-10 and YEET-05 in this goal: each lands as shadow receipts and attribution only. No narrowed TURBO_FORCE decision, cross-host reuse or same-head lane-proof reuse is enforced, and no cache-policy baseline re-record is requested for them, until the pause lifts. YEET-06 enforcement for cheap-tier lanes is a ProofLedger decision under time-to-certainty's rulings, not a cache-reuse lever, but it too stays shadow while the pause holds. Rejected: local-only enforcement (the pause's reasoning covers reuse trust, not only the remote writer) and lifting the pause for this program.

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D14).

Reverse: When the R2 pause lifts, record a new decision that admits enforced reuse lever by lever with its cache-policy re-record.

### A diff-preserving merge of main keeps the review-window anchor; window length unchanged, 2026-11-09

A push whose patch-id against the base is unchanged (a clean merge of `origin/main`) keeps the review-window anchor; a conflict resolution that touches PR lines re-arms it, and an unknown identity re-arms it. The window length stays 20 minutes. The lever (PERIL-09) amends the mergeable definition in the AGENTS.md Quality Operator laws, and the amendment lands in the same PR as the replay fixture (clean merge keeps, conflict touching PR lines re-arms). Rejected: re-arming on every push (measured 12 to 20 min after the last check on bound PRs) and shortening the window (assurance loss).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D12).

Reverse: Revert the anchor change and the AGENTS.md mergeable amendment; every push re-arms the 20-minute window again.

### Packet 6 of six in the critic's order, at most three open PRs, 2026-11-09

This goal is packet 6 of six, run in the critic's dependency order: it starts early with the schema and documentation slices and lands enforcement last, after certainty-scorecard and route-soundness-repair. At most three PRs are open across this packet's lanes at once (AGENTS.md Autonomy, `goals/README.md`); a fourth slice is sequenced behind one of the three in the same lane, never opened as a stack. Rejected: the first three ready PRs only (no owner for the rest) and scorecard and soundness only (defers the local work the audit was asked for).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D19).

Reverse: Re-shape the sequence through the exploration's MAP.md and record the change as a new decision.

### time-to-certainty stays paused; its C4.2 enforcement, WaveOrder re-seed and gate-order fixtures move here, 2026-11-09

`goals/time-to-certainty` stays paused. Its pointer to this goal (a "Re-homed 2026-11-09" paragraph in its README and a sentence in its manifest statusNote) landed with the graduation PR, and no slice of this goal edits that packet. Its open seams move here: ProofLedger C4.2 enforcement for cheap-tier lanes (YEET-06, bar READY), the WaveOrder re-seed (YEET-07) and the gate-order fixtures. Its rulings 76 to 83 bind this goal as constraints: a re-seed is a new seed literal under ruling 76, its provenance is pinned under ruling 77, the handoff stays one fixture-guarded `gate-order-handoff/v1` document under ruling 78, and enforcement flips only on ruling 80's bar as restarted by ruling 83 (200 attempts, 10 branches, 0 disagreements, 0 malformed rows, every C5 fixture green). Its artifacts, including `goals/time-to-certainty/research/gate-order-handoff.json` and its `economics.json`, are not edited: a re-seed writes a new handoff document under this packet's `research/` and moves the fixture pin there. Under ruling 80 the enforcement flip PR keeps ruling 82's ruling-69 root-input lock (#2625, f5552fcd812) green among the C5 fixtures, then deletes LaneProofReuse.ts and the lane-proofs.json store with a retirement receipt and re-runs the economics close, so YEET-05's shadow moves onto the ProofLedger path before or in that PR. Rejected: un-pausing time-to-certainty (its 200-attempt sample is hard to accumulate under push-first) and leaving the seams parked (the READY bar goes unused and the 2026-09-03 seed stays in force).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D13).

Reverse: Un-pause goals/time-to-certainty by a new decision and move YEET-06, YEET-07 and the gate-order fixtures back to it.

### PERIL-09: the base-merge proof is a second method on the #3130 head-move classifier, 2026-11-14

PERIL-09 reuses the head-move classifier #3130 added (`YeetHeadMoveClassifier` in `Yeet/internal/HeadMove.ts`) instead of writing a second one. The service gains `classifyBaseMerge`, which shares the classifier's object fetch, parent read, raw-entry comparison and streamed patch-identity digest (`PatchIdentity.ts`), and `isLocalMergeCommit`, a probe that reads only the local object store and never fetches. `classify` is unchanged and still refuses every merge, so it never carries a final-check receipt across a base merge. That is `classify`'s rule only: the separate refresh rule (`references/merge-loop.md`, "Refresh after a main merge", in `FinalCheckRefresh.ts`) can carry an ancestor's complete passing final-check receipt to a head with none of its own across a main merge. `classifyBaseMerge` carries only the review window.

A base merge carries the window when four checks pass, in order: the new head is one two-parent commit whose first parent is the old head (`not-base-merge` otherwise); the merged commit is an ancestor of the synchronized base `base.sha` (`base-mismatch`); the pushed tree equals `git merge-tree`'s clean merge of the old head and the merged commit (`merge-conflict` when that merge conflicts, `replay-tree` when the merge commit was edited); and the pull request's patch against the base, GitHub's three-dot diff from `merge-base(base, head)`, has the same raw entries and per-file identity before and after (`patch`). Every config-dependent diff default those reads keep a byte of is pinned (`--ignore-submodules=none` on `diff-tree` and `diff`, the submodule format, context, hunk joining, algorithm, heuristic, prefixes and `--no-relative`), so a checkout's `diff.ignoreSubmodules` or a `.gitmodules` `ignore = all` cannot hide a moved gitlink (review finding on #3329). A shallow checkout, a missing object or any failed read is `unknown`. SPEC states the rule as a conflict resolution that touches PR lines re-arming; the implementation re-arms on any conflicted automatic merge, which is SPEC's own parenthetical (a clean merge of origin/main keeps the anchor) and in practice the same set, because a resolved conflict always moves a removed or context line of a PR hunk.

The carry record `YeetReviewWindowCarry` gains `merges` (constructor and decoding default 0); `rewrites` relaxes to a natural number and a struct check requires at least one step. Rejected: a separate base-merge classifier (two owners of one patch-identity rule) and widening `classify` to accept merges (it also gates final-check receipt carry).

Lane feat/local-proof-review-window-anchor

Reverse: Remove classifyBaseMerge and isLocalMergeCommit from YeetHeadMoveClassifier and the base-merge walk from ReviewWindow.ts; every merge push re-arms the window again.

### PERIL-09: base-merge carry stops at a GitHub rewrite and at a moved hunk context, 2026-11-14

Two cases re-arm although the pull request's own lines did not change, both on purpose, because unknown is never unchanged. First, the merge walk follows only push rows and the rewrite walk only force-push rows, chosen by the head: a base merge on top of a GitHub-cascaded head counts from the cascade's push, not from the push before it, because the rewrite proof needs the cascade's own linear base and `base.sha` is the base at the merge's synchronization. Second, the patch identity keeps context lines, so a base change within three lines of a PR hunk changes the identity and re-arms (the recorded `HX` fixture). The reviewers' diff did change in both cases, only less than a fix push would. Rejected: carrying across a rewrite with an inferred base (one more inference on the merge path) and a context-free identity for merges only (a second patch-identity rule beside the one the rewrite proof and final-check refresh share in `PatchIdentity.ts`).

Lane feat/local-proof-review-window-anchor

Reverse: Compose the merge walk with the rewrite walk (merge-base of the root and base.sha as the rewrite base) or compare patches without context lines; both widen what carries.

### PERIL-09: a base-merge carry adds no request for an ordinary push and fetches only a two-parent head, once, 2026-11-14

The window is read on every monitor poll once it is the last blocker, the REST budget is shared by every monitor (D16), and `yeet gate-table` and `yeet merge-gate` read other lanes' pull requests from a checkout that lacks their heads. So the base-merge carry must add no request, and no fetch, for an ordinary push. `readYeetReviewWindowEvidence` first computes the uncarried push instant. Only while that push still holds the window does it ask whether the head is a two-parent commit, and it answers without a new request or a fetch: the issue timeline the window already reads lists pushed commits with their parents (`committed` events, now decoded into `GithubRest.reviewTimeline`'s `commits`), and a head the timeline does not list is read from the local object store by the classifier's `isLocalMergeCommit`, which never fetches, so a head the checkout lacks reads as no merge.

Only a two-parent head reads the pull (when no caller supplied it) and the branch's ref activity, and only the proofs fetch: `classifyBaseMerge`, like #3130's `classify`, fetches what the checkout lacks with `git fetch origin <sha...>` bounded at 60 seconds. Each object is fetched at most once per head per checkout per process (a process-wide `Context.Reference` set in `HeadMove.ts`, keyed by checkout, head and object, so two pull requests that share a missing base never refuse each other's fetch), so a fetch that failed or timed out is not paid again on every poll of a long-running monitor: the object stays missing, the verdict stays `unknown`, and the window re-arms without the read failing. The set also bounds the rewrite proof, which until now refetched a missing object on every read. A GitHub rewrite otherwise keeps #3130's path (force pushes in the timeline still trigger it).

Rejected: always reading the activity when a classifier is present (one or two extra REST calls per window poll on every pull request); a probe that fetches every missing head (a fetch round trip per in-window pull request in `yeet gate-table`, the review finding on #3329 that replaced it); a local-only probe (the merge gate and the gate table would never carry another lane's merge); and a per-head commit read (`GET /commits/{sha}`), which the timeline makes unnecessary.

Lane feat/local-proof-review-window-anchor

Reverse: Drop the pushHolds and two-parent gate in readWindowCarry so every window read with a classifier reads the pull and the ref activity, and drop the fetch-attempt set in HeadMove.ts so every proof fetches missing objects again.

### Readiness monitor reuse keys on the normalized replay argv; only an equal key is reused, 2026-11-14

`readyMonitorArgvKey` (`ProofJob.ts`) is the reuse key for `monitor --until-ready` jobs. It starts from the words the job replays (`stripProofJobSubmitFlags` already drops `--detach` and `--job-max-runtime`), drops `--json` and `--summary` (output only; the until-ready loop reads neither) and `--poll-interval` (how often the loop reads, not what it decides), reads `--flag=value` as `--flag value`, and sorts the entries. Every other flag stays with its value, including one the list does not know, so a future requirement flag keys apart without a code change. A live job is reused only when its key equals the request's. A stricter request (an extra or different flag, such as a longer `--settle-timeout`) submits a new job, and so does a looser one: handing back a stricter job could hold the caller's `job wait` on a requirement it never asked for. Publish now keys its reuse the same way, on `MONITOR_READY_SUBMIT_ARGV` (`Planner.ts`), so it no longer hands back a monitor an agent started with other readiness flags; before, any live monitor on the pull request was reused. The runtime cap is compared beside the key, not inside it (review findings on #3316). systemd counts `RuntimeMaxSec` from when the unit started, so what matters is the time a live job has left: its cap minus the time since it started (`readyMonitorRuntimeLeft`, read at the Effect clock's current time). The start is the record's submit time, which comes before the unit starts, so the time left is never overstated; the runner's start is used when the submit time does not parse. A request without `--job-max-runtime` accepts any live job. A capped request accepts a job with no cap, or one whose time left is at least the requested cap; equal is enough, because the measure is conservative. A capped job whose record has no readable start time is not reused for a capped request. `--job-max-runtime none`, a new accepted value, asks explicitly for no cap and accepts only a job without one. Every refusal is named on stderr with its reason, and the reuse note states the time left, not the configured cap. Before these fixes, `--job-max-runtime 6h` against a monitor capped at one hour got the old job back, and a 30-minute request against a 60-minute job started 50 minutes earlier got a job systemd stopped 10 minutes later. Rejected: subset matching (a stricter job satisfies a looser request); keeping publish's any-monitor rule (one rule for both paths, and a monitor with another `--state-root` or settle timeout reports somewhere else or on another schedule); keying on the raw argv (publish's `--json` would never match an agent's plain `--detach`).

Lane fix/local-proof-monitor-reuse

Reverse: Drop the argv comparison from matchesReadyMonitorRequest so any live monitor on the pull request is reused again, or widen it to subset matching; drop readyMonitorRuntimeShortfall from the reuse loop to stop comparing runtime.

### monitor --until-ready --detach matches a live job by branch and takes no submit lock, 2026-11-14

The CLI submit knows its branch but not its pull request number, and reading the number would spend a GitHub call on every submit. A detached monitor resolves its pull request from the branch it was submitted from, so `submitProofJobReusingReadyMonitor` (`ProofJobLauncher.ts`) matches a live job submitted from the same branch in the same checkout. Publish knows the number and still matches on it once the job has bound one. The lookup does not run under `withReadyMonitorSubmitLock`: publish runs this same command as its child while it holds that lock, so taking the lock here would make every publish wait out the lock's one-minute retry and then run unlocked anyway. Publish has already looked for a monitor to reuse before it runs the child. The cost is that two `monitor --until-ready --detach` commands started in one checkout at the same moment can both submit; the sequential repeat PERIL-02 targets is reused. Rejected: a GitHub read of the pull request number on every submit; an environment flag from publish telling its child that the lock is held (a new cross-process contract, which the job unit would also inherit through the `BEEP_` forwarding prefix).

Lane fix/local-proof-monitor-reuse

Reverse: Pass a lock-held signal from publish's submit step and wrap the CLI lookup and submit in withReadyMonitorSubmitLock, or read the pull request number before matching.

### SCHE-08 schema: unit, weight source and owner as optional keys behind a tolerant decoder, 2026-11-14

Tickets, leases and the enqueue, admission, v3 release and withdrawal journal rows gain three optional keys, read as Options: `unit` (`AdmissionUnit`: `tier` for the whole work kind, `lane` for one `GateRouteId` gate family, `package` for one `ScopedPackageName` plus Turbo task name, whose Turbo task id is `<packageName>#<task>`), `weightSource` (`AdmissionWeightSource`: `static-seed`, `measured` with a positive `sampleCount`, `conservative-fallback`) and `owner` (`AdmissionOwner`: the owning proof's nonce, pid and process start, attempt, checkout, branch, origin and command). Eviction and routing rows are unchanged. An absent key is the legacy reading (a whole-tier unit, the static seed, the record's own process as owner), so `legacy` is absence rather than a variant. The decoder is tolerant in two ways: a present value this revision cannot decode (a newer unit variant, weight source or owner shape) reads as None through `Schema.catchDecoding` instead of failing the record, and the persisted `kind` is `RecordedAdmissionWorkKind` (a known `AdmissionWorkKind` or an `UnrecognizedAdmissionWorkKind` kept verbatim), so a lease from a newer writer stays live and charged by its `weightTokens` and sits outside the review-fix class cap. `AdmissionRequest.kind` stays closed; requests carry `unit` (default `tier`) and `weightSource` (default `static-seed`). Rejected: decoding defaults that fill `tier` and `legacy` (the keys would then be written whatever the gate says), a new lease or ticket `schemaVersion` (every pre-unit reader would quarantine every new file), keeping the closed kind (a newer kind quarantines the lease and drops its tokens from capacity, the failure behind the 2,068 quarantined files), and the scoped-or-unscoped `PackageName` (workspace packages are scoped and Turbo's root `//` task is not a package unit). Evidence: `packages/tooling/tool/cli/test/quality-scheduler-admission-unit.test.ts` (origin/main bytes decode and re-encode byte for byte; a pre-unit reader decodes gated records exactly as the pre-unit bytes; a newer kind and unit are charged, not quarantined) and the ciops frozen-journal replay at 41 of 41 with the keys on every row.

Lane feat/local-proof-admission-unit

Reverse: Revert the slice; records written with the units gate on still decode on older revisions, because pre-unit readers ignore the three keys.

### SCHE-08 Cache kind: Cache commands request cache, weight 1, written behind the units gate and kept in the review-fix class, 2026-11-14

`AdmissionWorkKind` gains `cache`, and the five Cache admission sites (dependency materialization, the pilot, signed-pilot and protocol experiments, producer workflow verification) request it with `admissionTokenWeight("cache")`, which is 1, the review-fix weight they paid before. Per the units-gate decision the new kind is written only behind the `units` key: with the gate off a Cache ticket records `review-fix` and the lease and journal rows copy it, so the files are byte-identical to origin/main's. The fixture is the bytes origin/main's encoder wrote at 52900b5c0cf for the same request (lease, ticket, enqueued, admitted, released and withdrawn rows), with only the pid and nonce substituted. With the gate on the ticket, lease and enqueued, admitted and withdrawn rows carry `cache`. The review-fix class cap counts `review-fix` and `cache` together (`AdmissionWorkKind.pick(["review-fix", "cache"])`), so Cache tickets are capped and Cache leases fill seats exactly as when Cache borrowed `review-fix`. A reader older than SCHE-08 refuses `cache` (its closed kind literal quarantines the file), which is why it waits behind the gate. A slice 3 reader reads `cache` as an unrecognized kind: charged by its weight, but outside the class cap, so while any live checkout runs slice 3 alone the cap can admit one more review-fix per Cache lease; nothing is quarantined. Turn the gate on once every live checkout runs this slice or later. Console lines that print the requested kind (the wait progress, clamp, worker bypass and below-envelope lines) now say `cache`; holder lists print the recorded kind. The ciops lab keeps its own closed kind literal and is unchanged: with the gate off no row carries `cache`, and a replay of a journal written with the gate on needs the lab to learn the kind (slice 11 models the scheduler there). Rejected: a separate cap or weight for Cache (a policy change, outside this slice); a second protocol gate (the units decision puts new kinds behind `units`); writing `cache` with the gate off (pre-SCHE-08 readers would quarantine Cache leases and drop their tokens from capacity).

Lane refactor/local-proof-scheduler-facade

Reverse: Run bun run beep quality scheduler protocol --units off to stop writing the kind at once; revert the slice to have Cache request review-fix again; a lease already written with cache stays charged on any reader from slice 3 on.

### SCHE-08 facade: one QualityScheduler service whose operations keep their caller-side requirements, 2026-11-14

Callers now reach the scheduler through one `Context.Service`, `QualityScheduler` (contract in `internal/repo-run/QualityScheduler.service.ts`). Its operations are the ones callers used as module functions: `admit` (enqueue, wait, run under a heartbeated lease, release; interrupting a queued request withdraws it), `observe` (the read-only snapshot), `reap`, `protocol`, `setEvictionProtocol`, `setUnitProtocol`, `history`, `archive` and `recordRoute`. Release and withdrawal stay inside `admit` because no caller releases or withdraws on its own; resize waits for SCHE-01. `QualitySchedulerLive` in `QualityScheduler.ts` maps each operation to the existing function, so admission order, weights, the review-fix cap and journal rows are unchanged. The contract file imports only types from the implementation, so the two modules have no runtime cycle. Each operation keeps the requirements its implementation reads from the caller (platform services and `MemoryStats`), as the scheduler's two journal services already do; the shared platform requirement is marked expected for the language service's leaking-requirements check. Callers moved: the three Yeet admission wrappers in `Handler.ts`, the worker route rows in `FinalCheck.ts`, the five Cache sites, the `quality scheduler` status, reap, history and protocol commands, Palantiri's admission occupancy and the quality concurrency plan. The plan still reads admission only where the entry point provides `MemoryStats`; it now also needs the service, and every production entry point provides both together: the bin's `memory-stats` runtime service builds `MemoryStatsLive` with `QualitySchedulerLive`, the quality-task route does the same, the five Cache commands provide it next to `MemoryStatsLive`, and `session open` gives it to its hot parcels. The module functions stay exported as the implementation and its test seams (a goal research script imports `withQualityAdmission`). Cache tests now replace the scheduler with a recording Layer (`test/support/AdmissionRecorder.ts`) instead of spying on the module export; it counts admissions as they run, so the producer workflow test now sees its three identity-check admissions instead of one constructed effect. The `CacheRuntimeAdmission` test-kit namespace, used only by those spies, is removed. Rejected: resolving the services when the Layer is built (the Layer's FileSystem, Path and SecureRandom would also reach the admitted work and the origin gate, and the memory reading would be fixed per Layer instead of per call, which changes what callers and tests that pass their own readings see); a `Context.Reference` with the live scheduler as default (a test that forgets the Layer would silently admit for real); a separate `quality-scheduler` runtime-service key (every group that declares `memory-stats` needs both, and the key already loads the module that owns both Layers).

Lane refactor/local-proof-scheduler-facade

Reverse: Revert the slice; callers go back to the scheduler's module functions, which this slice left unchanged.

### Admission-unit fields are written only behind a units key on the v2 protocol marker, 2026-11-14

The gate is an additive `units` key (`off` or `on`, default `off`) on the existing `yeet-admission-protocol/v2` marker in `protocol.json`, flipped with `bun run beep quality scheduler protocol --units on|off`. `withQualityAdmission` reads it once when it builds the ticket; the lease and the enqueue, admission, release and withdrawal rows copy the ticket, so one decision covers a whole lifecycle. With it off every ticket, lease and row is byte-identical to the pre-unit format (fixture captured from origin/main's encoder). Older readers ignore the key, and an older checkout that rewrites the marker drops it, which turns the fields off again (fail-safe). `writeAdmissionProtocol` now reads the current marker inside the journal lock and changes one gate, so flipping evictions keeps the units state and the reverse. The key means every live reader runs the SCHE-08 tolerant decoder; later slices (slice 6's Cache work kind, SCHE-02's gate units) write new work kinds and unit variants behind this same gate instead of adding another. There is no automatic census of live readers: no record carries a reader revision, so, as with the eviction gate, the operator turns it on once every live checkout runs this revision. Rejected: a v3 marker (older readers would fall back to the disabled default and turn eviction rows off), writing the fields unconditionally (safe for unit keys alone, but leaves no switch for the new kinds that pre-SCHE-08 readers quarantine), and a reader-revision census (needs a field nothing writes yet).

Lane feat/local-proof-admission-unit

Reverse: Run bun run beep quality scheduler protocol --units off; writers stop at once and records already written keep decoding.

### TURB-05 force receipt rides the attempt-started row, 2026-11-14

Every repair, verify and publish attempt writes a `turboForce` key on its `attempt-started` journal row: a `TurboForceReceipt` whose `reasons` is the actual decision (forced exactly when non-empty) and whose `shadow` is the narrowed TURB-05 decision. Monitor, closeout and status attempts never decide a force and write no key. The reasons come from the closed `TurboForceReason` kit, and each one forces every dependency-sensitive step:

- `lockfile-changed`: `bun.lock` differs between the merge base and HEAD.
- `patches-changed`: a file under `patches/` or the root `patchedDependencies` changed.
- `overrides-changed`: the root `overrides` or `resolutions` changed.

The attempt row is the per-attempt receipt Yeet economics already reads, and the exploration found no receipt that records the force. Its optional keys decode on older revisions: they ignore keys they do not know, and rows written before this key decode with it absent. The force decision moved from `Handler.ts` into `decideTurboForce` in `Yeet/internal/TurboForce.ts`, kept the same modes, lockfile log line and tolerance of a failed diff, and gained the patch and override triggers (decision file `turb-05-patch-only-commits-unforced-today`). `runYeet` builds the receipt after the `--plan` return, so a plan render reads no lockfile for the shadow and prints no shadow line.

Rejected: a new ProofLedger row kind, because older readers count an unknown row as malformed and YEET-06 needs zero malformed rows; and a separate shadow file, which would need a second writer and its own retention for one field.

Lane perf/local-proof-force-reason

Reverse: Drop the turboForce key from YeetAttemptStarted and the receipt call in runYeet; rows that carry it still decode on revisions without the key.

### TURB-05 installed-tree digest is each package's locked closure, 2026-11-14

Today an installed tree is identified two ways. `HeadInstallInputs` names what a frozen install reads at a commit (the `bun.lock` blob, the manifests, `patches/`, `bunfig.toml`, `.npmrc`, the Bun version and host), at repository grain. `Cache.dependencies.ts` takes a tar digest of the whole `node_modules` for cache experiments, which also covers the whole repository and takes minutes. The per-package digest refines the first without reading `node_modules`.

A package's installed tree is every instance its resolved edges reach in the parsed `bun.lock` (`@beep/lockfiles`), plus everything the root reaches. The root is added because the hoisted linker lets every package load the root's tools, and Turbo folds the root's external-dependency hash into every task in the same way. Each instance contributes one line: its `bun.lock` key (its install position under the hoisted linker), `name@version` and integrity. The digest is SHA-256 over the sorted lines (`Sha256HexFromBytes`). The root package is named `//`.

The digests are computed only when `bun.lock` changed, from `git show` of the lockfile at the decision's merge base and at HEAD, so the shadow records which packages a per-package narrowed force would force. Three things are left out on purpose: patch content (path-detected as `patches-changed`), drift between `node_modules` and `bun.lock` (the frozen head-install preflight checks that), and undeclared imports (the separate undeclared-import invariant in the SPEC gate).

Measured on this checkout in single runs on a shared host under load, for a range of three lockfile commits that also changed the root `package.json` (209 packages compared, 4 changed): the decision took 55 ms (the diff, the merge base and the two root manifest reads) and the shadow 0.62 s (the two lockfile reads, parses and digests). A cold separate runtime took up to 2.5 s for the shadow. With `bun.lock` unchanged the decision is one `git diff --name-only` (43 ms) and the shadow reads nothing more (17 ms).

Rejected: walking `node_modules`, because only the HEAD side is on disk, so there is nothing to compare against, and its cost grows with the install; and the full tar digest, which covers the whole repository and takes minutes.

Lane perf/local-proof-force-reason

Reverse: Replace packageInstalledTreeDigests with another digest; recorded digests are shadow evidence only and nothing reads them to decide.

### Patch-only and override-only commits are forced from slice 9, 2026-11-14

Before this slice the actual decision forced only when `bun.lock` was in the three-dot diff. A patch-content edit leaves `bun.lock` alone, because `bun.lock` records patch paths and no patch content, and Turbo hashes no patch content either. A commit that touched only `patches/` was therefore never forced and could replay a cached green; #2873 (d8ef9b3839b) was such a commit. An override-only commit that left `bun.lock` alone was in the same position. A stale green is a correctness defect, so the orchestrator ruled to close the gap where it was found, in this slice. Widening the force is not the narrowing that ruling D14 defers.

From this slice the actual decision also forces when a file under `patches/` or the root `patchedDependencies` changed (`patches-changed`), or when the root `overrides` or `resolutions` changed (`overrides-changed`). The recorded `reasons` list every trigger that applied. The same `git diff --name-only <base>...HEAD -- bun.lock patches package.json` finds the path triggers, and the root `package.json` is read at the merge base and HEAD only when it is in that diff. Nothing else about the forced set changed: a `bun.lock` change forces as before with the same log line, a run that touches none of the three is not forced, the forced steps are the ones a lockfile force always set, and a failed diff still forces nothing. If the merge base or the root manifest cannot be read, the path triggers stand and the shadow is recorded as unavailable. The narrowed shadow is unchanged and still drives nothing.

Lane perf/local-proof-force-reason

Reverse: Drop the patch and override triggers from decideTurboForce (pathReasons and rootPolicyReasons in Yeet/internal/TurboForce.ts) so only a bun.lock change forces; the shadow keeps recording them.

### SCHE-06 model: EASY backfill against the head's projected start, a bound stamped at protection, and origin-then-checkout fairness on token-milliseconds, 2026-11-18

Slice 11 models SCHE-06 in `apps/labs/ciops/src/backfill/` so slice 12 can port it into `selfMayAttempt`. Schema first (`Schemas.ts`), then the `BackfillModel` service (`BackfillModel.ts`: `verdict`, `order`, `deadline`, `simulate`), then the pure policy (`Policy.ts`) and an event-driven simulator (`Simulation.ts`). Every policy function reads one `SchedulerView` (the queue, the live leases and the released leases still inside the fairness window), the state one live scan already has.

Choices, each one a place where SPEC's SCHE-06 row and the merged scheduler critique left a degree of freedom:

- **Order.** Protected units (waited at least `protectAfterMillis`, 120 s) come first in immutable enqueue order and nonce, so no newer unit overtakes them. The rest follow by the deployed effective rank, then (fairness on) the least windowed origin usage and the least checkout usage within it, then enqueue order. With `protectAfterMillis` equal to the deployed 120 s publish aging and both modes off this is exactly the deployed `ticketOrder`, because every aged unit is older than every unaged one; the property suite checks that equality and the verdict equality on arbitrary views.
- **Fairness usage is token-milliseconds**, the lease weight times its overlap with the last 30 minutes, not bare lease-seconds: one 5-token proof costs its origin what five 1-token proofs do, which is what the capacity charges.
- **EASY backfill.** A non-head unit may attempt only while the head is capacity-blocked, backfill is on and no bound is breached, when its own weight fits and its declared ETA ends no later than the head's projected start. The projection releases running leases in ETA order until the head fits; a running lease without an ETA, or past it, makes the projection unknown and stops backfill (a wrong ETA can leave capacity idle but cannot jump the head). A unit also waits while an earlier non-head unit could backfill, so backfill follows the fairness order and is never shortest-job-first.
- **The conditional bound is stamped once, at the protection instant `p`:** `p` plus the remaining ETA of every running lease, plus the ETA of every unit ahead (all older, all protected), plus `promotionOverheadMillis` per unit ahead and for the unit itself. It is declared only when all those ETAs exist (Astra's conditional framing). Why it holds with honest ETAs: a backfill admitted while the head waits ends by the head's projected start, which never moves later while the head waits, so the head starts by `p` plus the running remainder, and each protected unit behind it by induction.
- **The breach latch is derived, not stored:** backfill is off while any waiting unit is past its stamped deadline, and the simulator journals a `BoundBreached` row once per unit. The live port needs only the stamped deadline on the ticket.
- **Tier units carry no ETA**, so they never backfill; with no ETAs anywhere and fairness off, EASY replays the deployed admissions exactly. Fairness compares usage, not ETAs, so with it on the order can differ from the deployed one even for tier units. Oversized requests clamp to the capacity on enqueue, as the live scheduler clamps to the machine ceiling.
- **Out of the model:** the skippable tickets of the live scheduler (same-checkout lease, legacy origin owner, origin stamp, review-fix class cap). Slice 12 keeps those checks ahead of the new verdict unchanged. The model decides at events (arrivals, releases, protection and aging boundaries, the instant after a deadline), where the live scheduler polls on a heartbeat; `promotionOverheadMillis` is the slack slice 12 sets from that heartbeat. With fairness on, windowed usage drifts between events, so a polling scheduler can reorder the queue and admit a unit earlier than the model does; no law reads the admission instant, and the protected order the bound reads never drifts.

Gate evidence: `apps/labs/ciops/test/backfill-fairness.test.ts`, 16 cases, effect/Arbitrary streams at the repo's run floor (64 to 96 runs; 600 runs per law pass locally). Laws: capacity never exceeded and oversized units clamped under any stream, overruns included; every arrival admitted exactly once and the journal deterministic under input reordering; with honest ETAs (crashes and early finishes included) no bound is breached, also under continuous tiny arrivals behind a full-capacity unit; no backfill while a bound is breached under overrun streams; protected units lead in enqueue order and fairness orders the rest by origin usage; modes off equal the deployed order and verdicts; tier units replay the deployed admissions; under a one-origin flood a quiet origin is overtaken only by protected or backfilled units. Mutants prove the laws can fail: greedy backfill (attempt whenever the unit fits) starves the full-capacity unit past its bound, and fairness without protection or aging lets fresh origins overtake an old unit past its bound. The S7 replay stays 41/41; no existing lab file changed.

Rejected: shortest-job-first backfill (starvation, and SPEC rules it out without fairness); a stored latch (two writers would have to agree on it); bounding the wait unconditionally (no bound exists under nonpreemption with a measured 88.6-minute maximum hold); counting fairness in lease-seconds unweighted.

Lane t3/ciops-model-backfill-fairness

Reverse: Delete apps/labs/ciops/src/backfill and test/backfill-fairness.test.ts; nothing outside the lab reads them, and the live scheduler is unchanged.

### SCHE-06 live port behind default-off backfill and fairness gates; journal A/B finds no tail-wait gain on today's uniform workload, 2026-11-18

Slice 12 ports the slice 11 verdict into the live scheduler and measures it on the recorded admission journal. Recommendation: keep both gates off. On the recorded workload backfill never fires, and fairness alone lengthens the tail.

**The port.** The SCHE-06 section of `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts` (`admissionAttemptVerdict`, `admissionBackfillOrder`, `admissionConditionalDeadline`) is `attemptVerdict`, the protected order, the projected head start and the conditional bound, written against the live ticket and lease records. The schemas (`AdmissionBackfillPolicy`, `AdmissionBackfillView`, `AdmissionAttemptVerdict`, the two mode kits) are in `QualityScheduler.schemas.ts`. The port lives in existing files on purpose: a new module in the repo-run closure changes the policy-tools fingerprint, whose regeneration rewrites `turbo.json`, which this lane may not touch during window 5. The lab model and the port are deliberately mirrored, so `Policy.ts` and `JournalReplay.ts` in the lab carry a file-level `fallow-ignore-file code-duplication` with an exit: import the live verdict once a shared scheduler-policy module exists that both packages depend on. `selfMayAttempt` calls the verdict only while the admission protocol's new `backfill` (`off | easy`) or `fairness` (`off | origin-checkout`) key is on. Both keys are additive and default `off`, like `units` and `pressure`. With both off, the scheduler runs its deployed loop unchanged. The verdict runs after the deployed skippable checks (same-checkout lease, legacy origin owner, origin stamp, review-fix class cap): a skippable ticket leaves the line before the verdict reads it. The QualityScheduler contract gains `setBackfillProtocol` and `setFairnessProtocol`, and `quality scheduler protocol` gains `--backfill` and `--fairness`.

Under `easy`:
- A new ticket declares `etaMillis`: the p90 of its kind's last 200 recorded holds, once five exist. Its lease copies the value.
- When the ticket has waited 120 s, its owner stamps `deadlineMillis` on it in the next heartbeat rewrite.

Under `origin-checkout`, each scan folds the journal history into the released intervals of the last 30 minutes. With both gates off, no ticket, lease or journal row changes by a byte. The existing origin/main byte fixtures pass unchanged.

**Mixed revisions.** An older checkout ignores the new keys. It keeps the head-of-line rule and the overshoot rollback, so capacity holds whatever mix of revisions is running. Only checkouts at this revision or later can backfill or reorder.

**Fidelity to the model.** `test/quality-scheduler-backfill.test.ts` has 14 cases:
- the verdict's routes and wait reasons;
- the head start projected across several leases;
- backfill in queue order, never shortest-job-first;
- a breached bound disables backfill;
- protected order and fairness order;
- the bound's arithmetic;
- the journal-derived ETA and fairness intervals;
- 400 seeded queues on which the gated rule with both modes off equals the deployed rule for every contender;
- gate independence, ETA declaration only under the gate, and the 125 s bound stamped once on a waiting ticket under TestClock.

The SCHE-06 section of `QualityScheduler.ts` and the lab's `JournalReplay.ts` are at 100% line, branch and function coverage.

**The A/B harness.** `apps/labs/ciops/src/backfill/JournalReplay.ts` and `apps/labs/ciops/scripts/backfill-ab.ts` replay a journal root (archive day segments, then the live file). The replay:
- joins each nonce's admitted and released rows into an arrival with its recorded enqueue instant, weight, priority, origin, checkout and true hold;
- declares a causal ETA from holds already released when the unit enqueued, so it never reads the future;
- runs each arm through the slice 11 simulator;
- prints counts and nearest-rank quantiles only.

`test/backfill-journal-replay.test.ts` shows the harness finds a gain when one exists. On a mixed stream (9-token hold, 10-token head, 1-token fix), EASY admits the fix by backfill and the maximum wait drops from 498 s to 199 s. On a uniform stream every arm is identical.

**Measured, workstation journal, 2026-11-09 to 2026-11-18 (202 h):** 377 complete chains; 4 nonces skipped (withdrawn or evicted); 371 declared an ETA. All but a handful are 3-token full proofs. The recorded waits were p50 53 ms, p90 5.4 s, p95 27.4 s, p99 181.6 s and max 433.9 s, with 12 over a minute.

| Capacity | Arm (backfill / fairness) | p95 | p99 | max | mean | over 1 min | backfills | breaches |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | off / off | 0 | 24.8 s | 351.7 s | 1.3 s | 2 | 0 | 1 |
| 10 | easy / off, off / fair, easy / fair | identical to off / off | | | | | 0 | 1 |
| 8 | off / off | 43.2 s | 399.1 s | 536.0 s | 9.6 s | 16 | 0 | 0 |
| 8 | easy / off | identical to off / off | | | | | 0 | 0 |
| 8 | off / fair and easy / fair | 43.2 s | 415.3 s | 646.6 s | 10.4 s | 16 | 0 | 0 |
| 6 | off / off and easy / off | 70.4 s | 399.1 s | 536.0 s | 10.8 s | 19 | 0 | 0 |
| 6 | off / fair and easy / fair | 68.9 s | 415.3 s | 646.6 s | 11.6 s | 19 | 0 | 0 |
| 5 | every arm | 940.2 s | 2102.9 s | 2338.3 s | 132.6 to 132.8 s | 87 to 88 | 0 | 7 |

The pressure-stamped window since 2026-11-17T23:46:54Z holds only 12 chains. Their recorded maximum wait is 91 ms, and every arm matches at capacity 10, and at capacity 5 (max 16.8 s). That window is too short to rank the arms, so the full journal is the evidence.

**Reading.**
- *Backfill admitted zero units in every arm.* Backfill helps only a unit smaller than a blocked head, and this machine's heavy work is one 3-token kind: whenever the head is blocked, nothing behind it fits either.
- *Fairness reordered unprotected proofs* among the journal's 144 checkouts in two origins. It raised p99 by 4% and max by 21% at capacity 8 and 6, and it lowered p95 at capacity 6 by 2%. The tail cost outweighs that.
- *The constant-capacity replay is not the live machine.* At capacity 10 it predicts p99 24.8 s against 181.6 s recorded, because the live capacity follows MemAvailable, and the skippable checks and the review-fix cap sit outside the model. Arm-to-arm differences are the measurement; absolute values are not.

**Recommendation to the driver.** Leave both gates off. Re-run the A/B (`bun run apps/labs/ciops/scripts/backfill-ab.ts <admission-root>`) once SCHE-02 (slice 13) admits final-check gates per step and lane or package units mix weights on the queue. That is the workload backfill exists for. Turn `--backfill easy` on only if that run shows a lower p99 with zero breaches. Leave fairness off unless a run shows it does not lengthen the tail.

Lane t3/local-proof-backfill-self-may-attempt

Reverse: Leave both protocol keys off (the default) or run `quality scheduler protocol --backfill off --fairness off`; delete the SCHE-06 section of QualityScheduler.ts and QualityScheduler.schemas.ts and the gated branch of selfMayAttempt to remove the code.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
