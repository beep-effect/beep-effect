# Epistemic Retention Policy Calibration

Lifecycle: `active`

Source: [`ops/manifest.json`](ops/manifest.json)

Prepare reproducible calibration evidence and a justified candidate retention
policy against the merged standalone report. Production activation requires
both accepted calibration evidence and separate explicit human approval.

This packet was explicitly launched by the user on 2026-10-28. Dataset access must be
independently authorized. Preparing or launching this packet, merging its PR,
or passing its tests does not approve production activation.

## Baseline and reading order

1. [SPEC.md](SPEC.md): normative scope and evidence/approval gates.
2. [PLAN.md](PLAN.md): phases and concrete exit criteria.
3. [GOAL.md](GOAL.md): execution launcher.
4. [Evidence contract](ops/EVIDENCE.md): dataset, evaluation and approval bundle.
5. [Source ledger](research/SOURCES.md): exact merged baseline and source limits.

Baseline: [PR #2322](https://github.com/beep-effect/beep-effect/pull/2322),
commit `732e11fd6dc417e5954b22fbbd856a026299ea50`.
The [predecessor runbook](../epistemic-memory-retention-projections/ops/REPORT.md)
remains authoritative for the shipped report. Its CLI uses the inert registry.

## Launch

```text
/goal follow the instructions in goals/epistemic-retention-policy-calibration/GOAL.md
```

## Current phase and evidence

P0–P2 are complete. Synthetic-only protocol and input hashes are frozen in ops/.
The native offline runner evaluated all five fields;
independent replay and sensitivity validation passed. See
[execution receipt](history/execution-v1.json),
[independent review](history/2026-10-28-independent-review.md) and
[run ledger](history/run-ledger.jsonl).
Independent G2 review accepted the insufficient-evidence verdict. P3/P4 exact-head
delivery gates remain open. Production approval is not requested.
No numerical production recommendation, approval or deployment is recorded.

Completion may conclude that the evidence is insufficient and recommend keeping
policy inert; an accountable negative result is a valid calibration outcome.
