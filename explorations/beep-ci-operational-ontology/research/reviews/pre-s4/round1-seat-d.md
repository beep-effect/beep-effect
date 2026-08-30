# Round 1 Seat D — adversarial admission-law attack

Attack frame: a Must CQ dies unless deleting it changes a projection
`(T-Box, A-Box, live) → WorkUnit schedule` decision in one of R3's four
mechanisms (admission, DRR scheduling, stopping, cache validity).
Measurement-only Musts and unqueryable mechanisms are the freeze hazard.

## Findings

- [BLOCKER] CQ-019 — the admitted invariant is not the fail-open law — argument: R4-deep / notes require fail-open → epoch-invalidating *full* scope, never a *filtered* schedule. The SPARQL flags *any* `Proof` with `scopedByComputation` on a `FailOpenOutcome`, so an honest full-scope remap goes red, while a filtered schedule with no `scopedByComputation` (and no `Proof` yet) stays green. Frozen as law, the suite either certifies the lie S7 can still emit or rejects the remap it demanded. Notes say "proof or schedule"; the query has no schedule individual.

- [BLOCKER] suite vs R3 stopping — no CQ admits cancellation — argument: R3's third mechanism is: classify a failure as actionable, then cancel obsolete in-flight WorkUnits the moment the agent is committed to a new tree. No Must/Should asks which WUs are obsolete, whether the failure is actionable vs flaky, or whether cancel is cheap (Pants-pure) vs dirty (yeet locks / cache writes — R4-deep open Q). S4 will not extract those terms; S5 will kill them as CQ-less; S7 still has to decide them. Green CQ regression would then certify a T-Box that cannot stop.

- [BLOCKER] suite vs R3 admission≠scheduling — DRR next-pick is unqueryable — argument: CQ-002 (`admissibleFor`) and CQ-010 (`admittedBy` / `maxGrantCostMs`) are admission. UC-002's actual schedule decision is per-agent FIFO + carried deficit + cost quanta, and R4-deep forbids encoding jump-to-front *priority* as that deficit. Nothing queries ready-set, deficit, quantum, or "selected by deficit vs priority override." SeatRequest is glossary-smuggled off CQ-008 without being in its `required_classes`. Fairness terms cannot survive "decision-relevance or death"; S7 cannot implement the locked scheduler without breaking the admission law.

- [BLOCKER] CQ-009, CQ-010, CQ-019 — zero-rows prove absence only over asserted triples — argument: CQ-009 is green if no `ActiveGrant`/`occupiesCheckout` facts exist; CQ-010 is green if `p95Ms`, `admittedBy`, or `hasBudget` are missing (the FILTER never sees an oversize packet); CQ-019 is green if `AffectedComputation` individuals, typed `FailOpenOutcome`, or `scopedByComputation` are omitted. S6 completeness preconditions that must be *enforced*, not hoped: (9) every live lock-holder is a SeatGrant with `occupiesCheckout` + `hasGrantState`; (10) every admitted WU has a p95 estimate and a budgeted grant; (19) every affected-scoped Proof *and* emitted schedule is linked to an AffectedComputation whose outcome is a closed typed enum (fail-open included). Without those, constraint CQs launder empty A-Boxes as invariant-holding.

- [WARN] CQ-012 — Must badge on a derived ratio of CQ-007 — argument: deleting CQ-012 changes no admission/schedule/stop/cache decision. `lockWaitMs` and `timeToCertaintyMs` already enter via CQ-007. Demote or drop before S4 mints a second KPI class around a SUM.

- [WARN] CQ-001 `LaneKind` — catalog, not a four-mechanism input — argument: deleting the *kind* taxonomy leaves `requiresLane` / `executesLane` (CQ-002, CQ-006, CQ-017), costs (CQ-003), hash surfaces (CQ-011), and `TurboDaemon` as a `ContendedResource` (CQ-008). Kind does not change which WU is admissible, next, cancelled, or reusable. Lane *existence* is already implied by those CQs; freeze LaneKind and S4 will extract a T-Box split the projection never branches on.

- [WARN] CQ-018 Could vs CQ-013 Must — fail-fast order is not Must-admitted — argument: R3 serial order is `p_i/c_i`. CQ-013 Must only joins `surfacedByLane` to *lane* p50; it never asks delay-to-certainty or probability. The probability term is CQ-018 Could (`estimatedFailureProbability`, external). S4 can extract signatures and still have no legal term for the ranking UC-001's projection is specified to emit. Either promote a p/c-order CQ to Must or admit CQ-013 is not the scheduling question it pretends to be.

