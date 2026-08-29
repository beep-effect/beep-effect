# Identity IRI Fibered

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

Completed-retained 2026-08-25: the full MAP row shipped on
`feat/identity-iri-fibered` (evidence in `history/p1-p2-evidence.md`, reflection
in `history/reflections/2026-08-25-claude.md`), published through Yeet.

## Mission

Ship the discrete-case Fibered kit, IdentityRegistry, JSDocTagDefinition
migration, SHACL projection, and test/dev registry store Layers from the full
ratified MAP row.

## Launch

```text
/goal follow the instructions in goals/identity-iri-fibered/GOAL.md
```

## Read This First

1. [`GOAL.md`](./GOAL.md)
2. [`SPEC.md`](./SPEC.md)
3. [`PLAN.md`](./PLAN.md)
4. [`ops/manifest.json`](./ops/manifest.json)
5. [`research/SOURCES.md`](./research/SOURCES.md)

## Current Phase

P4 Close — complete. `Fibered` + `IdentityRegistry` (`@beep/identity`),
byte-identical `JSDocTagDefinition.make` migration (`@beep/repo-utils`), identity
RDF binding + `layerDataset` + SHACL policy projection (`@beep/semantic-web`),
end-to-end proof in `packages/epistemic/server/test`.

## Latest Evidence

`identity-iri-fold` merged as PR #536 on 2026-08-01, firing this goal's
trigger. P0 (2026-08-25) evidenced semantic-web PR2 (#695) and PR3 (#687,
#711, #715) landed from live source and identified the post-move SHACL
contract (`semantic-web/src/services/shacl-validation.ts`).
