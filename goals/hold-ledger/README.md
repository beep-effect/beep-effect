# Hold Ledger

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Record every dependency-shaped temporary decision as a probe-backed hold on the claim envelope, derive the configs that enforce it from an in-repo ledger, and re-check holds mechanically, with renewal only on fresh evidence.

Graduated 2026-10-31 from
[`explorations/expiring-repo-facts`](../../explorations/expiring-repo-facts/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/hold-ledger/GOAL.md
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

Closed. Slice 1 (`beep holds list` and `probe`, the statelyai record) merged in
#2404; slice 2 (every site recorded, the syncpack held list derived from the
ledger, `beep holds lint` in the cheap gate) merged in #2450; slice 3
(`beep holds update` as the `deps:update` pre-step, `beep holds why` and the
[hold ledger runbook](../../docs/runbooks/hold-ledger.md)) merged in #2453. The
first two ledger-driven unpins (#2462 statelyai, #2465 jsdom) proved the loop
end to end. #2453 was pushed without a Yeet publish verdict, so this docs-only
final PR (#2755) carries the `completed-retained` proposal and the gating verdict; the
closeout reflection is `history/reflections/2026-11-01-claude.md`.

## Latest Evidence

- 2026-11-06: closeout. Every `SPEC.md` acceptance criterion is checked with
  its PR; the sweep slice shipped as #2453 and both unpins it planned have
  merged. The final PR proposes `completed-retained`.
- 2026-11-01: jsdom unpinned by hand (a `Judgement` hold, so `holds update`
  never retires it): on jsdom 30.1.3 all 11 jsdom workspaces (126 files, 1,225
  tests) pass under `bunx --bun vitest`; tombstone
  `jsdom-vitest-bun-eventtarget@2` and catalog 30.0.1 → 30.1.3 in the same PR.
- 2026-11-01: first ledger-driven unpin. `beep holds update` re-probed
  statelyai (0.15.0 still 404s, latest 0.19.0 installs), tombstoned
  `statelyai-model-testing-404@2` and dropped it from the held list; the
  catalog moved 0.14.3 → 0.19.0 in the same PR (OSV and `bun audit` clean).
- 2026-11-01: [sweep slice](history/receipts/2026-11-01-sweep-slice.md).
  `holds update --dry-run` re-probes statelyai (0.15.0 still 404s, `latest`
  0.19.0 installs) and plans its unpin, so the next `deps:update` retires it and
  bumps the catalog to the release it just tested.
- 2026-10-31: [inventory slice](history/receipts/2026-10-31-inventory-slice.md).
  30 live holds cover every root override, patch and OSV package override;
  syncpack's update dry run is identical with the ledger-derived held list, and
  a control without statelyai lists `0.14.3 → 0.19.0`.
- 2026-10-31: [first manual probes](history/receipts/2026-10-31-first-manual-probes.md). The jsdom hold is `probe-broken` (control no longer reproduces; repo jsdom suites pass on 30.1.3 under `--bun`). The statelyai control reproduces the npm 404 deterministically, and latest installs.

## Notes

The wake service depends on this ledger.
