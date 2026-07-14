# Identity IRI Fold

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Repopulate `@beep/ontology` around the identity composer’s `$I.key`,
`$I.class`, and `$I.ontology` fold, then ship validated assembled ontologies,
pure JSON-LD/context/Turtle/Markdown projections, and the ratified FOLIO
annotation migrations.

## Launch

```text
/goal follow the instructions in goals/identity-iri-fold/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains normative.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact launcher.
2. [`SPEC.md`](./SPEC.md) - normative contract.
3. [`PLAN.md`](./PLAN.md) - P0–P3 execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - routing and lifecycle.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited provenance.
6. [`identity-as-iri`](../../explorations/identity-as-iri/README.md) - source exploration.

## Current Phase

P0 Contract and donor audit: confirm the completed-retained core surface,
freeze the tuple grammar/diagnostics boundary, inventory the live FOLIO
migration sites, and reconcile the on-disk projection donors before editing.

## Latest Evidence

Dependency satisfied: [`identity-iri-core`](../identity-iri-core/README.md) is
completed-retained (5/5), merged through PR #289.

## Notes

The sequence is strict: core → fold → fibered. `identity-iri-fibered` remains
held until this packet lands. Do not absorb the Fibered kit, registry/store
layers, or SHACL projection.
