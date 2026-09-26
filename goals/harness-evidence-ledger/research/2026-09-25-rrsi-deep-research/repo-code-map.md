# RRSI mechanisms A–H: implemented analogues in beep-effect19 (code, not prose)

Survey date 2026-09-25, checkout `main` @ 489ea7c488. Every path below was verified with `ls`/`rg`.
Paths are relative to `$HOME/YeeBois/projects/beep-effect19/`.
Abbreviation: `CLI = packages/tooling/tool/cli/src`, `AIM = packages/tooling/library/ai-metrics/src`.

Closeness scale: **same rule** / **adjacent rule** / **only superficially related**.

---

## A. Annealed edit budget per candidate (L0 cap, cosine-annealed b_max→b_min)

**A1. One-surface-per-comparison rule** (fixed cap = 1, no anneal)
- `CLI/commands/AgentEffectiveness/internal/EvalComparison.ts:107` `compareAgentConventionTrials`
- `CLI/commands/AgentEffectiveness/AgentEffectiveness.schemas.ts:457` `ConventionSurface` = `guidance | navigation | handoff`; `:458` `ComparisonRefusal` (includes `"surface-count"`); `:523` `AgentConventionComparison`
- Rule: the code diffs `baseline.variant[surface]` against `candidate.variant[surface]` for the three surfaces. If more than one surface changed, or none did, the pair is refused as `Incomparable` with reason `surface-count`. Otherwise it is `Comparable { changedSurface, differences }`.
- This is a hard L0 cap of 1 attributable edit per paired comparison. It does not anneal and there are no rounds; it gates comparability, not proposal generation.
- Closeness: **adjacent rule**. It is the late-phase RRSI setting (b_min = 1) made permanent.

**A2. Flake quarantine cap**: `CLI/commands/Quality/internal/FlakeQuarantine.ts:91` `MAX_QUARANTINED_TASKS_PER_LANE = 3`. This caps how many tasks one lane failure can excuse. It is a budget on exceptions, not on edits. Closeness: **only superficially related**.

No schedule, anneal, cosine or decay logic exists anywhere in `packages/tooling` (rg for `anneal|cosine|decay|stall|plateau` finds nothing relevant).

---

## B. Evidence-aware credit assignment (per-candidate ledger: component, hypothesis, diff, ΔS, ΔC, accepted?)

**B1. Paired convention-trial receipts** (the strongest match)
- `CLI/commands/AgentEffectiveness/AgentEffectiveness.schemas.ts:342` `AgentConventionControls`: task, repositorySnapshot, **harnessDigest**, environmentDigest, safetyPolicyDigest, model, reasoningEffort, tokenBudget, timeBudgetMs, acceptanceChecks
- `:375` `AgentConventionVariant`: content digests of the guidance, navigation and handoff surfaces (the "component")
- `:407` `AgentConventionMeasurements`: elapsedMs, input/outputTokens, introducedDefects, humanInterventions, acceptance map (the cost side)
- `:442` `AgentConventionTrial` (`agent-convention-trial/v1`): runId, pairId, controls, variant, evaluation (score report), measurements
- `:482` `AgentConventionDifferences`: candidate − baseline for each score component (completion, schemaFirst, tsgo, biome), violationCount, acceptance counts, **elapsedMs and token deltas** (ΔS and ΔC kept separate)
- `:523` `AgentConventionComparison` (`agent-convention-comparison/v1`): baseline, candidate, and `Comparable{changedSurface, differences} | Incomparable{reasons}`
- Rule: a receipt-only comparator. It changes nothing and runs no agent. Differences are reported "without an aggregate score or winner". There is **no accepted/rejected field and no hypothesis field**. There is no persistent history the proposer conditions on.
- Closeness: **adjacent rule**. It has the component, the ΔS and the ΔC, but no hypothesis, no acceptance flag and no accumulated ledger.

