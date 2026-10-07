# KPI measurement rules v1.2 (ETL law) — final-grill rounds 2–3, 2026-08-27

Version: v1.2 (v1 2026-08-27; v1.1 amendment §6, 2026-10-01; v1.2 amendment §7, 2026-10-06).

The binding rules for computing the packet's ONE KPI — fleet-aggregated P50/P95
time-to-certainty per verification episode. Every number the packet publishes obeys
this document; a number that can't state which rule produced it is not a KPI reading.
Probe conformance, stated honestly (round-3 H-13 killed a phantom "v2 conforms"
sentence): the committed probe is `scripts/kpi_baseline_probe.py` **v3.2** — it
implements §3 censorship reporting and §4's TRUE nearest-rank estimator (fixed in
v3.2; v3.1's `round(p*(n-1))` was not nearest-rank), but does NOT yet implement §1's
seat-request clock, §2's tier partitioning, or the cut+uncut dual report — those are
the durable ETL's obligations (labs-incubated), and any number published before it
exists must name which rules its probe version skips.

## 1. Episode identity

- **Unit of account**: one `(checkout, branch)` red streak — from the opening instant
  to the attempt that establishes the target assurance tier. Cross-checkout branch
  collisions are distinct episodes (round-2 seat F: fleet probes MUST key on the pair,
  never branch alone).
- **The clock opens at seat request** (final-grill round 3, now that SeatRequest is
  admitted): post-#870, the episode's opening instant is the first admission ticket's
  `enqueuedAtMillis` for the streak — queue wait is INSIDE the KPI, not before it.
  An episode with no admission ticket (pure repair loops below the scheduler) opens at
  its first attempt's `startedAt`.
- **Pre-#870 mapping** (no durable queue existed): the clock opens at the first red
  attempt's `startedAt`; `queueWaitMs := 0` is MATERIALIZED, and the mapping states —
  never hides — that bounce-era waiting wall time sits unlabeled inside episode
  duration. Pre/post decompositions are therefore not field-comparable at
  `queueWaitMs`; only total time-to-certainty compares across the boundary.

## 2. Membership and partitioning

- **Window membership** is by `episodeStartedAt` (CQ-012's contract). Decomposition
  shares are VOID unless `decomposedEpisodes = windowEpisodes` — the harness fails the
  run when they differ; report the pair, never the shares alone.
- **Tier partitioning**: report per target assurance tier (TierRepairGreen /
  TierLocalFullProof / TierCiMergeGreen); a fleet aggregate without tier partitions is
  a headline, not a reading.
- **Change-event membership is ADOPTION-QUALIFIED** (round-2 seat F): wall-clock
  `landedAt` is the series partition point, but a checkout is in the post-period ONLY
  when its HEAD ancestry includes the event's merge commit (adoption census:
  `evidence/journal-snapshot-2026-08-27/CHECKOUT_HEADS.txt` pattern). Merge time is
  never the fleet boundary — old binaries keep old behavior.
- **Observational vs causal labeling** (final-grill round 3): every partition-point
  comparison is labeled OBSERVATIONAL (OperationalChangeEvent) unless a supporting
  design (paired pre/post cohorts under adoption qualification, stated confounders)
  upgrades it; "the KPI moved after X landed" is never reported as "X moved the KPI"
  without the upgrade.

## 3. Censorship

- The attempt-journal vein is a RING BUFFER (exactly the newest 50 `attempt-started`
  events per branch-scoped run-id file per checkout — `RETAINED_ATTEMPTS = 50`,
  eviction drops everything before the 50th-newest start plus any torn trailing line;
  round-3 J W7 precision): every figure is RETAINED-WINDOW-RELATIVE and the report
  says so. History beyond retention is evicted, not absent — no negation, no "never
  happened" claims over it (closed-world.yaml declares this vein open-world).
- **Right-censored episodes** (red streak still open at snapshot, or opening truncated
  by eviction) are REPORTED, not dropped: publish BOTH the cut distribution (censored
  excluded) and the uncut distribution (censored included at their observed lower
  bounds), with the censored count beside each percentile set.

## 4. Estimators and reporting

- Percentiles use the **nearest-rank** estimator (named in every report; no
  interpolation).
