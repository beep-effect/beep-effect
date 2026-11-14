# Local Proof Under Ten Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Confirm the lever status table in `SPEC.md` against the checkout, take the baseline from `yeet economics --fleet` and `quality scheduler status`, and record which upstream prerequisites (SCHE-09, MEAS-02, MEAS-07, PERIL-11, COVE-02, COVE-03, COVE-04) have landed. | Baseline and prerequisite state recorded as a checkpoint file; slices 1 to 3 ready to open. |
| P1 Implement | in-progress | Land the slices below in order, at most three open at once, each with its gate. | Every slice merged or recorded as held with its blocker; enforcement slices still shadow while the R2 pause holds. |
| P2 Verify | pending | Run the Verification Matrix and read the target from certainty-scorecard over 7 days. | Publish p95 at most 8 min, verify p50 at most 10 min, zero killed admitted gates, every stale-green fixture green, or the residual recorded. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status local-proof-under-ten completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug local-proof-under-ten` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add local-proof-under-ten --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.
- **Dependencies:** `requires` certainty-scorecard (`ci/certainty-scorecard`) and route-soundness-repair
  (`ci/route-soundness`). Slices 1 to 6 do not wait on them. Weights and the final-check and agent-shell
  admission wait on the scorecard's SCHE-09 retention; the WaveOrder re-seed waits on its MEAS-02 attribution
  fix; final-check lane-proof reuse and C4.2 enforcement wait on MEAS-07 and ruling 80's bar and stay shadow
  under the R2 pause. COVE-01, TEST-04 and TEST-08 wait on COVE-03 (and COVE-01 on COVE-02 and COVE-04).
- **Shared files:** `MonitorLoop.ts` is also edited by `goals/github-state-worker` and
  `goals/yeet-monitor-app-identity`; `Economics.ts` and the attempt-termination journal by certainty-scorecard's
  MEAS-02 and MEAS-03. Whichever PR lands second merges `main` first. `AGENTS.md` (PERIL-09's mergeable amendment) and
  `.claude/skills/orchestrate/SKILL.md` (PERIL-10's beep-heavy retirement) are also edited by
  main-verdict-every-commit's HOST-01 (cancel ban; Red check and Queue starved rows). The PERIL-09 PR may carry
  the one-clause cancel ban when both are ready the same day; otherwise whichever lands second merges `main`
  first. The gated `merge-queue-activation` candidate (`explorations/github-merge-queue`) will later rewrite
  the same merge doctrine; this goal lands against the doctrine as it stands and does not wait on it (D28).
- **Never edit** the `goals/time-to-certainty` packet or the archived push-first packet. The D13 pointer
  (a "Re-homed 2026-11-09" paragraph in that packet's README and a sentence in its manifest statusNote) landed
  with the graduation PR; no slice of this goal edits that packet. The re-seed writes a new handoff under this
  packet's `research/`.

## Slices

PR-sized slices in landing order. Titles are the PLAN rows' slice titles. "Open with" groups slices that may be
open together; at most three PRs are open across the packet at any time.

| # | Slice | Levers | Size | Gate before landing | Depends on |
| --- | --- | --- | --- | --- | --- |
| 1 | `docs(yeet): mark merged-preview dormant` | PERIL-13 | S | Ruling D17 (given) | none |
| 2 | `fix(quality): summarize scheduler quarantine and reap aged entries` | PERIL-10 | S | Renderer and age-gate tests; archive-restore fixture; live lease count unchanged | none |
| 3 | `feat(repo-cli): admission unit schema` (AdmissionUnit, weight source and owner on tickets, leases and journal rows; tolerant decoder) | SCHE-08 | M | Mixed-version decode fixture; ciops replay 41/41; new fields written only behind the protocol gate | none for the schema; journal fields read SCHE-09 once it lands |
| 4 | `docs: retire the beep-heavy rule from the orchestrate skill and runbook` | PERIL-10 | S | None beyond review | slice 2 |
| 5 | `fix(yeet): reuse a live readiness monitor on monitor --until-ready --detach` | PERIL-02 | S | Same PR and argv yield one job; stricter argv not reused; dead runner skipped; `ReadyGate.ts:565` fixed | none |
| 6 | `refactor(repo-cli): scheduler Context.Service facade; Cache commands use their own work kind` | SCHE-08 | M | Cache sites stop borrowing `review-fix`; existing scheduler suites green on Node and Bun | slice 3 |
| 7 | `feat(yeet): patch-id-preserving review-window anchor` (with the AGENTS.md mergeable amendment) | PERIL-09 | M | Replay fixtures: clean merge keeps, conflict touching PR lines re-arms, unknown identity re-arms | none |
| 8 | `perf(yeet): back off the readiness monitor in push-blocked states` (wake on a local ref change; the yeet skill budgeting rule) | PERIL-03, D16 | M | TestClock mutation fixtures; dirty-file re-edit still flags stale gates; then the 7-day A/B | slice 5; github-budget-ledger's reserve signal for the skill rule |
| 9 | `perf(yeet): record force reason; shadow narrowed force` | TURB-05 | S | Shadow receipts with a per-package installed-tree digest; patch-only commits forced; no enforcement (D14) | none |
| 10 | `feat(repo-cli): sample anon/file per unit` | SCHE-07 | S | Two-week shadow with zero undercharges, raise-only | slice 3, SCHE-09 |
| 11 | `feat(ciops): model backfill and fairness` | SCHE-06 | M | Property laws under adversarial streams in `apps/labs/ciops` | slice 3, SCHE-09 |
| 12 | `feat(repo-cli): backfill in selfMayAttempt` | SCHE-06 | M | A/B on tail waits | slice 11 |
| 13 | `feat(yeet): admit final-check gates per step` (with the journald kill census) | SCHE-02 | M | Late failure, killed producer, mid-run mutation, nested capability and mixed-version fixtures; A/B with the kill census | slices 6, 10, 12 |
| 14 | `feat(quality): admit agent-shell coverage/test/docgen with an inherited capability` | SCHE-02 | L | Nested capability does not deadlock; zero kills of admitted gates in the A/B | slice 13 |
| 15 | `feat(repo-cli): resizable admission lease (shadow)` | SCHE-01 | L | Lifecycle and hold-and-wait fixtures; shadow bar on per-wave peaks | slices 10, 12, SCHE-09 |
| 16 | `feat(repo-cli): typed AdmissionBackpressure` | SCHE-05 | M | Pure-fold fixtures; push-to-hosted only at 600 s or later | slice 3, SCHE-09 |
| 17 | `chore(quality): runtime-obligation census for the Bun replay` | TEST-04 | S | Census equals the coverage census for every package whose Bun replay is dropped | COVE-03 |
| 18 | `feat(yeet): verify runs hosted partitions as admitted units (shadow)` | TEST-04 | L | Shadow parity on at least 10 heads (3 LPS-affected) | slices 15, 17, COVE-03 |
| 19 | `feat(yeet): local coverage join with run identity` | TEST-04 | M | A/B including queue time: p95 under 10 min, no deadline reds | slice 18 |
| 20 | `feat(repo-cli): direct-owner coverage scope with long-pole deferral` (publish step and the push-first amendment record) | COVE-01 | M | Byte-identical rows on Node 22.23.4; cheap-gates p95 not raised, at most 2 min added | COVE-02, COVE-03, COVE-04, slice 13 |
| 21 | `perf(yeet): final-check cheap-gates lane-proof shadow with pinned base` (receipt-grain fixture) | YEET-05 | S | Hits above 0, zero disagreements; tracked, untracked and moved-main misses; changeset-status excluded | MEAS-07 |
| 22 | `feat(yeet): enforce ProofLedger reuse for cheap-tier lanes` (shadow while the R2 pause holds) | YEET-06 | M | C5 fixtures on the flip HEAD; 0 malformed rows; narrowed receipts rejected; ruling 80 bar from ruling 83's instant; the flip keeps ruling 82's root-input lock (#2625) green, then deletes LaneProofReuse.ts and lane-proofs.json with a retirement receipt and re-runs the economics close, with YEET-05's shadow moved onto ProofLedger | slice 21 |
| 23 | `perf(yeet): file-scope effect-imports at publish with escalation and receipt grain` | YEET-02 | M | Route replay at 100% recall on the escalation list; grain fixture refused by slices 21 and 22 | slices 21, 22; ROUT-07 (LINT-01, LINT-04 landed in #3019) |
| 24 | `chore(yeet): re-seed the gate-order seed` (new handoff under this packet) | YEET-07 | S | Trace replay preserving first-red identity on a post-MEAS-02 snapshot | MEAS-02 |
| 25 | `feat(cache): attribute first-cold decisions` | TURB-10 | S | Same-head hashes across hosts; attribution only (D14) | PERIL-11 fleet roots |
| 26 | `feat(repo-cli): beep test related advisory lane` | TEST-08 | M | None for advisory use | TEST-10, COVE-03 |

Open with: slices 1, 2 and 3 first; then 4, 5 and 6 as those merge; 7 to 9 next. Slices 10 onward open as
their upstream prerequisites land, three at a time, scheduler slices before coverage and reuse slices.

## Verification Commands

```sh
test "$(wc -m < goals/local-proof-under-ten/GOAL.md)" -le 4000
jq . goals/local-proof-under-ten/ops/manifest.json
rg -n "local-proof-under-ten|GOAL.md|agentLaunchers|packetAnchorDocument" goals/local-proof-under-ten
git diff --check -- goals/local-proof-under-ten
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug local-proof-under-ten`; add a `kind: checkpoint` file there, never edit this block._

### P0 baseline: fleet economics, scheduler status and open prerequisites, 2026-11-10

P0 baseline, taken 2026-11-10 against `origin/main` `b757bd0400f`.

`bun run beep yeet economics --fleet` (yeet-economics/v2, window 2026-08-04 to 2026-11-10, 341 journals, 0 unreadable): 2606 attempts (failure 1324, success 901, unknown 381). Wrapper lanes 316.06 h measured; `full:01-pre-push` 529 runs, p50 15.6 min, p95 39.8 min (49.67%); `full:00-cheap-gates` 551 runs, p50 3.7 min, p95 10.0 min; `full:02-ci-parity` (the merged-preview step) 27 runs, p50 21.6 min, p95 46.1 min, last started 2026-10-05. Red to green (M1, comparable24h) 277 episodes, p50 35.4 min, p95 5.59 h. Terminations (M5): 2620 starts, 18 without a terminal row; interrupted 244, lease-eviction 5, owner-dead 5.

`bun run beep quality scheduler status`: capacity 3/5 tokens (MemAvailable 38.8 GiB), one live `full-proof(3)` lease, 2068 quarantine lines printed one per entry (PERIL-10's target). The admission journal holds 600 rows from 2026-11-08 to 2026-11-10 with zero `merged-preview` grants; `admissionTokenWeight("merged-preview")` is 5.

Upstream prerequisites, all still open on `origin/main`: SCHE-09, MEAS-02 and MEAS-07 (certainty-scorecard); PERIL-11 (certainty-scorecard); COVE-02, COVE-03 and COVE-04 (route-soundness-repair). Slices 1 to 3 do not wait on them; slice 1 (PERIL-13) lands in this PR.

Lane claude/adoring-payne-d7ed34

Reverse: Delete this checkpoint file and re-run goals decisions write; the baseline is a measurement, not a change.

### Slice 2 (PERIL-10): quarantine summary line and aged-entry archive, 2026-11-12

Slice 2 lands PERIL-10's code half. `quality scheduler status` prints the quarantine as one line (count, oldest age read from the `.<nowMillis>` suffix, archive directory); `--json` keeps every path. The scheduler's reap pass (`repairDeadAdmissionState`, run by admission attempts and `quality scheduler reap --apply`) moves quarantine entries older than 7 days into `<admission root>/quarantine-archive` under an exclusive claims lock, never overwriting and never deleting (ruling D17: archive first, retire nothing). The status snapshot stays read-only, and leases, tickets and reap claims are never touched; the archive's only write in `claims/` is its own lock, `claims/quarantine-archive.lock`. A needed entry is restored by moving it into its live directory with the suffix stripped; moving it back into `quarantine/` is re-archived by the next reap (review fix, 2026-11-13). The beep-heavy retirement in the orchestrate skill stays open as slice 4.

Prerequisite drift recorded on 2026-11-12: COVE-02 landed in #3115, MEAS-01 with MEAS-04 in #3118; SCHE-09, MEAS-02 and MEAS-07 are still open. The PLAN's HOST-01 co-carry note is moot because HOST-01 part a landed alone in #3111. #3130 (goal yeet-async-merge-and-stacks, merged 2026-11-12) adds `Yeet/internal/PatchIdentity.ts` and a head-move classifier that carries the review window across GitHub-made unchanged rewrites (cascade, restack) and fails closed on merges, so PERIL-09 (keep the anchor across a diff-preserving merge of main) remains open and should build on that classifier.

Lane fix/peril-10-quarantine-summary

Reverse: Revert the slice 2 PR; restore any needed archived entry by moving it from <admission root>/quarantine-archive into its live directory (leases/ or queue/) with the .<nowMillis> suffix stripped.

### Baselines before d8326d5593 are not comparable (declaration-only builds), 2026-11-13

declaration-only-builds PR 2 (#3208) merged at `d8326d55935849b4bf6fd29ec4ef80327efd6af8` (2026-11-13T05:44:35Z). Library builds are now `tsrs -p tsconfig.json --emitDeclarationOnly`: no Babel step, no `babel` script key, no JavaScript in a library dist.

- Every `#build` cache entry (local, remote, CI) misses once from that commit. The first run after merging main rebuilds cold and is not a regression.
- Any wall-time, cache-size or dist-size baseline this packet recorded before that commit is not comparable with a reading after it. Re-take the baseline before reading an after-number.
- Measured by the owning goal (181 packages, serial, fastest of three): build 80.9 s to 32.9 s, dist 232.5 MB to 147.9 MB, compile unchanged (`goals/declaration-only-builds/research/2026-11-13-build-after.md`).
- A lane editing generated files (package.json scripts, the catalog, turbo.json, the policy fingerprint, the cache baseline, the check-census baseline) merges main first and re-runs the generators.

