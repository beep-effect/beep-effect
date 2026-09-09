# Turborepo cache conformance

## Status

Lifecycle: `paused`

Source: [ops/manifest.json](./ops/manifest.json).
Authored but not started. Launch begins P0; see [PLAN.md](./PLAN.md) for resume
conditions and milestone dependencies.

## Mission

Deliver a reusable exact-version Remote Cache conformance corpus and a bounded, evidence-neutral comparison of the named backend topologies.

## Launch

```text
/goal follow the instructions in goals/turborepo-cache-conformance/GOAL.md
```

[GOAL.md](./GOAL.md) is the launcher; [SPEC.md](./SPEC.md) is normative.

## Read this first

1. [SPEC.md](./SPEC.md) and [PLAN.md](./PLAN.md).
2. [Source ledger](./research/SOURCES.md).
3. [Approved exploration](../../explorations/turborepo-quality-cache/README.md) and [program map](../../explorations/turborepo-quality-cache/MAP.md).
4. [Manifest](./ops/manifest.json), [friction ledger](./research/OPPORTUNITIES.md)
   and [history](./history/).

## Current phase

P0 Pins, corpus and budget plan, not started.

Refresh exact source/client/backend pins and compile the existing 32-case corpus plan into an executable local fixture design.

## Latest evidence

[Graduation receipt](./history/graduation-2026-09-08.md) records approval and
packet creation only. Implementation tests, deployment and observation have
not started.

## Notes

Use qualification's early tuple/policy interface and trust's result/producer
receipt contract. Run baseline fixtures before trust remediation, then rerun
the same cases after it. Do not wait for production trust rollout to exercise
the disposable lab. Shared infra files have one writer per implementation
slice; sequence trust adapter changes and lab topology integration.
