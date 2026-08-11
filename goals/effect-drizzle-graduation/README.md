# Effect-Drizzle Graduation

## Status

Lifecycle: `active`

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
6. `scratchpad/bsl/research/graduation-decisions.md` - the locked operator
   decisions this packet executes.

## Current Phase

P0 — Doctrine: ecosystem family docs PR. Charter the family in the standards
(doc 14 + grammar/summary/glossary/decision/index edits + the shared-tables
projection line) and register this packet; land it as a docs-only PR via yeet.

## Latest Evidence

Exploration merged: PR #651 (`e92b8b7d9d`, 2026-08-10) — `scratchpad/bsl` at
86/86 tests, 402 assertions, two dialects, Greptile 5/5. P0 PR: not yet
opened.

## Notes

- Beep adoption (BaseEntity parity, EntityTable replacement) is deliberately
  OUT — future packet chartered by
  `scratchpad/bsl/research/baseentity-migration-plan.md`.
- npm publication stays gated (`private: true`) until effect v4 stable and
  drizzle 1.0 final; pre-npm feedback flows through the public repository
  meanwhile, and the unscoped `effect-drizzle` npm-name ask is the operator's
  own parallel action.
- The member-scoped tstyche lane is a deliberate exception to the 2026-08
  repo-wide type-test removal; the DECISIONS entry cross-references it.
