# Effect-Drizzle Graduation

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Graduate `scratchpad/bsl` — the effect v4 + drizzle SQL DSL proven through
rounds 1-7.5, two quality loops, and PR #651 — into
the new flat `ecosystem` family as `@beep/effect-drizzle` (member root
`packages/ecosystem/effect-drizzle/**`, created in P1), chartering the package
family (publishable, beep-independent packages) in the architecture standards
along the way.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/effect-drizzle-graduation/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.
6. [`research/bsl/graduation-decisions.md`](./research/bsl/graduation-decisions.md)
   - the locked operator decisions this packet executes.

## Current Phase

Complete. All three phases shipped: P0 doctrine (PR #658), P1 package
creation (PRs #664 + #667), P2 quality integration + closeout (this PR).

## Latest Evidence

P2: `Ecosystem Contracts` CI lane (member tstyche matrix + bundle ratchet,
esbuild raw-byte baseline 7864), `test:integration:parallel` enrollment in
the affected integration lane, docgen local/aggregate proofs, closeout
reflection, and the lifecycle flip — landed together in the final PR.
P1 merged: PR #664 (`6eb1f37024`) + review remediation PR #667
(`6fecd1811b`) — member live at `packages/ecosystem/effect-drizzle`,
89 runtime tests, tstyche 160 assertions on TS 5.9.3 + 6.0.3,
`scratchpad/bsl` retired. P0 merged: PR #658 (`4857be45cb`) — family
doctrine. Exploration: PR #651 (`e92b8b7d9d`).

## Notes

- Beep adoption (BaseEntity parity, EntityTable replacement) is deliberately
  OUT — future packet chartered by
  [`research/bsl/baseentity-migration-plan.md`](./research/bsl/baseentity-migration-plan.md).
- npm publication stays gated (`private: true`) until effect v4 stable and
  drizzle 1.0 final; pre-npm feedback flows through the public repository
  meanwhile, and the unscoped `effect-drizzle` npm-name ask is the operator's
  own parallel action.
- The member-scoped tstyche lane is a deliberate exception to the 2026-08
  repo-wide type-test removal; the DECISIONS entry cross-references it.