**B2. ai-metrics benchmark runs keyed by harness config snapshot**
- `AIM/models.ts:936` `BenchmarkCase`; `:975` `BenchmarkRun` {benchmarkCaseId, benchmarkRunId, **configSnapshotId**, elapsedMs, passed, qualityGate, recordedAtEpochMillis}
- `AIM/config-snapshot.ts:82` `AiMetricsConfigScope` = `baseline | session`; `:385` `AiMetricsConfigSnapshotDiff` (the harness diff between the baseline config and the session config)
- `AIM/scorecard.ts:351` `AiMetricsWeeklyConfigScore`; `:556` `BenchmarkAggregateRow` {benchmarkPassRate, benchmarkQualityGateScore, benchmarkRunCount, configSnapshotId}; `:993` `recordAiMetricsBenchmarkRun`; `:1427` `generateAiMetricsWeeklyReport`
- `CLI/commands/AgentEffectiveness/internal/EvalRecord.ts:56` writes each scorer report as a `BenchmarkRun`.
- Rule: outcomes are grouped by harness-config snapshot each week. That gives per-harness-version score history, but no accept/reject and no hypothesis.
- Closeness: **adjacent rule**. It is a credit ledger keyed by harness version, not by candidate edit.

**B3. Proof ledger (negative evidence is binding)**
- `CLI/commands/Yeet/internal/ProofFact.ts:297` `ProofFact` {key: ProofInputDigest, epoch, outcome passed|failed, durationMs, provenance, recordedAt, expiresAt}; `:329` `ProofMissReason` includes `prior-failed`, `changed-package-tripwire`, `epoch-changed`, `expired`
- `CLI/commands/Yeet/internal/ProofLedger.ts:277` `ProofLedger` service (append-only NDJSON per checkout); `:156` `ProofChangedPackageTripwire`
- Rule: a lane result counts as reusable evidence only for the exact input digest and epoch it ran against. A recorded failure (`prior-failed`) blocks reuse. Facts expire after 30 days (`ProofShadow.ts:61` `PROOF_FACT_TTL`).
- Closeness: **adjacent rule**. The "don't re-trust falsified evidence" idea is present, but it is keyed on inputs, not on hypotheses.

**B4. Research routine tombstones** (data convention; **no repo code** writes or reads them)
- `research/ledger/tombstones/*.jsonl` with schema tag `beep.research.tombstone/v0`: fields include originId, reason (`unactioned-3-runs`), and `resurrect: "needs evidence post-dating <date>"`. `research/README.md:19-38` makes `claims.jsonl` plus the ledger the truth, with the routine as single writer.
- A rejected item stays as negative evidence and can come back only with new evidence. This is the RRSI "don't re-test falsified hypotheses" rule, but it is enforced by the agent routine, not by code. `claims.jsonl` appears in code only in test fixtures (`CLI/../test/ci-heavy-admission.test.ts`, `changeset-status.test.ts`).
- Closeness: **same rule in spirit, but not implemented as code**.

---

## C. Structured exploration on stall (progress within δ over window w, then reserve budget for unexercised components)

- Nothing found. No stall or plateau detector exists in `packages/tooling` (rg `stall|plateau|no-progress|stuck` finds only process-wedge comments).
- Nearest loop-control code: `CLI/commands/Yeet/internal/MonitorPolicy.ts:68` `YEET_MONITOR_POLL_ERROR_BUDGET = 5` (consecutive poll-error budget) and `:50` `YEET_SETTLE_TIMEOUT_DEFAULT_MILLIS = 30 min`. These end a loop; they do not diversify it.
- `CLI/commands/Yeet/internal/Remediation.ts:276` `decideYeetRemediation` (`start-session | queue | duplicate` per head SHA wave) routes repair work and does not explore.
- Closeness: **only superficially related**.

---

## D. Leakage screening (a critic rejects diffs that encode benchmark-specific content or inert machinery)

**D1. Coverage floor-lowering guard** (stops edits to the verifier)
- `CLI/commands/Quality/internal/CoverageRegression.ts:773` `CoverageLoweredFloor`; `:965` `CoverageComparisonBaselines`; `:2025` `readComparisonBaseline`
- Rule: on a PR run pinned to a base, floors come from the **base revision's** baseline document. The branch's own document is only "proposed". A PR that lowers a floor on a package it could not have moved gets flagged, so a candidate cannot pass by rewriting its own acceptance threshold.
- Closeness: **adjacent rule**. It blocks gaming the evaluator, not benchmark-specific content.