Lane chore/ci-goals-finish

Reverse: Delete this checkpoint; it records a fact about main and changes no behaviour.

### Slice 3 (SCHE-08): admission unit schema, tolerant decoder and units gate implemented, 2026-11-14

Slice 3 lands SCHE-08's schema half on `feat/local-proof-admission-unit`: `AdmissionUnit`, `AdmissionWeightSource` and `AdmissionOwner` as optional keys on tickets, leases and the enqueue, admission, v3 release and withdrawal rows; `RecordedAdmissionWorkKind` as the tolerant reader of the persisted kind; and a `units` key on the v2 protocol marker, flipped with `bun run beep quality scheduler protocol --units on|off` and off by default (decision files `sche-08-admission-unit-schema` and `sche-08-units-protocol-gate`). Scheduler behaviour is unchanged: admission order, weights and the review-fix cap are as before, and with the gate off every record keeps origin/main's bytes. Gate evidence: `test/quality-scheduler-admission-unit.test.ts` (12 cases, Node and Bun, in-memory filesystem and a fixed procfs entry) covers the mixed-version decode in both directions, the gate off and on through `withQualityAdmission`, and a newer writer's lease charged instead of quarantined; the ciops frozen-journal replay is 41 of 41 (`evidence:s7` PASS) and stays 41 of 41 with the unit keys injected on every row (new `property 5b` in `apps/labs/ciops/test/projection.test.ts`). The gate stays off on the workstation until every live checkout runs this revision. Next for SCHE-08 is slice 6: the scheduler `Context.Service` facade and Cache's own work kind, written behind the same gate.

