# Effect-level JSDoc Quality

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make `@beep/*` IDE hovers teach like Effect v4's by porting Effect's
machine-checked JSDoc section grammar into repo law + kind-aware inventory
rules — while keeping the example compile validation Effect v4 lost — proven
on a three-package pilot and ratcheted for new/touched code only.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/effect-jsdoc-quality/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - carried provenance ledger.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research — next concrete action: orient on `SPEC.md` + the exploration
packet's `research/` legs and `DECISIONS.md`, verify the cited tooling
baselines still hold, then start the P1 law + skill rewrite.

## Latest Evidence

Not started. Provenance: graduated 2026-07-30 from
[`explorations/effect-jsdoc-quality/`](../../explorations/effect-jsdoc-quality/README.md)
(twelve grilled decisions in its
[`DECISIONS.md`](../../explorations/effect-jsdoc-quality/DECISIONS.md);
WebStorm hover-fidelity lab settled the example-carrier choice).

## Notes

- Implementation must NOT re-mine Effect — the grammar is cited to path:line
  in the exploration's `research/` legs and summarized normatively in SPEC.
- Planning/implementation separation is deliberate: this packet landed with
  zero implementation; all code changes belong to this goal's execution PRs.
