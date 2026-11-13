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

P3 Yeet. P0 to P2 and P4's work are done: the verdict is **go**
([`decisions/2026-11-10-verdict-go.md`](./decisions/2026-11-10-verdict-go.md)).
The driver pull request (#3072) and the first final (#3112) are merged.
#3112 merged before its readiness receipt, so #3146 is the re-final.
Next action: merge #3146 at merge-ready, then adopt the closeout in a
packet-state pull request.

## Latest Evidence

- [`research/findings.md`](./research/findings.md): every Observations row,
  each tied to a file under [`research/evidence/`](./research/evidence/).
- Lab: branch `queue-lab`, ruleset 26917133 (parked at build concurrency 0);
  ruleset 10240248 on `main` unchanged since 2026-10-27.
- Driver: `@beep/github` `enqueuePullRequest`, `dequeuePullRequest`,
  `mergeQueueEntry` (#3072).
- Driver script: [`ops/queue-lab.sh`](./ops/queue-lab.sh).
- Reflection: [`history/reflections/2026-11-10-claude.md`](./history/reflections/2026-11-10-claude.md).

## Notes

- Graduated from `explorations/github-merge-queue` on 2026-11-09. Appetite:
  one week.
- This is the only candidate that exploration promised now. Its four gated
  candidates (`merge-group-parity`, `yeet-queue-states`,
  `merge-queue-activation`, `pr-head-slimming`) wait on this goal's verdict
  and on other packets; see the exploration's `MAP.md`.
- The lab may end the exploration. A kill verdict is a successful outcome.
