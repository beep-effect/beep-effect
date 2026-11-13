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
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

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

Slice 2 lands PERIL-10's code half. `quality scheduler status` prints the quarantine as one line (count, oldest age read from the `.<nowMillis>` suffix, archive directory); `--json` keeps every path. The scheduler's reap pass (`repairDeadAdmissionState`, run by admission attempts and `quality scheduler reap --apply`) moves quarantine entries older than 7 days into `<admission root>/quarantine-archive` under an exclusive claims lock, never overwriting and never deleting (ruling D17: archive first, retire nothing). The status snapshot stays read-only, and leases, tickets and claims are never touched. The beep-heavy retirement in the orchestrate skill stays open as slice 4.

Prerequisite drift recorded on 2026-11-12: COVE-02 landed in #3115, MEAS-01 with MEAS-04 in #3118; SCHE-09, MEAS-02 and MEAS-07 are still open. The PLAN's HOST-01 co-carry note is moot because HOST-01 part a landed alone in #3111. #3130 (goal yeet-async-merge-and-stacks, merged 2026-11-12) adds `Yeet/internal/PatchIdentity.ts` and a head-move classifier that carries the review window across GitHub-made unchanged rewrites (cascade, restack) and fails closed on merges, so PERIL-09 (keep the anchor across a diff-preserving merge of main) remains open and should build on that classifier.

Lane fix/peril-10-quarantine-summary

Reverse: Revert the slice 2 PR; move archived entries back from <admission root>/quarantine-archive into quarantine/ if any is needed.

<!-- beep:decisions:end -->
