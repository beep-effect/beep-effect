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

P1 Implement. P0 produced [research/DESIGN.md](./research/DESIGN.md) and the foundational audit ([research/FOUNDATIONAL-AUDIT.md](./research/FOUNDATIONAL-AUDIT.md), adversary review and r2 revision). Models, service, DCAT vocabulary, T-Box/SHACL fold and A-Box projection have landed; SPARQL views and the v2 migration are next.

## Latest Evidence

Real-library `research library verify` (read-only) matches `main` failure-for-failure. It reports 10 inherited data-gap issues; the 104 introduced correction-hash failures were fixed (see [research/OPPORTUNITIES.md](./research/OPPORTUNITIES.md)).

## Notes

<Record high-signal constraints or resume notes that do not belong in the
normative spec.>
