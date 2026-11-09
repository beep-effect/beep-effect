# Ranked plan (phase 2b)

Produced 2026-11-09 by the merge, refute and synthesis pass: twelve Opus 5.5 mergers reconciled the Opus and Astra seat reports per area (125 merged levers); two independent Opus skeptics reviewed every material lever (69 levers; 15 refuted by the first skeptic, 1 more by the second); one Opus 5.5 (high) synthesizer produced the ranked plan below and one cross-area critic reviewed it. Refute verdicts and merged lever records are in [`merged/`](./merged/README.md). This is a research artifact of the exploration: nothing here is adopted until the align round in `../../DECISIONS.md` rules on it.

## Summary

The plan has five parts. First it repairs eight trust holes. Then it removes duplicated hosted work and the setup tax. It cuts heavy-pool occupancy by making Lint Policy cheaper. It builds the head-level scorecard needed to prove any of this. It makes a hosted verdict on every main commit affordable before turning that on. The required p95 cannot reach 10 minutes at the cap-2 heavy pool. Peak heavy demand is about 260 slot-min/h against 120 supplied. Even after the Lint Policy diet and the admission-chain fix (0.6-0.9 min), the projected p95 for code heads is 70-115 min, down from 124.5. Closing the rest of the gap needs capacity, which is the operator's money decision, or a much smaller Test Unit and Test Integration envelope, which only a #3005/#3007 steady-state measurement can confirm. Runner-minutes per green code run fall by about 20-40 from a 264 p50. The largest items are standards owner rows (TURB-01: about 6-10 per run averaged, 6.5-11k per week), the Property Laws file split, folding Fallow into Labs, retiring the duplicate Shadcn job, the Nix, Security and SAST install removals, and the noResolve JSDoc inventory. Every main commit getting a verdict is achievable: about 55-65% once agents stop cancelling main runs mid-flight, and at least 95% once main uses per-SHA concurrency groups. That costs about 20-36k runner-min/day at the full profile (measured), not the 9.7k first claimed, so a throughput push layout must land first, or PR heavy queueing gets worse. Local publish p95 moves from 11.6 to about 6-9 min, mostly from LINT-01 and LINT-04 shrinking the cheap-tier pole. Local verify p95 stays at about 25-45 min, because the LPS coverage long pole (2,680 s solo) remains. The admitted hosted-partition route (TEST-04) is the only path toward a lower figure, and it is high risk and not yet demonstrated. Eight soundness repairs come first even where they cost compute: main verdicts, the @beep/glob setup-closure stale green, goal-folder data consumers misrouted as docs-only by #2999, knowledge policy on docs/goals-only PRs, the bare-coverage self-judge, final-check receipt versioning, the Node 22 coverage runtime, and base-ref patterns. Sixteen levers were refuted by a skeptic and dropped. Three more were dropped because they share a refuted lever's mechanism. Duplicates were merged so that every minute is counted once, notably YEET-01 into TEST-04, YEET-03 into SCHE-02, HOST-03 into LINT-05 and PERIH-02, HOST-04 into LINT-02, HOST-07 into ROUT-01, and DEPS-02 into PERIH-01. The merge input reused the ids PERI-01..13 in both peripheral areas; this plan renames them PERIH-xx (hosted) and PERIL-xx (local). Several prerequisites are not established. #3007 was assumed merged but skeptics found it still open. RouteCensus drops the #3005 'Test Integration (lps-int-N)' jobs, about 29% of the minutes in run 42656046751. Retired lanes delete their attempt journals, which leaves 85% of merged branches since 10-25 without local evidence. So fleet local targets and post-#3005/#3007 hosted targets stay unmeasured until MEAS-01, MEAS-04, ROUT-05 and PERIL-11 land.

## Projection after the plan

| Operator number | Baseline (2026-11-09) | Projected after the plan |
| --- | --- | --- |
| pushToRequiredGreenP95 | code PR heads p50 48.5 / p95 124.5 min; 2 of 27 under 10 | Code heads, from p50 48.5 / p95 124.5 min (2 of 27 under 10): projected p50 about 35-45 and p95 about 70-115. The levers that move it are queue relief from the Lint Policy diet (LINT-01, LINT-05, LINT-02; Lint Policy is about 60% of heavy occupancy per run), the admission-chain fix (PERIH-01, 0.6-0.9 min) and HOST-06 skips. Under 10 min at p95 is not reachable at the cap-2 heavy pool: peak demand is about 260 slot-min/h against 120, and the diet leaves it about 25% lower but still over supply. Docs-only heads stay at about 4 min plus about 4-5 min for ROUT-02. |
| runnerMinutesPerPrRun | p50 264 / p95 556 per green code head | From p50 264 / p95 556 per green code head: projected p50 about 225-245 and p95 about 500-540. Main savings: TURB-01 about 6-10, TEST-01 about 3-4 averaged, PERIL-01 about 1.0-1.3, PERIH-02 about 1.2, LINT-01 about 4 on the JSDoc job, LINT-02 and LINT-05 about 2-3 heavy minutes, PERIH-04/05/06, HOST-09 and DEPS-01 about 2-4 together. Offsets: ROUT-02 adds +4-5 on docs/goals runs, ROUT-03 a slight increase, and HOST-05 +6-10 if adopted. Main pushes cost more under HOST-01 (about 20-36k runner-min/day at the full profile before the throughput layout). |
| mainVerdictRate | 13% (13 of 101 main commits) | From 13% (13 of 101): about 55-65% after the no-manual-cancel slice, since in-progress cancels were 27 of 60, and at least 95% of non-docs SHAs after the throughput layout plus per-SHA groups. |
| localPublishP95 | p50 4.0 / p95 11.6 min | From p50 4.0 / p95 11.6 min: projected p50 about 2.0-2.5 and p95 about 6-9. LINT-01 then LINT-04 shrink the cheap-tier pole (jsdoc 188 s, then effect-imports 143 s and effect-vitest 85 s). The admission-wait tail (p95 277 s) remains. |
| localVerifyP95 | p50 14.5 / p95 57 min | From p50 14.5 / p95 57 min: projected p50 about 10-13 and p95 about 25-45. LPS-affected coverage (2,680 s solo) dominates the tail. Under 10 min requires TEST-04, which is high risk and undemonstrated. |

Caveats:

- Component p95s were not added; each range is an independent judgment from its own baseline.
- #3005 and #3007 steady state is unmeasured, and skeptics found #3007 still open. Test Unit (11-18 min on #3007-layout runs) and partitioned Test Integration p95 are unknown until 7 days of post-merge runs exist.
- RouteCensus does not map the #3005 partition jobs (29% of minutes in run 42656046751) until ROUT-05 lands.
- Fleet local figures are censored: 85% of merged branches since 10-25 have no surviving journal (PERIL-11), and T3 and remote hosts are invisible.
- The heavy-queue projection assumes HOST-01 lands with the throughput layout; per-SHA groups without it would raise PR p95.
- The public repo makes GitHub-hosted minutes free; the savings show up as runner-minute and concurrency headroom, while heavy EC2 minutes are paid.
- Runner-minute savings are not strictly additive. Several levers share setup seconds (PERIL-01, HOST-10, PERIH-05/06).

## Plan rows by tier


### T0. Trust repairs (first, even at a cost)

#### 1. HOST-01 A hosted verdict for every main commit, staged: no manual main cancels, then a throughput layout, then per-SHA groups (hosted-ci)

- **Moves:** main-verdict-rate, trust, runner-minutes (worse). **Trust risk:** medium. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics. Cost understated 2-4x. No tooling cancels main runs; the cancels are ad hoc agent cancels licensed by the AGENTS.md runner-freeing law. Shared DATABASE_URL across concurrent main runs is unverified. Reconciliation overlaps MEAS-01 and rerun-runner-loss.
- **Expected effect:** Main verdict rate goes from 13% to about 55-65% after the no-manual-cancel slice (27 of 60 main runs were cancelled mid-run by hand), then to at least 95% of non-docs SHAs after per-SHA groups. Measured net cost is about 20-36k runner-min/day at the full profile (about 360 runner-min/run x 54-100 commits/day), not the 9.7k claimed. The throughput layout must come before per-SHA groups.
- **Gate before landing:** Before landing: replay 7-14 days of merge timestamps against the 60-job hosted ceiling and the cap-2 heavy pool. PR pickup p95 and heavy-wait p95 may regress by at most 1 min. Throughput-layout census must match the full profile. After landing: over 7 days, at least 95% of non-docs main SHAs have a completed Check run and no agent cancels a main run.
- **Depends on:** MEAS-01
- **PR slices:** docs: forbid cancelling refs/heads/main runs (AGENTS.md inherited-red law + orchestrate skill) [S]; perf(ci): throughput partition layout for main push runs [M]; ci: per-SHA Check concurrency group for main pushes [S]; feat(ci): re-dispatch missing or cancelled main verdicts by extending rerun-runner-loss [S]

#### 2. TEST-10 Key test, test:property and doctest on @beep/glob#transit, with a setup-closure invariant (merges TURB-04) (tests)

- **Moves:** trust. **Trust risk:** none. **Seats agree:** True.
- **Refute outcome:** Confirmed by both skeptics (TEST-10). TURB-04 weakened: its coverage invariant is meaningless (cache:false) and its selection clause is unmeetable.
- **Expected effect:** Closes a cached stale green: 127 of 200 test tasks and the doctest set ignore @beep/glob edits even though vitest.setup.ts:34 imports it. 0 hosted minutes, since Test Unit runs --force. About 1.2 glob edits/week now invalidate locally. --affected selection does not widen.
- **Gate before landing:** Dry-run hash A/B in a disposable worktree: every hash in the three families changes on a GlobPattern.ts edit, and a control edit leaves them stable. Pre-fix baseline is @beep/identity#test=efb65c7d1bcb4fc1. The invariant covers cacheable families only (not coverage). Cache-qualification baseline is re-recorded in the same PR.
- **PR slices:** fix(turbo): key test, test:property and doctest on @beep/glob#transit [S]

#### 3. ROUT-03 Register goal-folder data consumers and narrow the #2999 docs-only widening for consumed paths (routing)

