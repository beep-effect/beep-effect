---
title: "P5: the vetted FOLIO alignment lives inline in the law-practice legal-intake scheme, and a concept-alignment row resolves only against concept-scheme rows of its own manifest"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Commit the FOLIO slice bytes into the law-practice pack and load the alignment as a pack concept-alignment row, by a decision file before the pack commit lands"
---

Independent review of the P5 design, finding on the FOLIO alignment. Refines decisions `2026-11-23-p5-the-manifest-protocol-verifies-digests-and-loads-concept-schemes` item 4 and `2026-11-23-p5-the-law-practice-asset-pack-and-its-json-scheme-sources`.

Removing the base seed from `mergeSlices` (`packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:914-931`) leaves the vetted FOLIO alignment (`explorations/legal-ontology-landscape/assets/manifest.jsonl:17`) with nothing to resolve against: its local concept, `semantic-foundation/concept/email-message`, is a legal-intake concept that moves to the law-practice pack, and the exploration manifest has no concept-scheme row, so `mergeAlignment` would fail `VendorAlignmentTargetNotFound` (`:892-903`).

1. A `concept-alignment` row resolves only against the `concept-scheme` rows of the same manifest. A target outside them fails `VendorAlignmentTargetNotFound`, as today.
2. The FOLIO alignment is a legal alignment of a legal concept, so it lives in the law-practice pack, inline in `legal-intake.json` on the email-message concept as `ConceptAlignment { predicate: skos:closeMatch, target, source: Some(fetchUrl) }`, written once in the move commit. It is not a pack `concept-alignment` row, because the vendor slice bytes are gitignored (`explorations/legal-ontology-landscape/assets/.gitignore:1`), absent from every checkout measured, and a dated API response that a re-fetch need not reproduce; a pack that needed them could not load in CI.
3. Exploration row 17 stays the vetting record carrying the approval metadata. It is rewritten from `"mappingKind":"closeMatch"` to `"mappingPredicate":"skos:closeMatch"` with `explorations/legal-ontology-landscape/assets/README.md:38` in the loader commit.
4. The ontology loader's alignment cases (`ontology/test/SemanticFoundation.test.ts:184-338`) move onto a test-owned repo scheme plus alignment fixture in `ontology/test/fixtures/concept-scheme/`, with the existing `fixture-slice.jsonld` as the vendor slice.
