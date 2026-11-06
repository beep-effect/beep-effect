# Research library ontology core

## Status

Lifecycle: `active`

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

P2 Verify / P3 Yeet. Everything in scope has landed: S.Opaque models with ontology annotations, the `ResearchLibrary`
service, the DCAT vocabulary, the T-Box/SHACL fold, the A-Box projection, SPARQL-backed render/status with a
private partition, the hash-gated v2 `migrate` command, golden replay of both intakes, and the runbook.

## Latest Evidence

- Real-library `research library migrate --dry-run`: SHACL `conforms=true violations=0`, and the in-memory `index.md` hash equals the on-disk pre-migration render.
- `bun run beep yeet verify --tier cheap-gates`: all lanes green after the schema-first, oxlint, Fallow, tsconfig-sync and cache-baseline repairs.
- Real-library `research library verify` (read-only) matches `main` failure-for-failure. It reports 10 inherited data-gap issues; the 104 introduced correction-hash failures were fixed (see [research/OPPORTUNITIES.md](./research/OPPORTUNITIES.md)).

## Notes

<Record high-signal constraints or resume notes that do not belong in the
normative spec.>
