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

Slices A (the async merge port), B (proof that survives an unchanged
rewrite) and C (two-layer stacks through Yeet) are done. Slice D, the
measured two-week pilot, is in progress: its record opened on 2026-11-13,
the clock runs to the end of 2026-11-26, and the continue-or-stop decision
is due on or after 2026-11-27. The four slices are listed in
[`PLAN.md`](./PLAN.md).

## Latest Evidence

- Slice A: [`history/2026-11-10-slice-a-blocked-hold.md`](./history/2026-11-10-slice-a-blocked-hold.md)
  (a blocked PR holds with GitHub's sentence) and
  [`history/2026-11-13-slice-a-closed.md`](./history/2026-11-13-slice-a-closed.md)
  (merges observed on the async path; legacy call deleted).
- Slice B: the 2026-11-12 decisions under [`decisions/`](./decisions/),
  merged in #3130.
- Slice C: [`history/2026-11-13-slice-c-stack-landed.md`](./history/2026-11-13-slice-c-stack-landed.md)
  (stack #3190: #3188 and #3189 published, readied without a push, merged
  from the top in one push and retired through Yeet) and the P0 probes in
  [`research/stack-p0-probes-2026-11.md`](./research/stack-p0-probes-2026-11.md).
- Slice D: [`research/stack-pilot-2026-11.md`](./research/stack-pilot-2026-11.md)
  (the pilot record: kill criteria, one row per stack, and the evidence
  that GitHub does not restack a layer when the trunk moves, including a
  layer that `--alone` cascaded onto `main`).
- The evidence this goal starts from is the stack test record,
  [`explorations/stacked-pr-adoption/research/stack-test-2026-11.md`](../../explorations/stacked-pr-adoption/research/stack-test-2026-11.md).

## Notes

- Graduated 2026-11-10 from `explorations/stacked-pr-adoption`. Its
  `BRIEF.md` calls the slices P0 to P3.
- Slices A and B are worth having with stacks off. The goal may close after
  B if the pilot's kill criteria fire or the appetite runs out.
- `explorations/github-merge-queue` reuses slice A's client; it does not
  wait on this goal's later slices.