**D2. Gate staleness, a vacuous-proof detector**
- `CLI/commands/Yeet/internal/GateStaleness.ts:442` `assessGateStaleness`; `:270` `GateStalenessVerdict` = `GateFresh | GateStale | GateUnproven`; `:309` `YEET_GATE_ARTIFACT_DESCRIPTORS`
- Rule: a cached gate artifact older than the newest relevant changed input cannot have observed that change, so it is marked stale. This is a warning surface only.
- Closeness: **only superficially related**. It catches "inert" proofs, not inert harness machinery.

**D3. QA judge evidence cross-check** (a critic screens judge output before it is accepted)
- `CLI/commands/Qa/JudgeCheck.ts:57` `EvidenceCrossCheck`; `:182` `crossCheckEvidence`; `:360` `crossCheckAgainstRound`; `CLI/commands/Qa/Inventory.schemas.ts:474` `QaInventory` (`qa-inventory/v1`), `:347` `QaFinding` (evidence is a NonEmptyArray)
- Rule: every cited artifact must exist in the round, and every cited event id must appear in that round's witness log. Otherwise the inventory is rejected at ingest and again at lint.
- Closeness: **only superficially related**. It screens the judge for hallucinated citations, not the diff for leakage.

**D4. Review-body structural parsing** (`CLI/commands/Yeet/internal/ReviewBodySignal.ts`): it reads only structural markers of untrusted review text. Closeness: **only superficially related**.

No code scans a diff for task names, answers or fixture-specific literals. The one "synthetic secret canary" is `CLI/commands/Cache/Cache.experiment.ts` `secretCanary` (a capture-leak control), which is a different sense of leakage.

---

## E. Noise-adjusted acceptance floor (δ measured by rerunning the unchanged baseline; accept iff S ≥ S* − δ)

**E1. Coverage ratchet with epsilon** (the closest in form)
- `CLI/commands/Quality/internal/CoverageRegression.ts:116` `coverageRegressionEpsilon = 0.001` (pinned by `SupportedCoverageRegressionEpsilon` literal); `:2682` `metricRegressed`; `:1003-1006` stricter-floor predicate
- Rule: a metric counts as regressed iff `actual + ε < baseline` **and** real coverage was lost (more uncovered units, or the file set changed). A raise counts iff `proposed > base + ε` or fewer uncovered units. ε is a **fixed floating-point tolerance, not a measured noise band**. S* is the committed floor (a ratchet: best-so-far).
- Closeness: **adjacent rule**. It has the S ≥ S* − δ shape, but δ is not measured.

**E2. Fail-on-growth ratchets** (zero tolerance, one-way floor)
- `CLI/internal/ratchet/RatchetDiff.ts:71` `diffMembership`; `:241` `diffTotals`; `:112` `RatchetTotalDelta`; `:151` `RatchetTotalsDiff`; `CLI/internal/ratchet/RatchetLifecycle.ts` (fail on first increase, otherwise suggest tightening)
- Users: `CLI/commands/Quality/internal/KnipRatchet.ts:217` `KnipRegressionBaseline`, `:528` `runKnipRatchet`; `CLI/commands/Quality/internal/JSDocRatchet.ts:191` `JSDocTotalsRegressionBaseline`, `:261` `JSDocTotalsComparison`
- Rule: any increase of any metric fails. Decreases only prompt a baseline tighten (`--write-baseline`). There is no tolerance at all, which is RRSI's "no walking downhill" with δ = 0 on deterministic counts.
- Closeness: **adjacent rule**.

**E3. Shadow-mode promotion bar** (measure disagreement before a rule becomes permanent)
- `CLI/commands/Yeet/internal/ProofShadow.ts:96` `ProofShadowEnforcementBar.ratified = {attempts: 200, branches: 10, disagreements: 0}`; `:133` `ProofShadowDisagreement`; `:211` `ProofShadowReport`
- Rule: proof reuse can only be enforced after shadow mode has seen at least 200 attempts across at least 10 branches with 0 cases where "the ledger would have reused a pass but the lane failed".
- Closeness: **adjacent rule**. It is a pre-registered bar measured before promotion, but it gates an optimisation rather than scoring a candidate.

