---
title: "Slice 19: empty-leg runner-minutes and local publish and verify in the certainty report"
date: 2026-11-27
kind: checkpoint
lane: "feat/certainty-scorecard-slice-19"
reversal: "Delete this checkpoint so the slice-18 checkpoint is the latest PLAN status note, and revert the slice-19 PR."
---

Slice 19 (decision `criterion-2-rows-built-into-certainty`) adds the last two rows of SPEC "Numbers the scorecard reports" to `beep ci certainty`, in its JSON report and its aggregates-only summary.

- `emptyLegs` (ROUT-01): empty-leg runner-minutes per code-head check.yml run. Each run goes through the cost ledger's own fold (`foldCiLedgerRun`), so the (lane, partition) join to `Test Plan` is the ledger's, not a copy of it. The capture reads each window run's Test Plan and catch-all partition logs through `readCiLedgerRunLogs`, which `beep ci ledger` now reads through too, and stores them on the run as `ledgerLogs`. The log reads come after every job read and are charged to `--max-requests` before they are sent. A run whose reads the bound refuses keeps no logs, so its legs are undetermined. A log read can never make a head api-partial. The row reports runs, undetermined runs and empty legs beside the distribution. Undetermined runs are left out of the distribution, not counted as zero.
- `localProof` (`local-proof-under-ten`): local publish and verify on the fleet census, with attempts, measured and censored counts and p50 and p95 minutes. The row is always present. With `--fleet` the capture folds this workstation's journals through `collectYeetEconomicsReport`, the fold behind `yeet economics --fleet`, into the corpus's `fleetLocalProof`. Without it, as on the hosted nightly, the row is `not-read`: n=0, every run censored, and the reason that the hosted runner cannot read workstation journals and the source of record is `beep yeet economics --fleet`.
- "Not covered" no longer lists local publish and verify. The fleet-host item now says `--fleet` reads this workstation's checkouts and T3 lanes, never the remote hosts.

Corpora captured earlier still decode. Their runs carry no `ledgerLogs`, so their legs read undetermined. The admission gate is `ci-certainty.test.ts` with `ci-cost-ledger.test.ts` and the economics suites, passing on Node and Bun. `Certainty.ts`, `Certainty.schemas.ts`, `CostLedger.ts` and `CostLedger.schemas.ts` are at 100% file-scoped coverage. This is a CLI change only and the nightly workflow is unchanged. Each night now reads about two more logs per code-head check.yml run. Criterion 2 stays unticked until the first nightly after this merge shows every row.
