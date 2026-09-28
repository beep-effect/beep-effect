# Yeet PR Events

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

Slice 1 (W1-W6) merged as PR #1270 on 2026-09-25. On 2026-09-28 the W7
socket probe failed for every detached sender, so slice 2 is cut (W8
not built); W9 and W10 ship with the closeout in one PR.

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

Closeout PR: W9 (dead-owner pr-wave notifier), W10 (Status chain collapse)
and P13 in one PR, driven to merge-ready through Yeet.

## Latest evidence

- [`history/2026-09-25-slice-1-babysit.md`](./history/2026-09-25-slice-1-babysit.md)
  — slice 1 proven on PR #1270's own babysit (exit 2 waves, injected row, fix
  push supersede, exit 0, first push → row → ack timeline).
- [`../../explorations/pr-event-awareness/research/2026-09-28-W7-socket-probe.md`](../../explorations/pr-event-awareness/research/2026-09-28-W7-socket-probe.md)
  — W7 probe: wire contract, seven-sender delivery matrix, accepted frame,
  refusal, slice-2 verdict (cut).
- The operator-confirmed brief, the decomposition and D1-D39 remain in the
  source [`pr-event-awareness`](../../explorations/pr-event-awareness/README.md)
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