**E4. Noise handling that refuses to chase noise**
- `CLI/commands/Yeet/internal/MonitorLoop.ts:179` `YeetMonitorFlakeClass` (`ts2589-no-location | ci-timeout | setup-5xx | runner-loss | install-failure`); `:275` `detectYeetMonitorFlakeClass`; `:332` `YeetMonitorRerunJob` / `:359` `YeetMonitorRerunSpent` / `YeetMonitorNeedsCodeFix`
- Rule: a red job is rerun **once per head SHA**, and only if its log matches a known flake fingerprint. An unmatched red is `needs-code-fix`.
- `CLI/commands/Quality/internal/FlakeQuarantine.ts:352` `detectNoLocationTs2589Flake`, `:176` `FlakeQuarantineIncident`, `:211` `FlakeQuarantineArtifact` (`yeet-flake-quarantine/v1`); `CLI/internal/process/StepExec.ts:193` `StepFlakeQuarantinePolicy`. Quarantine applies only when every failed task is a no-location TS2589, there is no other diagnostic, the output was not truncated, and at most 3 tasks are affected.
- Closeness: **adjacent rule**. Noise is classified by signature, not measured as a band.

---

## F. Cost-justified acceptance (ΔC ≤ β0 + β1·ΔS)

- **F1.** `AgentConventionDifferences` (`AgentEffectiveness.schemas.ts:482`) computes ΔS and ΔC (tokens, elapsedMs) side by side but **no rule combines them**; the comparator explicitly declares no winner. Closeness: **only superficially related** (it has the inputs but no rule).
- **F2. Evidence-backed lane ordering by cost and yield**: `CLI/commands/Yeet/internal/WaveOrder.ts:377` `orderWaveLanes`; `CLI/commands/Quality/Quality.schemas.ts:1100` `GateOrderSeedRow` {laneId, costP50Seconds, redProbability, precision, laneClass, each value with a pointer to its evidence}, `:1140` `GateOrderSeed`. Seed data comes from `goals/time-to-certainty/research/economics.json` (A1 hosted P50s; red share over the 832 reconstructable first failures). Lanes are sorted by partition, then cost ascending, then red probability descending, then precision. This is cost/yield scheduling, not acceptance. Closeness: **only superficially related**.
- **F3. Absolute cost caps**: `CLI/commands/Ci/LaneTimings.ts:1482` `CI_LANE_TIMING_CHARTER = 20 min` (p95 < charter ⇒ Pass, `:2211`); queue tripwire p95 > 5 min (`:2254`). `CLI/commands/Ci/HeavyAdmission.ts:344` `decideHeavyAdmission` (`run | skip-satisfied | hold`) admits the expensive tier only with the `ready-for-heavy` label, a merge group or a push to main. These are fixed budgets that do not scale with gain. Closeness: **only superficially related**.

---

## G. Structural pruning (components with no positive measured gain over a window become deletion targets)

- **G1. Research tombstones** (data only): `research/ledger/tombstones/*.jsonl` reason `unactioned-3-runs`. An item that produces no action over a 3-run window gets reaped. This is the closest to "must keep earning its place", but it is enforced by the routine agent, **not by code**. Closeness: **same rule in spirit, not implemented**.
- **G2. Dead-code ratchets**: `CLI/commands/Quality/internal/KnipRatchet.ts:49` `KnipFindingKind` (unused exports, files, dependencies, types, enum members…), `CLI/commands/Quality/internal/FallowCiContract.ts:273` `fallowCiContractDiagnostics`, `CLI/commands/Fallow/Fallow.command.ts`. These flag *unreferenced* code, not code without measured gain. Closeness: **only superficially related**.
- **G3.** `CLI/commands/Quality/internal/CoverageRegression.ts:517` `CoverageBaselineRowDisposition` = `replaced | held | added | pruned` prunes baseline rows for packages that no longer exist. This is bookkeeping. Closeness: **only superficially related**.
- There is no code that credits a harness component (skill, rule, lane or hook) with measured gain and proposes deleting it. `WaveOrder` has `redProbability = 0` lanes such as `quality:sast` and `quality:nix` (`WaveOrder.ts:~300`) but only reorders them.

