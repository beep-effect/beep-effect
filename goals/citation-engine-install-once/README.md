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

Slice A4 in review after owner round 3: configuration owned once per engine
(`CitationOwned`; the default engine derives its installed configuration from
the owned caller configuration), leaf helpers typed, reference-pattern
authentication hoisted to install. A1 (#3253), A2 (#3265) and A3 (#3282) are
merged.

## Latest Evidence

[`history/evidence/2026-11-13-a4-owned-configuration.md`](./history/evidence/2026-11-13-a4-owned-configuration.md):
per call still 0 installs, 0 detaches, 0 tokenizer builds and 0 evaluator
installs with 291 child processes over ten calls; engine construction now
performs 1 configuration detach (10 at A3).

## Notes

The schemas and service contracts were designed and independently reviewed
before graduation: [`explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md`](../../explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md).
Write no code that departs from it without a decision file.
