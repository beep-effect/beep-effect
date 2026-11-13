# Citation Engine Install Once

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Install the citation stage tree, tokenizer and regex evaluators once per engine, bind each request's budget, Scope and admission through one invocation service, and own configuration once at the engine boundary, with no change to extraction results.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/citation-engine-install-once/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

Slice A1 in review: the probe fixture and recorded baseline.

## Latest Evidence

[`history/evidence/2026-11-13-a1-baseline.md`](./history/evidence/2026-11-13-a1-baseline.md):
per call, 14 metadata-operation installs, 8 configuration detaches and 1
tokenizer build; 291 child processes across the ten calls.

## Notes

The schemas and service contracts were designed and independently reviewed
before graduation: [`explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md`](../../explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md).
Write no code that departs from it without a decision file.
