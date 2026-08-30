# FreshBooks Driver

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Ship `@beep/freshbooks` on the `@beep/hubspot` pattern: auth-code token
helper with single-refresh-owner rotation, clients/invoices/payments read
verbs, and invoice-PDF retrieval gated on a first-phase endpoint-validation
spike against the existing dev app.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/freshbooks-driver/GOAL.md
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

P0 Research — the endpoint-validation spike: invoice-PDF endpoint verdict,
live request-limit numbers, and the webhook retry/disable schedule, all
against the existing dev app.

## Latest Evidence

Not started.

## Notes

- Graduated 2026-08-30 from `explorations/practice-office-provisioning`
  (BRIEF solution sketch point 4, driver half). The invoice-delivery
  composition is the gated `practice-sign-invoice-flow` candidate in the
  exploration `MAP.md` — its gate consumes this goal's P0 verdict.
- FreshBooks refresh tokens are single-use: rotation is a serialization
  problem, not just persistence (one refresh owner, atomic persist). See
  the FreshBooks driver goal entry in the exploration `DECISIONS.md`.
- Dev-app credentials live behind 1Password references recorded in the
  exploration `CAPTURE.md`; refs stay references.
