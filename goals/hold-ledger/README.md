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

P1 Implement — in progress. Schemas and verdict rules landed on `feat/hold-ledger`; `beep holds probe` and the statelyai record are next.

## Latest Evidence

- 2026-10-31: [first manual probes](history/receipts/2026-10-31-first-manual-probes.md). The jsdom hold is `probe-broken` (control no longer reproduces; repo jsdom suites pass on 30.1.3 under `--bun`). The statelyai control reproduces the npm 404 deterministically, and latest installs.

## Notes

Holds come first: start with the statelyai slice in `SPEC.md` (moved from jsdom on 2026-10-31). The wake service depends on this ledger.
