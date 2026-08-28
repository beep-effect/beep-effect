# Round 1 triage — pre-S4 quality loop (2026-08-27)

Panel: seats A (codex/max, CQ answerability), B (codex/max, coherence), C (codex/max,
KPI+contract), D (grok/xhigh, adversarial). Round 0 (mechanical) ran first: 0 blockers.
Fixer: Fable. Disposition legend: **FIXED** (applied this round), **GRILL** (operator
decision queued — see the round-1 frontier), **S5/S6/S7** (deferred to the named stage
with a recorded carrier), **REJECTED** (with reason).

## Round 0

| Finding | Disposition |
|---|---|
| "provisional" prefix annotation contradicted namespace ruling | FIXED (CQ header, orsd, scope) |
| Property count drift (38 vs actual) | FIXED (README, memory; ORSD census now 28/41→46 after admissions) |
| Probe silent all-zero on wrong root | FIXED (exit 2 + stderr; v3 echoes resolved roots) |
| Admission-law warns: `Scope`, `SeatRequest`, `Agent` CQ-less | GRILL (B verdicts: admit each with a new CQ) |

## Seat A (11 BLOCKER / 6 WARN)

| Finding | Disposition |
|---|---|
| Global-vs-parameterized queries (CQ-002/004/005/006/011/012/014/015) | FIXED — parameter-binding convention added to suite header; VALUES `# harness binds` blocks in all 8 |
| CQ-004 missing touched packages + hash-surface clause in NL | FIXED — UNION includes touched; NL scoped to dependency closure, radiation delegated to CQ-011 |
| CQ-006 obligations uncorrelated to tree/epoch; held tier unbindable | FIXED — correlated to given tree×epoch; held-tier = documented per-tier iteration; TreeState/CacheEpoch/provesTree/validInEpoch added to requireds |
| CQ-007 queue wait absent | FIXED — `queueWaitMs` admitted (Must CQ requires it) |
| CQ-007/010 derivation_method mislabels | FIXED — relabeled with external-computation / query-level notes |
| CQ-008 returns released grants | FIXED — fixed-domain VALUES restriction (Active/Waiting) |
| CQ-011 no window | FIXED — `occurredAt` admitted; xsd:dateTime window binding |
| CQ-012 no window/fractions | FIXED — `episodeStartedAt` admitted; in-query shares via SUM division |
| CQ-013 no ranking, earliestLane unbindable | FIXED — `attributedDelayMs` admitted (ETL-computed); cheapest-lane selection in-query; NL reshaped |
| CQ-014 no branch criterion | FIXED — `hasCurrentEpoch` admitted (TreeState→CacheEpoch) |
| CQ-015 unbound existential ASK | FIXED — proof + other checkout caller-bound; origin-checkout modeling deferred (no CQ needs it) |
| CQ-016 promises distributions it can't bind | FIXED — NL reshaped to partition point; ETL boundary documented; sample now bindable |
| CQ-017 half the asymmetry map | FIXED — UNION both directions, `?onlyIn` projected |
| CQ-019 inventory+constraint fused | FIXED — constraint-only NL; inventory = documented diagnostic |

## Seat B (11 BLOCKER / 9 WARN / 1 NIT)

| Finding | Disposition |
|---|---|
| orsd/scope still "provisional" | FIXED |
| ORSD purpose-KPI missing tier/epoch coords | FIXED |
| scope.md cheap-gates conflated into CertaintyTier | FIXED — YeetProofTier declared a distinct domain; mapping = S4 extraction question |
| ORSD blanket lever ban vs control interventions | FIXED — exception stated |
| Stale censuses (Must count, glossary counts) | FIXED |
| Agent-row traceability claim | FIXED (ORSD wording; Agent admission GRILL) |
| Six prose unions need closed domains | FIXED — `literal-domains.md` authored |
| ScopeKind member spelling | FIXED — glossary spellings canonical |
| SharedCache punning collision | FIXED — members are individuals; no punning ruling recorded in literal-domains.md |
| "admission law" term misuse (WorkUnit note) | FIXED |
| GrantState union placement (NIT) | FIXED |
| Agent note overreach | FIXED |
| UC-001 rival-objective goal | FIXED — reframed as scheduling heuristic serving the KPI |
| UC-001 missing CQ-010; ordering un-covered | FIXED (CQ-010 added); ordering CQ = GRILL |
| UC-002 fairness promises with no CQ | GRILL (SeatRequest/queue CQ) — promise annotated in UC meanwhile |
| UC-003 missing CQ-019 | FIXED |
| UC-005 ranking promise | FIXED — ranking = ETL over CQ-016 partition points, stated in UC |
| Traceability rows drift both directions | FIXED — policy ruled (`ontology_terms` = requireds), regen script committed, matrix regenerated |
| Admission verdicts: Scope / SeatRequest / Agent → admit-with-CQ | GRILL |

