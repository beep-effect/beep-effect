---
title: "P5: generic SKOS models stay in @beep/ontology; the legal vocabulary kinds, intake filing model and librarian loop move to law-practice; VocabularyRegistry is deleted"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Keep the intake model and registries in @beep/ontology by a decision file that amends the legal-semantics non-goal"
---

Map questions T3 and T4. "Legal semantics in foundation" is a non-goal (SPEC Non-Goals), so moving only the data is not enough.

These parts stay in `@beep/ontology`, generic:
- a new `ConceptScheme` leaf with `ConceptScheme`, `Concept` (iri, prefLabel, optional notation, definition, source and scopeNote, broader as a canonical IRI set, alignments), `ConceptAlignment`, now over `MappingPredicate`, `ConceptSchemePin { scheme, version }` and the broader profile;
- `TaxonomyLoader`;
- the classification editions;
- the fold;
- the new mapping and gUFO leaves.

These leave for `@beep/law-practice-domain`, routed by `bun run beep architecture`:
- `VocabularySchemeKind` (docketing, party-kinds, legal-roles) as `LegalVocabularyKind`, keyed to the pack pins;
- the intake filing model: `DocumentClass` with `privileged`, `FilingSegment`, `FilingRoot`, `FilingRootKind`, and each concept's document classes and filing segment, as an `IntakeTaxonomy` record over generic concept IRIs, with the seed's ordered `pathTemplateSegments` (`SemanticFoundation.seed.ts:142`), stored as a fifth pack JSON file;
- the librarian loop (`TaxonomyRegistry.ts:169`), re-typed over `ConceptScheme` plus `IntakeTaxonomy` in a new file that owes 100 percent coverage, covered by `law-practice/domain/test/LibrarianLoop.test.ts`; `TaxonomySeed` is deleted in the same commit.

`ConceptAlignment` keeps the live `sourceIri` as `source: Option<IRI>`, and `LoadedPack.schemeFor(pin)` refuses a version mismatch with `ConceptSchemeVersionMismatch`, so no field the current models carry is dropped silently.

`VocabularyRegistry`, whose job was a `Match` over the three legal kinds (`VocabularyRegistry.ts:66-80`), is deleted. Lookup by pin is a pure function over a `LoadedPack`. `Vocabulary.models.ts`, `SemanticFoundation.models.ts` and `TaxonomyRegistry.ts` are deleted once their parts have moved. Every one of these surfaces has 0 consumers outside the package (map, taxonomy section 3), and their tests move with them.

Census row 247 ("Classification and registries keep") is restated in the P5 design commit. The registries split: the classification registry keeps, `VocabularyRegistry` retires with 0 consumers, and the intake parts adapt by moving to law-practice with 0 consumers. Those rows precede the implementing commit.

T4: the slice's `PartyKind` (two literals, `packages/law-practice/domain/src/values/PartyKind/PartyKind.model.ts:12`) and the party-kinds scheme (six concepts, `ontology/src/seed/party-roles.ttl`) are not aligned in P5. A `Mapping` needs a declared term IRI on both sides, and `PartyKind`'s literals have none. Their granularity also differs: natural and juristic person against Party, NaturalPersonParty, OrganizationParty, LawFirm, PatentOffice and TrademarkOffice. Both now live in the slice, beside each other.
