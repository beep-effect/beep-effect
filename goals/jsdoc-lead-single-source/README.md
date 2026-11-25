# JSDoc Lead Single Source

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Single-source JSDoc leads from $I.annote descriptions and stop requiring restating leads on type companions and barrels.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/jsdoc-lead-single-source/GOAL.md
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

P4 Close — six waves merged or final (#3496, #3506, #3512, #3514, #3532, #3535); the closeout rides #3535.

## Latest Evidence

After wave 6 (#3535) the inventory measures 507 restating leads, down from 8,726. The remainder sits in CI binary closure and runner handler files, `infra/src`, `@beep/text` and guard-kept rows (`decisions/2026-11-24-wave-6-deferred-packages.md`). Reflection: [`history/reflections/2026-11-24-claude.md`](./history/reflections/2026-11-24-claude.md).

Before any sweep the JSDoc inventory measures 8,726 restating leads
(`restating-lead` in `standards/jsdoc-totals.regression-baseline.jsonc`): 3,283 on
schema classes, 1,686 on schema constants, 2,529 on type companions, 400 on
companion namespaces and 828 on barrels. The sampled estimate was about 25,000
exported blocks of tautological prose of every kind. Run over the same 1,046 sampled
blocks, the detector flags 25%, about 10,500 extrapolated; the rest have no annotation to
derive a lead from or sit outside the inventory
(`decisions/2026-11-23-estimate-reconciliation.md`).

## Notes

Evidence and the four-goal map: [`explorations/comment-law/MAP.md`](../../explorations/comment-law/MAP.md).