---

## H. Evolve / held-out / OOD discipline; every number vs the unchanged baseline in the same window

**H1. Census window guard plus ratified population** (the "same window, no infra drift" rule)
- `CLI/commands/Ci/LaneTimings.ts:2756` `assessCiLaneTimingWindowBounds`; `:1079` `CiLaneTimingWindowGuardReason` = `future-cutoff | short-span`; `:2670` `CI_LANE_TIMING_CENSUS_SPAN = 7 days`; `:1131` `CiLaneTimingWindowGuardVerdict` (preview flag); `:2800` `renderCiLaneTimingWindowPreviewBanner`; `:1517` `CiLaneTimingRatifiedPopulation` {versionId, contextCount, ratifiedOn}; `:1430` `CiRulesetHistoryVersion`; `:1463` `CiLaneTimingWindowReport` (`ci-lane-timing-window/v1`)
- Rule: a census window counts as admission evidence only if it is a complete past span of at least 7 days. Otherwise it is refused, or printed with a `--preview` banner that cannot be dropped from pastes. Required contexts are pinned to a ratified ruleset version and context count, so the measured population cannot drift inside a comparison.
- Closeness: **adjacent rule**. It is a measurement-validity discipline, not a held-out split.

**H2. Paired controls ("unchanged baseline, same conditions")**: `AgentConventionControls` must match exactly between baseline and candidate (refusals `controls-differ`, `pair-differs`, `run-reused`, `task-mismatch`) in `EvalComparison.ts:107`. Closeness: **adjacent rule**. It enforces same-conditions pairing but has no held-out or OOD split.

**H3. Base-pinned coverage floors**: judged against the **merge base's** baseline, not the branch's (`CoverageRegression.ts:965`, `:2025`); the jsdoc ratchet on hosted runs scans the merge commit. Closeness: **adjacent rule**.

**H4. Cache qualification controls**: `CLI/commands/Cache/Cache.pilot.ts:1062` `runMutationControls` (a seeded baseline run, then planted mutations that must change the hash), `:1019` `runFailedSourceControl`, `:1266` `runNonExecutionControls`; `CLI/commands/Cache/Cache.experiment.ts:140` `equivalentCacheFixtureRuns`. These are must-detect controls run against an unchanged baseline in the same session. Closeness: **only superficially related** (verifier qualification, not generalization).

**H5. Verification-failure attribution**: `CLI/commands/Yeet/Yeet.schemas.ts:158` `QualityIssueAttribution` = `introduced | inherited-adjacent | not-applicable`. A failure is attributed against a baseline state before anyone acts on it. Closeness: **only superficially related**.

No evolve/held-out/OOD split exists anywhere. `SkillOptTaskManifest` (`AgentEffectiveness.schemas.ts:123`) is a single task set with no split field.

---

## Schemas that record evolution history (per-attempt record with outcome + cost + accepted?)

