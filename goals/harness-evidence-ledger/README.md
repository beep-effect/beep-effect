# Harness Evidence Ledger

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Typed per-edit harness evidence ledger with config-fingerprint expiry,
retention-side pruning proposals, and an annealed-budget rerun of the SkillOpt
pilot.

A harness here means prompts + control flow + tools + skills/memory + context
management + subagents. The model is held fixed. The harness is what we edit.

## Why This Packet Exists

On 2026-09-25 we read RRSI (arXiv 2609.24972 v2, "regularized recursive
self-improvement" for agent harnesses). It is convergent prior art. This
repo's own packets predate it by two to eleven weeks:
`goals/agent-effectiveness-loop` (2026-05-20),
`goals/skillopt-training-pilot` (2026-07-06),
`goals/coding-agent-effectiveness-evidence-loop` (2026-07-31), and
`explorations/context-rent-telemetry` (2026-07-31). The repo did not copy the
paper, and the paper did not copy the repo.

The paper does make three mechanisms concrete that the repo only described.
This packet ports those three:

1. A typed ledger row per harness edit: hypothesis, mechanism class, diff,
   score and cost delta, disposition.
2. Evidence expiry by config fingerprint (model id, reasoning effort, hash of
   the always-loaded harness surfaces), not by calendar date.
3. Retention pruning: surfaces that stop earning their place become deletion
   proposals.

It also reruns the parked SkillOpt pilot with an annealed edit budget and
parallel gate evaluation. The rerun writes the first ledger rows.

Two choices deliberately differ from the paper. A human admits every change;
the loop only proposes. Regularization sits on the retention side (what we
keep), not the proposal side (what we may try).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/harness-evidence-ledger/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth, including locked
   decisions D1 to D14.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - papers, session maps, and
   repo precedents.
6. [`history/`](./history/) - rerun evidence and closeouts.
7. [`../../harness-ledger/README.md`](../../harness-ledger/README.md) - the
   tracked ledger surface and its laws.

## Current Phase

P0 Research is complete (the 2026-09-25 grill). P1 is next: schemas, the
ledger CLI, the hook-pulse surface field, and the scorer fixes.

## Latest Evidence

Locked decisions D1 to D14 in [`SPEC.md`](./SPEC.md). The stopped P2 run produced two `proposed` rows,
`hl-20260925-873a855c` and `hl-20260925-4fc1962c`, in
[`2026-09.jsonl`](../../harness-ledger/rows/2026-09.jsonl). The run stopped
after step 2 saturated the score through sandbox repair and task leakage;
these proposals are not accepted harness edits. See
[`FINDINGS.md`](history/p2-rerun/FINDINGS.md).

## Notes

- The pilot packet `goals/skillopt-training-pilot` stays parked and
  `completed-retained`. The rerun lives here.
- `coding-agent-effectiveness-evidence-loop` P7 records its improvement
  dispositions as rows in this ledger.
- `explorations/context-rent-telemetry` resumes when this packet ships
  `prune-proposals`.
