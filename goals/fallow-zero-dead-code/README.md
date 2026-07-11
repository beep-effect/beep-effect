# Fallow Zero Dead-Code

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

### Closeout reconciliation (2026-07-11)

The work shipped weeks ago but the packet paperwork drifted. PR #229
(`feat/fallow-zero-dead-code`) merged to `main` on 2026-06-11 (merge commit
`c25dc13663`), including the review-comment fix commit `8e9483aea7`: dead-code
findings driven to zero, regression baseline reset to zero, and the dead-code
plus audit lanes promoted to blocking pre-push (fqe-005/fqe-006 closed). The
manifest still showed P4 Close as `in-progress`; this reconciliation flips P4
to done and marks the packet `completed-retained` to match the git evidence.

## Mission

Drive the Fallow dead-code lane to a true zero (fix all verified true
positives, eliminate false positives via config only), re-baseline at zero,
promote the dead-code and audit lanes to blocking pre-push proof (closing
fqe-005/fqe-006 in `goals/fallow-quality-enforcement`), and land it all as a
mergeable PR via the normal yeet path.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/fallow-zero-dead-code/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`research/triage.md`](./research/triage.md) - verified per-finding
   verdicts (20 true positives / 41 false positives) and locked policies.
5. [`tasks/tasks.jsonc`](./tasks/tasks.jsonc) - ranked task inventory
   (fzd-001..fzd-006).
6. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
7. [`history/`](./history/) - review rounds and closeout evidence.

Related packet: [`goals/fallow-quality-enforcement`](../fallow-quality-enforcement/)
owns the authoritative feature matrix, knip parity matrix, and the heavy
validators; this packet updates those artifacts and completes its seeded
tasks fqe-005/fqe-006.

## Current Phase

Closed. All phases (P0-P4) are done: fallow dead-code reports
`total_issues: 0`, the regression baseline is zero, the dead-code + audit
lanes are blocking in `quality github-checks pre-push` (fqe-005/fqe-006
closed), and the work merged to `main` via PR #229 on 2026-06-11.

## Latest Evidence

- [`reports/clean-runs.md`](./reports/clean-runs.md) (2026-06-11): 3
  consecutive clean runs of both promoted blocking lanes plus contract-check
  proofs.
- [`research/triage.md`](./research/triage.md) (2026-06-11): all 61 findings
  verified (20 true positives, 41 false positives).

## Notes

- 0 means 0: no exception lists, no inline suppressions, no `apps/**`
  blanket ignore.
- Knip stays blocking in this packet (`keep-knip`); retirement is a future
  packet once fallow has a clean blocking track record.
- Dupes (930 clone groups) and health (209 over-threshold functions) stay
  advisory with measured ratchet baselines recorded in the feature matrix.