## Seat C (4 BLOCKER / many WARN / 1 NIT)

| Finding | Disposition |
|---|---|
| Journal is a ring buffer (RETAINED_ATTEMPTS=50), not append-only | FIXED — baseline + probe docstrings corrected; retained-window caveat on all numbers; memory update queued |
| Right-censored red streaks silently dropped | FIXED — probe v3 reports censored streaks (this checkout: 3 branches, 59 red attempts, max 1.5h open) |
| Fleet v0.5 numbers not reproducible from committed probe | FIXED — probe v3 grew the fleet flags (`--modes/--exclude-bounces/--max-episode-hours`, multi-root); exact invocation documented |
| schemaVersion unvalidated / attemptId dedupe / sort key / silent-default root / estimator unnamed / verify-row omission / zero-elapsed inconsistency | FIXED in probe v3 + baseline doc |
| Episode decomposition undocumented | FIXED — measurement-rule caveats section added; full decomposition = CQ-007/012 v1 |
| Unmatched starts uncounted | FIXED — counted and printed |
| v0-limitations scoping (NIT) | FIXED |
| 15-item S4 lane-contract gap checklist | FIXED — `ontology/docs/s4-lane-contract.md` authored covering all 15 |

## Seat D (4 BLOCKER / 9 WARN)

