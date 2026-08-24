# Boolean-Creep Eradication

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Find every place AI-generated code flattened one domain state variable into
parallel correlated booleans, prove each with cited evidence (E1–E4), and
refactor the confirmed instances to schema-first shapes (LiteralKit literal,
tagged union, or Option-of-literal) that delete the guards the booleans made
necessary.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/boolean-creep/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract;
[`DECISIONS.md`](./DECISIONS.md) holds the ratified campaign decisions.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`DECISIONS.md`](./DECISIONS.md) - ratified decisions (binding).
4. [`PLAN.md`](./PLAN.md) - active execution plan.
5. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
6. [`data/inventory.jsonl`](./data/inventory.jsonl) - campaign state of truth.
7. [`research/`](./research/) - supporting research.
8. [`history/`](./history/) - evidence and closeouts.

## Current Phase

GATE 1 — awaiting Benjamin's ratification of the confirmed inventory. P1 is
complete: 7 sweep rounds to dryness (rounds 6+7 both zero-new), 100% of
confirmed entries evidence-verified by the orchestrator. No design work
before ratification.

## Latest Evidence

`bun goals/boolean-creep/ops/validate-inventory.ts` → 294 records OK
(46 confirmed, 248 disqualified census: D1 207 / D2 41). Sweep round detail
in `PLAN.md`; per-round lane outputs under `data/sweeps/`.

## Notes

- The inventory is schema-validated JSONL; the record union makes
  "disqualified but designed against" unrepresentable
  ([`ops/validate-inventory.ts`](./ops/validate-inventory.ts)).
- Two hard user gates: inventory ratification before design, design
  ratification before apply.
- Tier 2 instances (persisted/wire encoded exposure) land one PR each with an
  encoded-compat proof; Tier 1 lands batched by package/app.
