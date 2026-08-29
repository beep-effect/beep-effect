# Identity IRI Fold

## Status

Lifecycle: `completed-retained`

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

Completed-retained. The branch merged as PR #536 on 2026-08-01; `Fold.*` is
live on main. P0-P2 evidence remains in
[`history/p0-p2-evidence.md`](./history/p0-p2-evidence.md), with the closeout
reflection under `history/reflections/`.

## Latest Evidence

Dependency satisfied: [`identity-iri-core`](../identity-iri-core/README.md) is
completed-retained (5/5), merged through PR #289.

2026-07-31 pre-execution grill (recorded in the exploration
[`DECISIONS.md`](../../explorations/identity-as-iri/DECISIONS.md)): packaging
superseded to the split surface; SKOS collapsed into the fact channel; inline
`is:` sugar closed as not planned; four hardening acceptance items and the
in-packet vocab codegen adopted into `SPEC.md`.

## Notes

The sequence is strict: core → fold → fibered. This packet has landed, so the
fibered trigger fired; its separately ratified goal remains blocked by the
semantic-web PR2+PR3 cleanups. Do not retroactively absorb the Fibered kit,
registry/store layers, or SHACL projection into this completed packet.
`@beep/ontology` repopulation is additive: the FOLIO models and
semantic-foundation M1 taxonomy surface stay in place.
