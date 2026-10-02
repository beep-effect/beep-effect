# Turborepo cache conformance

## Status

Lifecycle: `active`

Source: [ops/manifest.json](./ops/manifest.json).
Active for the early handoff consumed by task qualification. See
[PLAN.md](./PLAN.md) for current evidence and remaining milestone gates.

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

P0 Pins, corpus and budget plan, in progress.

Refresh exact source/client/backend pins and compile the existing 32-case corpus plan into an executable local fixture design.

## Latest evidence

The [owned protocol runner](./research/owned-protocol-runner.json) and expanded
[stable](./research/owned-fixture-expanded-stable.json) and
[canary](./research/owned-fixture-expanded-canary.json) fixture reports record
local runtime controls. They do not establish accepted qualification imports,
backend deployment or the broader topology comparison.

## Notes

Use qualification's early tuple/policy interface and trust's result/producer
receipt contract. Run baseline fixtures before trust remediation, then rerun
the same cases after it. Do not wait for production trust rollout to exercise
the disposable lab. Shared infra files have one writer per implementation
slice; sequence trust adapter changes and lab topology integration.
