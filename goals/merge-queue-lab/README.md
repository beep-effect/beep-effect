# Merge Queue Lab

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Run a GitHub merge queue on a lab branch behind a toy required check, record
how GitHub behaves wherever its documentation is silent, land the enqueue
calls in the GitHub driver, and give
[`explorations/github-merge-queue`](../../explorations/github-merge-queue/README.md)
a go, park or kill verdict. Nothing on `main` changes behaviour.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/merge-queue-lab/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth, including the Observations table and the verdict rule.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing; its `researchReports` array is a generated projection of `research/` (`bun run beep goals manifest --write`), never hand-edited.
5. [`research/`](./research/) - the provenance ledger; findings and evidence land here.
6. [`history/`](./history/) - evidence and closeouts, if present.
7. The source exploration: [`BRIEF.md`](../../explorations/github-merge-queue/BRIEF.md), [`DECISIONS.md`](../../explorations/github-merge-queue/DECISIONS.md), [`MAP.md`](../../explorations/github-merge-queue/MAP.md) and [`research/github-semantics.md`](../../explorations/github-merge-queue/research/github-semantics.md).

## Current Phase

P0 Research, not started. Next action: read the live `main` ruleset, list the
identities the fleet merges with, then start P1 by cutting `queue-lab`.

## Latest Evidence

Not started.

## Notes

- Graduated from `explorations/github-merge-queue` on 2026-11-09. Appetite:
  one week.
- This is the only candidate that exploration promised now. Its four gated
  candidates (`merge-group-parity`, `yeet-queue-states`,
  `merge-queue-activation`, `pr-head-slimming`) wait on this goal's verdict
  and on other packets; see the exploration's `MAP.md`.
- The lab may end the exploration. A kill verdict is a successful outcome.
