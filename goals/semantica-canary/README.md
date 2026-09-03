# Semantica Canary

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Scaffold the headless-first Tauri lab at the future apps/labs/semantica and
run the staged canary C0 → C1 → C2 over F1 + W1 under the probe breaker (S1),
emitting replay-identical `EvalReport`s; each passing stage flips its families
from park-pending-canary to a verdict (B1).

Graduated 2026-08-24 from
[`explorations/semantica-lab`](../../explorations/semantica-lab/README.md)
(Goal 1 of its [`MAP.md`](../../explorations/semantica-lab/MAP.md)).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/semantica-canary/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read this first

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative scope, constraints, acceptance, and
   stop conditions; every section back-links the exploration instead of
   restating it.
3. [`PLAN.md`](./PLAN.md) - P1-P5 execution plan (scaffold, C0, C1, C2, close).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - goal-side mirror of the
   exploration's provenance ledger.
6. Exploration contracts in force:
   [`BRIEF.md`](../../explorations/semantica-lab/BRIEF.md) v1.1,
   [`MAP.md`](../../explorations/semantica-lab/MAP.md) v1.0,
   [`DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md) (Current
   law table + M1-M6),
   [`research/shared-schema.md`](../../explorations/semantica-lab/research/shared-schema.md)
   v1.4, and
   [`research/workload-contract.md`](../../explorations/semantica-lab/research/workload-contract.md)
   v1.4.
7. [`history/`](./history/) - stage evidence and the closeout reflection.

## Current phase

P5 Close is complete. C0, C1, and C2 passed their full-W1 live/replay gates,
and all five family verdicts are dated in the exploration's `DECISIONS.md`.
The closeout audited every stage artifact, added the required reflection, and
retained the packet. The C2 pass fired the storage gate and left the reasoning spike gated on
its `G-entailment/rules` fixture; both return to the exploration at
`decompose`, and no successor packet was scaffolded. The six final
`park` values were synced to the Notion atlas; see `history/p5-atlas-sync.md`.

## Latest evidence

[`history/p5-close.md`](./history/p5-close.md) records the checksum, artifact,
and replay-identity audit. The closeout
[`reflection`](./history/reflections/2026-09-02-codex.md) records execution
lessons and codification work.
[`history/p5-atlas-sync.md`](./history/p5-atlas-sync.md) records the six final
`park` values written to the Notion atlas, the read-back, and what was left unwritten.
[`history/p4-c2-r2.md`](./history/p4-c2-r2.md) records the C2 oracle, crash,
Tier-L, full-W1 live/replay gate, and Reasoning verdict.
[`history/p3-c1-r2.md`](./history/p3-c1-r2.md) records the C1 G-projection,
rebuild-identity, full-W1 live/replay gate, and resulting family verdicts.
[`history/p2-c0-r2.md`](./history/p2-c0-r2.md) records the C0 full-W1 gate.
[`history/p2-c0-relation-slate.md`](./history/p2-c0-relation-slate.md) records
the preceding slice and relation-paper extension. The earlier
[`history/p2-c0-evidence-quote-reentry.md`](./history/p2-c0-evidence-quote-reentry.md)
records the candidate contract, zero-spend preview, and gold repair.

## Notes

- The sibling `openai-driver` packet is a dependency edge before C1 only; C0
  and the scaffold never wait on it (MAP Sequencing 3).
- The stop rule is the probe breaker, never a calendar (S1): first-probe
  candidate, one retry, then the family parks and the exploration drops back
  to `decompose`.
- Family verdicts are written to the exploration's `DECISIONS.md` only after
  the matching stage passes, and only final park/drop values reach the Notion
  atlas (B1).
- Explorer/UI: deferred. No window in M1; a thin workbench is a post-C2
  milestone decided by re-entry (SPEC decision log, D16/A5/D12).
