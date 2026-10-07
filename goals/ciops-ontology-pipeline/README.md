# CI-Ops Ontology Pipeline

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Operate the ratified CI operational ontology as a pipeline: project live admission and wave-order data through the S7 engine, hold CQ regression green, ratify auditor run 4, and state the fleet time-to-certainty verdict.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/ciops-ontology-pipeline/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P3 auditor run 4 (W7) — complete 2026-10-06: run 4 ratified eight flagged accepts (`rat-071..078`) with
the gate PASSED at the pin before and after the scribe (#1490), and the lab's CQ-009 lift reports a typed
verdict (the same-checkout arm holds with 0 pairs; the legacy-origin-drain arm is unobservable in the
journal) under P3 close Rulings 33–35. P0–P2 complete. P4, the KPI reading and verdict (W8–W9), opened
2026-10-06 under its launch sitting (Rulings 1–12, from `research/p4-survey.md`): the KPI ETL lands in
`apps/labs/ciops/src/kpi/` (PR-A), then the verdict beside time-to-certainty's M1 (PR-B). W8 landed
2026-10-06 (PR-A, Rulings 13–16): `research/kpi-reading.md` is the generated reading; its normative
starvation count is nonzero (a lawful failing report), the seat-request clock opens no episode on the
pins, and TierCiMergeGreen is unmeasured.

## Latest Evidence

- 2026-10-06, W8: `apps/labs/ciops/src/kpi/` folds the `run4-fleet` pin, the two admission sources, the
  change-event ledger and the committed adoption table (each by path and sha256) into
  `research/kpi-reading.{json,md}` (`ciops-kpi-reading/v1`): nearest-rank P50/P95 cut and uncut per
  slice and tier, censoring counts, the declared 120000 ms starvation bound (165 of 473 requests in W
  beyond it: a lawful failing report), the M1-replica on W-a, CQ-012 void (7 of 21 decompose) and the
  change-event partitions with #1427 on the local series. P4 Rulings 13–16 in `research/decisions.md`.
- 2026-10-06, P3 close: `apps/labs/ciops` reports CQ-009 as a typed `Cq009Verdict` over the replayed
  active set (same-checkout arm holds, 0 pairs across 200 grants; legacy arm unobservable with its census;
  censorship line) in `research/s7-live-replay-evidence.md`; CQ-009's same-checkout branch is scoped to
  current-protocol grants with a `rows_eq_0` drain-window fixture (CQ suite `3eed0c3f73de`).
- 2026-10-06, W7: auditor run 4 (`orun-2026-10-06T15:51:01Z`, pin `71c7357adc`) ratified eight
  flagged accepts (`OperationalChangeEvent`, `WorkUnitExecution`, `CommittedFailure`; reuses of
  `VerificationAttempt`, `SeatRequest`, `SeatGrant`, `admissionChargeTokens`, `VerificationLane`) and
  withdrew six with named evidence; index 342 rows, unresolved 54/198 = 27%; gate PASSED at the pin
  before and after the scribe; S5/S6 projection green. Rulings 18–32, calls ae–aj and the P4 hand-off
  in `research/decisions.md`; run report in the exploration's `research/run4-lanes/p3-run4-report.md`.
- 2026-10-06, W5+W6: `apps/labs/ciops` plans the 33-lane gate-order handoff by path and sha256
  (`LanePlanProposal`, provisional `ciops-prov:` lane vocabulary, S7 contract §8) and replays the
  pinned canonical journal with surrogate custody (`research/s7-live-replay-evidence.md`: 197/200
  live, 41/41 golden, CQ-009 out of scope); P2 Rulings 1–10 and calls u–ee in
  `research/decisions.md`; lane reports `research/run4-lanes/p2-{w5,w6}-report.md` in the exploration.
- 2026-10-06, W3+W4: `corpus/run4-fleet/` (937 files, 260 checkouts, 11,179 events) and
  `corpus/run4-ledger/` (9 ledgers, 8,082 rows, gate holds: C4.1 checked, 3,628 post-cut pre-push
  facts, merged-preview dormant) pinned by the new sibling generators under P1 Rulings 1–8; lane
  reports in `explorations/beep-ci-operational-ontology/research/run4-lanes/stage-c-*-report.md`.
- 2026-10-05, W1: `research/SOURCES.md` §4 refreshed against `8b7392fe00`; 39 change-event rows
  backfilled into `explorations/beep-ci-operational-ontology/research/control-interventions.yaml`
  (42 rows) by the reproducible query in `research/scripts/w1_lever_query.sh`, under P0 Rulings
  2–7; protocol, census and exclusions in `research/w1-lever-query.md`.

## Notes

- Graduated 2026-10-01 from
  [`explorations/beep-ci-operational-ontology`](../../explorations/beep-ci-operational-ontology/README.md);
  its `BRIEF.md` and `MAP.md` are the shaped pitch and the decomposition.
  "Graduation Ruling n" is Ruling n of that packet's 2026-10-01 graduation sitting. New
  rulings land in [`research/decisions.md`](./research/decisions.md).
- The ontology tree and `research/scripts/**` stay under the exploration; this goal owns them
  by back-link (graduation Ruling 7). `ontology/extraction/**` is byte-immutable.
- Run 4 waits on the graduation Ruling 1 gate as amended by P1 Rulings 1–2 (2026-10-05):
  time-to-certainty C4.1 checked plus post-#1321 pre-push proof-ledger facts in the fleet's
  owning-clone ledgers; the merged-preview legs stay flagged beside the C4.2 legs.