- **Moves:** trust. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Confirmed (r1), weakened (r2): the lever listed only ops .ts, the manifest and the fixture, and missed the executed .py/.mjs probes. A root turbo.json edit would force a repo-wide cold cache and a reseal, so use per-package inputs.
- **Expected effect:** Closes missed-red paths on docs-only and code PRs. Affected consumers: law-practice-server runs goals/citation-extraction-engine/ops/*.py and *.mjs (10 commits since 10-25); eyecite and LPS read the frozen profile fixture; semantica reads its canary report; ciops reads gate-order-handoff; repo-cli reads ops and research inputs. Slightly negative runner-minutes (under 5% of PRs regain shards).
- **Gate before landing:** A generated census of every goals/ path that a test reads, spawns or imports, or that a turbo.json declares. Each path must be non-docs-only, mapped in CoverageScope, and a per-package Turbo test input. Mutations of a .py probe, a .ts ops script, the JSON fixture and a research JSON must each be selected and go red.
- **PR slices:** fix(ci): keep goal ops scripts, fixtures and research inputs on the code route, with a generated consumer census [S]; fix(quality): declare goal-data consumers in CoverageScope and per-package turbo.json inputs [S]

#### 4. ROUT-02 Run knowledge and packet policy on docs-only and goals-only PRs in their own job (routing)

- **Moves:** trust. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics: the proposed host (Repo Sanity) was wrong, the task list was incomplete against its own derivation rule, and the main-verdict credit belongs to HOST-01.
- **Expected effect:** Restores pre-merge semantic-delta and refs-check verdicts. Two escapes confirmed: run 39753415111, and #2909, which needed fix PR #2919 on main. Costs about +4-5 runner-min per docs/goals-only run (about 25% of PRs), 0 on code PRs. Repo Sanity cannot host it because it skips on goals_only.
- **Gate before landing:** A completeness test derived from turbo.json inputs against fixed probe paths (goals/x/README.md, goals/x/SPEC.md, docs/a.md, explorations/x/CAPTURE.md), with an explicit catch-all exclusion list; it fails today on lint:effect-imports-markdown. goals_only and docs_only fixtures must select the job. Replaying #2909's head must go red.
- **Depends on:** ROUT-03, HOST-06
- **PR slices:** fix(ci): docs-policy job running knowledge and packet checks on documentation and goal PRs [M]

#### 5. COVE-02 Bare `bun run coverage` judges against the merge base it planned from (coverage)

- **Moves:** trust. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Confirmed by both skeptics.
- **Expected effect:** Repairs a local stale green. Today a bare run compares against working-copy floors with no self-judge (Tasks.ts:4837, CoverageRegression.ts:2386-2390). 0 minutes.
- **Gate before landing:** Unit fixture in quality-tasks.test.ts: a lowered row in a dirty baseline makes the bare run fail with the self-judge line. The same fixture passes green on the current tree.
- **PR slices:** fix(coverage): judge bare affected runs against the merge base they planned from [S]

#### 6. YEET-08 Make final-check's assurance contract explicit: versioned receipts, exact gate names, named hosted obligations (yeet-pipeline)

- **Moves:** trust. **Trust risk:** medium (slice 1 low). **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics. Ancestor-carry lets old receipts pass a larger gate set, so versioning must land in slice 1. The argv-parity claim was false (no range field; workflow-gated lanes run unscoped). Commitlint replay catches nothing new.
- **Expected effect:** final-check stops claiming 'every hosted gate'. A gate-set digest is refused on both the same-head and the ancestor-carry paths (ReadyGate.ts:1260). AGENTS.md drops the non-existent 'Effect Diagnostics' gate. Omitted required contexts are named as hosted obligations. Local commitlint, codegen and IPC replays wait until CiLocalStepPlan carries a commit range and the change-profile should_run flag. 0 minutes.
- **Gate before landing:** repo-cli fixtures: a v1 receipt is refused on the head path and the ancestor-carry path. A docs-drift test ties the AGENTS.md and SKILL.md gate names to the FinalCheckGate literals. Later slices: commitlint argv equals check.yml --from/--to, and codegen/IPC are planned only when should_run.
- **Depends on:** SCHE-02
- **PR slices:** fix(yeet): version final-check receipts by gate set; docs name the exact gates [S]; feat(yeet): versioned obligation registry with named hosted deferrals [M]; feat(yeet): commit-range plan field and should_run-gated codegen/IPC/commitlint replays [M]

#### 7. COVE-03 Local coverage children and baseline writes run on Node 22.23.4 from one shared pin (coverage)

- **Moves:** trust. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics: no counter delta measured, a second source of truth needs a drift test, and cloud bootstrap must provision the pinned runtime.
- **Expected effect:** Removes the documented node#63785 class of local false reds (Node 24 property failures). No V8 counter difference has been measured. 0 minutes. Prerequisite for TEST-04 and COVE-01.
- **Gate before landing:** A wrong runtime is refused with no rows written, and the bunx --bun LPS argv is unchanged. A pin-drift test checks the CLI pin against check.yml. A/B on @beep/acp plus 2-4 v8 packages in the hosted producer mode matches hosted rows within 0.001.
- **PR slices:** feat(coverage): bind local coverage to the shared Node 22.23.4 pin; guard baseline writes; provision in bootstrap.sh [M]

#### 8. PERIH-10 Classify PRs against base-ref CI patterns (peripheral-hosted)

- **Moves:** trust. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Weakened by both skeptics: the head-controlled workflow and pin keep easier bypasses, and there is a new fail-closed hazard when a pin bump changes the patterns schema.
- **Expected effect:** Closes one self-classification channel. The trust gain is small because the head still controls check.yml and the binary pin. Required before more decisions move onto the pinned binary.
- **Gate before landing:** Unit fixture: canonical base patterns plus a widened head give docs_only=false. A push event gives fullProfile. A base from an older schema decodes or falls back explicitly. The check.yml:256 call site is covered.
- **PR slices:** ci: classify against base-ref CI patterns at both change-profile call sites [S]


### T1. Pure waste (no trust trade)

#### 1. PERIH-02 One hosted lint:shadcn owner: retire the Shadcn Lint job, run it in required Repo Sanity, drop it from the hosted Lint Policy plan (absorbs HOST-03 shadcn half and HOST-09 shadcn) (peripheral-hosted)

- **Moves:** runner-minutes. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Confirmed (r1), weakened (r2): it duplicates HOST-09's minutes and conflicts with HOST-03. Resolved by making Repo Sanity the single owner and counting the minutes once.
- **Expected effect:** About -1,350 runner-min/week (88 s job, of which 60-70 s is setup, about 1,050 jobs/week). 0 critical path. Shadcn findings become merge-blocking; record a decision file.
- **Gate before landing:** A planted violation turns Repo Sanity red on PR and push and green when removed. A test asserts exactly one hosted owner across check.yml and the hosted Lint Policy plan. The step cannot be masked by an earlier Repo Sanity failure.
- **PR slices:** ci: one hosted lint:shadcn owner in Repo Sanity (check.yml, CiLane, RouteFootprints, WaveOrder, tests) [M]

#### 2. LINT-05 Drop the duplicate jsdoc inventory and ratchet from the hosted Lint Policy plan (absorbs HOST-03 jsdoc half) (lint-laws-knowledge)

- **Moves:** runner-minutes. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Confirmed (r1), weakened (r2): duplicate of HOST-03, and the gate condition was reworded.
- **Expected effect:** About -1.9 heavy runner-min per Lint Policy run when the inventory misses and is the medium tail (measured 225 s tail), and about 0 on cache hits. Falls to 0.3-0.6 after LINT-01. About 130-350 paid heavy min/week.
- **Gate before landing:** A plan test shows the hosted plan omits both tasks only while JSDoc Ratchet is required. On a seeded-red draft PR, JSDoc Ratchet fails and the Lint Policy log shows neither task.
- **PR slices:** perf(repo-cli): leave the JSDoc inventory to the required JSDoc Ratchet lane [S]

#### 3. PERIH-05 Run the Nix Shell lane without installing the JS workspace (peripheral-hosted)

- **Moves:** runner-minutes. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Confirmed by both skeptics. r2 found the missing ci-runner-security edit and the warn-dirty drift.
- **Expected effect:** -0.6-0.85 min per active Nix run, about 600-650 runner-min/week (35% of PRs plus every main push). 0 critical path.
- **Gate before landing:** Nix Shell is green on its own PR, and a broken-flake mutation turns it red. A drift test checks check.yml argv against the CiLane nix steps, including --option warn-dirty false. The ci-runner-security assertion is updated.
- **PR slices:** ci: decouple the Nix proof from the workspace install with an argv drift test [S]

#### 4. PERIL-04 Run changeset-graph once in Repo Sanity (merges LINT-06) (peripheral-local)

- **Moves:** runner-minutes. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Confirmed (r1), weakened (r2): the 'or the reverse' option was unsafe, and it duplicates LINT-06.
- **Expected effect:** About -1.8 s per Repo Sanity run (about 16-50 runner-min/week). The GithubChecks lane stays, because it is the only local graph check. LINT-06's schema-catalog half needs cache qualification first.
- **Gate before landing:** A plan-label test shows a single execution, and a corrupt .changeset fixture stays red.
- **PR slices:** ci: run changeset graph once in Repo Sanity [S]

#### 5. PERIL-10 Summarize scheduler quarantine in status and archive-reap aged entries; retire the beep-heavy doctrine (merges SCHE-10) (peripheral-local)

- **Moves:** measurement. **Trust risk:** none. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Each scheduler status call shrinks from 305 KB (about 75k agent tokens) to one line. The 2,068 stale rows are archived and then reaped.
- **Gate before landing:** Unit tests for the renderer and the reaper age gate, plus an archive-restore fixture; the live lease count is unchanged.
- **PR slices:** fix(quality): summarize scheduler quarantine and reap aged entries [S]; docs: retire the beep-heavy rule from the orchestrate skill and runbook [S]

#### 6. PERIL-02 One readiness monitor per PR in a checkout, reuse keyed on normalized readiness argv (same-checkout only) (peripheral-local)

- **Moves:** none. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics. Cross-clone supersede is unsound (per-checkout registry and inbox), so slice 2 is dropped. Runner-liveness must be checked.
- **Expected effect:** Removes duplicate monitors; three are live on PR 3007 right now. That saves about 86 CPU-s and 250 MB per duplicate monitor-hour, plus REST budget. 0 target minutes.
- **Gate before landing:** yeet.test.ts: two submissions with the same PR and argv yield one job; stricter argv is not reused; a dead-runner record is skipped. Reuse goes through pickReusableReadyMonitor, and ReadyGate.ts:565 is fixed in the same PR.
- **PR slices:** fix(yeet): reuse a live readiness monitor on monitor --until-ready --detach [S]

#### 7. PERIL-03 State-aware monitor cadence: back off in push-blocked and window-only states, wake on a local ref change (peripheral-local)

- **Moves:** none. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics. The CPU target was mislabelled (it is GateStaleness, not lane digests). Paginated ETag reuse and a count-keyed staleness cache are unsafe.
- **Expected effect:** Up to 75% fewer polls in stable states, saving local CPU and REST only. Notice lag is bounded by the idle interval. ETag and staleness caching are split out as separate, riskier work.
- **Gate before landing:** TestClock mutation fixtures: the first terminal state after each mutation follows a full read taken after that mutation; a dirty-file re-edit still flags stale gates. After PERIL-02, a 7-day A/B of polls per monitor-hour.
- **Depends on:** PERIL-02
- **PR slices:** perf(yeet): attribute monitor API cycles per call site [S]; perf(yeet): back off the readiness monitor in push-blocked states [M]

#### 8. TURB-09 Ignore Python tool caches in repo-cli and assert that every hashed input is tracked (turbo)

- **Moves:** local-verify, trust. **Trust risk:** none. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Removes non-inputs from repo-cli hashes so primary-clone runs can hit worktree and hosted entries. Small local gain.
- **Gate before landing:** None (pure waste). A dry-run shows only the two residue files dropping out.
- **PR slices:** fix(turbo): ignore python tool caches and assert hashed inputs are tracked [S]

#### 9. DEPS-08 Retire the baked-AMI Bun fast path, which keys on the lockfile and saves about 1 s (deps-toolchain)

- **Moves:** trust. **Trust risk:** none. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** About 0 minutes. Removes dead maintenance: the image stamp says Bun 1.4.2 while setup expects 1.4.4.
- **Gate before landing:** None. Digest checks are kept.
- **PR slices:** ci: retire the baked-runner Bun fast path [S]

#### 10. PERIL-07 Pre-commit typos on staged files only, with a full scan on config changes (merges LINT-11) (peripheral-local)

- **Moves:** local-publish. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** About 0 commit wall time (hooks run in parallel and typos takes 631 ms). Saves about 10 CPU-s per commit and stops inherited typos from blocking commits.
- **Gate before landing:** Fixtures for staged files, renames, spaces in names and config edits.
- **PR slices:** chore(hooks): check staged spelling in pre-commit [S]


### T2. Required-path latency and heavy-pool relief

#### 1. PERIH-01 Heavy Admission from the pinned CI binary with a closure-digest fallback; delete the dead coverage-rollout probe (absorbs DEPS-02 admission half) (peripheral-hosted)

- **Moves:** required-path-p95, runner-minutes. **Trust risk:** medium. **Seats agree:** False.
- **Refute outcome:** Weakened by both skeptics. Pin lag: #2999 and #3011 changed admission after the pin. The 'trust' gain is illusory. Deleting the probe alone would turn Coverage Regression red. Duplicate of DEPS-02.
- **Expected effect:** -0.6-0.9 min on the Admission to Heavy chain for every non-docs PR (setup measured at 34-50 s; Heavy starts 2-4 s after admission). About 950-1,050 runner-min/week. Variant to measure: fold admission into the change-profile job for another 20-30 s.
- **Gate before landing:** Replay of recorded events (draft, label, fork, docs, push, error) through binary and source must give byte-identical verdict, route_skips and route_receipt. A closure-digest mismatch fixture must force the head-install fallback. Slice 1 removes the probe, the output, the env line and the LEGACY_COVERAGE assertion (check.yml:899) together.
- **Depends on:** PERIH-11, PERIH-10
- **PR slices:** ci: delete the dead coverage-rollout probe at all four sites [S]; ci: bundle ci admission in the CI binary with a closure-digest fallback [M]; ci: switch Admission to the pinned binary after the pin bump [S]

#### 2. LINT-01 Build JSDoc inventory programs with noResolve, as an opt-in factory option (lint-laws-knowledge)

- **Moves:** runner-minutes, local-publish, local-verify. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics: the required-path claim was wrong, an augmentation fixture was missing, and its savings overlap LINT-05 and YEET-02.
- **Expected effect:** The required JSDoc Ratchet inventory goes from 300-309 s to about 45-60 s (derived), about 4 ubuntu runner-min per job. It shrinks the Lint Policy medium tail (heavy occupancy) and the local cheap-gates jsdoc pole (188 s p50), worth -0.75 to -2 min on local publish. It is not the required-path pole today.
- **Gate before landing:** Inventory jsonc and md byte-identical, minus generatedAt, across 194 packages. Fixtures include a local re-export, a star export, a merged namespace, an overload, and a module augmentation of an imported package. One hosted JSDoc Ratchet timing.
- **PR slices:** perf(repo-cli): build jsdoc inventory programs with noResolve [S]

#### 3. LINT-02 Lint Policy stage widths: knowledge doctor abreast of medium, changed-scope state width derived jointly (merges HOST-04, LINT-03) (lint-laws-knowledge)

- **Moves:** runner-minutes, required-path-p95. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Weakened by both skeptics. The 3.4-min saving was overstated, the doctor is not a single-slot cost, and it duplicates HOST-04 and competes with LINT-03 for slots.
- **Expected effect:** -1.7 to -2.2 heavy min per escalated run today, because medium is width-bound. Approaches -3.4 after LINT-01 and LINT-05. About 550-700 heavy runner-min/week. LINT-03 adds about 0.3 per run on average. Lint Policy is not required; the latency effect comes through cap-2 heavy occupancy.
- **Gate before landing:** Plan-shape test: doctor present in both scopes with unchanged argv, summed width at most policyLint and medium at least 2 for every profile. A red doctor fails the lane. Hosted A/B of at least 10 runs per arm: p50 and p95 each improve by at least 90 s, and memory.peak stays under 24 GB.
- **Depends on:** LINT-01, LINT-05
- **PR slices:** perf(repo-cli): run the knowledge doctor abreast of medium inside the width budget [S]; perf(repo-cli): derive the changed-scope state width from the remaining slots [S]

#### 4. HOST-06 Hoist heavy route_skips, goals-only and Docgen decisions to job-level `if` before Spot boot (hosted-ci)

- **Moves:** runner-minutes, required-path-p95. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** About 1 heavy slot-min per eligible run, freeing cap-2 slots that no-op leaves now hold.
- **Gate before landing:** Route replay plus mutation fixtures (docs, goals, no-diff, unreadable base). Hosted ruleset parity ledger.
- **PR slices:** perf(ci): decide heavy route, goals and docgen skips at job level (two-PR heavy.yml@main rollout) [M]

#### 5. HOST-08 Queue-aware Test Unit leg-width A/B after #3007 reaches steady state (hosted-ci)

- **Moves:** required-path-p95, measurement. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Weakened by both skeptics: the slice 2 envelope assertion is already in #3007, T6 is off the critical leg, and it double-counts TEST-02.
- **Expected effect:** 0 credited. #3007 already enforces per-partition budgets and isolates research-library-views. The T6 fix moves the critical path by 0, since the critical leg is repo-cli-3 (research-library-replay, 284 s). Only a leg-width A/B under 1, 2 and 4+ concurrent PRs, within the 60-job ceiling, can show a Test Unit context under 10 min.
- **Gate before landing:** Hosted A/B: push-to-Test-Unit p95 at most 9.5 min per run from lane-timings, runner-minutes reported beside it, and no queued-job growth at the ceiling.
- **Depends on:** MEAS-04, ROUT-01
- **PR slices:** chore(ci): queue-inclusive leg-width A/B harness for Test Unit [M]

#### 6. HOST-05 Shard the Property Laws repo-cli sweep under a fail-closed census aggregate, only if TEST-01 leaves it above 10 min (merges TEST-06) (hosted-ci)

- **Moves:** runner-minutes (worse). **Trust risk:** medium. **Seats agree:** True.
- **Refute outcome:** Weakened by all four skeptic reviews: it moves no target, cost was understated, the partition tooling does not cover the lane, and it duplicates TEST-06.
- **Expected effect:** +6 to +10 runner-min per eligible run. Cuts Yeet-mergeable p95 by about 3.4 min, at the tail only. 0 effect on required contexts. The 305 s coverage-artifacts file sets a floor of about 8-9 min per leg.
- **Gate before landing:** Draft PR on 5 heads: the union of leg test IDs equals the unsharded vitest list under the sweep env. A planted failing leg, a leg missing its env and an empty leg each turn the aggregate red. A/B runs after TEST-01.
- **Depends on:** TEST-01
- **PR slices:** perf(ci): property partitions in CiLanePartitions with census and env parity [L]; perf(ci): shard Property Laws with a fail-closed aggregate [M]


### T3. Runner-minutes

#### 1. TURB-01 Owner-map generated standards inventories in CoverageScope (turbo)

- **Moves:** runner-minutes, local-verify. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics. Magnitude was revised from 100-140 per affected run to 6-10 averaged. A literal-path drift scan misses path.join readers. The repo-cli-kit and repo-configs rows were unnecessary.
- **Expected effect:** About 6-10 runner-min per PR run on average. About 8% of runs convert from a full to a repo-cli fan-out, saving 80-130 job-min each. Roughly 6,500-11,000 runner-min/week. 0 critical path.
- **Gate before landing:** In-repo replay corpus: only commits whose sole full trigger is a mapped file shrink. Per-file mutation fixtures; unmapped standards files stay full. The reader drift check is token- and segment-aware (path.join readers) and proven by a seeded fixture.
- **Depends on:** ROUT-05
- **PR slices:** feat(quality): derive coverage owners for generated standards inventories, with a reseal [M]; test(quality): replay the coverage scope corpus before and after owner rows [S]

#### 2. TEST-01 Property sweep runs only property-executing tests: file split first, then a census checked by an oracle (tests)

- **Moves:** runner-minutes. **Trust risk:** medium. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics. An fcRuns-time hook misses 431 module-scope bindings and props without fcRuns. The gate was circular without an oracle. It shares research-library-views minutes with the dropped TEST-02.
- **Expected effect:** The slice 1 split (coverage-artifacts 305 s, research-library-views 174 s, ci-runner-security 110 s) saves about 4-6 runner-min per repo-cli Property Laws run, which is about 70% of runs, and takes Property Laws from 15-18 min to about 10-13. The census slices add an unmeasured remainder.
- **Gate before landing:** An oracle wrapper on effect/Arbitrary and @effect/vitest prop via vitest.setup. Old and new oracle logs must be identical in (file, test, runs, seed) on 3 heads. A passWithNoTests override, and fixtures for module-scope fcRuns, props without fcRuns, and renamed tests.
- **PR slices:** test(repo-cli): split single properties into their own files with the same generator, seed and floor [S]; feat(fc-runs): oracle-checked property census and drift join [M]

#### 3. PERIL-01 Fold the non-required Fallow envelopes into Labs after its coverage body (peripheral-local)

- **Moves:** runner-minutes. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Weakened by both skeptics. Needs statuses:write, which is unavailable on forks. Coverage Regression authenticates Labs. Overlaps HOST-10, DEPS-03 and DEPS-04 on setup seconds.
- **Expected effect:** -1.0 to -1.3 runner-min per non-docs PR run, about 1,000-2,300 runner-min/week. 0 critical path.
- **Gate before landing:** Shadow on a draft PR with both paths for at least 10 runs: envelope fields match. Negative fixtures: a seeded finding goes red; a status post without statuses:write is visible; a Labs failure still posts. Coverage Regression stays green with a red Fallow step (continue-on-error). RouteCensus keeps a Fallow timing row.
- **Depends on:** PERIH-04
- **PR slices:** ci: run Fallow envelopes inside Labs and post the advisory status [M]

#### 4. PERIH-04 Job-level lane-relevance skips for Codegen, Ecosystem, Nix and IPC from Change Profile (Labs excluded) (peripheral-hosted)

- **Moves:** runner-minutes. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Weakened by both skeptics. Labs must be excluded. A fail-closed-to-skip hazard exists if a key is missing. The live parity window conflicts with section K.
- **Expected effect:** -0.5 to -0.76 runner-min per PR run, about 830/week, and about 1.8 fewer runner allocations per run.
- **Gate before landing:** Offline replay of historical PR heads: zero heads where the old gate runs and the new one skips. Push events emit all-true. An old-binary/new-workflow fixture shows guards written as `!= 'false'` still run the lane.
- **Depends on:** PERIH-11, ROUT-07
- **PR slices:** ci: lane-relevance outputs from change-profile with fixtures [M]; ci: pin bump [S]; ci: job-level skips from change-profile outputs [S]

#### 5. HOST-09 Fold PR Size Label into Change Profile, run Rerun Runner Loss from the binary, A/B PR Build on hosted runners (absorbs PERIH-03) (hosted-ci)

- **Moves:** runner-minutes, required-path-p95. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** PERIH-03 weakened by both skeptics: savings were triple-counted with DEPS-02 and HOST-09, and the rerun half bills about 0.
- **Expected effect:** Removing the PR Size job saves about 600-1,000 runner-min/week. Rerun Runner Loss saves about 180 wall-min/week, which is about 0 billed. Moving Build to hosted would free about 1 heavy slot-min per run if the A/B fits in 16 GB.
- **Gate before landing:** Label-set parity, a rerun-decision shadow ledger with 0 mismatches, and a Build A/B with peak RSS on 5 hub-touching heads.
- **Depends on:** PERIH-11
- **PR slices:** perf(ci): fold PR size into Change Profile [S]; ci: rerun-runner-loss from the CI binary [M]; perf(ci): PR Build on hosted runners (A/B) [M]

#### 6. PERIH-06 Security and SAST dispatch without the workspace install, with a head fallback on mismatch (peripheral-hosted)

- **Moves:** runner-minutes. **Trust risk:** medium. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** About 0.6 runner-min per run, about 650-750/week. Applies to two required contexts.
- **Gate before landing:** Parity ledger: argv and env, red exits, fixture exclusions and a planted Semgrep finding. Head-install fallback on any compatibility mismatch.
- **Depends on:** PERIH-11
- **PR slices:** ci: shared slim Security/SAST dispatch [M]; ci: switch to the pinned dispatcher with head fallback [M]

#### 7. DEPS-01 Explicit trustedDependencies allowlist replacing Bun's default list, with a lifecycle-script census guard (deps-toolchain)

- **Moves:** runner-minutes, trust. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics. A within-run comparison contradicts the 4-12 s figure. The critical-path credit belongs to PERIH-01. turborepo-cache-trust-observability must re-observe.
- **Expected effect:** About 1-5 s per installing job (guess), roughly 0.5-3 runner-min per run. Stops at least 7 third-party lifecycle scripts on every install. lefthook is denied because its script is a no-op in CI. Removes the node-gyp drift source.
- **Gate before landing:** Two-head A/B over at least 2-3 paired runs: identical census and verdicts, and `bun pm untrusted` equals the deny set. The guard reads installed package.json scripts, not bun.lock hasInstallScript. This is a global-input PR, so plan for the coverage-floor freeze.
- **PR slices:** chore(deps): explicit trustedDependencies allowlist and bootstrap.sh comment fix [S]; chore(quality): guard for unclassified install scripts [S]

#### 8. LINT-04 PR C checker algorithms: P55, S4, P12/P11, P28, S2 (lint-laws-knowledge)

- **Moves:** runner-minutes, local-publish, local-verify. **Trust risk:** medium. **Seats agree:** False.
- **Refute outcome:** Weakened by both skeptics. The jsdoc chain is the medium pole until LINT-01 and LINT-05 land. Coverage floors are a landing cost. It double-counts with YEET-02 and LINT-10.
- **Expected effect:** 0.7-1.0 heavy runner-min per full-scope Lint Policy run after LINT-01 and LINT-05 (about 220-320/week). About -1 min on local cheap-gates after LINT-01. Mostly CPU on its own.
- **Gate before landing:** Per-family checks. P55: planted fixtures (the main-HEAD summary is vacuous). S4: findings diff. P12/P11: 814-assertion digest plus diagnostics sha 44b7c59c9033de74 plus an aliased-assertion fixture. P28: census plus a WORKSPACE_MANIFEST_WALK re-key probe. S2: prefilter generated from rows. Per-file coverage floors must hold.
- **Depends on:** LINT-01, LINT-05
- **PR slices:** perf(repo-cli): effect-imports single visitor and generated retired-iri prefilter [S]; perf(repo-cli): opaque pre-pass, effect-vitest index, pruned laws walk [M]

#### 9. ROUT-01 Skip empty partitions before setup, starting with the provable lps-int half (merges HOST-07) (routing)

- **Moves:** runner-minutes. **Trust risk:** medium. **Seats agree:** True.
- **Refute outcome:** Weakened by four skeptic reviews: dropping the coverage-manifest obligation, pinned-binary skew, a fleet net of about 0, and duplication with HOST-07.
- **Expected effect:** Gross 2.8-4 runner-min per run in empty legs (4 of 12 qualifying runs). Net -2 to +2 once each shard pays the plan overhead. Positive mainly on single-package PRs, about -13 to -30.
- **Gate before landing:** Replay `ci lane --partition --dry-run` against hosted logs. Mutation fixtures for partition, scope and turbo.json edits force the full lane. Empty Test Unit partitions still seal a manifest. The aggregate tells a planned skip from a failure. Push events plan everything.
- **Depends on:** ROUT-03, PERIH-11, ROUT-07
- **PR slices:** feat(ci): plan-only partition mode with a closure-keyed full fallback [M]; ci: pin bump [S]; ci(check): gate shards on the plan [S]; ci(heavy): gate integration partitions on the plan [S]

#### 10. PERIH-07 Decide Storybook selection before the full install (peripheral-hosted)

- **Moves:** runner-minutes. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** About 0.25 runner-min per run (27% of runs skip and save about 55 s), about 275-300/week.
- **Gate before landing:** A/B parity ledger of the selection verdict before and after install.
- **PR slices:** ci: select Storybook before installing the workspace [S]

#### 11. HOST-10 Trim proven-unused provisioning in short hosted jobs (hosted-ci)

- **Moves:** runner-minutes. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Guess: -1.5 to -3 runner-min on eligible runs. Overlaps PERIH-05 and PERIH-06.
- **Gate before landing:** Cold-control A/B plus a dependency-closure parity ledger.
- **PR slices:** perf(ci): trim unused provisioning in short hosted jobs [M]

#### 12. COVE-01 Advisory direct-owner coverage scope, bounded inside publish (scope slice only) (coverage)

- **Moves:** runner-minutes, trust, local-publish. **Trust risk:** medium. **Seats agree:** False.
- **Refute outcome:** Weakened by both skeptics: push-first D2 rejects a detached advisory proof, repo-cli is deferred, and it double-counts with TEST-04.
- **Expected effect:** 0 hosted saving provable before landing; guess 300-1,200 runner-min/week. Only about 1 in 6 sampled own reds is a direct-owner red. Long poles (repo-cli, LPS) are deferred. Wiring it into publish needs a push-first D1/D2 amendment.
- **Gate before landing:** Mutation fixture: the local direct run prints row text byte-identical to hosted on Node 22.23.4. Cold/warm A/B: cheap-gates p95 must not rise and at most 2 min is added. After landing, at least 50 paired publishes for the ledger.
- **Depends on:** COVE-02, COVE-03
- **PR slices:** feat(repo-cli): direct-owner coverage scope with long-pole deferral [M]

#### 13. DEPS-05 --libc=glibc install filter (slice a only; scratchpad onnx drop excluded) (deps-toolchain)

- **Moves:** runner-minutes. **Trust risk:** medium. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics. The target is unproven. Slice b is a cut in proof depth (NomicNlp.ts imports the dependency).
- **Expected effect:** Guess 0.3-1 runner-min per run. The flag probably drops @next/swc musl (88 MB), not the named duckdb musl, because the lockfile entry for duckdb has no libc field.
- **Gate before landing:** Fresh-install census in ~/.cache/beep: the frozen install succeeds, the named musl payload is absent, gnu bindings load, and hosted install time drops over at least 3 paired runs.
- **PR slices:** ci: install with --libc=glibc [S]

#### 14. TURB-07 Key root scripts and workspaces only on root tasks; drop root tsconfig from build/check after a read trace (turbo)

- **Moves:** runner-minutes, local-verify. **Trust risk:** medium. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Small: about 3 projection-only commits per 15 days avoid a full re-key.
- **Gate before landing:** turbo-config-proof before and after on recorded commits, a per-task-kind read trace, and a cache baseline re-record.
- **Depends on:** TURB-09
- **PR slices:** perf(turbo): key root scripts only on root tasks [M]

#### 15. TURB-03 Classify turbo.json edits by effective task-definition change (turbo)

- **Moves:** runner-minutes. **Trust risk:** medium. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Small: turbo.json is the sole escalation trigger in 4 of 727 PRs.
- **Gate before landing:** Route replay plus mutation fixtures with 100% recall of relevant reds.
- **Depends on:** ROUT-07
- **PR slices:** perf(quality): classify effective Turbo changes [M]

#### 16. PERIH-09 Scoped installs for administrative workflows (peripheral-hosted)

- **Moves:** runner-minutes. **Trust risk:** medium. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** About 12 runner-min/week.
- **Gate before landing:** Byte-parity ledger of emitted output, plus fallback to a full install.
- **PR slices:** ci: scoped install for skills-update-train [M]

#### 17. DEPS-06 Filtered-install parity experiment (side workflow only) (deps-toolchain)

- **Moves:** runner-minutes. **Trust risk:** high. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** About 1 runner-min per run at most. The root plus repo-cli closure is already 1,687 of 2,336 packages.
- **Gate before landing:** Parity ledger over 10 consecutive heads per lane class with zero divergence.
- **Depends on:** PERIH-01
- **PR slices:** ci: side-workflow parity experiment for filtered installs [M]

#### 18. TEST-07 Hub narrowing for test (merges TURB-11): parked (tests)

- **Moves:** local-verify. **Trust risk:** high. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** 0 hosted credit, because hosted Unit runs --force. Reopen only with module-graph evidence and a qualified affected-route refinement.
- **Gate before landing:** 14-day shadow with zero divergence plus a mutation hash matrix.
- **Depends on:** TEST-10
- **PR slices:** refactor(identity): per-package composer leaves (only after TEST-10) [L]

#### 19. ROUT-04 Derive the docs-only profile from enforced route refinements: parked (routing)

- **Moves:** trust, runner-minutes. **Trust risk:** high. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** 0 credited. Could later recover part of ROUT-02's and ROUT-03's cost.
- **Gate before landing:** Route replay with 100% recall of introduced reds on the refreshed corpus.
- **Depends on:** ROUT-02, ROUT-03, ROUT-05, ROUT-07
- **PR slices:** refactor(ci): docs-only profile from refinements [L]

#### 20. LINT-07 Escalate Lint Policy only on added @deprecated annotations: parked (lint-laws-knowledge)

- **Moves:** runner-minutes. **Trust risk:** medium. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** At most 1 min on escalated runs, about 0.5 on average. TURB-02's evidence puts full minus changed at only about 110 s on a non-required lane.
- **Gate before landing:** Route replay plus per-trigger mutation fixtures.
- **Depends on:** LINT-02
- **PR slices:** perf(repo-cli): escalate only on added deprecation annotations [M]

#### 21. COVE-07 Per-partition coverage validation overlap: parked (coverage)

- **Moves:** none. **Trust risk:** high. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Runner savings are negative (+10 to +15 per run). No required-path value while coverage is non-required.
- **Gate before landing:** Week-long parity ledger plus mutation fixtures, and only if COVE-08 option A is chosen.
- **Depends on:** COVE-08
- **PR slices:** feat(coverage): partition validation diagnostics [M]

#### 22. LINT-09 Shared schema-scanner parse: parked (lint-laws-knowledge)

- **Moves:** runner-minutes. **Trust risk:** high. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy (Opus rejected it).
- **Expected effect:** About 0.1 per run, possibly negative.
- **Gate before landing:** Reopen only if summed parse cost after PR C exceeds 150 CPU-s per run.
- **Depends on:** LINT-01, LINT-04
- **PR slices:** measure scanner syntax overlap [S]

#### 23. DEPS-09 Consolidate compiler passes: parked (deps-toolchain)

- **Moves:** runner-minutes. **Trust risk:** high. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** About 0.1 per run (check misses average 0.4 s).
- **Gate before landing:** Reopen when a cold Check exceeds 2 min of tsrs time.
- **PR slices:** chore(toolchain): per-pass profiler [S]


### T4. Local wall (publish, verify, final-check)

#### 1. SCHE-02 Admit final-check gates, package-verify and agent-shell heavy commands through QualityScheduler (absorbs YEET-03 slice 1) (scheduler)

- **Moves:** trust, local-verify. **Trust risk:** medium. **Seats agree:** False.
- **Refute outcome:** Weakened by four skeptic reviews. Waits can still end in skips. The closed AdmissionWorkKind needs SCHE-08 first. package-verify is already sequential. Duplicates YEET-03.
- **Expected effect:** Trust: fewer earlyoom/SIGKILL-lost final-check proofs (11 of 161 receipts) and fewer --skip receipts. Latency is 0 to negative because admission adds queue wait. 0 hosted.
- **Gate before landing:** Fixtures: a late failure gives no ready receipt; a killed producer gives an incomplete receipt; a mid-run mutation is refused; a nested capability does not deadlock; mixed-version decode works. A/B with a journald kill census: zero kills of admitted gates, no more --skip steps per receipt, and wait p95 below each gate's p50.
- **Depends on:** SCHE-08, SCHE-06, SCHE-07
- **PR slices:** feat(yeet): admit final-check gates per step [M]; feat(quality): admit agent-shell coverage/test/docgen with an inherited capability [L]

#### 2. TEST-04 Verify runs the hosted Test Unit producer partitions as admitted units, replacing the duplicate test-unit plus standalone coverage (merges YEET-01 and TEST-05 census) (tests)

- **Moves:** local-verify. **Trust risk:** high. **Seats agree:** True.
- **Refute outcome:** Weakened by six skeptic reviews. The comparator needs all 13 partitions plus labs. Unit admission needs SCHE-01 and SCHE-08. #3007 is still open. Requires the Node pin.
- **Expected effect:** 0-20 min on LPS-affected verifies (LPS coverage alone is 2,680 s). About 4 coverage verifies/week. Under 10 min is not demonstrated. The Bun replay is dropped only for packages whose beep:test census equals the coverage census and that have no continuations (infra excluded).
- **Gate before landing:** Shadow parity on at least 10 heads (at least 3 LPS-affected) against hosted Test Unit plus Coverage Regression, with the Node 22.23.4 pin and a local run identity. A/B including queue time: p95 under 10 min with no deadline reds.
- **Depends on:** COVE-03, SCHE-01, SCHE-08
- **PR slices:** feat(yeet): verify runs hosted partitions as admitted units (shadow) [L]; feat(yeet): local coverage join with run identity [M]; chore(quality): runtime-obligation census for the Bun replay [S]

#### 3. YEET-02 File-scope effect-imports in the publish cheap tier with full escalation (merges LINT-08); jsdoc half parked behind LINT-01 (yeet-pipeline)

- **Moves:** local-publish. **Trust risk:** medium. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics. effect-imports' real inputs differ from what the lever assumed. Safety breaks if YEET-05 or YEET-06 land without receipt grain. It double-counts with LINT-01, LINT-04, LINT-08 and ROUT-08.
- **Expected effect:** 0-1 min p50 on code publishes after LINT-01 and LINT-04. About 0 on its own, because jsdoc stays the pole.
- **Gate before landing:** Route replay with the full escalation list (scanner source, policy-fingerprint, the GithubChecks selector, effect version/bun.lock, the root catalog, root tsconfig, renames) at 100% recall. A receipt-grain fixture is refused by YEET-05 and YEET-06. Selector-overhead A/B.
- **Depends on:** LINT-01, LINT-04, ROUT-07
- **PR slices:** perf(yeet): file-scope effect-imports at publish with escalation and receipt grain [M]

#### 4. YEET-05 final-check reuses same-head cheap-lane proofs (pinned base, shadow first) (yeet-pipeline)

- **Moves:** local-verify. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Weakened by both skeptics: wrong dependency gate (it uses LaneProofReuse, not ProofLedger), base drift, and an incorrect live-lane list.
- **Expected effect:** About 1.5 min per hit, about 0.2-0.3 averaged over all final-checks, possibly about 0 because of base and environment hash misses.
- **Gate before landing:** Shadow run with BEEP_YEET_PROOF_BASE pinned: hits above 0 and zero disagreements. Fixtures: a modified tracked file, an untracked file and a moved origin/main all miss. changeset-status stays non-reusable until PERIL-12.
- **Depends on:** MEAS-07
- **PR slices:** perf(yeet): final-check cheap-gates lane-proof shadow with pinned base [S]

#### 5. TURB-05 Scope local TURBO_FORCE to path-detected patches and overrides (shadow first) (turbo)

- **Moves:** local-verify, local-publish. **Trust risk:** medium. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics. Turbo does not hash patch contents. The hoisted linker defeats per-package hashing. The standard calls this force a deliberate false-green control.
- **Expected effect:** About 0.5 min per verify and 0.2 per publish on average (guess).
- **Gate before landing:** Shadow receipts recording the narrowed decision and a per-package installed-tree digest. An undeclared-import invariant. Patch-only commits must still be forced.
- **PR slices:** perf(yeet): record force reason; shadow narrowed force [S]

#### 6. YEET-06 ProofLedger C4.2 enforcement for cheap-tier lanes after C5 fixtures pass on the flip HEAD (yeet-pipeline)

- **Moves:** local-publish, local-verify. **Trust risk:** medium. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** About 0.15 min per attempt (central estimate).
- **Gate before landing:** C5 must-fail fixtures green on the flip HEAD, the official report with 0 malformed rows, and rejection of narrowed receipts.
- **Depends on:** YEET-02
- **PR slices:** feat(yeet): enforce ProofLedger reuse for cheap-tier lanes [M]

#### 7. SCHE-06 Conditional starvation bound with EASY backfill and per-origin fairness (scheduler)

- **Moves:** local-publish, local-verify, trust. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** 0 on the mean; caps tail waits once SCHE-01 and SCHE-02 land.
- **Gate before landing:** Property laws in the ciops lab under adversarial streams, then an A/B on tail waits.
- **Depends on:** SCHE-08, SCHE-09
- **PR slices:** feat(ciops): model backfill and fairness [M]; feat(repo-cli): backfill in selfMayAttempt [M]

#### 8. SCHE-01 Resizable lease units under one proof nonce (scheduler)

- **Moves:** local-publish, local-verify. **Trust risk:** medium. **Seats agree:** False.
- **Refute outcome:** Weakened by both skeptics: undercharging already exists, it is hold-and-wait, and the gate cannot run on the 200-row ring.
- **Expected effect:** About 0-0.1 min per admission. The pool overlaps the dropped SCHE-03 and YEET-03.
- **Gate before landing:** Lifecycle and hold-and-wait fixtures. The shadow bar needs per-wave peaks and SCHE-09 retention.
- **Depends on:** SCHE-08, SCHE-07, SCHE-09, SCHE-06
- **PR slices:** feat(repo-cli): resizable admission lease (shadow) [L]

#### 9. YEET-07 Re-seed WaveOrder from current economics after the attribution fix (yeet-pipeline)

- **Moves:** local-verify. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** About 0.1 min central; 1-4 min on red attempts only.
- **Gate before landing:** Trace-replay simulation that preserves first-red identity, on a fresh post-MEAS-02 snapshot.
- **Depends on:** MEAS-02
- **PR slices:** chore(yeet): re-seed the gate-order seed [S]

#### 10. PERIL-06 Keep Biome's scanner out of sibling worktrees in nested lanes (reproduce first) (peripheral-local)

- **Moves:** local-verify. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Up to about 70 CPU-s per biome package task, in the 17 of 301 nested lanes only.
- **Gate before landing:** A/B in primary, sibling and nested lanes with identical diagnostics. The crawl must reproduce first.
- **PR slices:** perf(biome): scanner ignore for nested worktrees [S]

#### 11. TEST-08 Advisory related-tests lane with a read-graph recorder and recall audit (merges COVE-05) (tests)

- **Moves:** measurement. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** COVE-05 weakened by both skeptics; its gate tested only the near-guaranteed direction, and it duplicated TEST-08.
- **Expected effect:** 0 proof savings. Faster local diagnosis on long-pole PRs. Never produces a receipt.
- **Gate before landing:** None for advisory use. Any gating use needs 100% recall over at least 50 red episodes.
- **Depends on:** TEST-10, COVE-03
- **PR slices:** feat(repo-cli): beep test related advisory lane [M]

#### 12. COVE-09 Row-wise three-way merge driver for the coverage baseline (coverage)

- **Moves:** local-publish. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Minutes per manual conflict resolution (1 receipt so far).
- **Gate before landing:** Three-way fixture replay plus a git merge-file round trip.
- **PR slices:** feat(coverage): row-wise baseline merge driver [S]

#### 13. PERIL-08 Record duplicate Fallow audit identities within an attempt, then share an exact computation (peripheral-local)

- **Moves:** local-verify. **Trust risk:** medium. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** 0-0.24 min per verify; zero until a duplicate is found.
- **Gate before landing:** Parity ledger with base, head, dirty and config mutations.
- **PR slices:** chore(quality): record duplicate Fallow audit identities [S]

#### 14. PERIL-09 Keep the review-window anchor across a diff-preserving merge of main (operator-gated) (peripheral-local)

- **Moves:** none. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Merge latency only (outside ruling 1). 5 of 30 merged PRs ended on such a push.
- **Gate before landing:** Operator ruling, then replay fixtures: a clean merge keeps the anchor, and a conflict touching PR lines re-arms it.
- **PR slices:** feat(yeet): patch-id-preserving review-window anchor [M]


### T5. Measurement prerequisites

#### 1. MEAS-01 Nightly push-to-every-required-green scorecard per head SHA, with main verdict cohorts (measurement)

- **Moves:** measurement, main-verdict-rate. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Confirmed (r1), weakened (r2): the green-only headline is gameable, the API budget is unpriced, and the workflow-security test needs an edit.
- **Expected effect:** The instrument that judges ruling 1. Red, held and api-partial heads count as not attained in the headline p95; green-only is diagnostic. Superseded heads are censored, and their cost is reported as a share. A ruleset digest is recorded per head. Costs about 3-6 runner-min per night.
- **Gate before landing:** Fixture replay of auditJ/pr_heads.json and the Astra 60-run corpus. A monotonicity fixture: turning a green head red never improves the statistic. An api-partial census refuses certification. The nightly fits the GITHUB_TOKEN budget or resumes.
- **Depends on:** MEAS-04
- **PR slices:** feat(ci): beep ci certainty head-level report with fixtures [M]; ci: certainty-nightly workflow (plus ci-runner-security enumeration) [S]

#### 2. MEAS-04 lane-timings per-attempt job reads, partial-row stamping and a filtered recent mode (measurement)

- **Moves:** measurement. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Confirmed (r1), weakened (r2): the queue and runner columns already shipped, and a naive queue column would reintroduce phantom waits.
- **Expected effect:** Measured: the per-attempt endpoint avoided 502s in 8 of 8 calls, against 5 failures in 13 for filter=all. Pickup semantics stay attempt-1-only.
- **Gate before landing:** Fixtures for 502/exhaustion/duplicate/rerun. Partial output reuses the --window preview stamp on both renderers. Live union parity on run 42655574858. 180 jobs on 42646019844.
- **PR slices:** fix(ci): lane-timings per-attempt reads, partial integrity, recent filters [S]

#### 3. MEAS-02 Attribute lock-bounce, stale-base and closeout refusals outside first-failure lanes (merges DEPS-10) (measurement)

- **Moves:** measurement. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Confirmed by both skeptics (r2 added the gate-order pointer coupling and the wrong test path).
- **Expected effect:** Preflight first-red count drops from about 181 to about 3 real failures. About 237 commit and closeout rows move to refusal classes. Removes the false premise behind Y1.
- **Gate before landing:** Fixtures in test/yeet-economics.test.ts. The actionableLaneMix total equals redAttempts. gate-order-handoff.test.ts stays green.
- **PR slices:** fix(yeet): attribute refusals by failure kind [S]

#### 4. PERIL-11 Keep attempt journals outside the reaped residue root and count T3 lanes via roots.json (merges MEAS-09) (peripheral-local)

- **Moves:** measurement, trust. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Confirmed (r1), weakened (r2): the archive target is reaped, T3 support already exists as fleet-root config, and it duplicates MEAS-09.
- **Expected effect:** 85% of merged branches since 10-25 have no surviving journal. Fixes coverage going forward only (the residue holds 2 real journals). T3 lanes add about 1.7% through one config row.
- **Gate before landing:** Fixture: retire, simulate a copy failure, restore, import duplicates, run residue-reap with maxAgeDays=0, then re-census. Each (runId, attemptId) appears exactly once, and a copy failure blocks deletion.
- **Depends on:** MEAS-07
- **PR slices:** fix(worktree): export .beep/yeet/runs to ~/.local/state on retire [M]; chore(fleet): T3 root in roots.json; split monitor time out of economics [S]; feat(yeet): optional host/seat/session on started rows [M]

#### 5. ROUT-05 Refresh the route corpus with partition mapping, step classes and per-lane outcomes in one capture (merges ROUT-06) (routing)

- **Moves:** measurement, trust. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics: the mapping was claimed to work but does not, the gate exercises nothing new, and annotations cost about 40k API calls.
- **Expected effect:** Unmapped 'Test Integration (lps-int-N)' jobs are 29% of minutes in run 42656046751 today. Gates every refinement and TURB-01's replay.
- **Gate before landing:** Old receipt restored to a scratch --corpus dir reproduces 242 skipped and 0 skippedReds. A post-#3005 fixture maps every job. Aggregator and setup reds become unknown, never dropped.
- **PR slices:** fix(ci): map partition jobs to lanes with a conservation test [S]; feat(ci): optional step and per-task outcome fields under v1 [M]; chore(route): capture 2026-10-31..now [S]

#### 6. ROUT-07 Differential test across the seven path classifiers, then one relevance model (routing)

- **Moves:** trust, measurement. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Drift prevention. Every narrowing lever (PERIH-04, ROUT-01, YEET-02, TURB-03) lands as an adapter.
- **Gate before landing:** Differential parity over corpus heads.
- **Depends on:** ROUT-03, ROUT-05
- **PR slices:** test(ci): differential classifier test [M]; refactor(ci): RoutePlan registry [L]

#### 7. PERIH-11 Closure-digest binary builds and reviewed pin-bump PRs (merges PERIH-08) (peripheral-hosted)

- **Moves:** trust, runner-minutes. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Removes pin lag for every binary-hosted decision. About 40-105 main runner-min/week saved on unneeded builds.
- **Gate before landing:** Closure mutation fixtures; the pin PR proves itself through its own Check.
- **PR slices:** ci: gate binary releases on a closure projection [M]; ci: open a pin-bump PR on closure change [S]

#### 8. MEAS-06 Project the existing Vitest unit-results.json into per-file and per-package timing on every event (measurement)

- **Moves:** measurement. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics: it used the wrong source (Turbo summaries); check.yml-only slice.
- **Expected effect:** Test-body timing for #3007 and HOST-08. Turbo summaries hold only prebuilds for Test Unit.
- **Gate before landing:** Rows exist for every executed package, and file counts equal expectedTestFiles, stratified by event.
- **Depends on:** MEAS-01
- **PR slices:** feat(ci): project unit-results.json timings [S]

#### 9. MEAS-07 Journal final-check invocations and keep per-run history (measurement)

- **Moves:** measurement, local-verify. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Makes final-check (p50 6.3, p95 50 min) visible to economics.
- **Gate before landing:** Journaling unit test plus a ready-gate regression fixture.
- **PR slices:** feat(yeet): journal final-check attempts [S]

#### 10. MEAS-05 Joined per-check cost ledger at (lane, partition) grain with asymmetric digests (measurement)

- **Moves:** measurement. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics: the map was partly shipped, the exhaustiveness check pointed at the wrong side, and the claimed grain was wrong.
- **Expected effect:** Attribution only; never a parity authority.
- **Gate before landing:** At least 95% of job-minutes mapped on the three reference runs; an umbrella-plus-partition fixture shows no double count.
- **Depends on:** ROUT-05, MEAS-04
- **PR slices:** refactor(ci): consolidate the lane-id maps [S]; feat(quality): ledger fold with absent-source rows [M]

#### 11. SCHE-08 AdmissionUnit, weight source and owner schema; scheduler service facade; Cache uses its own kind (scheduler)

- **Moves:** trust, measurement. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Enabling only. Fixes the Cache review-fix mislabel.
- **Gate before landing:** Mixed-version decode fixture; ciops replay stays 41/41.
- **Depends on:** SCHE-09
- **PR slices:** feat(repo-cli): admission unit schema [M]

#### 12. SCHE-09 Retain admission history beyond the 200-row ring, with pressure fields (scheduler)

- **Moves:** measurement. **Trust risk:** none. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Prerequisite for every scheduler claim.
- **Gate before landing:** Archive fold tests.
- **PR slices:** feat(repo-cli): archive trimmed admission rows [S]

#### 13. SCHE-07 Calibrate unit weights from measured envelopes (raise-only) (scheduler)

- **Moves:** trust, measurement. **Trust risk:** medium. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Today's 15 GiB charge sits below the measured 22.9 GiB p50 lease peak.
- **Gate before landing:** Two-week shadow with zero undercharges.
- **Depends on:** SCHE-08
- **PR slices:** feat(repo-cli): sample anon/file per unit [S]

#### 14. SCHE-05 Typed admission backpressure with a 600 s deadline outcome (scheduler)

- **Moves:** measurement. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics: savings about 1 min/week; depends on SCHE-08 and SCHE-09.
- **Expected effect:** About 1 wall-min/week (measured). Value is measurement and agent UX.
- **Gate before landing:** Pure-fold fixtures; push-to-hosted only at 600 s or later (#131).
- **Depends on:** SCHE-08, SCHE-09
- **PR slices:** feat(repo-cli): typed AdmissionBackpressure [M]

#### 15. COVE-04 Label coverage failure rows (inherited and environment gated off) (coverage)

- **Moves:** trust, measurement. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Weakened by both skeptics: inherited class nearly dead, no channel into receipts.
- **Expected effect:** Trust and measurement. Receipts need a structured row channel first.
- **Gate before landing:** Synthetic fixtures; exit status unchanged.
- **Depends on:** COVE-03
- **PR slices:** feat(coverage): classify failure rows [M]

#### 16. COVE-08 Give the coverage comparator a fixed context name (prerequisite for any policy option) (coverage)

- **Moves:** trust. **Trust risk:** medium. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Enables option A without a migration deadlock. Policy itself goes to an operator question.
- **Gate before landing:** Route replay of context emission (docs, source, main).
- **Depends on:** PERIH-01
- **PR slices:** ci: fixed coverage comparator context name, removing the LEGACY_COVERAGE coupling [S]

#### 17. MEAS-03 Separate terminations and type unlocated failures (measurement)

- **Moves:** measurement. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Red attempts drop from 321 to about 243 locally; denominator change is recorded.
- **Gate before landing:** Adjudicated fixtures.
- **Depends on:** MEAS-02, MEAS-07
- **PR slices:** fix(yeet): report terminations apart from reds [S]

#### 18. MEAS-08 Time-join PSI samples onto attempts (no hot-path stamps) (measurement)

- **Moves:** measurement. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Pressure context for scheduler levers.
- **Gate before landing:** None.
- **Depends on:** MEAS-05
- **PR slices:** feat(yeet): join PSI samples [S]

#### 19. TEST-09 Measure the local cold doctest makespan (tests)

- **Moves:** measurement. **Trust risk:** none. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Hosted cost already measured (105 s cold).
- **Gate before landing:** Cold/warm A/B.
- **PR slices:** chore(quality): doctest CPU/RSS receipts [S]

#### 20. PERIL-12 Characterize changeset-status undeclared-input misses (peripheral-local)

- **Moves:** measurement. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Diagnostic only; prerequisite for any reuse.
- **Gate before landing:** None.
- **PR slices:** chore(quality): explain changeset-status misses [S]

#### 21. YEET-09 Record worker-substitution provenance (zero credit) (yeet-pipeline)

- **Moves:** trust, measurement. **Trust risk:** medium. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Savings stay 0 until at least 30% of final-checks start after hosted green.
- **Gate before landing:** Per-gate parity ledger with negative fixtures.
- **Depends on:** YEET-08
- **PR slices:** feat(yeet): record substitution provenance [S]

#### 22. TURB-10 Attribute first-cold cross-host cache reuse on fleet hosts (turbo)

- **Moves:** measurement. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Measurement only.
- **Gate before landing:** Same-head hashes across hosts.
- **PR slices:** feat(cache): attribute first-cold decisions [S]

#### 23. PERIH-12 Read-only Vercel deployment census, then a closure-scoped ignoreCommand (peripheral-hosted)

- **Moves:** trust, measurement. **Trust risk:** low. **Seats agree:** True.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** 0 GitHub minutes; restores a real preview signal (77% of statuses are rate-limited).
- **Gate before landing:** Affected and unaffected PRs show deployed versus ignored.
- **PR slices:** infra: Vercel census [S]; infra: closure-scoped ignoreCommand [S]

#### 24. PERIL-13 Mark merged-preview admission dormant (removal only on an operator ruling) (peripheral-local)

- **Moves:** none. **Trust risk:** low. **Seats agree:** False.
- **Refute outcome:** Not refute-worthy.
- **Expected effect:** Documentation only; no proof capability removed.
- **Gate before landing:** Operator ruling.
- **PR slices:** docs(yeet): mark merged-preview dormant [S]

## First three PRs

- **fix(ci): keep goal ops scripts, fixtures and research inputs on the code route (ROUT-03 slice 1)** [S], levers ROUT-03. Gate: A generated census test finds every goals/ path that a test reads, spawns or imports, or that a turbo.json declares, and asserts each is non-docs-only. Mutations of a citation ops .py probe, a .ts ops script, the frozen JSON fixture and a ciops research JSON are each selected by change-profile. The PR only widens selection. It does not edit heavy.yml or turbo.json, so it lands alone. Files: `packages/tooling/tool/cli/src/commands/Ci/CiOperational.schemas.ts`, `packages/tooling/tool/cli/src/commands/Ci/CiOperational.patterns.json`, `packages/tooling/tool/cli/test/ci-heavy-admission.test.ts`, `packages/tooling/tool/cli/test/goal-data-consumer-census.test.ts`
- **feat(quality): derive coverage owners for generated standards inventories (TURB-01 slice 1)** [M], levers TURB-01. Gate: Planner fixtures: each mapped file selects exactly @beep/repo-cli, an unmapped standards file still returns full, and commits whose sole full trigger is a mapped file shrink in a first-parent replay. A token- and segment-aware reader drift check is proven by a seeded path.join fixture. Reseal the policy fingerprint. The PR runs full Test Unit once. Files: `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts`, `packages/tooling/tool/cli/test/coverage-scope.test.ts`, `standards/policy-tools.fingerprint.json`
- **feat(ci): beep ci certainty head-level required-green and main-verdict report (MEAS-01 slice 1)** [M], levers MEAS-01, MEAS-04. Gate: Fixture replay matches the recorded corpora: 4 of 30 under 10 min, green-only p95 101.9, about 315 runner-min per run, plus per-head cases (two producers, three attempts, docs-only, cancelled). A monotonicity fixture shows that turning a green head red never lowers the SLO statistic. An api-partial census refuses certification. Per-attempt job reads avoid the run 42646019844 502s. CLI only, so the nightly workflow follows as its own PR. Files: `packages/tooling/tool/cli/src/commands/Ci/Certainty.ts`, `packages/tooling/tool/cli/src/commands/Ci/Certainty.schemas.ts`, `packages/tooling/tool/cli/src/commands/Ci/Ci.command.ts`, `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts`, `packages/tooling/tool/cli/test/ci-certainty.test.ts`

## Candidate goal packets

- **certainty-scorecard**: Ship the nightly head-level push-to-required-green and main-verdict scorecard plus attributable ledgers. Acceptance: 7 consecutive nightly reports with no api-partial certification, partition jobs fully mapped, and fleet journals retained across retirement. Levers: MEAS-01, MEAS-04, MEAS-02, MEAS-03, MEAS-06, MEAS-07, MEAS-05, MEAS-08, PERIL-11, ROUT-05.
- **route-soundness-repair**: Close the routing and proof soundness holes the audit found. Acceptance: mutation fixtures go red for every confirmed missed-red path (goal-data consumers, docs/goals knowledge policy, glob setup closure, bare-coverage self-judge, final-check receipt versioning, Node coverage runtime), and the classifier differential reports zero unadmitted disagreements. Levers: ROUT-03, ROUT-02, TEST-10, COVE-02, YEET-08, COVE-03, PERIH-10, ROUT-07.
- **main-verdict-every-commit**: Give every non-docs main SHA a completed hosted verdict without regressing PR latency. Acceptance: at least 95% of non-docs main SHAs verdicted over 7 days, PR first-wave pickup p95 and heavy-wait p95 regressed by at most 1 min, and zero agent-initiated main cancels. Levers: HOST-01. Depends on: certainty-scorecard.
- **heavy-pool-diet**: Cut heavy-pool occupancy and the admission chain on code PRs. Acceptance: Lint Policy wall p95 at most 9 min, heavy slot-min per code run down by at least 20%, admission-to-Heavy start 0.5 min faster, with JSDoc inventory byte parity and identical findings. Levers: LINT-01, LINT-05, LINT-02, LINT-04, HOST-06, PERIH-01, PERIH-11, HOST-08. Depends on: certainty-scorecard.
- **hosted-setup-tax**: Remove duplicate hosted work and the setup tax with no proof-depth change. Acceptance: runner-minutes per green code run p50 down by at least 20 against the 264 baseline, measured by the scorecard, with every required context still present and parity ledgers green. Levers: TURB-01, TEST-01, PERIL-01, PERIH-02, PERIH-04, PERIH-05, PERIH-06, HOST-09, DEPS-01, PERIL-04, ROUT-01. Depends on: route-soundness-repair, certainty-scorecard.
- **local-proof-under-ten**: Make local publish and verify predictable under fan-out through the existing QualityScheduler. Acceptance: local publish p95 at most 8 min and verify p50 at most 10 min on the fleet census, zero earlyoom-killed admitted gates over 7 days, and no stale-green fixtures failing. Levers: SCHE-02, SCHE-08, SCHE-09, SCHE-07, SCHE-06, SCHE-01, TEST-04, YEET-02, YEET-05, YEET-06, TURB-05, PERIL-02, PERIL-03, PERIL-10. Depends on: certainty-scorecard, route-soundness-repair.

## Measurement prerequisites

- MEAS-01 scorecard: head-SHA unit, red/held/api-partial heads count as not attained, superseded heads censored, per-head ruleset digest. Every target claim depends on it.
- MEAS-04 per-attempt job reads with partial stamping. filter=all 502s otherwise drop the large reruns and bias p95 low.
- 7 days of post-merge #3005 and #3007 runs. Skeptics found #3007 still open while the brief assumed it merged.
- ROUT-05 partition mapping fix. 'Test Integration (lps-int-N)' jobs are currently unmapped (29% of run minutes) in census and replay.
- Queue-inclusive heavy-pool telemetry (pickup per job, slot-min per run) and per-lane peak RSS, to size the Lint Policy diet against cap 2.
- PERIL-11 journal retention outside the reaped residue root, plus a T3 roots.json entry, so fleet local verify/publish p95 can be measured.
- MEAS-02 attribution fix before any WaveOrder re-seed (YEET-07) or preflight reordering.
- A per-wave anonymous-memory census (memory.stat anon vs file) before any lease split or weight change (SCHE-01/07).
- A journald earlyoom/SIGKILL census source, so SCHE-02 can show fewer killed gates rather than just more waiting.
- Per-file Vitest timings from unit-results.json on every event (MEAS-06), for Test Unit leg sizing.
- ROUT-07 classifier differential before any route narrowing (ROUT-01, PERIH-04, YEET-02, TURB-03).
- A pre-landing queue replay of main merge timestamps against the 60-job ceiling and cap-2 heavy pool before HOST-01 per-SHA grouping.

## Questions for the align round

### Coverage Regression: required context, non-required but gating Yeet-mergeable, or not gating?

- **A: required**: Needs the fixed context name (COVE-08 slice). Puts the push-to-coverage-verdict p50 of 29 min on the required path, so the 10-min target becomes unreachable until Test Unit plus the comparator fit.
- **B: stop gating mergeable**: Floor regressions reach main, where most runs are cancelled today. A real assurance loss.
- **C: status quo (non-required, gates mergeable)**: No change to required p95. Coverage still guards merges through the Yeet gate.

Recommended: C now, plus the fixed-name slice; move to A once the MEAS-01 census shows coverage-verdict p95 under 10 min. Basis: Ruleset 10240248 lists 15 contexts and coverage is not one. The measured push-to-coverage-verdict p50 is 29 min. The check.yml:868 name is conditional. Both seats reject B.

### Canonical citation corpus replays (Test Integration at the real 30 s extractDeadline): full replay on every PR, or a smoke subset per PR plus the full replay nightly or on main?

- **Full per PR**: Keeps the only production-deadline witness, which caught #3007's first heavy red. Costs about 16 partitions of runner time on every code PR.
- **Smoke per PR plus full on main or nightly**: Cheaper PRs. With a 13% main verdict rate, a deadline regression could reach main undetected for days.

Recommended: Full per PR until #3005 steady state is measured. Revisit smoke-plus-main only after HOST-01 brings main verdicts to at least 95%. Basis: TEST-03 was dropped because its incidental-limit layer would remove this witness. Ruling 5 forbids proof-depth reduction presented as efficiency. Without per-SHA main verdicts, nightly or main detection is not reliable.

### Is the runner-minute cost of sharding Property Laws worth its latency gain?

- **Shard now**: +6 to +10 runner-min per run. Cuts Yeet-mergeable p95 by about 3.4 min at the tail only, with 0 effect on required contexts.
- **TEST-01 file split first, shard only if still over 10 min**: Takes about 4-6 runner-min out first. Sharding may become unnecessary.
- **Stop Yeet waiting on Property Laws**: Latency gone without compute, but a non-required property red no longer holds merges.

Recommended: TEST-01 first. Shard only if Property Laws p95 stays over 10 min and you rule that the target covers Yeet-mergeable contexts. Basis: Property Laws is non-required. One file (coverage-artifacts, 305 s) sets an 8-9 min per-leg floor. Skeptics measured the sharding cost at +5-10 min, not +2-3.

### Moving Heavy / Lint Policy off the cap-2 heavy pool?

- **Standard hosted runner**: Refuted: the lane peaks at 32-36 GiB against 16 GB, and fitting it changes the lane's shape.
- **Larger paid hosted runner or a higher heavy cap**: A money decision. It is the only route found to a required p95 under 10 min at peak.
- **Keep on heavy, run the diet (LINT-01, LINT-05, LINT-02, LINT-04), and order required heavy lanes first with needs plus if: !cancelled()**: About 25% less heavy occupancy per run with no spend. The peak queue still saturates.

Recommended: Keep it on heavy and run the diet. Decide on capacity after MEAS-01 shows the post-diet heavy-queue p95. Basis: HOST-02 was refuted on measured peaks of 32.16-36.23 GiB. Lint Policy is about 60% of heavy occupancy per run.

### A verdict for every main commit costs compute. How should it be delivered?

- **Per-SHA full profile**: About 20-36k runner-min/day. About 62 jobs per run against a 60-job ceiling, so PR p95 regresses during merge bursts.
- **Ban manual main cancels, then a throughput layout, then per-SHA groups**: Verdict rate goes 13% to about 60%, then to at least 95%. Cost is bounded by the layout.
- **Coalesced verdict (a green later SHA covers contiguous earlier commits; a red triggers bisection)**: Much cheaper, but weaker per-commit attribution. Needs your ruling that it satisfies 'every commit'.

Recommended: The staged option, with the cancel-ban as an AGENTS.md amendment now. Coalescing is a fallback only if the queue replay shows PR p95 regressing by more than 1 min. Basis: Measured: 49 of 60 main runs cancelled, 27 of them mid-run by hand, and about 360 runner-min per full run. No tooling cancels main; the AGENTS.md runner-freeing law licenses the ad hoc cancels.

### Review window: should a push that leaves the PR's own diff byte-identical (a clean merge of origin/main) re-arm the 20-min window?

- **Keep re-arming on every push**: Each serial-gate merge re-arms every sibling's window. 5 of 30 merged PRs ended on such a push.
- **No re-arm when the patch-id is identical (PERIL-09)**: Window length unchanged. A conflict resolution touching PR lines still re-arms.
- **Shorten the window**: Assurance loss; neither seat proposes it.

Recommended: No re-arm when the patch-id is identical. Basis: The window bound the merge in 11 of 30 PRs. A clean merge-main changes no reviewed lines. This amends the mergeable definition, so it is your call.

### The #2999 docs-only widening: roll it back or narrow it?

- **Full rollback to the pre-#2999 regex**: Closes the hole at once. Every goal-packet PR runs the code lanes again.
- **Targeted narrowing (ROUT-03 generated consumer census) plus the ROUT-02 docs-policy job**: Closes the confirmed consumers (citation ops .py/.mjs probes, the frozen fixture, semantica, ciops, repo-cli ops and research). Keeps the skip for pure prose.
- **Keep as is**: Confirmed missed-red paths stay open.

Recommended: Targeted narrowing now. Full rollback if the census PR cannot land within a week. Basis: 4 of 80 recent PRs became docs-only through #2999. Skeptics verified executed consumers missing from the regex, from CoverageScope and from Turbo inputs.

### Does the 10-min target cover non-required contexts that still gate Yeet-mergeable (Lint Policy, Property Laws, Coverage Regression), and is it measured over code heads only?

- **Required contexts, code heads, red and held counted as not attained**: Matches ruling 1. Mergeable latency is reported separately.
- **Include mergeable contexts**: HOST-05 and Lint Policy become target-critical, at a large compute cost.

Recommended: Required contexts only, code heads separate from docs heads, red and held counted as misses, mergeable latency reported beside it. Basis: A green-only p95 can be gamed by turning slow passes red (MEAS-01 r2). Docs heads at p95 4 min would flatter a pooled number.

### Is `yeet verify --merged` (merged-preview, weight 5, no grants since about 10-05) still supported?

- **Supported**: Keep it and mark it dormant in the docs.
- **Unsupported**: Removing it deletes the merged-tree semantic proof, which is a capability decision.

Recommended: Supported, marked dormant. Basis: MergedPreview.ts proves something distinct, and zero grants does not make it dead code.

## Dropped levers

- **YEET-04**: Refuted (r1). The cheap tier is bound by its long pole (jsdoc 188 s, effect-imports 143 s), so batching removes about 5-8 s at most. It also breaks collect-all without --continue, escapes QualityScheduler width, and matches killed P5.
- **LINT-10**: Same mechanism as the refuted YEET-04: Turbo planning measured 0.1-0.3 s per launch.
- **COVE-06**: Refuted (r1). The nested concurrency-1 sites are synchronous CPU work on one Node thread. All of the savings belong to #3007, and it adds nondeterministic first-error reporting.
- **HOST-02**: Refuted (r1). Lint Policy peaks at 32-36 GiB against a 16 GB hosted runner, so fitting it changes the lane's shape. The needs-ordering fallback goes to the Lint Policy operator question.
- **TURB-02**: Refuted (r1). Lint Policy is non-required, full minus changed scope measured about 110 s, and only about 6% of commits would narrow. Seal-to-dependent affected propagation is unverified.
- **HOST-11**: Same family as the refuted TURB-02 (consumer-aware narrowing of Lint Policy escalation). The same measured 110 s ceiling applies.
- **TURB-06**: Refuted (r1). bun.lock is a hard full trigger in CoverageScope, LintPolicyScope and docgen, so moving tools saves under 1 runner-min per run.
- **DEPS-07**: Same mechanism as the refuted TURB-06 (tool-only root devDependency isolation).
- **TURB-08**: Refuted (r1). eyecite tests read a goals/ fixture outside the package's Turbo inputs, so caching opens a stale green. Savings are seconds.
- **TEST-02**: Refuted (r1). The services are already file-scoped. Time goes to libraryTopics scanning about 389 live manifests plus SHACL on every call, not to fixture build.
- **TEST-03**: Refuted (r2). #3007 already splits LPS into native-wallclock and replay projects, so 0 hosted gain remains. Incidental limits on canonical replays would remove the production-deadline witness.
- **SCHE-03**: Refuted (r1). docs/goals leases peak at 16-31.7 GiB cgroup memory, contradicting a 1-token charge. This also covers YEET-03 slice 2 (the light preflight lease).
- **SCHE-04**: Refuted (r1). CPU-some exceeds 25% in only 0.68% of PSI samples. Grant-bound width already shipped in #2560, and deprioritizing verify risks deadline false reds.
- **DEPS-03**: Refuted (r1). The blob:none history fetch is 2.4-2.8 s; the 14 s checkout cost is HEAD blob materialization, which tree:0 does not touch.
- **DEPS-04**: Refuted (r1). It moves free public-runner minutes onto paid EC2, adds about 55 min of Heavy-pool queue risk, and runs unadmitted draft code on owned runners.
- **ROUT-08**: Refuted (r1). The 2-lane docs skip already shipped in #3011. The remaining lanes do not shorten the wall because effect-vitest and schema-first must run, and warm runs regressed 40%.
- **ROUT-09**: Refuted (r1). It already shipped as isOwnerTestPath (#806). The audit also found an existing hole: LPS reads use-cases/test/fixtures unregistered; fix it under ROUT-03's census.
- **ROUT-10**: Refuted (r1). 353 of 358 check tasks were cached and the one rebuilt producer ran concurrently. Heavy / Check is 77-89 s, mostly setup.
- **PERIL-05**: Refuted (r1). Instrumentation shard rows lack file provenance, and 18 repo-cli span names come from multiple files, so a per-file splice leaves stale shards.

## Cross-area critique

### Conflicts

- HOST-03, HOST-09, PERI-02 (peripheral-hosted), LINT-05: These levers pick different survivors for the one hosted lint:shadcn walk. HOST-03 removes lint:shadcn from the hosted Lint Policy plan, leaving the Shadcn Lint job (verified: Tasks.ts:3705 policyStateTasks contains lint:shadcn). HOST-09 deletes the Shadcn Lint job (check.yml:400). PERI-02 deletes the job and moves the scan into required Repo Sanity. If HOST-03 and HOST-09 both land as titled, no hosted job runs lint:shadcn, because //#lint:shadcn is cache:false and appears nowhere else. That is a proof-depth loss disguised as a dedupe. PERI-02's own admission gate also asserts 'red in Lint Policy', which becomes false if HOST-03 lands first. Resolution: Keep exactly one owner and put PERI-02 (Repo Sanity, required, goals_only skip) in charge of the decision. Strip the shadcn half from HOST-03 and HOST-09. HOST-03/LINT-05 then cover only the JSDoc dedupe. Add a unit test asserting there is exactly one hosted owner of lint:shadcn across the check.yml jobs and the hosted Lint Policy plan.
- PERI-01 (peripheral-local, Fallow fold into Labs), PERI-04 (peripheral-hosted, job-level skip incl. Labs), COVE-08: The Fallow fold puts an advisory body inside Labs. PERI-04 wants Labs skipped at job level on most PRs, which would make Fallow silently stop running. Coverage Regression needs [admission, test-unit, labs] (check.yml:1018) and authenticates that the latest Labs execution succeeded (check.yml:1078). A non-continue-on-error Fallow red would therefore turn Coverage Regression red, and a job-level Labs skip breaks Coverage Regression outright, as skeptic 1 confirmed. If COVE-08 makes Coverage Regression required, the extra Labs wall also lands on a required needs-edge. Resolution: Drop Labs from PERI-04 (both skeptics agree). Choose the Fallow host only after PERI-04/HOST-09 settle job-level ifs, and pick a host no lever skips. Run Fallow strictly after the coverage body with continue-on-error, and post the context with explicit statuses:write. Re-evaluate if COVE-08 option A is chosen.
- HOST-02, HOST-07, HOST-08 (extra legs), HOST-05/TEST-06, HOST-01, DEPS-04: Every lever that adds hosted jobs or legs draws on the same unverified org concurrency ceiling of about 60 standard jobs. One PR run already allocates about 60 jobs (28-30 Test Unit legs, 17 Test Integration partitions since #3005, plus side jobs); 59 concurrent were measured. HOST-02 (Lint Policy to hosted) adds a first-wave job, and its 32-36 GiB peak does not fit a 16 GB runner, so it was refuted at high risk. HOST-08 extra legs and HOST-05/TEST-06 Property shards add jobs. HOST-01 per-SHA main runs add about 62 jobs per main commit at 54-100 commits/day. These pull directly against HOST-07/ROUT-01/PERI-04, which remove jobs. HOST-01 without its throughput layout (slice 4) makes the PR required-path p95 worse. Resolution: Sequence job-removing levers (PERI-04 without Labs, HOST-09/PERI-02, ROUT-01/HOST-07 as one lever, PERI-03/HOST-09 PR Size fold) before any job-adding lever. Admit HOST-01 only together with its throughput layout and a queue replay against the 60-job ceiling. Gate HOST-08 extra legs and TEST-06 on a 2+-concurrent-PR A/B. Drop HOST-02's hosted move and keep only the `needs:` ordering fallback with `if: !cancelled()`.
- HOST-01 (every main commit verdict), AGENTS.md inherited-red law, SCHE/heavy cap 2: HOST-01 asks for no-cancel per-SHA main runs. The always-loaded AGENTS.md Autonomy law tells the orchestrator to cancel runs, running ones included, so the unblocker gets runners. Skeptic 2 traced the in-progress main cancels to ad hoc agent `gh run cancel` calls, not CLI tooling (MergeGate and cancel-queued act only on PR head SHAs). Per-SHA queues add 12 Heavy jobs per main run against a cap-2 pool whose p95 wait is already 84 min, which raises the incentive to cancel. Resolution: Amend AGENTS.md to say 'never refs/heads/main' (operator-visible law edit, batched with other always-loaded edits), not just orchestrate SKILL.md. Land HOST-01 slice 1 together with the slice-4 throughput layout. Record the heavy-cap residual as an operator money question.
- PERI-10 (base-ref patterns), PERI-01/DEPS-02 (admission on pinned binary), PERI-04 (lane-relevance outputs), PERI-11 (auto pin bumps), ROUT-03 (narrow docs regex): PERI-10 makes CiOperational.patterns.json bind from base. ROUT-03 narrows the same regex and PERI-04 adds new keys to it, so both then take effect one PR late. Under base reads, a pin bump whose binary expects a changed patterns schema fails closed on its own Change Profile, with no single-PR way out. PERI-01/DEPS-02 move admission logic into the pinned binary (beep-ci-d15ecf4ca610, verified at fetch-beep-ci/action.yml:20), which already lags #2999 and #3011. PERI-04 guards written `== 'true'` against a binary that predates the new keys skip required Codegen, Nix and IPC on every PR and on main. Resolution: Order: ROUT-03 (widening-only, safe under head reads), then PERI-08 closure digest, PERI-11 automated pin bumps, and PERI-10 with backward-compatible decode. After that come PERI-04 (guards `!= 'false'`, plus an old-binary/new-workflow fixture) and PERI-01/DEPS-02 (closure-digest fallback to head install).
- YEET-03, SCHE-02, SCHE-03, SCHE-01: YEET-03 slice 1 is SCHE-02 (admit final-check gates) and slice 2 is SCHE-03 (wave-charged publish lease). Two areas would implement two admission shapes for one QualityScheduler, which the single-authority ruling forbids. There is also a nesting hazard: FinalCheck (verified, no withQualityAdmission today) spawns `quality github-checks cheap-gates`, so inner wave admission under an outer final-check lease can deadlock. Admitting final-check also makes 27-min coverage steps 3-token holders that compete with publish, which pulls against the local-publish <10 min target. Resolution: Merge into SCHE-01/02/03 under one owner (the scheduler area). Credit no YEET minutes. Treat the final-check admission half as trust only. Land the AdmissionUnit schema (SCHE-08) and a tolerant decoder first, because the persisted AdmissionWorkKind literal is closed and the journal is shared by mixed-revision worktrees.
- YEET-02, YEET-05, YEET-06: YEET-02's safety argument is that final-check and hosted stay at repo grain. YEET-05 makes final-check reuse same-head cheap-lane proofs, and YEET-06 enforces ProofLedger reuse on cheap lanes. Either one would let a file-scoped effect-imports receipt or a per-package jsdoc receipt satisfy final-check, which is a stale green. Resolution: Receipts must record their grain (narrowed or full), and reuse or enforcement must reject narrowed receipts. Add that fixture to both YEET-05 and YEET-06 before YEET-02 slice 1 lands.
- HOST-05/TEST-06 (Property sharding), TEST-01 (property census), HOST-08/TEST-02 (research-library fixtures): Sharding adds about 5-10 runner-min per run (plus a census job) to cut latency on a non-required context. TEST-01, TEST-02 and HOST-08 shrink the same sweep first. The 305 s coverage-artifacts file plus about 3.5 min of setup per leg floors any leg at about 8-9 min, so sharding after TEST-01 may buy close to nothing. Resolution: TEST-06 lands only if Property Laws p95 stays over 10 min after TEST-01 slice 1 (the file split) and TEST-02, and only if the operator says the target binds Property Laws.
- COVE-01, YEET-01, TEST-04, TEST-05: These levers give competing designs for local coverage. YEET-01 (producer/compare pair) fails closed as written, because the comparator needs all 13 partitions plus Labs. TEST-04 runs all partitions under unit admission. TEST-05 drops the Bun replay. COVE-01 adds publish-time advisory coverage, which push-first D2 rejects as a detached advisory proof unless it is bounded before push. Running 13-28 partitions locally under one host also conflicts with the local verify <10 min target if they are serialized. Resolution: Make TEST-04 the single carrier and fold YEET-01 into it. TEST-05 becomes TEST-04's eligibility census, not a separate lever. Hold COVE-01 slice 2 for an operator D1/D2 amendment. All of these need COVE-03 (Node 22.23.4 pin) first.

### Double counting

- Changeset-graph dedupe is claimed twice, by LINT-06 and peripheral-local PERI-04. Verified in source: CiLane.ts:1885 bunRunStep ci:repo-sanity:changeset-graph, plus GithubChecks.ts:577/581 repo-sanity:changeset-graph lane. Credit about 16-50 runner-min/week once, and remove only the CiLane step.
- The JSDoc inventory/ratchet dedupe in hosted Lint Policy is claimed by both LINT-05 and HOST-03 (Tasks.ts:3707-3708 and 3719). LINT-01 (noResolve) claims the same heavy-runner minutes on the Lint Policy copy, and HOST-02 would move them off the heavy pool entirely. Credit them once: LINT-01 for the JSDoc Ratchet ubuntu job, and one of LINT-05/HOST-03 for the Lint Policy copy.
- Knowledge-doctor overlap is claimed by both LINT-02 and HOST-04 for the same 200-211 s. LINT-03, LINT-05 and HOST-03 reshape the same medium-stage pole. Book the stage-wall reduction once, measured after the inventory pole is removed.
- Heavy Admission on the pinned binary is claimed by both DEPS-02 and peripheral-hosted PERI-01. PR Size Label setup is claimed by DEPS-02, PERI-03 and HOST-09 (HOST-09 folds it into Change Profile and also saves the checkout). The critical-path 0.6-0.9 min and about 950-1,050 runner-min/week must be credited once. DEPS-01's critical-path claim, the Heavy Admission install on the chain, also disappears once DEPS-02/PERI-01 lands.
- Empty Test Unit/Integration legs are claimed by ROUT-01 and HOST-07 (alternative placements). Labs/IPC/Ecosystem/Codegen skips are claimed by PERI-04 against ROUT-01, and Docgen by HOST-06. The per-job setup seconds for those jobs are also claimed by HOST-10, DEPS-03 (treeless checkout), DEPS-05 and DEPS-01. Measured empty-leg value is about 2.8-4 runner-min per run, not 9-11. Assign one owner per lane.
- Duplicate-monitor removal is claimed twice: PERI-02 (peripheral-local) reduces monitor count and PERI-03 (peripheral-local) reduces per-monitor polls against the same REST/CPU baseline. These savings multiply rather than add, so measure PERI-03 after PERI-02.
- Journal retention is claimed by both MEAS-09 and peripheral-local PERI-11, with the same mechanism (isRetainedCheckoutResidueName('yeet') is false, verified at ResidueReap.ts:1776). Its T3 half is also only a roots.json config row, so no code saving belongs there.
- Attribution fix: MEAS-02 duplicates DEPS-10 (Economics.ts actionableLane fallback). Neither claims minutes. Merge them into one slice so YEET-07 re-seeds once.
- @beep/glob#transit: TEST-10 duplicates TURB-04 (turbo.json:5351/5396 dependsOn ['^transit','@beep/utils#transit'] verified). Credit the trust gain once and include doctest (TEST-10 scope).
- Coverage producer: YEET-01, TEST-04 and TEST-05 all claim the same removed local test-unit execution. COVE-01's hosted-avoidance minutes overlap YEET-01, and COVE-05 overlaps TEST-08 (related-tests mapping) and borrows COVE-01's catch rate. TEST-02 and HOST-08 both claim the research-library-views fix, and TEST-01 also claims the views file's Property Laws time.
- YEET-03 duplicates SCHE-02 and SCHE-03. YEET-04 duplicates LINT-10 (one Turbo graph). YEET-02's effect-imports half duplicates LINT-08 and ROUT-08, and its jsdoc half depends on LINT-01, which claims most of the same saving.
- SCHE-01 and SCHE-03 claim the same token-contention pool, about 183 wait-min/week across the host, as YEET-03.
- TURB-06 duplicates DEPS-07 (tool-only root devDependencies isolation), and both feed TURB-05's eligible set. Count that gain once.
- Duplicate IDs corrupt cross-references: PERI-01..PERI-12 exist in both peripheral-hosted and peripheral-local with different meanings (e.g. PERI-01 = Heavy Admission binary vs Fallow fold; PERI-02 = Shadcn retire vs monitor singleton; PERI-04 = path gates vs changeset-graph; PERI-11 = pin bumps vs journal retention). Renumber, e.g. PHST-* and PLOC-*, before ranking.

### Dependency order

- 0. Prerequisite merges and state: #3005, #3014 and #3015 are on origin/main (fa8c30740b0). #3007 is still OPEN (gh pr view: OPEN), even though the brief assumes it merged. Every Test Unit lever (HOST-07/08, ROUT-01, TEST-04, COVE-06, MEAS-06 consumers) must rebase on #3007's final CiPartitions plan before it lands.
- 1. Measurement first, because no other area's target claim is checkable without it: MEAS-04 (per-attempt jobs, partial-row integrity), then MEAS-01 (head-SHA scorecard, all-terminal SLO statistic plus green-only diagnostic), MEAS-02+DEPS-10 (one attribution slice), MEAS-07 (final-check journal), and MEAS-09/PERI-11 merged (journals stored outside ~/.cache/beep/worktree-residue). ROUT-05 must fix jobNameToLane for 'Test Integration (<partition>)' before any census or ledger (MEAS-05) is trusted, because 29% of post-#3005 job-minutes are unmapped.
- 2. Soundness repairs before any narrowing: TEST-10/TURB-04 (glob#transit for test, test:property and doctest; re-record the cache-qualification baseline in the same PR). ROUT-03 (goal-folder consumers, including the ops .py/.mjs probes, with per-package turbo.json inputs and not the root, to avoid a repo-wide cold cache and reseal). ROUT-02 (docs/goals policy job that runs on goals_only). COVE-02 (bare coverage judge). YEET-08 slice 1 with receipt versioning against ReadyGate's ancestor carry.
- 3. CI binary chain: PERI-08 (closure-digest release trigger), then PERI-11 (automated reviewed pin-bump PRs, one per closure change), then PERI-10 (base-ref patterns with compat decode), then binary-dependent moves: PERI-01/DEPS-02 merged (with the closure-digest fallback; delete the dead coverage probe and its LEGACY_COVERAGE assertion at the same time), PERI-03/HOST-09 PR Size, PERI-06, and PERI-04 (guards `!= 'false'`). Each binary change is three PRs: CLI, pin bump, then the workflow switch.
- 4. heavy.yml@main two-PR rule (check.yml:214 calls heavy.yml@main; the referenced_workflows pin is at check.yml:149) applies to HOST-02 fallback ordering, HOST-06, MEAS-06's heavy.yml leg (avoidable, since it only carries the Lint Policy summary), ROUT-01 slice 3, and any Lint Policy hosted job rename. Ship the first PR additive under a migration name; the second retires it after main resolves.
- 5. Cache-policy and coverage baseline re-records: any PR touching turbo.json (TEST-10, TURB-01, TURB-06/DEPS-07, TURB-08), bun.lock or root package.json (DEPS-01, DEPS-05b, DEPS-07), or a workflow file freezes coverage floors at base and escalates to a full matrix (memory heavy-yml-pinned-main-and-ratchet-global-inputs). Batch these to minimize full-matrix runs, plan the S11 path, and re-record the cache-qualification baseline in the same PR. TURB-08 (eyecite cache) must wait for TEST-10 and the goals-fixture input from ROUT-03, or its test family stays cache:false.
- 6. Lint: LINT-01 (noResolve) then LINT-05 (JSDoc dedupe, merged with HOST-03 JSDoc half), then LINT-02 (doctor overlap, merged with HOST-04), then LINT-03 (width split derived from the post-LINT-02 slot owners), then LINT-04 per family. Respect the three-open-PR packet limit.
- 7. Scheduler: SCHE-09 retention and SCHE-08 schema (with a tolerant decoder for mixed-revision worktrees), then SCHE-07 weights (per-wave anon measurement), then SCHE-01/02/03 (YEET-03 folded in), then SCHE-06 backfill before admitting long final-check coverage units, then SCHE-05 backpressure (needs SCHE-08 and SCHE-09 for ETA).
- 8. Local proof shape: COVE-03 (Node 22.23.4 pin with a shared pin source or drift test) before COVE-01, TEST-04 and YEET-01. TEST-04 then absorbs YEET-01 and TEST-05's census. YEET-05 runs shadow-first with a pinned base, and changeset-status is excluded until PERI-12 closes.
- 9. Main verdicts: HOST-01 slice 1 (per-SHA group) only together with or after slice 4 (throughput layout), and after job-removing levers (HOST-07/ROUT-01, PERI-04, HOST-09) free first-wave slots. The AGENTS.md never-cancel-main amendment goes in the same wave.
- 10. Paused rulings: time-to-certainty is Lifecycle paused (goals/time-to-certainty/README.md:3), and the ten-minute-certainty packet exists under explorations/ and goals/. Levers that edit TTC artifacts (YEET-06 C4.2 enforce, YEET-07 re-seed of economics.json and gate-order-handoff.json, the PERI-02 Shadcn row in gate-order-handoff fixtures, SCHE-05) need either an un-pause decision or a re-home into ten-minute-certainty with a decision file. Leave the frozen TTC fixtures untouched in the meantime.
- 11. R2 pause (2026-11-08 workstation-writer pause, still an open question): TURB-10 fleet attribution and any lever counting on remote cache hits for first-cold reuse (TURB-05/TURB-06 payoff, YEET-05) must not assume workstation R2 writes until the operator rules.
- 12. Required-context names must not change. 'Heavy / Test Integration' is now produced by partition jobs (#3005) and an aggregator, so census and scorecard mapping (ROUT-05, MEAS-01, MEAS-05) has to handle the 'Test Integration (p)' and 'Test Integration Partitions' names before COVE-08 option A is considered. COVE-08's fixed comparator context name (check.yml conditional at the coverage-regression job) must land before any required promotion.

### Numbers still without a primary source

- The 60-job org concurrent-job ceiling: no admin-side read. The 59 concurrent figure is measured, but the limit itself is the documented Team default and is unverified (SURFACE-INVENTORY line 94/250).
- HOST-02 'required heavy queue p95 84 -> ~10-20 min at peak' is a fluid-model guess. The 84 min baseline window (09-12Z 11-09) also included Heavy / Test Integration, which #3005 has since removed.
- COVE-01 '~1,900 runner-min/week' rests on 1 direct-owner red in 43 comparator runs. Skeptics put the guess band at 300-1,200 and book it at 0. The 2-4% direct-owner rate comes from a 6-red sample.
- TURB-01's '15-19% of PR runs' is from Opus's replay, which is not a repo artifact. The skeptic's turbo dry-run sample says about 8% fully convert. The 727-commit corpus must be rebuilt in-repo.
- DEPS-01 '4-12 s/job lifecycle saving' is a confounded cross-job comparison. Within one run, the scripted install (25.97 s) and the --ignore-scripts install (23.41 s) did not differ.
- DEPS-03's treeless-checkout '4-8 runner-min/run' was refuted: the history fetch measured 2.4-2.8 s per job.
- DEPS-05 byte savings use local unpacked sizes. Whether --libc=glibc reaches the untagged duckdb musl entry (bun.lock:6033) is unproven.
- PERI-05 (peripheral-local) instrumentation splice '5-15 CPU-s per repo-cli commit' is a guess with no hook timing (and the lever was refuted).
- SCHE-04 CPU-dimension '0.2/0.5 min per publish/verify' has no receipt of CPU-bound slowdown (CPU-some p99 21%).
- SCHE-01 '40-80 wait-min/week' depends on an unmeasured light-wave fraction. Per-wave memory peaks do not exist, and lease peak p50 22.9 GiB is already above the 15 GiB charge.
- PERI-03 (peripheral-local) '10,000 CPU-s/week, 60-90k REST/week': its CPU basis was mislabelled (GateStaleness mtime witnesses, not lane digests) and it is unmeasured.
- LINT-02 originally claimed 1,100-1,180 min/week. Recomputed at 550-700 because the medium graph is width-bound, and that recompute is itself derived without per-task hosted timings (PR Turbo summaries are not uploaded).
- LINT-03 '350/week' was recomputed at about 90-100. Changed-scope share is 27% (4/15), not 47%.
- HOST-01 cost: the lever's ~9.7k runner-min/day for ~30 verdicts. Skeptic recomputed about 20-36k from 54-100 commits/day x ~360 runner-min. Docs-only skip share on main is unmeasured.
- The 25% docs-only publish share (ROUT-08) and the 0.75 non-docs PR fraction (PERI-01 Fallow fold) are both unverified.
- TEST-03 widening savings use pre-#3007 LPS baselines (377/407 s), and #3007 already splits native-wallclock and replay projects.
- MEAS-01's nightly '~1 runner-min' ignores install cost and the GITHUB_TOKEN ~1,000 req/h/repo budget against about 700 re-polled main SHAs plus per-attempt job reads.
- YEET-01 '310-520 min/week' assumed a 0.6 coverage-selecting share. Receipts show about 6% (9/157), and all of them predate #3008.
- Fleet volume figures disagree: economics 87 publishes/52 verifies a week, the journal about 412/87, and the fleet census fell from 2,596 to 2,579 as retired journals are deleted. Any weekly figure built on these is censored until MEAS-09/PERI-11 land.

### Missing from the plan

- Vercel: PERI-12 (closure ignoreCommand) is only trust/measurement. No lever addresses the fact that 77% of Vercel statuses are rate-limited failures that the merge gate must explicitly exempt (OwnerCheckpoint/MergeGate/Inbox special cases). Nobody owns the deployment-receipt census, and the operator product question (are previews wanted per push) is unanswered.
- Review window: PERI-09 changes only the anchor. No lever measures how often the 20-min window, rather than required-green, binds push-to-mergeable (11/30 merged PRs per Opus). MEAS-01 should report 'push to mergeable' alongside 'push to required green' so the operator can see the gap ruling 1 excludes.
- Fleet hosts (beep-worker, dankserver, tbk-worker, tom-pc-1-wsl, grok-bot): no lever measures local verify/publish p95 on them. QualityScheduler weights (SCHE-07) are workstation-only. The compute-profile refusal (#2925/#2959) routes work to hosted, but nothing records those runs. PERI-11 part (e) remote pulls are operator-gated and unowned.
- Agent seats as load: no lever counts concurrent agent sessions (Claude, Codex, Junie, Cursor, T3 delegates) as admission demand, even though the unattributed one-lease capacity dip (40 of 97.6 long-wait minutes) points to unadmitted load. Seat and host fields (PERI-11c) are proposed only as reporting, and admitting agent-shell heavy commands (SCHE-02 slice 3) is the only partial coverage.
- Monitor polling's REST budget versus hosted needs: PERI-02/03 (local) treat monitor polls as local CPU, but the shared user token at 2,184-3,025/5,000 also drives the merge-gate's GraphQL budget exit 75 and the lane-timings 502 and rate-limit failures. Nobody budgets the token across monitors, MEAS-01 nightly, ROUT-05 capture and lane-timings.
- Main-branch push runs: only HOST-01 addresses them. No lever restores main-run Turbo summary uploads for test bodies, and the Property Laws nightly is not in the scorecard.
- Hosted step-level waste on the critical Test Integration partitions (#3005): no lever profiles the 16 lps-int legs' setup versus body, or their 1,395-1,551 s outliers, after #3005 merged. TEST-03 is refuted and HOST-08 targets Test Unit only.
- Cancelled-run waste: 42% of PR runner-minutes go to superseded heads (MEAS-01 Opus). No lever reduces push churn (one push per wave is an AGENTS.md law that nothing enforces or measures per agent).
- Doctest local cold makespan (TEST-09) and the Heavy / Docgen required context have no latency lever beyond HOST-06's skip hoist.
- Rollback paths: none of the CI-YAML levers (HOST-01, PERI-04, PERI-05, HOST-07) names a tested revert. The workflow-PR App-token merge restriction (orchestrator cannot merge workflow PRs) is not scheduled into any slice.

### How to state the projection

- Report two separate objectives, never summed. (a) PR p95 push-to-every-required-context-green, measured per head SHA with all terminal non-superseded heads in the denominator. Red, held and api-partial heads count as not attained. Superseded heads are censored, and green-only p95 appears only as a diagnostic. (b) Runner-minutes per PR run split by pool (GitHub-hosted, which is free for this public repo, versus owned beep-ec2-heavy). Add one line for main verdict rate (today 13-17%) and one for local verify/publish p95.
- Baseline first, from MEAS-01, before any after-number: code heads p50 48.5 / p95 124.5 min, 2/27 under 10 (Opus). The critical context is Heavy / Test Integration and Test Unit. No lever in this plan, alone or summed, demonstrates sub-10 required p95. The honest projection is 'not yet reachable at cap 2 without capacity', and that states the money lever as the operator's.
- Project only from levers whose admission gate can run before landing and that survived both skeptics. List refuted levers explicitly at zero: YEET-04, COVE-06, HOST-02 (hosted move), ROUT-08, ROUT-09 (already shipped), ROUT-10, TURB-02, TURB-06, TURB-08, TEST-02, TEST-03, SCHE-03, SCHE-04, DEPS-03, DEPS-04, PERI-05-local. Present weakened levers with skeptic-recomputed ranges, not seat claims.
- Deduplicate before summing. Assign each minute to one lever per the doubleCounting list, and apply the interaction order: per-run savings measured after the preceding lever lands, e.g. LINT-02 after LINT-01/05, PERI-03 after PERI-02, TURB-01 after HOST-07/ROUT-01. Use multiplicative composition for overlapping reductions, never additive.
- Separate structural from contingent savings. Measured removals (Shadcn duplicate about 1.35k raw min/week, PR Size and Admission setup about 1k, Nix setup about 600, Fallow fold about 1-2k, empty legs about 2.8-4 min/run, JSDoc dedupe 0-1.9 min/run) go in one column. Hypothesis-gated ones (COVE-01 avoidance, TURB-01 at about 8% of runs) go in another, with a book-at-zero default.
- State confidence intervals from run-to-run variance. Leg variance (one Test Unit leg spread 11-18 min), queue bimodality (0 or 12-95 min) and 15-62 s install variance dwarf many per-lever deltas, so single paired runs cannot validate a projection. Require at least 3 paired runs or the 7-day MEAS-01 cohort.
- Account for cost-adding levers explicitly as negatives: HOST-01 (+~20-36k runner-min/day on main), ROUT-02 (+3-5/docs PR), ROUT-03, TEST-10, YEET-08 (local final-check growth), HOST-05/TEST-06 (+5-10/run), SCHE-02 (added publish waits). The net runner-minute projection may be close to zero or negative while trust rises, and the plan should say so.
- Do not count latency on non-required contexts (Property Laws, Lint Policy, Coverage Regression, Fallow, Storybook) toward ruling 1 unless the operator rules that Yeet-mergeable is in scope. Report them in a separate 'push-to-mergeable' row.
- Use the brief's volume band (76-245 PR runs/day, ~1,100/week central) and ~470-500 main pushes/week as stated sensitivity bounds, and show weekly totals at both ends.

### Operator questions the critic adds

- Does ruling 1's 10-minute target include non-required contexts that Yeet waits on for mergeable (Lint Policy, Property Laws, Coverage Regression, Fallow), and is it computed over code heads only or all heads? This decides whether HOST-05/TEST-06, LINT-02/03 and COVE-08 move the target at all.
- Coverage Regression policy (COVE-08): stay non-required but gating mergeable (C, recommended), become required (A, which needs a fixed context name and makes the target unreachable today), or stop gating (B)?
- Every-main-commit verdicts (HOST-01) cost roughly 20-36k runner-min/day at 54-100 commits/day and need the AGENTS.md inherited-red law amended to never cancel refs/heads/main. Accept both, and is a coarser throughput layout for push runs acceptable as the verdict shape?
- At cap 2 heavy runners, peak heavy demand stays near supply even after all no-money levers. Is a residual peak-hour heavy queue acceptable, or is raising the cap (money) on the table?
- Should a diff-preserving merge of origin/main re-arm the 20-minute review window (PERI-09)? It currently re-arms every sibling after each serial merge.
- Should pattern changes to CiOperational.patterns.json bind from base (PERI-10, two-PR changes like heavy.yml@main)? Which App identity may open automated CI-binary pin-bump PRs (PERI-11)?
- Is the 2026-11-08 R2 workstation-writer pause binding for this plan's cache-reuse levers (TURB-05/06/10, YEET-05)?
- Should time-to-certainty be un-paused, or its open seams (C4.2 ProofLedger enforcement YEET-06, WaveOrder re-seed YEET-07, gate-order fixtures) be re-homed into ten-minute-certainty?
- May detached monitors back off to 2-5 min in push-blocked states, and is the shared user token's REST budget something agents must budget across monitors, the nightly scorecard and corpus capture?
- May economics pull attempt journals from fleet hosts and include T3 lanes by default (a roots.json row), with seat and host fields on attempt rows?
- Push-first D1/D2: may a bounded publish-time advisory coverage run (COVE-01) execute before push, given D2 rejects detached advisory proofs?
- Is `yeet verify --merged` (merged-preview) still a supported proof posture (PERI-13), or may it be retired?