- [WARN] KPI episode-boundary gaming — no CQ or measurement rule binds episode identity — argument: locked KPI is fleet P50/P95 time-to-certainty *per verification episode*. Concrete games the suite would still go green on: (1) start the clock at first *attempt* not first *seat request* so queue wait vanishes (CQ-007 NL lists queue wait; SPARQL/glossary omit `queueWaitMs`); (2) exclude lock-bounces from episode opening (S0 fleet ETL already does this — 17% of attempts dropped from the clock while CQ-012 reports lock share only inside surviving episodes); (3) drop episodes ≥24h from the distribution (S0 `<24h` cut already censors the tail P95 is supposed to show); (4) close at local green and open a new episode after repair so `repairGapMs` never accumulates. CQ-007/012 `non_empty` cannot catch any of these.

- [WARN] KPI tier-downgrade laundering — no stratification CQ — argument: kpi-shape says repair / local-full / CI-merge are three certainties. A projection that targets `TierRepairGreen` (or reports mixed tiers as one fleet P50) stops the clock earlier; merges/day and CI-merge P50 can stay flat. CQ-006/017 know the tiers; nothing requires KPI aggregation to be partitioned by `targetsTier`. Sibling of the known batching-vs-merges/day caution; this one is cheaper and already latent in S0 ("episode end uses local green").

- [WARN] KPI red-attempt suppression / skip-laundering — argument: journal lanes are `passed|failed|not-run`. An episode can skip the lane that would have gone red, assert repair-green, and shrink P50. No Must asks which `requiresLane` obligations were `not-run` at episode close, or what fraction of journal attempts were excluded from the KPI set. CQ-013 only sees signatures that *were* surfaced.

- [WARN] cache read/write × local/remote/worktree — missing CQ for a live S7 decision — argument: R4-deep: `--force` still *writes*; disable-cache must name those axes. CQ-005/015 ask validity and transferability, never posture. Projection can skip reads (looks like a fast episode) while writing a proof that poisons other checkouts' `SharedCache`, or skip writes and export cache-miss latency onto the fleet. No CQ would catch it.

- [WARN] cost-estimate vs actual charge — DRR game with no CQ — argument: R3: admit on conservative estimate, charge actual, turn error into deficit debt/credit. CQ-003 is estimate-only; CQ-010 compares p95 to `maxGrantCostMs`. An agent that systematically underestimates still gets the grant; nothing queries actual-minus-estimate. That is an admission/scheduling decision, not a KPI nicety.

- [WARN] Won't "IDE on save" — hides a Proof-source dependency the Musts assume — argument: safe *not* to model save-hooks as lanes. Unsafe that CQ-006 will treat any `Proof` as `dischargesObligation`. Nothing requires the discharging run to be an in-scope yeet/CI `VerificationLane`. An out-of-scope IDE-green (or a minted Proof with no run) silently closes remaining obligations and stops the episode clock. S6 must close the Won't with a shape: Proofs admitted only from in-scope lane executions. The other two Won'ts hold: dollars are not the DRR currency (wall-ms is); cross-repo generalization is correctly out.

## Attacks that failed (suite held)

- CQ-002 / CQ-010 — admission of (lane × scope) under tier + MaxGrantCost is load-bearing; deleting them changes the grant.
- CQ-003 — cost is the DRR quantum and the CQ-010 packet size; not bloat.
- CQ-004 — affected closure is the scope input; without it the DAG is full-repo-or-guess.
- CQ-005 / CQ-011 — cache validity and blast radius are the rebuilder; overlapping but not redundant (filter vs function).
- CQ-006 remaining-obligation half — green-episode stopping ("nothing left to run"); held-tier *label* is cosmetic, the missing-lane set is not.
- CQ-008 — live grant/contention state is the other half of admission (can we grant *now*).
- CQ-013 as "which yeet lane can surface this signature" — that fact is an input to fail-fast even if p/c is missing.
- Won't-dollars — v1 scalar is machine-ms; $ would be a second currency the projection does not decide.
- Won't-cross-repo — closed-world is the reasoning-stack ruling; deleting it would not add a scheduler branch.
- Batching-vs-merges/day — already known; not re-raised except as cousin of tier-laundering.
