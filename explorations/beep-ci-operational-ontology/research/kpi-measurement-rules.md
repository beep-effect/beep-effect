# KPI measurement rules v1 (ETL law) — final-grill rounds 2–3, 2026-08-27

The binding rules for computing the packet's ONE KPI — fleet-aggregated P50/P95
time-to-certainty per verification episode. Every number the packet publishes obeys
this document; a number that can't state which rule produced it is not a KPI reading.
The first-cut baseline ([kpi-baseline-2026-08-27.md](./kpi-baseline-2026-08-27.md),
probe `scripts/kpi_baseline_probe.py` v3.1) predates some rules and says so inline;
v2 of the probe conforms fully.

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

- The attempt-journal vein is a RING BUFFER (newest ~50 attempts/branch,
  `AttemptJournal.ts`): every figure is RETAINED-WINDOW-RELATIVE and the report says
  so. History beyond retention is evicted, not absent — no negation, no "never
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
  (tickets/leases) for queue instants, `gh` run data for CI waits.
- Every aggregate names its probe version, flags, resolved roots, and snapshot
  instant; perishable inputs are snapshotted under `evidence/` with digests before
  they self-erase (the ring buffer waits for no one).

Reproduction: `uv run python scripts/kpi_baseline_probe.py --help` (v3.1 flags:
`--modes`, `--exclude-bounces`, `--max-episode-hours`, multi-root).
