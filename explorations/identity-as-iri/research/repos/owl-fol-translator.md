## 1. Overview & purpose

OFBT presents itself as an "OWL-FOL Bidirectional Translator" and describes its purpose as round-trip translation between OWL 2 DL ontologies and First-Order Logic while preserving axiomatic content across their expressivity gap (`README.md:1-3`).

Its core stance is to keep OWL and FOL synchronized instead of choosing one representation: clean OWL content stays OWL, FOL-only content is held in FOL, and OWL projections use property chains plus structural annotations for the gap (`README.md:7-10`, `README.md:27-35`).

The project treats annotated approximation as a recoverable residue: projected OWL carries original FOL, a reason OWL cannot express it, the weaker OWL approximation, and a round-trip identifier (`README.md:37-42`).

The implementation is organized around a pure kernel, optional composition layer, and adapters, with JSON-LD as the canonical kernel input/output representation (`docs/ARCHITECTURE.md:35-48`).

For our mining angle, the important modeling surface is the structured `OWLOntology` data shape with explicit `tbox`, `abox`, `rbox`, and `annotations` fields rather than raw RDF triples (`src/kernel/owl-types.ts:13-22`).

## 2. License

License status: `port-with-attribution`, because the verified license file is MIT (`LICENSE:1-13`).

Verified by reading `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/LICENSE` directly; the file begins with "MIT License" (`LICENSE:1-3`).

The relevant grant says, "Permission is hereby granted, free of charge" and allows use, copy, modification, merge, publish, distribution, sublicensing, and sale subject to including the copyright and permission notice (`LICENSE:5-13`).

The warranty disclaimer states that the software is provided "AS IS" without warranty and limits author liability (`LICENSE:15-21`).

## 3. Identity / IRI handling

The OWL ontology model carries an optional `prefixes?: Record<string, string>` table alongside `ontologyIRI`, optional `versionIRI`, imports, TBox, ABox, RBox, and annotations (`src/kernel/owl-types.ts:13-22`).

The API specification accepts IRI input in full URI form, CURIE form, and bracketed full URI form; CURIEs require a prefix declaration and undeclared CURIE prefixes throw `IRIFormatError` (`project/OFBT_API_v0.1.7.md:650-663`).

Internally, OFBT canonicalizes all IRIs to expanded full URI strings, and FOL predicates/constants use that expanded form by default (`project/OFBT_API_v0.1.7.md:666-698`).

The runtime canonicalizer implements that contract: it recognizes blank-node labels, bracketed full URIs, CURIEs, and full URI strings, then returns bare expanded full URI strings (`src/kernel/iri.ts:89-164`).

The canonicalizer includes built-in standard prefixes for `rdf`, `rdfs`, `owl`, `xsd`, `obo`, and `cco`, while caller-supplied prefixes override standard-prefix lookup (`src/kernel/iri.ts:18-48`, `src/kernel/iri.ts:130-137`).

Blank nodes in `_:` form are mapped to deterministic Skolem IRIs under `https://ofbt.ontology-of-freedom.org/ns/0.1/bnode/` (`src/kernel/iri.ts:56-77`, `src/kernel/iri.ts:100-110`).

Projection back to OWL preserves prefix ergonomics by carrying `config.prefixes` onto the output ontology when supplied and omitting the `prefixes` key when not supplied (`src/kernel/projector.ts:389-399`, `src/kernel/projector.ts:491-500`).

## 4. OWL construct modeling (axiom data model) -- this is the key section, go deep here

Top-level shape: `OWLOntology` is a structured JS object with `ontologyIRI`, optional version/import/prefix metadata, `tbox`, `abox`, `rbox`, and optional `annotations` (`src/kernel/owl-types.ts:13-22`).

TBox model: `TBoxAxiom` is a discriminated union of `SubClassOf`, `EquivalentClasses`, `DisjointWith`, and `ClassDefinition`, each carrying typed class-expression fields rather than loose triples (`src/kernel/owl-types.ts:24-52`).

