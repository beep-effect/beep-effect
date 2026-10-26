# Turborepo cache conformance

## Status

Lifecycle: `completed-retained`

Source: [ops/manifest.json](./ops/manifest.json). The corpus, runners, lab and
frozen-rubric comparison are complete; the [comparison](./research/comparison.md)
finds no eligible replacement and recommends retaining and evolving the
incumbent. See [PLAN.md](./PLAN.md) for the evidence trail.

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

Closed: P0–P6 complete. Lab torn down 2026-10-24 with an empty inventory.

## Latest evidence

- [Comparison](./research/comparison.md) and [JSON](./research/comparison.json):
  seven targets, 28 run reports in [runs/](./research/runs/), three
  [evidence](./research/evidence/) documents.
- [Pins](./research/pins-2026-10-23.json), [corpus](./research/conformance-corpus.json),
  [design](./research/corpus-fixture-design.md),
  [measured envelope](./research/load-envelope-2026-10-23.json).
- [AWS lab receipt](./research/aws-lab-c1023a.json): preview, apply, deployed
  checks, cutback drill, teardown inventory and cost.

## Rerun as an upgrade gate

When Turbo, the shim or a candidate backend changes, refresh the pin file,
then:

```sh
bun run beep cache conformance-corpus --check
infra/lambda/turbo-cache/lab/lab.sh up
bun run beep cache conformance-run --target <target.json> --output <run.json>
bun run beep cache conformance-lab --target <target.json> --output <lab.json>
bun run beep cache conformance-native --target <target.json> --client stable --output <native.json>
bun run beep cache conformance-native --target <target.json> --client canary --output <native.json>
bun run beep cache conformance-compare --runs <each report> --evidence <each evidence file> --output <comparison.json>
infra/lambda/turbo-cache/lab/lab.sh down
```

Targets live in `infra/lambda/turbo-cache/lab/targets/`; bearers come from the
lab's generated env file. A deployed rerun follows
[the lab preview](./research/lab-deployment-preview.md) and needs a fresh
spend approval. The native run reports are the signed-boundary receipts
qualification consumes: exact client digest, namespace epoch and per-case
native and wire outcomes.

## Notes

Use qualification's early tuple/policy interface and trust's result/producer
receipt contract. Run baseline fixtures before trust remediation, then rerun
the same cases after it. Do not wait for production trust rollout to exercise
the disposable lab. Shared infra files have one writer per implementation
slice; sequence trust adapter changes and lab topology integration.
