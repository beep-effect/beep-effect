# Research library ontology core

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make the research library ontology-first: named S.Class models with PROV-O/CiTO/FaBiO/SKOS/DCAT annotations, a Context.Service topology, generated Turtle T-Box and SHACL shapes through the @beep/ontology fold, SHACL-validated catalog, SPARQL-backed views.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/research-library-ontology-core/GOAL.md
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

Closed: `completed-retained`. `goals completion refresh` verified final PR #2787 (merge `34d6cd1309`); the work
landed in #2771. Open follow-ups recorded by the foundational audit: split `LibrarySourceKind`, provenance for
`expectedOccurrences`, and a SHACL coherence rule for capture status. A `toShacl` projection in `@beep/ontology`
is the reflection's promotion candidate.

## Latest Evidence

- Real library migrated (receipt `ops/migrations/2026-11-06T17-32-07.946Z-catalog-v2.json` in the library root):
  validator `research-library-shapes/1`, v1→v2, catalog `e88cf958…`→`5cda99e5…`, `index.md` `1048b6e6…` unchanged on
  disk (hash-equal re-render), intakes 2026-10-06 and 2026-10-14, SHACL violations 0. The pre-migration catalog is
  backed up in `catalog/history/`, and a second `migrate` run is a no-op.
- `research library ontology render`: `research-library.ttl` (`521755de…`, 580 triples) and
  `research-library.shacl.ttl` (`267e1e0d…`, 778 triples), byte-identical to the lane's fold output; both re-parse
  with `@beep/n3`.
- `research library verify` on v2: `shacl: conforms=true violations=0`. Its integrity gate still reports the 10
  inherited data-gap issues, identical to `main` before this goal.
- `research library status`: 144 reports, 1203 sources, 5418 occurrences; private partition empty.
- Golden replay of both intakes, local cheap-gates and `yeet final-check` (except coverage, fixed after merge in
  `33bbb5ba32` and #2778) are recorded in [`history/`](./history/).

## Notes

<Record high-signal constraints or resume notes that do not belong in the
normative spec.>