Lane feat/local-proof-admission-unit

Reverse: Revert the slice 3 PR; with the units gate off nothing on disk changed, and records written while it was on still decode on older revisions.

### Slice 4: beep-heavy rule retired from the orchestrate skill and runbook, 2026-11-14

Slice 4 lands PERIL-10's documentation half. `beep-heavy` is a slot wrapper installed outside the repo on 2026-10-06: it ran a command in `agent-runs.slice` after taking one of a few machine-wide `flock` slots. The exploration inventory found no `beep-heavy` unit since 2026-10-25, and no repo code calls it. The quality scheduler is the one admission authority (ruling D3), so live instructions now state what it does instead of the wrapper rule:

- `.claude/skills/orchestrate/SKILL.md`: the gate-table poller runs as a plain user unit (`systemd-run --user --unit=orchestrator-gate --collect --same-dir -E PATH ...`) or a T3 scheduled task. Hand-off re-creates a background poller as a `yeet ... --detach` job, a `systemd-run --user` unit or a scheduled task. "Where to launch" now says heavy commands need no wrapper: Yeet's full, merged-preview and review-fix proofs wait for weighted scheduler admission and run in `agent-run-<ticket>.scope`; other commands, such as `quality package-verify`, are not admitted yet (SCHE-02) and run directly; `beep-heavy` stays out of briefs.
- `docs/runbooks/practice-m365-contacts-seeding.md`: the two single-file live-test commands run without the `beep-heavy` prefix.
- `goals/design-figure-review-loop/PLAN.md`: its execution note no longer routes heavy commands through `beep-heavy`.