Class-expression model: `ClassExpression` covers named classes, intersection, union, complement, object restrictions, cardinality restrictions, and `ObjectOneOf` (`src/kernel/owl-types.ts:54-92`).

Restriction model: all object restriction variants share `@type: "Restriction"` and are distinguished by secondary fields such as `someValuesFrom`, `allValuesFrom`, `hasValue`, `minCardinality`, `maxCardinality`, `cardinality`, and optional `onClass` (`src/kernel/owl-types.ts:94-133`).

Datatype-restriction support is present only as a typed punted construct: `DatatypeRestriction` is typed in `owl-types.ts`, and the lifter rejects faceted datatype restrictions before emission (`src/kernel/owl-types.ts:276-282`, `src/kernel/lifter.ts:350-390`).

ABox model: `ABoxAxiom` distinguishes class assertions, object-property assertions, data-property assertions, negative variants, same-individual, and different-individual axioms (`src/kernel/owl-types.ts:135-188`).

Data values are explicit `TypedLiteral` records with `@value`, `@type`, and optional `@language`, which lets `DataPropertyAssertion` differ structurally from `ObjectPropertyAssertion` (`src/kernel/owl-types.ts:159-196`).

RBox model: `RBoxAxiom` is object-property focused and covers subproperty, equivalent properties, inverse properties, property chains, domain/range, disjoint object properties, and object-property characteristics (`src/kernel/owl-types.ts:198-261`).

Property characteristics are modeled as a literal union of `"Functional"`, `"InverseFunctional"`, `"Transitive"`, `"Symmetric"`, `"Asymmetric"`, `"Reflexive"`, and `"Irreflexive"` (`src/kernel/owl-types.ts:250-260`).

Annotations are modeled as `AnnotationAxiom` records with a property IRI, optional subject, string-or-typed-literal value, and optional nested annotations field so annotation-on-annotation patterns can be detected and rejected (`src/kernel/owl-types.ts:263-274`, `src/kernel/lifter.ts:364-378`).

ARC metadata is also data-first: `ARCEntry` records include name, level, context, notation, formal definition, `owlCharacteristics`, realization, `subPropertyOf`, domain, range, canonical `iri`, and notes (`src/kernel/arc-types.ts:33-64`).

ARC modules bundle entries under a `moduleId` and `arcManifestVersion`, and optionally carry module-level `disjointnessAxioms` and `bridgeAxioms` (`src/kernel/arc-types.ts:77-120`).

Bridge axioms are a discriminated union over `axiomForm` values `"reflexivity"`, `"symmetry"`, and `"parthood-extension"` with form-specific fields (`src/kernel/arc-types.ts:123-177`).

Disjointness axioms are explicit data records with `@type: "DisjointnessAxiom"` and a `classes` list whose pairwise-disjoint semantics are documented on the type (`src/kernel/arc-types.ts:179-203`).

## 5. Translation/round-trip architecture + validation

The lifter entrypoint is `owlToFol(ontology, config?)`; it rejects punted constructs first, optionally performs strict ARC coverage checks, then emits TBox, RBox, ABox, identity machinery, structural annotations, and ARC-derived axioms in a fixed order (`src/kernel/lifter.ts:181-302`).

TBox lifting maps `SubClassOf` to a universal implication, `EquivalentClasses` to bidirectional subsumption, `DisjointWith` to conjunction-implies-false, and `ClassDefinition` to equivalent-class style bidirectional subsumption (`src/kernel/lifter.ts:630-688`).

RBox domain and range are translated conditionally as `∀x,y. P(x,y) -> D(x)` and `∀x,y. P(x,y) -> R(y)`, avoiding existential synthesis (`src/kernel/lifter.ts:734-786`).

RBox property characteristics implemented in the lifter include `Functional`, `Transitive`, and `Symmetric`, and `InverseObjectProperties` emits a bidirectional implication pair (`src/kernel/lifter.ts:787-931`).

