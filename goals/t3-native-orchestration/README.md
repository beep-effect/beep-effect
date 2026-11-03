# T3-Native Orchestration

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make T3 Code the only cross-session messaging route: delete beep's agent-to-agent stack and its packets, and rewrite the orchestrator, handoff, remote-worker and closeout guidance around T3's MCP tools.

Graduated from [explorations/t3code-fleet-driver](../../explorations/t3code-fleet-driver/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/t3-native-orchestration/GOAL.md
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

P4 Close — the implementation merged in [#2594](https://github.com/beep-effect/beep-effect/pull/2594) (`6fad8f6d0f`); closeout PR [#2664](https://github.com/beep-effect/beep-effect/pull/2664) recorded the local-state cleanup but merged before its readiness job reported, and [#2671](https://github.com/beep-effect/beep-effect/pull/2671) was merged the same way, so closeout PR [#2675](https://github.com/beep-effect/beep-effect/pull/2675) rebinds the `completed-retained` proposal to its own readiness verdict and is held until that verdict records merge-ready.

## Latest Evidence

2026-11-02: removal map re-verified against `6bb8584b6d` (every row still present); installed T3 tool listing captured in `history/2026-11-02-t3-tool-listing.md`; live round-trip receipt in `history/2026-11-02-t3-round-trip.md`; reflection `history/reflections/2026-11-02-claude.md`; implementation PR #2594 merged `6fad8f6d0f` (it replaced #2574); local-state cleanup in `history/2026-11-03-local-state-cleanup.md`.

## Notes

First slice of the T3 fleet driver. Launch it from a T3 session on DankStation. Follow removal-map §0 order so every commit builds; re-verify each row against the current tree before deleting.