- **Starvation is reported BESIDE percentiles, never inside them** (final-grill
  round 2; review 2's 96-fast/4-starved counterexample): each report carries the count
  of seat requests beyond the declared starvation bound without a modeled exception
  (CQ-023's population) next to the P50/P95. A good P95 with a nonzero starvation
  count is a failing report.
- Bounce attempts (pre-#870 lock-contention bounces) are excluded from episode
  OPENING (`--exclude-bounces`) but their wall time inside an open episode stays
  counted — stated per §1.

## 5. Sources and provenance (NFR-5)

- Veins: `.beep/yeet/runs/*/attempts.ndjson` (yeet-attempt-journal/v1),
  `verdict.json` (last-write-only — never a history source), the #870 admission store
  (tickets/leases) for queue instants, `gh` run data for CI waits. Per-lane wall cost
  is `verdict.lanes[].durationMs` nested in `attempt-finished`; attempt-level
  `verdict.elapsedMs` covers the whole attempt (round-3 J-B2 — journal "step records"
  do not exist).
- **The admission store SELF-ERASES its handoffs** (round-3 H-05/J-B4, proven against
  the running scheduler): admission deletes the ticket file, completion deletes the
  lease, the lease body carries neither nonce nor enqueue time, and the ticket→lease
  linkage survives only in the lease FILENAME stem (`nonce-pid`). Consequences: queue
  wait for GRANTED work is not reconstructable from a single store snapshot — the ETL
  must either poll snapshots at a cadence finer than typical queue waits or wait for a
  scheduler-side admission-transition journal (recorded as a candidate repo
  improvement). Until then, §1's seat-request clock is computable only for episodes
  whose tickets were observed while queued; others fall back to attempt start, and the
  report says which clock each episode used.
- Every aggregate names its probe version, flags, resolved roots, and snapshot
  instant; perishable inputs are snapshotted under `evidence/` with digests before
  they self-erase (the ring buffer waits for no one).

Reproduction: `uv run python scripts/kpi_baseline_probe.py --help` (v3.1 flags:
`--modes`, `--exclude-bounces`, `--max-episode-hours`, multi-root).

## 6. 2026-10-01 amendment (v1.1)

Authority: DECISIONS.md, Ruling 10 (2026-10-01 graduation sitting). §1–§5 stay the
v1 text; where this section disagrees, it governs readings over journals written at
or after the changes it names.

- **Probe conformance.** `scripts/kpi_baseline_probe.py` v3.2 (flags `--modes`,
  `--exclude-bounces`, `--max-episode-hours`, multi-root) is the 2026-08-27 S0
  baseline instrument and reproduces that baseline. It reads only
  `attempt-started`/`attempt-finished`, so over post-#964 journals it miscounts
  `attempt-terminated` attempts as abandoned and cannot report left-censoring. A
  reading over current journals uses a reader that consumes `attempt-terminated` and
  `journal-compacted`: the durable ETL, or `bun run beep yeet economics --fleet`
  (#1239) as a named proxy.
- **§3 attempt retention (supersedes the ring sentence).** `RETAINED_ATTEMPTS = 50`
  counts TERMINAL attempts per run-id file (#978,
  `internal/repo-run/AttemptTerminationJournal.ts`). Eviction drops whole oldest
  terminal attempts and keeps unterminated ones. Every eviction writes
  `journal-compacted` (`evictedCount`, `evictedAttemptIds`,
  `terminalEvictionCutoffRecordedAt`; #964), so left-censoring is positively recorded.
  A terminated attempt counts as red.
- **§5 admission veins (supersedes the self-erasing bullet).** Handoffs no longer
  self-erase. The lease carries the ticket `nonce` and `enqueuedAtMillis` (#878). The
  admission transition journal (`internal/repo-run/AdmissionJournal.ts`, newest 200
  admissions retained) records `admission-admitted` with
  `enqueuedAtMillis`/`admittedAtMillis` (since #878), `admission-lease-evicted` (v2,
  #964), and `admission-enqueued` / `admission-withdrawn` / `admission-ticket-evicted`
  (v3, #1025, 2026-09-09). The seat-request clock is computable from v3
  `admission-enqueued` from #1025 onward, and for granted work from
  `admission-admitted.enqueuedAtMillis` from #878 onward. Earlier windows fall back to
  attempt start, labeled per episode. The owning-clone proof ledger
  (`.beep/yeet/proof-ledger.ndjson`, time-to-certainty ruling 71) is an issuance vein,
  never a KPI vein.
- **Mapping to time-to-certainty M1** (its rulings 73–75). M1 is red-to-green per
  branch from the first red's `startedAt`, over comparable modes
  (verify/repair/publish) with bounces excluded, cut at 24 h and uncut with
  right-censored streaks. It is left-censored by the compaction cutoff, treats
  terminated as red, keeps wrapper and inner lanes as separate populations, and
  reports no starvation. M1 is a PROXY: it opens at the first red attempt, not at seat
  request; it keys per branch, not per (checkout, branch); and it has no tier
  partitions. A reading here may cite M1 beside it, labeled, and never as this KPI.
- **Tier partitioning (graduation Ruling 10).** Merged preview reports as a
  sub-partition of TierLocalFullProof; §2's three-tier list stands until an auditor
  run ratifies a fourth AssuranceTier, which is proposed to run 4 (ratifying
  vocabulary outside an auditor run is a BRIEF no-go). The deployed `ProofStage`
  (`internal/repo-run/QualityScheduler.schemas.ts`, re-exported by `ProofFact.ts`) is
  `repair-loop | pre-push | merged-preview | hosted`, and `AdmissionWorkKind` includes
  `merged-preview`.

## 7. 2026-10-06 amendment (v1.2)

Authority: `goals/ciops-ontology-pipeline/research/decisions.md`, "2026-10-06 — P4
opened; launch sitting" (Rulings 2, 3, 6, 7 and 9), ruled by the orchestrator under the
operator autonomy charter and listed for the operator's asynchronous review. §1–§6 stand
except where this section says otherwise; it governs the W8 reading (the `CiOpsKpi`
service in `apps/labs/ciops/src/kpi/`, S7 contract §9). The rules below classify and
measure; none of them ratifies vocabulary.

Abbreviations: **FLEET** =
`ontology/extraction/s4/beep-ci-ops/corpus/run4-fleet/MANIFEST.yaml`; **TTC-D** =
`goals/time-to-certainty/research/decisions.md`; **ECON** =
`goals/time-to-certainty/research/scripts/economics.py`.

### 7.1 M1 keying erratum (supersedes one clause of §6's M1 mapping)

§6 says M1 "keys per branch, not per (checkout, branch)". That clause is wrong. M1
groups attempts by `(checkout, branch)`, as this KPI does (ECON:1421, :1434), and its
ruling keys by `(checkout, runId)` with a branch-derived `runId`, which is the same
partition (TTC-D:997). The remaining §6 differences stand: M1 opens at the first red
attempt's `startedAt`, not at seat request, and has no tier partitions.

### 7.2 Glossary: the two meanings of "cut"

- **Law cut / uncut (§3).** *Cut* = the distribution with censored episodes excluded;
  *uncut* = the distribution with censored episodes included at their observed lower
  bounds (§3, "Right-censored episodes"). The censored count sits beside each set.
- **M1 `comparable24h` / `uncut`.** M1's *cut* is a duration ceiling: `comparable24h`
  keeps closed episodes of at most 24 h; M1's `uncut` drops the ceiling but **still
  excludes right-censored streaks**, which M1 reports only as counts and an observed
  lower-bound sum (ECON:1536-1551; TTC-D:1003-1010).
- A reading names which sense it uses. The 24 h ceiling appears only in the
  M1-replica row (M1's definition run over the pinned fleet population, labelled "M1
  definition over the fleet pin, not M1"); this law's reading has no duration ceiling.

### 7.3 Tier assignment (ETL classification onto ratified tiers)

Each `attempt-started` row is classified by its deployed `stage` (`ProofStage`,
`packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts:194`),
with `proofTier` as a guard:

| Attempt start | Target tier |
| --- | --- |
| stage `repair-loop` (except `proofTier` `review-fix`) | TierRepairGreen |
| stage `pre-push`, `proofTier` `full` | TierLocalFullProof |
| stage `merged-preview` | TierLocalFullProof, merged-preview sub-partition |
| stage `hosted` | TierCiMergeGreen |
| stage `pre-push`, `proofTier` `cheap-gates`; any `proofTier` `review-fix` | **unassigned** (reported bucket) |
| no `stage` member | **untiered** (counted) |

- This assigns attempts to the three ratified tiers of §2 and the merged-preview
  sub-partition of §6; it ratifies no vocabulary. No ratified tier denotes "cheap gates
  passed", so cheap-gates is never TierRepairGreen, and a tier is never derived from
  `proofTier` alone (the refuted conflation:
  `goals/ciops-ontology-pipeline/research/decisions.md:1330-1335`).
- Merged preview is identified by **stage**, never by admission work kind: kind
  `merged-preview` is also written by any full proof carrying the CI-parity step
  (FLEET:37169-37189).
- Streaks are computed within each tier's attempt subsequence per `(checkout, branch)`.
- TierCiMergeGreen is reported **unmeasured**: no pin carries hosted input, and no
  pinned start has stage `hosted` (FLEET:37190-37213). Time-to-certainty's hosted
  workflow durations may be cited beside it as workflow durations, never as episodes.
- Stage-less starts predate the field (FLEET:37211-37213, `<absent>`); they are counted
  as untiered and never imputed a tier.

### 7.4 Clock rules (supersedes nothing; makes §1 operational)

- **Join.** An admission ticket joins an attempt by `attemptId`, checked against
  `branch` and the checkout label where the row carries them. A mismatch between the two
  admission sources (the `run4-fleet` canonical journal and the 2026-10-01 redacted
  snapshot, deduplicated by nonce and event tag) fails closed, never falls back.
- **Opening.** An episode opens at the earlier of its first attempt's `startedAt` and
  the `enqueuedAtMillis` of any ticket joined to that first attempt (§1, "the first
  admission ticket … for the streak"; a later attempt's ticket cannot predate the
  streak). v1 `admission-admitted.enqueuedAtMillis` counts as a ticket instant for
  granted work (§6).
- **Label.** Each episode carries its clock label, `seat-request` when a joined ticket
  set the opening, else `attempt-start`; the counts per label sit beside every
  percentile set.
  *Note of 2026-10-06 (the W8 reading; P4 Ruling 13).* On the pinned inputs every joined
  ticket's enqueue follows its attempt's `startedAt` (132 of 132 joins), so every episode
  opens at attempt start and the `seat-request` count is 0 in every row; the label is
  reported as that zero. W-b's role in §7.5 rests on the admission journal's completeness
  (every joined ticket's enqueue and resolution retained), not on this clock setting any
  opening.
- **Stop.** An episode stops at the closing attempt's `attempt-finished.recordedAt`,
  else its `startedAt` (M1's convention, TTC-D:999-1000). A reconciler-stamped
  termination (`legacy-unowned-start`, `owner-dead`, `stale-unverifiable-owner`) never
  ends a duration (TTC-D:1014-1018).

### 7.5 Censoring and survivorship

- **Right-censored.** An open streak's uncut lower bound is its last measured instant
  minus its opening: the last member's finish, else its start, and a reconciler-stamped
  termination's start (M1's convention, TTC-D:1006-1010).
- **Left-censored.** An episode is left-censored when a `journal-compacted` receipt's
  cutoff is at or after its opening (§6). The `run4-fleet` pin carries no receipt
  (every attempt source records `compaction_receipts: 0` and "wrapped: unknown unless a
  retained compaction receipt supplies evidence", e.g. FLEET:7740-7743), so streaks
  opening at the first retained attempt of an at-cap journal with no receipt are
  counted as **possibly truncated**. Receipts alone would claim a completeness the pin
  cannot show.
- **Survivorship.** Retiring a lane deletes its attempt journals, so an enqueue can
  name an attempt with no pinned journal. Such requests are **counted, never
  imputed**, by reason. M1 is subject to the same loss.
- **CQ-012 shares.** Queue-wait decomposition shares are reported only on the W-b slice
  (the canonical admission root's retained window, FLEET:2976-2978, where the
  seat-request clock is complete for joined episodes), and are printed as void, with
  the `(decomposedEpisodes, windowEpisodes)` pair, unless every episode in the slice
  decomposes (§2). An episode decomposes (P4 Ruling 14) when every attempt in it joins at
  least one admission ticket and every such ticket resolved; its queue wait is the sum of
  enqueue-to-resolution over those tickets, over the episode's uncut duration; a share
  above 1 voids the row.

### 7.6 The starvation bound (declared before computing)

- **Bound: 120000 ms.** It is the packet's only declared value
  (`ontology/tests/fixtures/seed.ttl:71`, `ciops:starvationBoundMs 120000`; CQ-023,
  `ontology/docs/competency-questions.yaml:616-623`), declared here before any reading is
  computed. A bound fitted to the observed distribution would be tuning to the reading.
- **Population.** Every v3 seat request enqueued in the window. A request's wait runs
  from its `enqueuedAtMillis` to its admission, withdrawal or ticket eviction, or to the
  capture instant if still open.
- **Exceptions.** The only modelled exception, the hard-floor exception, derives from a
  snapshot-global flag that no journal row records, so exceptions are reported as
  **unobservable** over history, never assumed absent.
- **Sensitivity rows.** Counts at 15 min (900000 ms) and 60 min (3600000 ms) are shown
  beside the normative count and are labelled non-normative.
- A nonzero count at the bound makes the report failing (§4). A failing report is a
  lawful verdict.

### 7.7 §5's self-erasing bullet (pointer restated)

§5's "The admission store SELF-ERASES its handoffs" bullet and its snapshot-polling
consequence are superseded by §6's "§5 admission veins" bullet: the
lease carries `nonce` and `enqueuedAtMillis`, and the admission transition journal
records enqueue, admission, withdrawal and eviction. No reading under this version polls
store snapshots.
