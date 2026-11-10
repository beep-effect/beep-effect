# Yeet Async Merge and Native Stacks

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Merge through GitHub's async endpoint with an explicit bypass, keep proof across rewrites that change nothing, and support two-layer native stacks.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/yeet-async-merge-and-stacks/GOAL.md
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

P0 Research — not started. The work is four slices, A to D, listed in
[`PLAN.md`](./PLAN.md); A (the async merge port) is first.

## Latest Evidence

Not started. The evidence this goal starts from is the stack test record,
[`explorations/stacked-pr-adoption/research/stack-test-2026-11.md`](../../explorations/stacked-pr-adoption/research/stack-test-2026-11.md).

## Notes

- Graduated 2026-11-10 from `explorations/stacked-pr-adoption`. Its
  `BRIEF.md` calls the slices P0 to P3.
- Slices A and B are worth having with stacks off. The goal may close after
  B if the pilot's kill criteria fire or the appetite runs out.
- `explorations/github-merge-queue` reuses slice A's client; it does not
  wait on this goal's later slices.
