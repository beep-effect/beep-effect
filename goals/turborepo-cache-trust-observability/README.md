# Turborepo cache trust and observability

## Status

Lifecycle: `paused`

Source: [ops/manifest.json](./ops/manifest.json).
Authored but not started. Launch begins P0; see [PLAN.md](./PLAN.md) for resume
conditions and milestone dependencies.

## Mission

Enforce signed artifact reuse, independent upload authorization, tenant isolation and attributable cache outcomes with bounded safe telemetry.

## Launch

```text
/goal follow the instructions in goals/turborepo-cache-trust-observability/GOAL.md
```

[GOAL.md](./GOAL.md) is the launcher; [SPEC.md](./SPEC.md) is normative.

## Read this first

1. [SPEC.md](./SPEC.md) and [PLAN.md](./PLAN.md).
2. [Source ledger](./research/SOURCES.md).
3. [Approved exploration](../../explorations/turborepo-quality-cache/README.md) and [program map](../../explorations/turborepo-quality-cache/MAP.md).
4. [Manifest](./ops/manifest.json), [friction ledger](./research/OPPORTUNITIES.md)
   and [history](./history/).

## Current phase

P0 Threat and receipt contracts, not started.

Refresh the checked-in and applicable deployed trust boundary, then define the cache-result and protected-producer receipt contract with the conformance owner.

## Latest evidence

[Graduation receipt](./history/graduation-2026-09-08.md) records approval and
packet creation only. Implementation tests, deployment and observation have
not started.

## Notes

Receipt schemas can be authored alongside qualification's early policy
contract. Conformance consumes those schemas and supplies direct negative-case
results. Apply adapter fixes in its lab before production. Coordinate the named
hosted cohort with adoption, without waiting for adoption's entire program to
finish. If replacement is selected, cutover belongs to the reopened migration
packet; incumbent hardening remains this goal's responsibility otherwise.