| Finding | Disposition |
|---|---|
| CQ-019 wrong invariant (honest full-scope remap goes red) | FIXED — `scopedByComputation` defined as "trusts the affected set of"; honest remaps carry no edge; S6 completeness preconditions recorded in CQ notes |
| No stopping/cancellation CQ | GRILL (scheduling-trio admission) |
| DRR next-pick unqueryable; SeatRequest smuggled | GRILL (same) |
| Zero-rows vacuity (CQ-009/010/019) | S6 — completeness preconditions recorded in CQ-019/CQ-006 notes; SHACL shapes are S6 deliverables; validation named in lane contract |
| CQ-012 derived-ratio Must badge | REJECTED as demotion, ACCEPTED as repair — CQ-012 now computes the full share decomposition in-query over a window (no longer a trivial SUM duplicate); window/shares are the lever-attribution instrument |
| CQ-001 LaneKind not a mechanism input | REJECTED — LaneKind partitions cost/scope semantics S4 extraction keys on (turbo task vs script lanes hash differently); revisit at S5 with extraction evidence |
| Fail-fast p/c order not Must-admitted | PARTIAL FIX (`attributedDelayMs` on CQ-13) + GRILL (full ordering CQ) |
| KPI episode-boundary games (queue-wait vanishing, bounce exclusion, <24h cut, repair-gap splitting) | FIXED partially (queueWaitMs admitted; censorships now documented as such in baseline) + GRILL (measurement-rules codification) |
| Tier-downgrade laundering | GRILL (measurement rules: tier-partitioned KPI reporting) |
| Red-attempt suppression / not-run laundering | GRILL (measurement rules; CQ-006's in-scope-lane precondition helps) |
| Cache read/write × local/remote posture unqueryable | GRILL (Should-CQ candidate) |
| Cost actual-vs-estimate uncharged | GRILL (Should-CQ candidate) |
| Won't-IDE hides Proof-source hole | FIXED — CQ-006 note: dischargesObligation only from in-scope lane executions, SHACL at S6 |

## Net artifact changes this round

Suite: 19 CQs (14 Must / 4 Should), 18 tests regenerated, all parse; glossary
28 classes / 46 properties / 4 individuals (5 properties admitted, each via an existing
Must/Should CQ); binding convention ruled; traceability policy ruled + regen script
committed; literal-domains.md + s4-lane-contract.md authored; probe v3 + baseline
corrections. Round-0 checker re-run: 0 blockers, 3 warns (all GRILL-pending).

## Round 2 plan

Grill frontier first (its outcome changes the suite again), then one delta round:
seats A/B/C re-review changed surfaces + any grill-admitted CQs; seat D re-attacks the
post-grill suite. Round 3 only if round 2 surfaces blockers. Cap holds.

## Addendum — external partner review (received after the round-1 fixer pass)

Full text: [`round1-partner-review.md`](./round1-partner-review.md). It reviewed the
MID-FLIGHT packet, so much of it independently converges with fixes already applied
(S4 lane contract, queueWaitMs, probe schema/dedupe/censoring/estimator, traceability
regeneration, CQ parameter binding — all FIXED above before receipt). Dispositions for
what is genuinely new, with local verification status:

| Partner finding | Verified? | Disposition |
|---|---|---|
| A1/B8/B9 — PR #870 (weighted admission scheduler) merged 2026-08-27T19:52:03Z, `debbbb51f7`; packet branch predates it (merge-base `6041ec475a`); DRR prose risks masquerading as runtime truth | VERIFIED (gh pr view 870; git ls-tree origin/main; QualityScheduler.schemas.ts LiteralKits) | FIXED — baseline re-labeled pre-intervention with #870 as first ControlIntervention; UC-002 deployed-vs-prospective note; s4-lane-contract corpus pin (>= debbbb51f7) + unit 7 (admission-scheduler); GRILL frontier Q1 reshaped (extract deployed vocabulary, label DRR prospective); rebase-before-S4 added to manifest openQuestions |
| A5/B10 — TurboQuery.ts drops affected-reason `__typename` at the plan-task boundary; affected collection repair-mode-only | VERIFIED (TurboQuery.ts:221-231, :54) | FIXED (packet side) — ingestion caveat in s4-lane-contract; repo fix spawned as background task chip (preserve `affectedReason` through TurboPlanTask) |
| B11 — CQ-015 same-epoch+shared-cache is necessary-not-sufficient; task-hash equivalence required | VERIFIED (turbo.json global.inputs + per-task inputs) | FIXED — CQ-015 note: CacheEpoch identity must pin at task-hash granularity at S4/S5 |
| Manifest `openQuestions: []` while the grill frontier is open (control-plane defect) | VERIFIED | FIXED — manifest now lists the 5 open questions |
| CQ-019 split (019A inventory / 019B scope-narrowness `FILTER ?scope != FullRepoScope`) — structurally stronger than the edge-convention repair applied in round 1 | Design judgment | GRILL/ROUND-2 input — the 019B form needs subject `hasScope` modeling, which lands with the ScheduleProposal ruling; adopt then |
| Negative/metamorphic fixtures (delete-a-required-fact-must-go-red; unrelated-proof monotonicity; safe-remap-accepted) | Design judgment | S6 — adopted as the S6 SHACL/fixture posture; named in CQ-006/019 notes and the lane contract validation section |
| Survival-analysis treatment of censoring | Design judgment | v1 ETL — probe v3 already reports censored streaks separately; estimator upgrade deferred |
| Source-freeze command bundle (worktree snapshot, digest manifest, ignore proof) | n/a | Adopt at packet commit/yeet time |
| "beep-effectexploration repo not found" | n/a | Artifact of the reviewer's own request context, not a packet defect |

Independence note (its B12): the partner shares no corpus with the four seats and still
converged on A's answerability class, C's KPI defects, and D's vacuity attacks — that is
genuine cross-model corroboration, not shared-omission consensus.
