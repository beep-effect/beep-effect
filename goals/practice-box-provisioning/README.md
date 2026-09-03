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

## Read this first

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance, inherited
   from the source exploration.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current phase

P2 Verify. The pre-apply adversarial review found the merged reconciler NOT
SAFE for a first live apply (silent exact-name adoption, case-sensitive name
matching, a loose blocker contract, no partial receipt); the hardening is
landed and verified. Live dry-run and apply still require the operator: the
1Password CLI desktop integration must be enabled, the three private practice
inputs filled, and the apply attended.

## Latest evidence

- [`history/2026-09-02-p2-preapply-hardening.md`](./history/2026-09-02-p2-preapply-hardening.md)
  records the branch re-sync, the Codex NOT SAFE verdict and Grok Box API
  verification, the nine reconciler and driver hardening items, verification,
  and the attended-session checklist.
- [`history/2026-08-30-p0-preflight.md`](./history/2026-08-30-p0-preflight.md)
  records the sanitized CCG verdict, current quote table, package-home decision,
  SDK provenance, and credential-path gate.
- [`history/2026-08-30-box-driver-surface.md`](./history/2026-08-30-box-driver-surface.md)
  records the accepted 19-manager / 69-operation generated surface, type-budget
  proof, and focused driver verification.
- [`history/2026-08-30-box-reconciler.md`](./history/2026-08-30-box-reconciler.md)
  records the schema and service boundaries, dry-run/apply safety tests, and
  successful canonical package verification.

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
