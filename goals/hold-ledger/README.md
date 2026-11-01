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

P3/P4 — the final PR #2453 meets the last acceptance criteria; the closeout reflection is in `history/reflections/`. The `completed-retained` proposal follows once #2453 has gating Yeet readiness evidence. Slice 1 (`beep holds list` and `probe`,
the statelyai record) merged in #2404; slice 2 (every site recorded, the syncpack
held list derived from the ledger, `beep holds lint` in the cheap gate) merged
in #2450. Slice 3 (`feat/hold-ledger-sweep`) adds `beep holds update` as the
`deps:update` pre-step, `beep holds why` and the
[hold ledger runbook](../../docs/runbooks/hold-ledger.md); it meets the last
acceptance criteria.

## Latest Evidence

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

The jsdom record is due: its control no longer reproduces, so its unpin PR is
the next consumer of the ledger. The wake service depends on this ledger.
