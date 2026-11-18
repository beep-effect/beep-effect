# Prunable product leaves

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Let a checkout that removes the product leaves install, typecheck and test without editing kept packages

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/prunable-product-leaves/GOAL.md
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

P1 Implement, seam 1 next (P0 Research done 2026-11-17).

## Latest Evidence

- 2026-11-17: coupling audit of `origin/main`,
  [`research/2026-11-17-product-leaf-couplings.md`](research/2026-11-17-product-leaf-couplings.md).

## Notes

- The operator decided the four seams, their order, the boundary rule and the
  db-admin doctrine amendment on 2026-11-17; `decisions/` records them. Do not
  reopen them without a new decision file.
- The motive stated in this packet is the only one: a checkout that removes
  product leaves must install, typecheck and test without editing kept
  packages.
