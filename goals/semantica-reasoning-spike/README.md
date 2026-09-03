# Semantica Reasoning Spike

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Dated NET-NEW reasoning spike: P1 builds the `G-entailment/rules` fixture
(`g-entailment-rules/v1`: twenty cases in five classes under the restricted
EYE pins, no negation class), then P2–P4 run the `/adhd` probes —
proof-ledger kernel, budget-certified rules, evidence-graph workspace — as
kill criteria ablated against EYE, with the v3 `rete` salvage entering at P3
once the archive is located; one S1 candidate.

Graduated 2026-09-03 from
[`explorations/semantica-lab`](../../explorations/semantica-lab/README.md)
(MAP v1.1 re-entry packet R, ratified 2026-09-03 as R2 with R2.a–R2.g). The
v1.0 precondition "`G-entailment/rules` fixture committed" had no owner and
became this packet's P1.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/semantica-reasoning-spike/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read this first

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative scope, constraints, acceptance, and
   stop conditions; every section back-links the exploration instead of
   restating it.
3. [`PLAN.md`](./PLAN.md) - P1-P5 execution plan (rules fixture, P-R1, P-R2,
   P-R3, close).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - goal-side mirror of the
   exploration's provenance ledger.
6. Exploration contracts in force:
   [`MAP.md` §R](../../explorations/semantica-lab/MAP.md#r-semantica-reasoning-spike--the-fixture-is-the-spikes-first-slice-not-its-gate)
   v1.1,
   [`DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md) (Current
   law table + the 2026-09-03 ratification grill),
   [`research/adhd-reasoning.md`](../../explorations/semantica-lab/research/adhd-reasoning.md)
   §Focus 1–3,
   [`research/grounding-v3-logos.md`](../../explorations/semantica-lab/research/grounding-v3-logos.md)
   §5.
7. [`goals/semantica-storage-inversion/SPEC.md`](../semantica-storage-inversion/SPEC.md)
   - the tombstone law R-c and P4 inherit;
   [`goals/semantica-canary/SPEC.md`](../semantica-canary/SPEC.md) - the
   lab's standing constraints and the C2 runtime this spike must not replace
   before ablation.
8. [`history/`](./history/) - fixture provenance, probe evidence and the
   closeout reflection.

## Current phase

P1 Rules fixture — not started. First action: the `g-entailment-rules/v1`
tagged family (case, expectation, witness) in `src/schema/Reasoning.ts`,
before any case is written; then extend `apps/labs/semantica/scripts/generate-g-entailment.ts`
under the same EYE pins for R-a, R-b, R-d and R-e. R-c waits for the storage
spike's P-S1.

## Latest evidence

Not started.

## Notes

- **Sequencing.** P1 (minus R-c) runs in parallel with the storage spike;
  R-c and P2–P4 start after P-S1 lands (R1.g). P3 (P-R2) needs the archived
  `beep-effect-logos` root located and its Apache-2.0 LICENSE re-verified
  (absent from the recorded workstation path on 2026-09-03; R2.g).
- **Budget.** P1–P4 are one stage of one S1 candidate; a failed probe buys
  exactly one redesigned candidate for that probe (R0.a); a second failure
  parks the reasoning family and drops the exploration to `decompose`.
- **Typed gap.** No negation class in `gold/v1` until restricted EYE is
  shown to accept scoped negation (R2.d).
- **OSS gate.** `reasoning-package` (O4) opens only if this spike survives
  ablation; nothing here exports from the lab.
