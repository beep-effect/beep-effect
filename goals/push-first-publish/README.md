# Push-First Publish

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Yeet publish gates on cheap-gates only, pushes to a draft PR by default, and
hands proof to hosted CI so agents never wait on the local admission queue.

## Launch

```text
/goal follow the instructions in goals/push-first-publish/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` is the normative contract and
carries the ten locked decisions.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - decisions D1–D10, surfaces, acceptance.
3. [`PLAN.md`](./PLAN.md) - P1 work items in schema-first order.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - grounding facts and
   their `file:line` sources.
6. [`history/`](./history/) - evidence and closeouts, when present.

## Current Phase

P0 Research and P1 Implement complete (2026-10-05). P2 Doctrine not
started; see `history/p1-handoff.md`.

## Latest Evidence

P1 landed on the lane (2026-10-05): 315 targeted tests green, test-tsgo green; package-verify carries one inherited red (`history/p1-handoff.md`).

## Notes

- This packet is the successor to the operator's hand-typed "open the PR" and
  "quit waiting on proof, push the fixes" instructions. If a session still
  needs that instruction after this packet merges, that is a defect in the
  packet, not in the operator.
- `goals/ship-velocity` (closed 2026-09-02) still owns the admission scheduler
  and parity doctrine. This packet only removes the full proof from the
  publish path; it does not change what `yeet verify` proves.
