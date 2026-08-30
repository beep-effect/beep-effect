# Practice Box Provisioning

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Expand `@beep/box` with the provisioning manager surface and ship the
Effect-native desired-state reconciler that provisions the practice's
client/matter tree in Box — service-identity-owned, attorney-collaborated,
dry-run plan artifacts by default, `BlockedByEntitlement` honesty on the
Business plan.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/practice-box-provisioning/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance, inherited
   from the source exploration.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research — verify the CCG platform-app approval flow on the Box Business
plan, repair the Box SDK version provenance drift, confirm the reconciler
package home with `bun run beep architecture`, and record the Box quote
table.

## Latest Evidence

Not started.

## Notes

- Graduated 2026-08-30 from `explorations/practice-office-provisioning`
  (BRIEF solution sketch point 1; the reconciler shape and identity topology
  are ratified decisions there — do not re-litigate).
- Deepest implementation reference:
  [`r4-provisioning-code-shape.md`](../../explorations/practice-office-provisioning/research/r4-provisioning-code-shape.md)
  (driver gap tables, desired-state schema sketch, per-resource idempotency
  rules, receipt redaction rules).
- The 2026-07 staging drop in the tenant is **foreign** to the reconciler:
  inventoried and reported, never adopted or pruned in v1.
