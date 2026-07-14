# TrustGraph Documentation Ontology

## Status

ARTIFACT-COMPLETE RESEARCH PRECEDENT

## Purpose

This initiative packet turns the TrustGraph documentation-memory exploration plan into runnable artifacts for the `beep-effect` documentation domain.

The package produces:

- a TrustGraph-native ontology JSON artifact for the documentation TBox
- a mechanically derived scaffold for the broader JSDoc and docgen domain
- a companion semantic-web seed layer grounded in RDF, PROV, evidence anchors, and bounded SHACL shapes
- local verification outputs that separate structural validation from rule-enforcement feasibility

The artifact set is complete for reference use. Local verification records 641
quads and SHACL conformance. The live TrustGraph config put/get/delete
round-trip is won't-do because no TrustGraph instance is running; it is not a
remaining acceptance gate for this research precedent.

## Quick Start

Rebuild the artifacts:

```bash
bun goals/trustgraph-doc-ontology/scripts/build-artifacts.ts
```

Run local verification:

```bash
bun goals/trustgraph-doc-ontology/scripts/verify-artifacts.ts
```

## Output Map

- `history/outputs/beep-effect-documentation-ontology.json`
- `history/outputs/beep-effect-documentation-tag-scaffold.json`
- `history/outputs/beep-effect-documentation-seed.dataset.json`
- `history/outputs/beep-effect-documentation-seed.nq`
- `history/outputs/beep-effect-documentation-seed.provenance.json`
- `history/outputs/beep-effect-documentation-seed.evidence.json`
- `history/outputs/beep-effect-documentation-shapes.json`
- `history/outputs/beep-effect-documentation-capability-audit.md`
- `history/outputs/source-authority-matrix.md`
- `ops/manifest.json`
- `history/outputs/verification-report.json`

## Scope Notes

- The ontology artifact is TBox-only and uses TrustGraph's current native ontology JSON structure.
- Rule instances, provenance records, evidence anchors, and SHACL shapes live in the companion outputs rather than inside the ontology JSON.
- The governing worked examples focus on `@param`, `@returns`, `@throws`, `@since`, `@category`, and `@example`, while the broader tag catalog is scaffolded mechanically from the repo's JSDoc source.
