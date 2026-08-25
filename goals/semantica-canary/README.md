# Semantica Canary

## Status

Lifecycle: `active`

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
   v1.3, and
   [`research/workload-contract.md`](../../explorations/semantica-lab/research/workload-contract.md)
   v1.3.
7. [`history/`](./history/) - stage evidence and the closeout reflection.

## Current phase

P1 Scaffold, step 1: the lab mint on its own PR (labs doctrine; #742
precedent, M5). Run
`bun run beep create-package semantica --type app --app-kind tauri --lab --description "Semantica port canary: headless Document→KG→eval chain over F1 + W1"`,
run one local `cargo check`, freeze `src-tauri`, and hand-write the headless
entry (server/main.ts) plus the runtime layer (src/runtime/Layer.ts) per
Professional Desktop's split (S4). F1 fixtures and the W1 manifest follow in
the same phase. C0 starts only after the mint PR is mergeable.

## Latest evidence

Not started. The graduation ceremony (docs-only PR B, M5) is the only artifact:
MAP v1.0 ratified, exploration flipped `graduated`, this packet scaffolded.
Stage evidence (EvalReports, replay diffs, crash-identity logs) lands under
[`history/`](./history/) as each stage runs.

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
