# Identity IRI Fold

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Repopulate `@beep/ontology` around the split authoring surface — composer
`$I.key`/`$I.class` writers in `@beep/identity` and the `Ontology.fold`
entrypoint in `@beep/ontology` — then ship validated predicate-open assembled
ontologies, pure JSON-LD/context/Turtle/Markdown projections, the ratified
FOLIO annotation migrations, and the vocab term-inventory codegen.

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

P3 Close: P0-P2 landed on `feat/identity-iri-fold` — evidence in
[`history/p0-p2-evidence.md`](./history/p0-p2-evidence.md). The reflection and
full local Yeet repair are green. Remaining: publish, hosted checks, and review
closure to mergeable.

## Latest Evidence

Dependency satisfied: [`identity-iri-core`](../identity-iri-core/README.md) is
completed-retained (5/5), merged through PR #289.

2026-07-31 pre-execution grill (recorded in the exploration
[`DECISIONS.md`](../../explorations/identity-as-iri/DECISIONS.md)): packaging
superseded to the split surface; SKOS collapsed into the fact channel; inline
`is:` sugar closed as not planned; four hardening acceptance items and the
in-packet vocab codegen adopted into `SPEC.md`.

## Notes

The sequence is strict: core → fold → fibered. `identity-iri-fibered` remains
held until this packet lands. Do not absorb the Fibered kit, registry/store
layers, or SHACL projection. `@beep/ontology` repopulation is additive: the
FOLIO models and semantic-foundation M1 taxonomy surface stay in place.
