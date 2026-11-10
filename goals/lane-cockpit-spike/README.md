# Lane Cockpit Spike

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

In one working day, build a read-only live lanes board as a lab app on a pinned cell-grid React renderer, then let one day of operator use decide keep or kill.

Graduated from [`explorations/textjs-console-ui`](../../explorations/textjs-console-ui/README.md).
The shaped pitch is its [`BRIEF.md`](../../explorations/textjs-console-ui/BRIEF.md);
this packet links to it and does not copy it.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/lane-cockpit-spike/GOAL.md
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

P3 Yeet: the lab is built and verified; the PR is being driven to merge. P4
waits on the operator's one-day keep test after the merge.

## Latest Evidence

- 2026-11-10: `render` from `@textjs/react/testing` runs under the repo's
  Vitest on Bun and Node; the circuit breaker did not fire
  ([checkpoint](./decisions/2026-11-10-p0-render-runs-under-the-repo-s-vitest-on-bun-and-node.md)).
- 2026-11-10: the lab draws the live ledger (127 rows, 26 blocked) offscreen
  and full-screen in a PTY; 17 tests pass and package-verify is green
  ([checkpoint](./decisions/2026-11-10-p2-first-frame-from-the-live-ledger.md)).
- Start the board from the repository root:
  `bun run --cwd apps/labs/lane-cockpit start`.

## Notes

- This is a spike. A killed spike with the lab deleted and the reason written
  down is a successful close.
- The keep test is the operator's and takes a working day of elapsed time
  after the PR merges. The packet stays `active` until the verdict is in.
- The wider cockpit is mapped as gated candidates in the exploration's
  [`MAP.md`](../../explorations/textjs-console-ui/MAP.md). A passed keep test
  reopens that exploration at `decompose`; it does not start new work here.
