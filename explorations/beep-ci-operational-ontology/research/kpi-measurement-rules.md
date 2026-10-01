# KPI measurement rules v1 (ETL law) — final-grill rounds 2–3, 2026-08-27

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
