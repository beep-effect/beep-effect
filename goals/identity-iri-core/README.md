# Identity IRI Core

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Rewrite `@beep/identity` in place so identity paths double as literal-typed
IRIs/CURIEs: root authority binding, exact-literal `.iri`/`.curie`
projections, baked-in CURIE vocabulary types, expand/contract + PN_LOCAL
codecs — shape-stable surface, zero call-site changes repo-wide.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/identity-iri-core/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited provenance ledger.
6. Exploration provenance:
   [`explorations/identity-as-iri`](../../explorations/identity-as-iri/README.md)
   (handoff D1–D9, decisions, adversarially-verified 12-repo synthesis,
   proven scratchpad prototype).

## Current Phase

P0 Research — next concrete action: confirm the authority host with
elpresidank (blocking input; `https://ns.beep.sh/` is a placeholder), then
build the audit-B shape-stable harness before touching `Id.ts`.

## Latest Evidence

Not started. Design proof: `scratchpad/identity/` prototype (27/27 tests,
effect-only) at checkpoint `61160e1baf`.

## Notes

- First of three graduated packets; `identity-iri-fold` and
  `identity-iri-fibered` queue behind it (see
  [`MAP.md`](../../explorations/identity-as-iri/MAP.md)).
- Compile blast radius is a named acceptance item — every file in the repo
  imports `@beep/identity`.
- Inherited main-red lanes at graduation are documented in SPEC's Exception
  Ledger; do not attribute them to this packet.