Class-expression lifting recursively maps named classes, intersections, unions, complements, `someValuesFrom`, `allValuesFrom`, `hasValue`, cardinalities, and `ObjectOneOf` into FOL term-tree shapes (`src/kernel/lifter.ts:1403-1560`).

Structural annotations only lift when the caller declares their property IRI in `config.structuralAnnotations`; declared annotation IRIs are canonicalized before membership checks (`src/kernel/lifter.ts:1168-1245`).

The projector entrypoint is `folToOwl(axioms, recoveryPayloads?, config?)`; it suppresses injected identity axioms, pair-matches multi-axiom constructs, performs single-axiom direct mapping, and distributes reconstructed axioms into TBox/ABox/RBox buckets (`src/kernel/projector.ts:393-610`).

Direct projection reconstructs class assertions, object-property assertions, data-property assertions, `SubClassOf`, domain/range, property characteristics, subproperties, disjoint properties, and property chains through matcher functions (`src/kernel/projector.ts:621-819`, `src/kernel/projector.ts:1007-1197`, `src/kernel/projector.ts:1201-1253`, `src/kernel/projector.ts:1411-1476`).

Cardinality projection uses explicit n-tuple matchers for min, max, and exact cardinality shapes, including QCR `onClass` reconstruction when the FOL shape matches (`src/kernel/projector.ts:1486-1694`).

Pair matching reconstructs `EquivalentClasses`, `EquivalentObjectProperties`, and `InverseObjectProperties` by consuming converse FOL axiom pairs before single-axiom fallback (`src/kernel/projector.ts:1720-1805`).

Loss and recovery artifacts are emitted for classical negation residue, property-chain realization, and unknown relations, with content-addressed IDs derived from stable stringification and SHA-256 (`src/kernel/projector.ts:1878-1945`, `src/kernel/projector.ts:1947-2021`, `src/kernel/projector.ts:2023-2073`, `src/kernel/projector.ts:2192-2211`).

Round-trip validation performs `owlToFol -> folToOwl -> owlToFol`, compares canonicalized FOL sets, treats RecoveryPayload `originalFOL` as recovered evidence, and reports both missing and extra output axioms (`src/kernel/round-trip.ts:50-133`).

The test suite validates lift output with byte-exact `deepStrictEqual`, checks forbidden FOL patterns for wrong-shape canaries, and runs 100-run determinism checks over lifter and projector-direct fixtures (`tests/lifter-phase1.test.ts:238-309`, `tests/determinism-100-run.test.ts:1-72`, `tests/determinism-100-run.test.ts:173-213`).

## 6. API ergonomics -- representative call sites (actual code snippets with file:line)

A lift/project round-trip call site builds a structured `OWLOntology`, calls `owlToFol`, calls `folToOwl`, and compares the reconstructed ABox to the input (`tests/projector-phase2.test.ts:391-420`).

```ts
const lifted = await owlToFol(input);
const projected = await folToOwl(lifted);
deepStrictEqual(projected.ontology.abox, input.abox);
```

The session API call site is explicit: create a session, load an ontology into it, evaluate a query, and pass closed-world predicates only when the caller opts into that behavior (`tests/evaluate-phase3-step4.test.ts:189-199`).

```ts
const session = createSession();
await loadOntology(session, fixture.input);
const result = await evaluate(session, fixture.query, {
  closedPredicates: new Set(fixture.closedPredicates),
});
strictEqual(result.result, "false");
```

The open-world variant omits `closedPredicates` and expects an undetermined result, so the API makes OWA/CWA behavior a call-site parameter rather than an implicit global mode (`tests/evaluate-phase3-step4.test.ts:213-230`).

```ts
const session = createSession();
await loadOntology(session, fixture.input);
const result = await evaluate(session, fixture.query);
strictEqual(result.result, "undetermined");
strictEqual(result.reason, REASON_CODES.open_world_undetermined);
```

