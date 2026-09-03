# Practice Box Provisioning

## Status

Lifecycle: `completed-retained`

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

Closed 2026-09-03. The live tenant carries the 32-folder starter tree under the
service identity with the attorney collaborated on the client folder; metadata
and retention stay `BlockedByEntitlement` on Business; a fresh-process re-plan
is all-`Noop`. The final fix merged as #959; the closeout reflection and this
status flip ride follow-up PR #960 by operator decision (Exception Ledger).

## Latest evidence

- [`history/2026-09-03-p2-live-apply.md`](./history/2026-09-03-p2-live-apply.md)
  records the live dry-run proof, the attended apply receipt summary, the
  post-apply all-`Noop` re-plan, and the two live-tenant fixes (Sign 403
  tolerance, runner input contract).
- [`history/reflections/2026-09-03-claude.md`](./history/reflections/2026-09-03-claude.md)
  is the closeout reflection.
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
