# Yeet PR Events

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

Slice 1 (W1-W6) is implemented and in P11 verification; slice 2 (W7, W8)
and slice 3 (W9) have not started.

## Mission

Make `yeet monitor --until-ready` the durable producer of every PR event that
matters — required reds, base conflicts, review threads, human comments — as
attributed, per-head-coalesced inbox rows; hand them to the owning session
whether it is blocked in `job wait`, idle, or dead; and prove the
push → row → ack timeline the cadence question is decided on.

## Launch

Use this command after the packet is activated:

```text
/goal follow the instructions in goals/yeet-pr-events/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read this first

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth and decision log.
3. [`PLAN.md`](./PLAN.md) - W1-W10 execution sequence, three PR-sized slices,
   the probe gate.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - carried research corpus
   and the in-repo brick table.
6. [`history/`](./history/) - evidence and closeouts, when present.

## Current phase

P11 verify for slice 1. W1-W6 ship as one producer PR whose own babysit is
the first vertical slice; after it merges, slice 2 starts with the W7 socket
probe.

## Latest evidence

Not started. The operator-confirmed brief, the decomposition, D1-D38 and the
measurement evidence remain in the source
[`pr-event-awareness`](../../explorations/pr-event-awareness/README.md)
exploration.

## Notes

- Slice 1 (W1-W6) merges alone and pays on its own. Slice 2 (W7 probe →
  W8 tail) is gated on the probe; a failed probe closes it as cut and never
  extends the budget. Slice 3 (W9) needs slice 1's rows, not slice 2.
- Law text whose truth depends on code — `AGENTS.md` closeout bullet, the
  yeet skill's wave and exit text, `CheckOutcome.ts`/`Remediation.ts` JSDoc,
  the ttc exit-code table — ships inside the slice-1 PR, which also ratifies
  the proposed ttc amendments under rulings 39, 41, 42, 46 and 48.
- The operator registers every `.claude/settings.json` hook change (the
  SessionEnd teardown command); agent `Edit` on that file is denied.
- Ack, `seenIds` and `firstSeenAt` pruning is its own small PR, outside this
  packet.