The round-trip validation call site uses `roundTripCheck(input)` and asserts `equivalent === true` before checking query behavior and audit artifacts (`tests/projector-phase2.test.ts:1884-1900`).

```ts
const F1 = await owlToFol(input);
const projected = await folToOwl(F1, undefined, { prefixes: input.prefixes });
const F3 = await owlToFol(projected.ontology);

const rt = await roundTripCheck(input);
strictEqual(rt.equivalent, true, "round-trip equivalent");
```

A property-chain recovery helper calls `folToOwl([folChainAxiom], undefined, config)` and filters `newRecoveryPayloads` for `PROPERTY_CHAIN` (`tests/regularity-check-phase4-step6.test.ts:227-235`).

```ts
const result = await folToOwl([folChainAxiom], undefined, config);
const chainRPs = result.newRecoveryPayloads.filter(
  (rp: RecoveryPayload) => rp.approximationStrategy === "PROPERTY_CHAIN"
);
```

## 7. DIAMONDS -- concrete patterns worth adopting; map each one explicitly onto our D1-D9 decisions or handoff phases from the baseline doc

- Data-first construct ASTs: OFBT keeps OWL constructs as explicit discriminated data across TBox/ABox/RBox, then translates from that data (`src/kernel/owl-types.ts:13-22`, `src/kernel/owl-types.ts:24-52`, `src/kernel/owl-types.ts:198-261`). Map to D6/D7: our `$I.ontology` fold should validate compact tuple input, but internally lower to a similarly explicit axiom AST before projection (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:100-114`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:228-257`).

- Separate object-vs-data assertion shapes after inference: OFBT makes `ObjectPropertyAssertion` and `DataPropertyAssertion` structurally different (`src/kernel/owl-types.ts:152-164`). Map to D6: our authoring layer should keep property kind implicit to users, infer it from schema ASTs at fold time, and then materialize distinct internal OWL property/axiom records (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:100-105`).

- Canonical IRI boundary: OFBT normalizes CURIEs/full URIs/bracketed URIs into expanded full URI strings at ingestion (`src/kernel/iri.ts:89-164`). Map to D1/D3: our version should keep the same single canonical boundary, but make it literal-preserving and type-backed rather than only runtime-string backed (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:74-91`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:150-162`).

- Domain/range canaries: OFBT tests the correct conditional domain/range FOL and separately asserts forbidden existential-synthesis shapes are absent (`tests/corpus/p1_prov_domain_range.fixture.js:47-107`, `tests/lifter-phase1.test.ts:286-309`). Map to our projection phase: when schema ASTs imply `rdfs:domain`, `rdfs:range`, SHACL paths, or OWL property declarations, add wrong-shape canaries rather than only positive snapshots (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:337-354`).

- Recovery ledger for non-equivalent projections: OFBT preserves FOL residue in RecoveryPayloads and lets round-trip comparison account for recovered FOL (`src/kernel/projector.ts:1878-2021`, `src/kernel/round-trip.ts:100-133`). Map to the `$I.ontology` assembled value: fold validation should make projections pure, but projection output can still carry a typed diagnostics/recovery ledger for non-OWL-native facts (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:253-257`).

- Relation registry as data: ARC modules model relation metadata and characteristics as records, then a narrow emitter turns loaded records into deterministic FOL axioms (`src/kernel/arc-types.ts:33-64`, `src/kernel/arc-axiom-emitter.ts:214-344`). Map to D8 and the vocab-registry phase: borrowed vocab and relation metadata should be schema-validated sections over a discrete base, not scattered constants or ad-hoc helper calls (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:128-132`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:283-324`).

## 8. ROUGH -- anti-patterns to avoid and why

- Runtime string identity everywhere: OFBT's OWL and FOL records use plain `string` for IRIs and rely on runtime canonicalization (`src/kernel/owl-types.ts:69-72`, `src/kernel/fol-types.ts:60-97`, `src/kernel/iri.ts:89-164`). Avoid this at our public surface because D1-D4 require literal-preserving identity, CURIE predicates, and handle-based references with compile-time typo resistance (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:74-95`).