| Schema | Path:line | Outcome | Cost | Accepted? | Component/diff |
|---|---|---|---|---|---|
| `AgentConventionTrial` (`agent-convention-trial/v1`) | `CLI/commands/AgentEffectiveness/AgentEffectiveness.schemas.ts:442` | `evaluation` score report + acceptance map | tokens, elapsedMs, budgets | no | `variant` digests (3 surfaces), `harnessDigest` |
| `AgentConventionComparison` (`agent-convention-comparison/v1`) | same file `:523` | `differences` (ΔS per component) | Δtokens, ΔelapsedMs | no (Comparable/Incomparable only) | `changedSurface` |
| `AgentEffectivenessEvalScoreReport` | same file `:229` | score + breakdown + violations | — | — | taskId |
| `BenchmarkRun` | `AIM/models.ts:975` | passed, qualityGate | elapsedMs | — | configSnapshotId |
| `AiMetricsConfigSnapshotDiff` | `AIM/config-snapshot.ts:385` | — | — | — | harness config diff, baseline vs session |
| `AiMetricsWeeklyConfigScore` / `BenchmarkAggregateRow` | `AIM/scorecard.ts:351` / `:556` | pass rate, gate score | — | — | per config snapshot |
| `YeetAttemptStarted` / `YeetAttemptFinished` / `YeetAttemptTerminated` (`yeet-attempt-journal/v1`) | `CLI/commands/Yeet/internal/AttemptJournal.ts:47` / `:86` / `:120`; union `:149` | embedded `YeetVerdict` | — (the verdict holds per-step timings) | the verdict's success/failure | branch, base, head, mode |
| `YeetVerdict` / `YeetExecutedStep` / `YeetMergeReady` | `CLI/commands/Yeet/internal/Verdict.ts:568` / `:664` / `:475` | per-lane status, merge-ready criteria | step durations | merge-ready yes/no | — |
| `ProofFact` / `ProofLedgerFactRow` / `ProofLedgerShadowRow` (`proof-fact/v1`) | `CLI/commands/Yeet/internal/ProofFact.ts:297` / `:451` / `:498` | passed/failed | durationMs | reuse hit/miss + `ProofMissReason` | input digest, epoch |
| `ProofShadowReport` / `ProofShadowDisagreement` | `CLI/commands/Yeet/internal/ProofShadow.ts:211` / `:133` | disagreement counts | — | enforcement bar | laneId, stage |
| `YeetRemediationWave` (`yeet-dispatch/v1`) | `CLI/commands/Yeet/internal/Remediation.ts:109` | repair-session wave per head | — | start/queue/duplicate | head SHA |
| `FlakeQuarantineIncident` / `FlakeQuarantineArtifact` | `CLI/commands/Quality/internal/FlakeQuarantine.ts:176` / `:211` | quarantined failure | — | quarantined | task |
| `QaInventory` / `QaFinding` (`qa-inventory/v1`) | `CLI/commands/Qa/Inventory.schemas.ts:474` / `:347` | findings, requiredCount per round | — | loop exits at requiredCount = 0 | round number, fix suggestion |
| `CiLaneTimingWindowReport` / `CiLaneTimingAttributionStat` | `CLI/commands/Ci/LaneTimings.ts:1463` / `:1353` | failures, cancellations, later-attempt outcomes | p50/p95 seconds | charter Pass/Breach | lane |
| `AdmissionJournalEvent` (union) | `CLI/internal/repo-run/AdmissionJournal.ts:569` | admitted/released/evicted | — | admitted | lease/ticket |
| `CoverageBaselineChangeSet` / `CoverageBaselineWritePlan` | `CLI/commands/Quality/internal/CoverageRegression.ts:568` / `:614` | row dispositions | — | replaced/held/added/pruned | package |
| research tombstone (JSONL, `beep.research.tombstone/v0`, **no TS schema**) | `research/ledger/tombstones/*.jsonl` | reaped | — | rejected + resurrect condition | originId |

None of these carries an RRSI **hypothesis** field. None combines ΔS, ΔC and accepted in one row. The closest is `AgentConventionComparison`, which would need `hypothesis` and `accepted` fields plus an append-only store to become the RRSI ledger.

---

## Gaps (no implemented analogue at all)

- **A (anneal)**: no budget schedule of any kind. Only a fixed cap of 1 surface per comparison (A1).
- **C (stall-triggered exploration)**: nothing. No stall detector and no diversification budget.
- **D (diff leakage critic)**: no code reads a candidate diff for benchmark-specific content or inert machinery. The nearest things are verifier-gaming guards (coverage floor lowering) and citation cross-checks.
- **E (measured noise band)**: all tolerances are fixed constants (ε = 0.001, or 0) or signature classes. Nothing reruns an unchanged baseline to estimate δ (graft and rg: no `noise band` hits in 5,512 indexed files).
- **F (cost-justified acceptance)**: ΔC is measured next to ΔS in `AgentConventionDifferences`, but no acceptance inequality exists.
- **G (gain-based pruning)**: exists only as the research-routine tombstone convention (`unactioned-3-runs`), which is data rather than code. Code pruning is reference-based (knip/fallow), not gain-based.
- **H (held-out/OOD split)**: no split. Same-window and same-controls discipline exists (H1, H2); held-out and OOD evaluation does not.
- **B** is partially implemented: component, ΔS and ΔC exist; hypothesis, accepted flag and a proposer-facing history do not.
