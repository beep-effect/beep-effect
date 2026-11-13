# Route Soundness Repair Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Re-check lever status against `origin/main`; generate the goal-data consumer inventory for ROUT-03. | Statuses recorded; census input list known; no lever found landed without a decision file. |
| P1 Implement | in-progress | Land the slices below in order, each with its mutation fixture or replay. | Every SPEC acceptance criterion has a merged slice. |
| P2 Verify | pending | Run the Verification Matrix per slice; replay the route corpus after each selector change. | Fixtures red on the pre-fix tree and green after; replay shows no new skipped red. |
| P3 Yeet: PR to mergeable | pending | Publish each slice through yeet and drive it to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Slices

PR-sized, in landing order. At most three open at once (`goals/README.md`). Sizes and gates from the exploration's lever rows.

| # | Slice (PR title) | Levers | Size | Admission gate | Depends on |
| --- | --- | --- | --- | --- | --- |
| 1 | `fix(ci): keep goal ops scripts, fixtures and research inputs on the code route` (landed, #3064) | ROUT-03 | S | Census test (a new goal-data consumer census test under `packages/tooling/tool/cli/test`) finds every `goals/` path a test reads, spawns or imports, or a `turbo.json` declares, and asserts each is non-docs-only; mutations of a citation ops `.py` probe, a `.ts` ops script, the frozen JSON fixture and a ciops research JSON are each selected by change-profile. Edits `CiOperational.schemas.ts` (the `ciGoalDataConsumers` rows joined into `codeRoots`), the generated patterns JSON and `ci-heavy-admission.test.ts`, and adds `goal-data-consumer-census.test.ts`; no workflow or `turbo.json` change, so it lands alone. Merge by 2026-11-16 (D8). | none; first |
| 2 | `fix(coverage): judge bare affected runs against the merge base they planned from` (landed) | COVE-02 | S | Lowered-row fixture in `quality-tasks.test.ts` fails the bare run with the self-judge line; clean tree passes | none; parallel with 1 |
| 3 | `fix(yeet): version final-check receipts by gate set; docs name the exact gates` | YEET-08 slice 1 | S | v1 receipt refused on head and ancestor-carry paths; docs-drift test over AGENTS.md and the yeet skill | none; parallel with 1-2 |
| 4 | `fix(quality): declare goal-data consumers in CoverageScope and per-package turbo.json inputs` | ROUT-03 slice 2 | S | Census asserts each path is mapped in CoverageScope and a per-package Turbo input; the four mutations turn their consumers red under `--affected`; a coverage scope fixture with only `packages/law-practice/use-cases/test/fixtures/eyecite/authority-identity-cases.json` changed includes `@beep/law-practice-server` (ROUT-09 hole); no root `turbo.json` edit; per-package `turbo.json` change, so coverage rows freeze at base and the cache-qualification baseline is re-recorded in the same PR | 1 |
| 5 | `ci: fixed coverage comparator context name` | COVE-08 | S | Route replay of context emission (docs, source, main); `ci-runner-security.test.ts` updated for the literal `Heavy / Coverage Regression` name; if PERIH-01's probe deletion landed first, delete the `legacy_coverage` output with its last consumer; workflow change, so coverage rows freeze at base; re-record the cache-policy baseline in the same PR | owns making the job name literal; whichever of COVE-08 and PERIH-01's probe-deletion slice lands second merges `main` first and deletes `legacy_coverage` |
| 6 | `fix(turbo): key test, test:property and doctest on @beep/glob#transit` | TEST-10 | S | Dry-run hash A/B with control; cache-qualification baseline re-recorded and `standards/policy-tools.fingerprint.json` resealed in the same PR; no other `turbo.json`, lockfile or workflow change in the PR | none; #3041 has merged, so re-record against main |
| 7 | `fix(ci): docs-policy job running knowledge and packet checks on documentation and goal PRs` | ROUT-02 | M | Completeness test from `turbo.json` inputs over fixed probe paths with an exclusion list; goals-only and docs-only fixtures select the docs-policy job; #2909 head replay red; the operator kept the separate job (2026-11-09), so no Repo Sanity measurement; re-record the cache-policy baseline in the same PR | 1; HOST-06 (heavy-pool-diet) |
| 8 | `feat(coverage): bind local coverage to the shared Node 22.23.4 pin; guard baseline writes; provision in bootstrap.sh` | COVE-03 | M | Wrong runtime refused with no rows; pin-drift test against check.yml; A/B within 0.001 on `@beep/acp` plus 2-4 v8 packages | none |
| 9 | `feat(coverage): classify failure rows` | COVE-04 | M | Synthetic fixtures; exit status unchanged | 8 |
| 10 | `test(ci): differential classifier test over corpus path sets` | ROUT-07 slice 1 | M | Every classifier run over corpus head path sets; each disagreement fixed or admitted by decision file; the #3030 Test Plan job's partition selector is among the classifiers compared | 1, 4; ROUT-05 (certainty-scorecard) |
| 11 | `feat(yeet): versioned obligation registry with named hosted deferrals` | YEET-08 slice 2 | M | Omitted required contexts named as hosted obligations | 3; SCHE-02 (local-proof-under-ten) |
| 12 | `ci: classify against base-ref CI patterns at every change-profile call site` | PERIH-10 | S | Widened-head fixture gives `docs_only=false`; push gives full profile; older-schema base decodes or falls back; every `beep ci change-profile` call site covered or listed as excluded with a reason; re-record the cache-policy baseline in the same PR; a heavy.yml edit, if needed, follows the SPEC two-PR @main rule | 1, 4; PERIH-11 (heavy-pool-diet) |
| 13 | `feat(yeet): commit-range plan field and should_run-gated codegen/IPC/commitlint replays` | YEET-08 slice 3 | M | Commitlint argv equals check.yml `--from/--to`; codegen and IPC planned only when `should_run` | 11 |
| 14 | `refactor(ci): RoutePlan registry consumed by change-profile, coverage and lint-policy scopes` | ROUT-07 slice 2 | L | Differential stays at zero unadmitted disagreements after each consumer migrates; no classifier removed early | 10 |

The first wave (slices 1, 2, 3) is three PRs; slice 4 opens when slice 1 merges. Slice 10 must report before
PERIH-04, YEET-02 or ROUT-01's residual land in the sibling goals (the #3030 empty-leg skips landed before this goal),
or TURB-03 if a goal adopts it (D24).

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

- Start with slice 1 the day this packet merges: it is the exploration's first vertical slice and carries the
  2026-11-16 rollback deadline (D8). If it slips past that date, land the full rollback of the docs regex first.
- Re-read each slice's surface against `origin/main` before starting it; other lanes edit `CiLane.ts`, `Tasks.ts`,
  check.yml and `turbo.json` often (#3041 merged after graduation).
- Batch workflow and `turbo.json` changes only within one lever; each such PR freezes coverage rows at base and runs
  the full matrix.
- Cross-goal waits: HOST-06 and PERIH-11 (heavy-pool-diet), ROUT-05 (certainty-scorecard), SCHE-02
  (local-proof-under-ten). Report a stalled dependency to the orchestrator session rather than working around it.
- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add route-soundness-repair --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/route-soundness-repair/GOAL.md)" -le 4000
jq . goals/route-soundness-repair/ops/manifest.json
rg -n "route-soundness-repair|GOAL.md|agentLaunchers|packetAnchorDocument" goals/route-soundness-repair
git diff --check -- goals/route-soundness-repair
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug route-soundness-repair`; add a `kind: checkpoint` file there, never edit this block._

### P0 re-checked at 5e09d90a6da; slice 1 (ROUT-03 census) lands in #3064, 2026-11-10

P0: lever statuses re-read against origin/main 5e09d90a6da after #3041, #3049, #3053, #3055 and #3056 merged. No lever of this goal had landed. Corrected stale citations: the bare coverage comparator call in `Tasks.ts` is now line 4852 (was 4838), the Repo Sanity goals-only step in check.yml is line 329 (was 330), the fourth lane-gate change-profile eval is line 1747 (was 1736); #3041 has merged, so TEST-10 rebases on its `turbo.json`. The ROUT-03 census input list is the census test's output. P1: slice 1 (ROUT-03 census and codeRoots consumer rows) lands in #3064, inside the D8 deadline; slices 2 and 3 are next in the first wave, slice 4 opens when slice 1 merges.
Source: `git log c90929b1ff1..origin/main`; the files named above at 5e09d90a6da.

Lane fix/rout-03-goal-data-census · PR #3064

Reverse: Supersede with a later checkpoint.

### Slice 2 (COVE-02): bare coverage judges against the merge base it planned from, 2026-11-10

The bare local run of bun run coverage resolves its origin/main merge base (or TURBO_SCM_BASE) to plan the affected scope. It now carries that base in the resolved coverage options as the comparison base and hands it to the ratchet comparator, which previously fell back to TURBO_SCM_BASE and, with neither set, judged every row at the working-copy floors. A fixture in quality-tasks.test.ts (merge base at 80, a dirty baseline lowering the touched row to 50, a measured 60) fails the bare run against the merge base and passes only when the planned base is dropped; it is red on the pre-fix resolver.
Source: packages/tooling/tool/cli/src/commands/Quality/Tasks.ts (resolveDefaultAffectedCoverageTaskOptions, compareRootCoverage).

Lane fix/cove-02-bare-coverage-base

Reverse: Supersede with a later checkpoint.

### Post-merge review: census covers bare-string and exploration reads; COVE-02 judges a baseless run at HEAD, 2026-11-12

A post-merge review of the slice 1 and slice 2 PRs found four gaps, all fixed in one PR. Scope call: ROUT-03 covers exploration packets as well as goal packets, because a test that reads a tracked exploration fixture is the same consumer class; the census now scans both roots. (1) The census missed bare-string reads such as the ci-runner-security test joining the repository root with the speed-loop runner-burst directory; a quoted-literal read shape now runs over test code, counts only literals that resolve to tracked files, skips classifier tables, drops a literal naming a single packet document, and lists each synthetic temp-root literal as an exclusion with its reason. (2) Tests reading the ciops s6 ABox and journal, the s4 run4-fleet corpus and the legal-ontology-landscape asset manifest stayed docs-only; four consumer rows join codeRoots for them and the runner-burst directory. (3) A bare coverage run with no origin/main merge base and TURBO_SCM_BASE unset now judges against the baseline committed at HEAD. (4) The COVE-02 fixture now asserts the withheld-lowering line, the fallback case, and a pinned comparison that passes once the package measures at its floor. Each fix is red on the code before it.
Source: post-merge review findings of 2026-11-12; goal-data-consumer-census.test.ts and quality-tasks.test.ts.

Lane fix/rout-03-census-gaps

Reverse: Supersede with a later checkpoint; to undo, drop the four new consumer rows and the fallback comparison base.

### Census reads product and lab source path constants; ciops KPI research inputs leave docs-only, 2026-11-13

A read-only verification of the census-gap PR found the ciops KPI change-event ledger and the 2026-10-01 redacted journal snapshot under the beep-ci-operational-ontology research directory still docs-only. The kpi-reading test reads them from the real repository through path constants in apps/labs/ciops/src/kpi/Pins.ts, which the census never scanned, and its temp-root exclusion silenced the one hit the scan did produce. A consumer row now joins codeRoots for both files. The census also scans bare path constants in product and lab src code (comment lines skipped), so a src-held constant a test reads is reported. Repo tooling src stays out: its packet-path constants (route corpus, cache conformance plan, harvest ledger, cache pilot pins) are command targets its tests read from temp roots. The kpi-reading exclusion is kept for its temp-root directory hit, with the reason now naming the pinned-source scan as the route for the real reads. The pinned COVE-02 comparison now asserts an empty error report. Accepted limits, none found live: a bare literal naming one packet Markdown file stays path data, and split-segment or concatenated paths are not scanned.
Source: verification findings of 2026-11-13; goal-data-consumer-census.test.ts.

Lane fix/rout-03-src-pinned-consumers

Reverse: Supersede with a later checkpoint; to undo, drop the research consumer row and the pinned-source scan.

<!-- beep:decisions:end -->
