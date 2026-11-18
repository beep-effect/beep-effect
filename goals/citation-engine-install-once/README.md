# Citation Engine Install Once

## Status

Lifecycle: `completed-retained`

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

All four slices are merged: A1 (#3253), A2 (#3265), A3 (#3282) and A4 (#3319). The packet is in
closeout; the reflection is
[`history/reflections/2026-11-14-claude.md`](./history/reflections/2026-11-14-claude.md).

## Latest Evidence

[`history/evidence/2026-11-13-a4-owned-configuration.md`](./history/evidence/2026-11-13-a4-owned-configuration.md):
per call 0 installs, 0 detaches, 0 tokenizer builds and 0 evaluator installs with 291 child
processes over ten calls; engine construction performs 1 configuration detach (10 at A3). The 291
child processes are the target of `goals/citation-regex-worker-v3`.

## Notes

The schemas and service contracts were designed and independently reviewed
before graduation: [`explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md`](../../explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md).
Write no code that departs from it without a decision file.