- Shared `@type: "Restriction"` plus secondary-field sniffing: OFBT models all restrictions under one discriminator and branches on fields like `someValuesFrom`, `allValuesFrom`, `hasValue`, and cardinalities (`src/kernel/owl-types.ts:94-133`, `src/kernel/lifter.ts:1447-1547`). Avoid this for our authoring API because the handoff requires nominal entrypoints and distinct payload schemas rather than runtime overload forensics (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:241-249`).

- Punted constructs as accepted type surface: OFBT types `DatatypeRestriction` and `HasKeyAxiom` so the lifter can reject them later (`src/kernel/owl-types.ts:276-288`, `src/kernel/lifter.ts:308-390`). Use that pattern only at import boundaries; our clean-room authoring surface should avoid advertising unsupported constructs as if they were normal domain values (`scratchpad/identity/README.md:14-24`).

- Silent projection gaps during phased implementation: OFBT documents cases where unmatched direct-mapping shapes were temporarily dropped and where non-named `ClassDefinition` bodies lose the original construct form (`src/kernel/projector.ts:219-232`, `src/kernel/projector.ts:271-284`). Our fold should preserve the handoff's propose-gate-record split: invalid or unsupported ontology facts fail with typed assembly errors before projection, and projections should remain pure (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:253-257`).

- Prose-only domain/range metadata: ARC entries carry `domain` and `range` as text while `iri` is canonicalizable, and the emitter explicitly skips domain/range emission because it lacks class-name-to-IRI mapping (`src/kernel/arc-types.ts:56-61`, `src/kernel/arc-axiom-emitter.ts:27-39`). Avoid that by making our schema handles and CURIE/IRI references first-class endpoints per D4, not prose labels that need a later lookup table (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:92-95`).

- Module-local registry as the integration seam: OFBT's ARC registry is module-local mutable state with explicit register/reset functions, even though it is fenced as kernel-pure no-I/O state (`src/kernel/arc-module-registry.ts:11-25`, `src/kernel/arc-module-registry.ts:31-80`). In our Effect v4 packages, prefer `ServiceMap.Service` and explicit layers for the registry service while keeping the same narrow lookup surface (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:31-33`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:325-328`).

## 9. Sources -- full list of file paths inspected

Baseline:

- `<repo-root>/explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md`
- `<repo-root>/scratchpad/identity/README.md`

Mined repository:

- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/LICENSE`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/README.md`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/package.json`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/docs/ARCHITECTURE.md`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/project/OFBT_API_v0.1.7.md`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/src/index.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/src/kernel/index.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/src/kernel/owl-types.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/src/kernel/fol-types.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/src/kernel/lifter.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/src/kernel/projector.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/src/kernel/round-trip.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/src/kernel/iri.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/src/kernel/transform.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/src/kernel/arc-types.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/src/kernel/arc-validation.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/src/kernel/arc-vocabulary.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/src/kernel/arc-axiom-emitter.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/src/kernel/arc-module-registry.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/src/composition/session.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/tests/lifter-phase1.test.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/tests/projector-phase2.test.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/tests/determinism-100-run.test.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/tests/evaluate-phase3-step4.test.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/tests/regularity-check-phase4-step6.test.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/tests/session.test.ts`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/tests/corpus/p1_restrictions_object_value.fixture.js`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/tests/corpus/p1_restrictions_cardinality.fixture.js`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/tests/corpus/p1_prov_domain_range.fixture.js`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/tests/corpus/p2_property_chain_realization_simplified.fixture.js`
- `<local-research-checkout>/OWL-FOL-Bidirectional-Translator/arc/core/bfo-2020.json`