Left unchanged: `goals/oppold-corpus-salvage-restoration` (paused; its mentions are dated decision records and the frozen launch protocol of its paused extraction wave, which that goal revisits when it resumes); `goals/declaration-only-builds/ops/measure-build-baseline.ts` (a completed goal's script, where the mention is a usage comment); and every history, decisions and research file. The wrapper script itself and the personal memory notes that still describe it live outside the repo and are the operator's to retire.

PERIL-10 is now fully landed (slice 2 for the status summary and archive, slice 4 for the documentation).

Lane docs/local-proof-retire-beep-heavy

Reverse: Restore the removed beep-heavy lines in the three edited files from this commit's parent; the wrapper itself was never changed.

### Slice 5: live readiness monitor reused, 2026-11-14

Slice 5 lands PERIL-02 on `fix/local-proof-monitor-reuse`. `yeet monitor --until-ready --detach` now hands back a live readiness monitor for the same branch and readiness argv instead of submitting a second job, as long as the live job's time left under its runtime cap (its cap minus the time since it was submitted) is at least what `--job-max-runtime` asks for: it prints the existing job (its JSON record with `--json`) and a stderr note that states the job's time left and ends `not re-submitted`. When an earlier `job wait` on that job already returned inbox rows, a second note says so, because `job wait` does not return them again. A job is live while it is submitted or running with no cancel request and its runner process is not provably dead; a record whose runner is gone is named and skipped. The runner check moved from `Handler.ts` into `ProofJobLauncher.ts` (`readyMonitorRunnerStatus`, `pickLiveReadyMonitor`, `findReusableReadyMonitor`), and publish and the CLI share it. No record or schema on disk changed.

The defect at the old `ReadyGate.ts:565`: after a flip, `yeet ready` named any `running` record as the monitor still watching the pull request without checking its runner, so an agent could be told to `job wait` on a job that had died without a finalizer. The hint now runs the same runner check and, when only a dead record exists, says no detached monitor is registered and how to submit one.

Decision files `ready-monitor-argv-key` and `ready-monitor-cli-reuse-scope` record the key and the matching scope. Gate evidence: `test/yeet-ready-monitor-reuse.test.ts` (31 cases, Node and Bun, with a fake registry, submit and runner probe) covers two identical submissions yielding one job, the runtime rule on the TestClock (a 60-minute job 50 minutes in is not reused for a 30-minute request but is for 5 minutes, ten minutes left serves a ten-minute request exactly, a job without a readable start time is refused for a capped request, and an explicit `none` against a capped job submits), the earlier-wave note and the `--job-max-runtime` parse, a publish-submitted monitor handed back to a later `--detach`, a stricter request submitting a new job, a dead runner skipped, a registry read failure, other modes bypassing the lookup, and the ready hint, whose dead-runner case fails against the old lookup. `test/yeet-command-wiring.test.ts` adds publish submitting a new monitor when the live one runs with a longer settle timeout. PERIL-03's back-off (slice 8) can start; its 7-day A/B stays open in the acceptance criteria.

Lane fix/local-proof-monitor-reuse

Reverse: Revert the slice 5 PR; monitor --until-ready --detach submits a new job every time again, and job records are unchanged.

### Slice 6: scheduler facade and Cache work kind, 2026-11-14

Slice 6 lands SCHE-08's service half on `refactor/local-proof-scheduler-facade` (decision files `sche-08-scheduler-facade` and `sche-08-cache-work-kind`). Callers reach the scheduler through the `QualityScheduler` service (`admit`, `observe`, `reap`, `protocol`, `setEvictionProtocol`, `setUnitProtocol`, `history`, `archive`, `recordRoute`), with `QualitySchedulerLive` over the existing functions. Cache commands request their own `cache` kind at weight 1; with the units gate off the files keep origin/main's `review-fix` bytes, and the review-fix class cap counts Cache work as before. Scheduler policy is unchanged: admission order, weights, the cap and journal rows. Gate evidence: `test/quality-scheduler-admission-unit.test.ts` gains four cases (Node and Bun, in-memory filesystem, fixed procfs entry, TestClock): gate off writes origin/main's captured bytes for a Cache admission and withdrawal, gate on writes `cache` that a pre-SCHE-08 reader refuses, and a Cache ticket waits a heartbeat while two review-fix leases and one Cache lease fill the cap. The Cache tests replace the scheduler through a recording Layer and assert each site requests `cache` (dependency materialization in `cache-dependencies.test.ts`, protocol and signed pilot in `cache-signed-runner.test.ts`, the pilot in `cache-pilot-orchestration.test.ts`, producer workflow verification in `cache-workflow.test.ts`). The existing scheduler suites pass on Node and Bun. The units gate stays off on the workstation until every live checkout runs this revision. With this slice both halves of SCHE-08, the schema and the service, are implemented; the journal fields still wait on SCHE-09's retention for their readers.

Lane refactor/local-proof-scheduler-facade

Reverse: Revert the slice 6 PR; with the units gate off nothing on disk changed, and a cache lease written while it was on stays charged on slice 3 and later readers.

### Slice 7: review window survives an unchanged base merge, 2026-11-14

Slice 7 lands PERIL-09 (ruling D12) on `feat/local-proof-review-window-anchor`. A push that only merges the synchronized base into the pull request keeps the review-window anchor where it was when #3130's head-move classifier proves the PR's own patch unchanged: the new head is one two-parent commit whose first parent is the old head and whose push row moved the branch from it, the merged commit is on `base.sha`, the pushed tree is git's clean automatic merge, and the three-dot patch has the same identity before and after. `ReviewWindow.ts` walks the anchor back across every such merge to the first push that changed the patch, so the monitor and its inbox rows, `yeet status --remote`, `yeet merge-gate`, `yeet gate-table` and the REST gate (`yeet gh pr status`) all read one anchor; a carried window prints `carried across N base merge(s) from <sha>`. A conflict resolution, an edit inside the merge, a base change next to a PR hunk, a force push, a shallow history, a failed read and any unknown verdict re-arm. An ordinary push costs no new request and no fetch: whether the head is a merge commit comes from the timeline the window already reads, or else the local object store; only a two-parent head reads the ref activity and is fetched, each object at most once per head per checkout per process with a 60-second bound, and a failed or timed-out fetch re-arms without failing the read (review finding on #3329). The window length stays 20 minutes. The AGENTS.md mergeable definition, the yeet skill (`references/merge-loop.md`) and the orchestrate skill state the rule in the same change. Decision files `peril-09-base-merge-proof-on-head-move-classifier`, `peril-09-merge-probe-gates-github-reads` and `peril-09-conservative-carry-limits` record the design.

Gate evidence: `test/yeet-review-window-base-merge.test.ts` (28 cases, Node and Bun, no checkout, no network, TestClock) replays git 2.56.1 output recorded from a scratch repository (`test/support/YeetBaseMergeReplay.ts`) through the real classifier over `Git.layerTest` and a scripted spawner, and recorded GitHub reads through the real REST client. Clean merge keeps (the window elapses from the PR's earlier push); conflict touching PR lines re-arms; unknown identity re-arms (shallow history, a failed activity read, a push that did not move the branch from the merge's first parent, a force-pushed merge). The suite also covers the edited merge, the moved hunk context, a base that absorbed the whole patch, a merged commit off the base, a two-merge chain, a carried root without a check suite, the read gate that spends no GitHub call on an elapsed window or a plain commit, the fetch cost (an ordinary head the checkout lacks runs no git process whether or not the timeline lists it; a two-parent head the checkout lacks is fetched once and proven, and a second read fetches nothing; a failed fetch re-arms both reads and is attempted once for its head, while another head still asks for a shared object; a hung fetch times out as unknown on the TestClock; `yeet gate-table` over three ordinary pull requests the checkout lacks runs no git process), the carry schema's legacy decode, and the REST gate and gh-login status read agreeing on the anchor. Mutating the carry to accept every merge fails four of its cases; dropping the fetch-attempt set fails two, ignoring the timeline fails two, letting the local probe fetch fails three, and keying the set by object alone fails one. The existing review-window, head-move, merge-gate, ready-gate, gate-table and monitor suites pass unchanged apart from the carry record's new `merges: 0`.

Lane feat/local-proof-review-window-anchor

Reverse: Revert the slice 7 PR; every push, a clean merge of the base included, re-arms the 20-minute window again, and no record on disk changes.

<!-- beep:decisions:end -->
