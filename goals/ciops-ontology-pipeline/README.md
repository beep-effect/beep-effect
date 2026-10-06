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

P1 Stage C capture — complete 2026-10-06 (W3 `run4-fleet` and W4 `run4-ledger` pinned, the
first irreversible step; P0 complete 2026-10-05). Next: P2 projection on live data (W6 S7-v2
seam first, then W5 live replay and the `planEpisode` body).

## Latest Evidence

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
