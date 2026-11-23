---
title: "The legal pack move: routing, intake version, filing roots and the path template"
date: 2026-11-23
lane: "p5"
reversal: "Restore the ontology seed modules from the parent commit and delete the law-practice pack, values and tests"
---

Row 11 settles seven calls that design sections 5.1 and 5.3 left open, and corrects one.

1. Routing. `bun run beep architecture add concept law-practice <Concept> --domain-kind values --stage core --dry-run` routes each concept to `packages/law-practice/domain/src/values/<Concept>/` with `<Concept>.model.ts`, `<Concept>.behavior.ts`, `index.ts` and a `./values/<Concept>` export. Its `apply` writes the accepted-proof template (a `WorkPriority` placeholder) and carries legacy-cleanup operations that remove other paths, so the three concepts (`IntakeTaxonomy`, `LibrarianLoop`, `LegalVocabularyPack`) follow that routing by hand.
2. `legal-intake.json` is version `1.0.0`: `ConceptScheme` requires a version and the TypeScript seed had none. The two filing roots are not concepts of the scheme (a `Concept` needs a `prefLabel` they lack); they live in `IntakeTaxonomy.filingRoots`, and the pack test compares the frozen intake row with the scheme concepts plus the filing-root IRIs.
3. `pathTemplateSegments` becomes a `PathTemplateSegment` literal list, and the librarian loop builds each path from it in order; the old loop ignored the list and hard-coded the same order.
4. The loop refuses a taxonomy whose `scheme` pin differs from the given scheme with `IntakeTaxonomySchemeMismatch`; a scheme concept with no filing fails `TaxonomyConceptNotFound`, like an absent concept. `LibrarianInput.conceptIri` is an `IRI`, the type `ConceptScheme` uses.
5. The six renderings are `payload` rows (verified bytes, never decoded). The four schemes and `intake-taxonomy.json` keep their RFC 8785 bytes, so `biome.jsonc` excludes `packages/law-practice/domain/assets/vocabulary/*.json`.
6. The Turtle parity case runs in `packages/law-practice/use-cases/test/LegalVocabularyRendering.test.ts`, not in the domain. The `doctrine:domain-deny-drivers-tables-server` boundary refuses any domain manifest edge to a driver, devDependencies included, so the domain cannot take the `@beep/n3` devDependency the design named. The use-cases devDependencies gain `@beep/n3`, `@beep/rdf` (for the test-support SKOS projection) and `@beep/ontology`. The domain gains only `@effect/platform-bun`, and its pack test asserts the frozen parity record. `@beep/ontology` drops the `@beep/n3` devDependency row 1 added, since the freeze test moved.
7. `VendorSlicePath` checks its components with a private safe-segment predicate, because `FilingSegment` moved to law-practice.
