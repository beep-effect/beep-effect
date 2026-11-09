# Reader B: foundation/modeling audit

Scope: `identity`, `rdf`, `provenance`, `epistemics`, `ontology`, `md`, `schema-org` under `packages/foundation/modeling/`, with `nlp` for cross-reference only. Date 2026-11-08. Read-only. Checkout: branch `explorations/nlp-annotation-family`, base `de54b37982b`.

Path shorthand: `M/` = `packages/foundation/modeling/`.

**Method notes and judgment calls**

- "Consumers" counts files matching `@beep/<name>(/|")` under `packages apps`, excluding the package itself. The count includes tests and files that only mention the name as a string, so where it misleads I give the verified import count as well.
- For JSDoc I measured every export declaration with an awk scan rather than sampling 10. The scan pairs an `export` line with an immediately preceding doc block. It excludes `generated/` and `schema-org/src/internal/vocabulary.ts`, and it does not see class statics.
- Claims about external standards (RDF 1.1, Web Annotation, RFC 8785) come from memory and were not re-fetched here. They are marked **[spec, from memory]**.
- Everything marked **Inference** is my reading rather than something a line of code states.

---

## Executive read

The stack has very strong individual parts:

- `VerifiedTextAnchor` proof tokens
- the `makeClaimEnvelope` parametric family
- `Fibered` with tested restriction laws
- the md render/parse round-trip property
- `SafeDocument`
- pinned SPAR acquisition

What's missing is cohesion. No package owns a morphism to its neighbours:

- `rdf` never imports `provenance`, and `provenance` never imports `rdf`.
- `rdf.Prov`, the only real PROV-O model, has no production consumer.
- `@beep/ontology` has 3 import sites and uses only `fold` and `toTurtle`, which bypass `rdf.Dataset`.
- Names such as provenance, ontology, vocabulary and evidence do not denote what their packages hold.

So this looks like a missing **category of contracts** (objects with no morphisms) rather than a set of bad objects. **Inference.**

---

## 1. Package facts

Counts are export declarations (`export const|class|type|interface|function|declare namespace`) in non-generated source, including `internal/`.

### `@beep/identity` (8.3k LOC)

- **Purpose:** "Stable identifiers and Effect schema annotations for Beep packages, plus registered vocabulary expansion and identity lookup." `M/identity/README.md:3-6`
- **Barrel:** 7 `export *` (`Curie`, `Fibered`, `Id`, `IdentityRegistry`, `PnLocal`, `packages`, `Vocab`) `M/identity/src/index.ts`. 285 declarations. Groups:
  - composer machinery (`Id.ts`, 2215 lines)
  - 203 exported `$XId` composers (`packages.ts`, 3736 lines)
  - vocabulary and CURIE (`Vocab.ts`, `Curie.ts`)
  - Turtle `PN_LOCAL` grammar (`PnLocal.ts`)
  - registry service (`IdentityRegistry.ts`)
  - discrete fibrations (`Fibered.ts`)
- **Deps:** `effect` only at runtime. Dev: `@beep/fc-runs`, `@beep/test-runner`, `@beep/types`.
- **Consumers:** 2897 files. Top: tooling/tool/cli 607, law-practice/server/src 203, law-practice/domain/src 108, law-practice/use-cases/src 93, law-practice/server/test 90.

### `@beep/rdf` (10.3k LOC)

- **Purpose:** "Domain-safe RDF and linked-data modeling primitives." `M/rdf/README.md:3`. It owns "IRI/URI identifiers, RDF/JS-aligned terms and datasets, bounded JSON-LD value shapes, and core vocabulary constants" (`:5-8`).
- **Barrel:** 11 `export *`, 6 namespaces (`WebAnnotation`, `Cito`, `Dcat`, `Deo`, `Doco`, `Fabio`) `M/rdf/src/index.ts`. 265 declarations. Groups:
  - IRI/URI syntax
  - RDF terms
  - JSON-LD
  - Evidence selectors
  - PROV-O records plus an RDF codec
  - Web Annotation adapters
  - Md section fold
  - semantic-metadata annotation grammar
  - vocab constants
- **Deps:** `identity`, `md`, `schema`, `utils`, `effect`.
- **Consumers:** 95. Top: tool/cli 13, ontology/use-cases/src 13, modeling/ontology 13, semantic-web 9, ontology/client/test 7.

### `@beep/provenance` (1.2k LOC)

- **Purpose:** "Domain-agnostic provenance value models." It owns "the canonical 'where did this come from?' primitives — starting with `TextAnchor`". `M/provenance/README.md:3-11`
- **Barrel:** 3 `export *`. 25 declarations: identity, anchor, proof.
- **Deps:** `identity`, `schema`, `effect`.
- **Consumers:** 150. Top: law-practice/domain/test 26, apps/labs 21, law-practice/server/test 19, law-practice/domain/src 19, law-practice/server/src 16.

### `@beep/epistemics` (5.3k LOC)

- **Purpose:** "Tenant-free epistemic vocabulary: evidence spans, claim gates, edge identity, contradictions, intervals and claim envelopes." `M/epistemics/README.md:3`
- **Barrel:** 14 `export *`, 1 `export type *` `M/epistemics/src/index.ts`. 99 declarations. Most are `make*` schema factories parameterised by `$I` and local id codecs.
- **Deps:** `identity`, `provenance`, `schema`, `utils`, `@noble/hashes`, `effect`. `M/epistemics/package.json`
- **Consumers:** 60. Top: epistemic/domain/src 12, apps/labs 6, party/server/src 5, epistemic/use-cases/src 5, party/domain/src 4.

### `@beep/ontology` (7.3k LOC plus 6 seed `.ttl`/`.jsonld`)

- **Purpose:** "Ontology modeling package for repo-internal foundation models." `M/ontology/README.md:3`. It owns "domain-agnostic ontology, identity-as-IRI, and manifested external-alignment primitives" (`:7-12`).
- **Barrel:** 13 `export *`, 1 namespace (`Ontology`). 147 declarations. Groups:
  - IPC/CPC/Nice classification
  - SKOS taxonomies and vocabularies
  - identity-triple `Fold`
  - FOLIO HTTP DTOs
  - vendor manifest loading
- **Deps:** `identity`, `rdf`, `schema`, `utils`, `effect`.
- **Consumers:** the raw count is 10. **Verified imports: 3 files, all in `tool/cli` Research/Library** (`Library.ontology.ts:8,32`, `Library.projection.ts:25`, `test/research-library-ontology.test.ts:3`). The other matches are CI partition strings and identity test string fixtures.
- **Unused exports:** `ClassificationRegistry`, `VocabularyRegistry`, `TaxonomyLoader`, `runLibrarianLoop`, `SemanticFoundationSeed`, `DocketingVocabulary`, `PartyKindVocabulary` and `LegalRoleVocabulary` have **zero** references outside the package. `OWLClass` appears outside only in identity test strings.

### `@beep/md` (14.7k LOC)

- **Purpose:** "Schema-first Markdown document modeling and rendering for Beep." `M/md/README.md:3`
- **Barrel:** 8 `export *`. 352 declarations: AST (`Md.model.ts`, 3576 lines), DSL (`Md.ts`), render, escape, safe refinement, conformance. `Md.syntax` and `Md.parse` are subpath-only.
- **Deps:** `html`, `identity`, `markdown`, `schema`, `utils`, `effect`.
- **Consumers:** 68. Top: apps/professional-desktop 22, tool/cli 7, modeling/lexical 5, ui-system/editor 4, workspace/server/test 3.

### `@beep/schema-org` (7.9k LOC, 4.8k vendored)

- **Purpose:** "schema.org as Effect Schema classes: build a JSON-LD graph, serialize it safely into a `<script>` element, and check it against schema.org's own vocabulary offline." `M/schema-org/README.md:3`
- **Barrel:** 9 named-export lines, nodes plus the document (`M/schema-org/src/index.ts`). `conformance-entry` is a subpath. 47 declarations.
- **Deps:** `identity`, `schema`, `effect`.
- **Consumers:** the raw count is 4; **verified imports: 0.** The matches are a CLI partition string, changeset fixtures, a `WholeToken` doc line and the identity registration. It is a port of `@effected/schema-org` 0.7.0 (`M/schema-org/README.md:122-127`).

---

## 2. Load-bearing schemas

### provenance

| Schema | Fields | Encoding | Invariant |
|---|---|---|---|
| `TextAnchor` `M/provenance/src/TextAnchor.ts:156` | `startChar`, `endChar` (`S.Natural`), `quote` (`NonEmptyString`) | `S.Class` with unique-symbol brand | `start < end && end-start == utf16len(quote)` via `TextAnchorWidthCheck` `:92` |
| `SourceTextIdentity` `M/provenance/src/SourceTextIdentity.ts:125` | `scopeRef`, `sourceRef`, `locator: PosixPath`, `sourceDigest`, `textDigest`, `extractor`, `normalizationVersion` | `S.Opaque` | Exact manifestation identity. Digest shape is checked; bytes are bound only in verification. |
| `SourceTextDigest` `:30` | `sha256:<hex>` | `TemplateLiteral` plus brand | Canonical form |
| `VerifiedSourceText`, `VerifiedTextAnchor` `M/provenance/src/VerifiedTextAnchor.ts:246,432` | WeakMap-held snapshot | `S.declare`, frozen class | **Proof token:** unforgeable and not decodable |
| `TextAnchorVerificationReceipt` `:354` | Anchor plus source | `S.Opaque` | Serializable receipt that grants no proof on decode (tested, `test/VerifiedTextAnchor.test.ts:359`) |

- **Documented, not enforced:** `TextAnchor` says `text.slice(startChar, endChar)` "should reproduce `quote`" (`TextAnchor.ts:10-11`). That cannot hold without the source, and it is enforced only through `verifyTextAnchorAgainstVerifiedSource` (`VerifiedTextAnchor.ts:639`).
- **Enforced, undocumented:** lone surrogates are reported as `stale-source` (`VerifiedTextAnchor.ts:~600`, `:22`), a semantically odd reason. "Well-formed text" and "the source moved" are different failures.
- **Predicates that disagree:** `isWellOrdered` permits `start == end` (`TextAnchor.ts:189-190`), while the schema requires `start < end` (`:74`). `isWellOrdered` has zero uses outside the module and its own test.

### rdf

| Schema | Fields | Encoding | Invariant and gap |
|---|---|---|---|
| `IRI`, `IRIReference`, `AbsoluteIRI`, `RelativeIRIReference` `M/rdf/src/Iri.ts:995,873,954,914` | string | brand plus RFC 3987 checks | Syntax only |
| `NamedNode` `M/rdf/src/Rdf.ts:399` | `termType`, `value: IRI` | Opaque | Absolute IRI enforced |
| `Literal` `:484` | `value`, `language: Option`, `datatype: NamedNode` | Opaque | **Not enforced:** language-tagged implies `rdf:langString` **[spec, from memory]**. The doc example builds `xsd:string` plus `language:"en"` (`:1014`), and tests codify it (`test/Rdf.test.ts:475,550-551`). |
| `Quad` `:764` | `subject`, `predicate`, `object`, `graph` | Opaque | Position typing is enforced by unions |
| `Dataset` `:798` | `quads: Array<Quad>` | Opaque | **Not a set.** Duplicates are admitted (no check). `areDatasetsEquivalent` compares sorted serializations (`:1289-1297`), so `[q,q]` ≠ `[q]` and blank-node relabelling ≠ equal. RDFC-1.0 lives elsewhere (`M/../capability/semantic-web/src/services/canonicalization.ts:29`). |
| `TextPositionSelector` `M/rdf/src/Evidence.ts:122` | `start`, `end` | Opaque | **No `start < end`,** and no link to quote |
| `EvidenceAnchor` `:290` | `id`, `target`, `note` | Opaque | Semantically Web Annotation, named "evidence" |
| PROV `Entity` and friends `M/rdf/src/Prov.ts:298-987`; `ProvBundle` `:1089` | `ObjectRef`s, times | Opaque | `ObjectRef` admits IRI, CURIE or local id (`:96`), so there is no referential integrity |
| `DocumentAnnotation` `M/rdf/src/Adapters/DocumentAnnotation.ts:165` | `@context`, `id`, `target`, `body` | Opaque | Hand-pinned JSON-LD context as literal tags (`:36`, `:167-180`) |
| `MdNodeId` `M/rdf/src/Adapters/MdSections.ts:37` | `md-v1/b/<n>` | TemplateLiteral | Stable only within "an immutable Md revision". No schema carries that revision. |

### epistemics

| Schema | Fields | Invariant and gap |
|---|---|---|
| `EvidenceSpan` `M/epistemics/src/EvidenceSpan/EvidenceSpan.model.ts:147` | `TextAnchorFields` flat, `confidence` | Width check, quote ≤ 65,536 (`:~80`). **Doc says "wrapping a TextAnchor" but it spreads fields, so it is not a `TextAnchor` value.** It has no source. |
| `Measurement` `M/epistemics/src/Claim/Claim.model.ts:94` | Tagged: `Similarity`, `ClassifierProbability`, `OrdinalJudgment` | "never a blended score" |
| `BasisDigest` `:128` | 64-hex | Unbranded and unprefixed |
| `ValidTime` `:219` | `Unknown` or `Interval` | Order check. `validAt(Unknown) = false` (`Claim.behavior.ts`), which is an implicit closed-world read choice. |
| `makeClaimEnvelope` → `ClaimVersion` `:276`, `:343` | `id`, `logicalKey`, `proposition`, `supportedBy` (non-empty), `challengedBy`, `validTime`, `knowledge`, `supersedes`, `review`, `signals` | `ClaimLogicalKeyCheck` enforces key = f(proposition). **Documented, not enforceable at value level:** "corrections append and expire, never update." |
| `ReviewState` `:331` | `Proposed`, `Accepted`, `Rejected`, `Disputed`, `Retracted` | Per-case disposition literal makes a mismatch unrepresentable. Good. Transitions are not modelled. |
| `DependenceAssessment` `:319` | `left`, `right`, `dependence`, `basis`, `producedBy` | "unknown is never treated as independent" is doc-only. `left ≠ right` and symmetry are not enforced. |
| `LogicalEdgeIdentity` `M/epistemics/src/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:115-125` | `orgScope`, `matterScope`, `evidenceScope`, `qualifiers`, `relation`, `source`, `target` | Symmetric relation canonical order is tested (`test/Factories.test.ts:113`) |
| `ValidInterval`, `KnowledgeInterval` `ValidInterval.model.ts`, `KnowledgeInterval.model.ts` | Half-open with open upper | Order check; structurally identical twins |

### ontology

| Schema | Invariant and gap |
|---|---|
| `ClassificationConcept` `M/ontology/src/Classification.models.ts:270` | `broader` ≤ 1 and depth ≥ 0. `edition` and `notation` are `NonEmptyString`, so the per-kind `IpcSymbol` and `NiceEdition` brands are not correlated with `kind` in this schema. **Enforced in the loader, not the schema** (`test/Classification.test.ts:154,275`). |
| `TaxonomyConcept` `M/ontology/src/SemanticFoundation.models.ts:224` | `iri`, `broader`, `alignments` use `IRIReference`, so **a relative reference is an admissible concept identity.** Mixes SKOS with filing (`filingSegment`, `documentClasses`). |
| `VocabularyConcept` `M/ontology/src/Vocabulary.models.ts:63` | Same IRIReference issue; a third "concept" shape. |
| `TripleValue` `M/ontology/src/Fold.models.ts:295` | Closed predicates via `isKnownPredicate`. `TypedLiteralValue` has datatype XOR language (`:~270`), the **stricter opposite of `rdf.Literal`**, which requires datatype always. |
| `AssembledFact` `:485` | `reverse: boolean`, a surface syntax marker carried into the semantic model |
| `AssembledOntology` `:669` | Hard SKOS checks (cycles, duplicate prefLabel) are enforced in `fold` (`Fold.assembly.ts:893`, `test/Fold.test.ts:360,377,398`) and are real. |
| `OWLClass` `M/ontology/src/Ontology.models.ts:311` | FOLIO OpenAPI DTO, snake_case, with a `TODO: think about future-proofing for next-gen roadmap` left in a runtime `description` (`:494`). |

### md

| Schema | Invariant |
|---|---|
| `Inline`, `Block` unions `M/md/src/Md.model.ts:1214,3365` | Recursive tagged AST; `po` pattern annotations tested against Pattern Ontology axes (`test/Md.pattern-ontology.test.ts`) |
| `Document` `:3518` | `frontmatter`, `children`. **No revision id, node ids or digest.** |
| `SafeDocument` `M/md/src/Md.safe.ts:870` | Refinement with identical encoding: no raw nodes, URL policy, no duplicate footnotes, no NUL or lone surrogates, HTML conformance, node cap 10,000 (`:58`) |
| `MdSourceMap` `M/md/src/Md.syntax.ts:426` | Pre-order entries; parse bridge only |
| `Heading` `Md.model.ts:1814`, `HeadingLevel` `:1690` | Level literal |

### schema-org

| Schema | Invariant |
|---|---|
| `NodeId` `M/schema-org/src/NodeRef.ts:127` | "A non-empty string without whitespace or control characters", **not an IRI** |
| `NodeRef` `:188` | Reference by `@id` |
| `JsonLdDocument` `M/schema-org/src/JsonLdDocument.ts:360` | Fixed `@context`, flat `@graph`; duplicate-id and conflicting-term errors (`:55,:110`); escaped `toScriptBody` is the single text serializer (`:551`) |
| `ConformanceIssue` `M/schema-org/src/Conformance.ts:405` | Typed findings over the vendored vocabulary |

---

## 3. Naming

### File suffixes versus the standard

`standards/ARCHITECTURE.md:717` prescribes for `foundation/modeling`: "concept modules with `*.schema.ts`, `*.brand.ts`, `*.codec.ts`, `index.ts`; package-specific role files when canonized". `:792` lists core schema roles. `.model.ts` and `.behavior.ts` are entity roles from the slice table (`:1063-1066`).

Actual counts across the 7 packages (`find … | awk`):

| Suffix | Count | Where |
|---|---|---|
| plain | 84 | identity, rdf, provenance, schema-org |
| `.model.ts` | 16 | epistemics concept folders, `Md.model.ts` |
| `.terms.ts` | 11 | rdf generated |
| `.models.ts` | 5 | ontology (plural) |
| `.behavior.ts` | 5 | epistemics, md |
| `.seed.ts` | 2 | ontology |
| `.schema.ts` | **1** | `SemanticSchemaMetadata.schema.ts` |
| `.brand.ts` | **0** | |
| `.codec.ts` | **0** | |

Other roles: `Fold.assembly`, `Fold.projections`, `Fold.markdown`, `Md.syntax`, `Md.parse`, `Md.safe`.

Five layouts coexist in one family:

- flat PascalCase (`provenance`)
- concept folders (`epistemics/Claim/Claim.model.ts`)
- dot-prefixed namespace files (`Md.*`, `Fold.*`)
- plural `.models`
- `Adapters/` and `Vocab/` folders

The standard's anchors are unobserved in the seven audited packages. **Either the standard or the code is wrong.** Because `create("Claim/Claim.model")` feeds identifiers, this drift enters identities too (`EvidenceSpan.model.ts`, `$I` at top).

### Package name versus content

| Name | What it suggests | What it holds |
|---|---|---|
| `provenance` | PROV-O | Text identity and anchoring: **locator-provenance only.** README never mentions PROV. PROV-O actually lives in `rdf/Prov.ts`, and a third "PROV-O-aligned" `Provenance` exists in `M/nlp/src/Handoff/Contract.ts:316`. |
| `ontology` | OWL ontology | SKOS registries, a classification loader, FOLIO **HTTP DTOs**, seeds, and `Fold`, which emits `rdfs:Class`/`owl:*Property` terms but holds no axioms and runs no reasoner. The only used API (`fold`, `toTurtle`) is **not mentioned in the README** (no "Fold" hits). The OWL workbench is a *separate* slice `@beep/ontology-domain` (`README.md:18-23`), which means two "ontology" namespaces. |
| `epistemics` versus `@beep/epistemic-domain` | | Same stem, different layers (decision `standards/architecture/DECISIONS.md:2290`). |
| `Evidence` (rdf) | Evidential support | Web Annotation selectors with no evidential semantics. `EvidenceAnchor`'s spec citation is Web Annotation (`Evidence.ts:290-300`). `party-domain` declares another `EvidenceAnchor` (`packages/party/domain/src/entities/Provenance/Provenance.model.ts:470`). |
| `identity` | Identifiers | Also Turtle grammar, fibrations and ontology annotation options (`Id.ts:712,743`), plus legal-intake terms (`Vocab.ts:548-557`). |
| `md` versus `markdown` | | `markdown` is syntax with positions, `md` is the semantic AST (`md/README` "Parsing Markdown text"). This is a sensible split with an unhelpful name pair. |

### Word collisions

- **Vocabulary, 4 meanings:** identity `Vocab` (namespace plus terms), `rdf/Vocab/*` (NamedNode constants), ontology `VocabularyConcept` (SKOS), schema-org `Vocabulary` (conformance table `Vocabulary.ts:140`).
- **`JsonLdDocument`, 2:** `rdf/JsonLd.ts:452`, `schema-org/JsonLdDocument.ts:360`.
- **`Curie`, 2:** `rdf/Rdf.ts:301` (branded, open-world syntax) and `identity/Vocab.ts:445` (type-level, closed-world). `expandOption` returns None for an unregistered term of a registered prefix (`Curie.ts:81`).
- **`Provenance`, 3-4;** **`Entity`, `Agent`, `Person`, `Organization`** exported bare from the rdf root via `export *` (`Prov.ts:298-596`). `Person` and `Organization` also exist in schema-org and the party slice.
- **`SkosClassification`, 2:** `identity/Id.ts:689` type, `ontology/Fold.models.ts:331` schema.
- **`Span`, 2 in nlp alone:** `Handoff/Contract.ts:249`, `Graph/Schema.ts:358`.
- **`fold`:** `ontology.fold` (`Fold.assembly.ts:893`) is an assembly/validation, not a catamorphism. `rdf.foldMdSections` (`MdSections.ts:290`) builds a nested tree with explicit cursors. Neither is a fold in the algebra sense. Given the owner's taste for category theory, this is a false friend. **Inference.**

### Identifier spelling

- `IRI`, `IRIReference` (schema, upper) in file `Iri.ts` (mixed).
- `iri` (field), `.iri` (composer property, plain string).
- `iri` in `VocabEntry` is `S.String` (`Vocab.ts:63-67`). `IdentityEntry.iri` and `curie` are `S.String` (`IdentityRegistry.ts:104-109`). Identity can't validate them because the schema lives downstream in rdf, so the dependency order forces this.
- Per-module variants: `FolioIriToken`, `ObjectRef`, `NodeId`, `MdNodeId`, `scopeRef`, `sourceRef`, `EdgeEntityRef`, `SourceTextDigest`, `BasisDigest`, `LogicalEdgeKey`, `documentPatternIri`.
- No convention separates *Id* (minted), *Ref* (foreign), *Digest* (content-derived) and *Key* (derived logical identity). `LogicalEdgeKey` and `ContradictionProposalId` are both SHA-256 hex (`LogicalEdgeIdentity.model.ts:106`, `Contradiction.model.ts:328`).

---

## 4. API ergonomics

Style census (occurrence counts in `src/`):

| Package | `S.Class` | `S.Opaque` | `S.brand` | `Effect.fn` | `dual` | `throw`/`getOrThrow` |
|---|---|---|---|---|---|---|
| identity | 0 | 2 | 0 | 2 | 6 | 8 |
| rdf | 0 | 60 | 14 | 0 | 8 | 17 |
| provenance | 1 | 7 | 1 | 3 | 1 | 5 |
| epistemics | 0 | 6 | 36 | 0 | 11 | 2 |
| ontology | 7 | 36 | 0 | 46 | 5 | 0 |
| md | 0 | 57 | 5 | 3 | 48 | 28 |
| schema-org | 1 | 8 | 0 | 3 | 3 | 16 |

Option usage is consistent in rdf (`OptionFromOptionalKey` plus default) and epistemics (`OptionFromNullOr` for row-flat columns). Optional-key versus null encoding differs by package and looks deliberate. **Inference.**

| Package | Good | Bad |
|---|---|---|
| identity | `expandOption` total, dual, schema-free `Curie.ts:113` | `throw` on template misuse `Id.ts:1733-1747`; registry entries unvalidated strings `IdentityRegistry.ts:106-108` |
| rdf | `provBundleToDataset`/`datasetToProvBundle` dual codec `ProvRdf.ts:569,1003` | `makeNamedNode` is `Result.getOrThrow` on arbitrary `string` `Rdf.ts:917-923`; vocab constants depend on it at module load |
| provenance | `verifyTextAnchor` typed, fails closed, reusable batch path `VerifiedTextAnchor.ts:639,721` | Getters `throw` a tagged error `:194,:202,:375,:383`; `isWellOrdered` contradicts the schema `TextAnchor.ts:189` |
| epistemics | `makeClaimEnvelope` parametric over proposition and ids, slices own P `Claim.model.ts:276` | `makeContradictionBehavior`, `makeContradictionArbitraries` staged factory pipeline over 1657 lines needing `Factory/` bespoke `FieldSchema` types `Contradiction.model.ts:1302,1502`, `Factory.model.ts`; arbitraries exported from `src` |
| ontology | `fold` with typed `OntologyAssemblyError` reasons `Fold.assembly.ts:893` | `runLibrarianLoop` names a filing-path pure lookup `TaxonomyRegistry.ts:169`, needlessly Effectful; `classificationConceptIri` takes bare `string` notation `Classification.models.ts:417` |
| md | `parseResult`/`parse` and `decodeSafeDocument` separate boundary from persistence truth `Md.parse.ts:230-251`, `Md.safe.ts:914` | Three spellings of one constructor `youtube`/`youtubeEffect`/`youtubeUnsafe` `Md.ts:1225,1244,1267`; AST names echo HTML (`A`, `P`, `Em`, `Li`, `Ul`) `Md.model.ts:853,1623,652,1899,2040` |
| schema-org | Safe serializer as the only text path `JsonLdDocument.ts:551` | Static-method class instead of data `Vocabulary.ts:140`, `Conformance.ts:670` |

---

## 5. Documentation

JSDoc measured across all export declarations:

| Package | Exports with JSDoc | `**Example**` on doc'd | `**Details**`/`**Gotchas**` | Examples total / executable `import.meta.vitest` |
|---|---|---|---|---|
| identity | 285/285 | 276 | 33 | 304 / 218 |
| rdf | 265/265 | 261 | 9 | 263 / 180 |
| provenance | 25/25 | 25 | 11 | 27 / 22 |
| epistemics | 99/99 | 90 | 36 | 108 / **0** |
| ontology | 146/147 | 144 | 18 | 147 / **20** |
| md | 351/352 | 284 | 51 | 295 / 210 |
| schema-org | 37/47 | 31 | 27 | 65 / **1** |

- No `@example` or `@remarks` tags were found by the scan.
- The form is nearly perfect, but **form is doing better than substance**. Many entries restate the name (`description: "Evidence selector union."` `rdf/Evidence.ts:204`).
- Epistemics, schema-org and most of ontology use non-asserting `console.log` examples, so the highest-stakes code has no executable docs.
- Missing docs: `ontology/src/internal/Fold.ts:7` (internal), `md/src/Md.safe.ts:870`, and `schema-org/src/conformance-entry.ts:58-60`.

### Claims the code does not keep

1. "**Tenant-free** epistemic vocabulary" `M/epistemics/README.md:3`, versus the required `orgScope` "Stringified owning organization id", plus `matterScope` `LogicalEdgeIdentity.model.ts:82,120`.
2. "Keep it product-agnostic: no claim/evidence/IP-law semantics" `M/provenance/AGENTS.md`, versus "**Matter-scoped** identity" `SourceTextIdentity.ts:89,148`.
3. "domain-agnostic ontology" `M/ontology/README.md:7-9`, versus `LegalRoleVocabulary`, `DocketingVocabulary`, `DocumentClass` including `"privileged"`, and `FilingRootKind` `"box-mirror"` (`Vocabulary.seed.ts:22,389`, `SemanticFoundation.models.ts:104,254`). Also versus the foundation guide: "Do not add product-domain concepts to foundation packages" `packages/foundation/CLAUDE.md`.
4. "Consuming slices wrap a `TextAnchor` in their own value objects (e.g. epistemic `EvidenceSpan`…)" `M/provenance/README.md`. It **spreads** fields and shadows `quote` (`EvidenceSpan.model.ts:107-113`), and `EvidenceSpan` is now in foundation, not a slice.
5. "Char-offset" and `startChar`: `TextAnchor.ts:1-11` says "character" but the unit is **UTF-16 code units** (`:66,:96`). `TextPositionSelector` has unspecified units. Web Annotation counts code points **[spec, from memory]**. **Inference:** astral text would misalign in any TextAnchor → selector mapping; no such mapping exists today.
6. "Typed measurement; never a blended score", "five separate signals, no score" `Claim.model.ts:94,317`, versus the same package's `Confidence` unit interval on `EvidenceSpan` (`EvidenceSpan.model.ts:48`) and `ExactNegationConfidence = 1`, `ValueConflictConfidence = 0.9` constants (`ContradictionDetection.model.ts:32,48`), which is an uncalibrated magic number. Slice `packages/epistemic/domain/src/values/ContradictionDetection/ContradictionDetection.model.ts:127,142` re-exports them.
7. "PROV-O-aligned provenance" `M/nlp/src/Handoff/Contract.ts:300-325`: plain `source: string`, `generatedBy: string`, epoch `timestamp: S.Finite`, no prov vocabulary. (Cross-reference.)
8. "stable source-node id" `rdf/Adapters/DocumentAnnotation.ts:140`: `md-v1/b/<index>` is stable only within one revision (`MdSections.ts:37-68`), and the revision is passed by convention, not in the schema.
9. `SemanticFoundationVocab`, "semantic foundation", is the name of a legal-intake taxonomy `identity/src/packages.ts:476`, `Vocab.ts:548`, a grand name for a small seed.
10. Doc example `rdf/Rdf.ts:1014` shows a literal that is invalid in RDF 1.1 **[spec, from memory]**.
11. `@beep/rdf` `AGENTS.md`: "`@beep/semantic-web` may re-export this package for compatibility", a stale-looking migration note. Not verified further.

`M/ontology/README.md` documents only classification and alignment. The live API, `Fold`, is not in it.

---

## 6. Tests: laws versus examples

Summary counts (`it.prop` or fast-check occurrences / test files): identity 10/14, rdf 6/12, provenance 3/3, **epistemics 0/6**, ontology 2/6, md 12/16, schema-org 16/28.

**Genuine laws**

- `identity/test/Fibered.test.ts:115`: pullback restriction and composition (functoriality of restriction).
- `identity/test/Curie.test.ts:58,86`: expand/contract round-trip over the registry.
- `identity/test/PnLocal.test.ts:87`: escape/unescape.
- `md/test/Md.bridge-roundtrip.property.test.ts:44`: `parse ∘ render = normalize` (200 runs), the strongest law here.
- `md/test/Md.test.ts:1165`: URL sanitization fixed point (idempotence).
- `md/test/Md.bridge-corpus.test.ts:130`: never yields unsafe from generated text.
- `rdf/test/ProvRdf.test.ts:214,544`: PROV ↔ Dataset round trip without loss.

**Round-trip floor only**

- `schema-org/test/*.property.test.ts`: generic encode/decode.
- `ontology/test/Ontology.models.test.ts:139,173`: **the only property tests in ontology, and they cover unused FOLIO DTOs.**
- `provenance/test/TextAnchor.test.ts:83`.

**Asserted by examples, no law**

- `provenance/test/VerifiedTextAnchor.test.ts`: 13 examples.
  - Covers proof forgery (`:147`), surrogate split (`:325`), and receipt grants no proof (`:359`). Security intent is excellent.
  - Missing: the constructive law `∀ s,i<j on boundaries: verify(anchor(s,i,j)) succeeds` and its converse. Its single prop (`:384`) only round-trips `SourceTextIdentity`.
- `epistemics/test/Claim.test.ts`, `Interval.test.ts`, `Factories.test.ts`: all examples.
  - `Interval.test.ts:31` tests half-open at points.
  - `Factories.test.ts:113` tests one symmetric digest example.
  - Nothing states key injectivity, order-independence over random inputs, or `versionsAt` laws.
- `ontology/test/Fold.test.ts`, `Classification.test.ts`, `SemanticFoundation.test.ts`, `Vocabulary.test.ts`: strong behaviour examples. "CQ" competency replays are real (`Classification.test.ts:82-101`, `Vocabulary.test.ts:157`), but CQs are in test names, not a shared artifact.
- `rdf/test/VocabDrift.test.ts`: generated constants equal the identity registry. `rdf/test/InteropAndMetadata.test.ts`: WA map round trip and metadata coverage audit.
- `md/test/Md.pattern-ontology.test.ts`: axes containment. `Md.import-boundary.test.ts`: dependency boundary.

**Merely exercised**

- `*/TaggedError.equivalence.test.ts`: per-error field equivalence.
- `identity/test/shape-stable.test.ts`: export inventory.
- `epistemics/test/index.test.ts`, `Factory.test.ts`: resolve/compile checks.

**Wrong law codified:** `rdf/test/Rdf.test.ts:475,550-551` asserts behaviour with `xsd:string` plus language.

---

## 7. Identity minting

There are **multiple registries and no single one.**

**Authority and composers.** `IdentityAuthority = "https://beep-effect.com/ns/"` `identity/src/Id.ts:77`. `$XId.create(segment).iri` appends path segments (`Id.ts:60-61`). 203 composers `identity/src/packages.ts`. So an IRI is **`authority + package + module path + symbol`**, including file-role segments: `"@beep/ontology/Ontology.models/HttpUrl"` (`identity/test/IriBinding.test.ts:58-71`). The README warns: "renaming one changes the resulting identity" (`identity/README.md`, "Keep these segments stable").

**Vocabulary registries**

1. `CoreVocab` `identity/src/Vocab.ts:130` (dcat, rdf, rdfs, skos, owl, dcterms, schema).
2. `SemanticFoundationVocab` `:548` (adds 4 `beep:` legal-intake terms).
3. `SparVocab` `:590` (separately generated `internal/generated/SparTerms.ts`; used outside identity only by a sync target and a drift test).
4. `rdf/src/Vocab/generated/*.terms.ts` generated from (1) and (3) (drift-tested `rdf/test/VocabDrift.test.ts`).
5. **Hand-written, not in any registry:** `PROV_NAMESPACE` `rdf/src/Vocab/Prov.ts:25`, `OA_NAMESPACE` `Vocab/Oa.ts:26`, `XSD_NAMESPACE` `Vocab/Xsd.ts:27`. `identity/src/Vocab.ts` has no `prov`/`oa` entry, so **`prov:wasGeneratedBy` can't expand through `Curie.ts`** even though the repo has 500+ lines of PROV constants. **Verified** by empty grep on `"prov"|"oa"|prov:|oa:` in `Vocab.ts`.
6. `schema-org/src/internal/vocabulary.ts`: a 4.8k-line separate schema.org table, overlapping `CoreVocab.schema`. Schema.org has **two** namespaces-of-record and a repair function, `canonicalizeSchemaOrgIri` `rdf/src/Iri.ts:747`.
7. `IdentityRegistry` service `identity/src/IdentityRegistry.ts:253`: a runtime resolver over `IdentityEntry` rows, with `layerLocal`. Used by CLI lint, ai-metrics and semantic-web `identity/IdentityRegistryDataset.ts`.

**CURIE sites.** `identity/Curie.ts` (closed-world, `makeCurieCodec` `:391`) versus `rdf/Rdf.ts:301` (syntax-only) versus `ontology/src/internal/Fold.ts` `registryPrefix` (a third parse).

**Ad-hoc minting (non-composer)**

| Site | What |
|---|---|
| `apps/labs/semantica/src/layers/RdfProjectionLive.ts:26,41,48-60` | `BASE = ${$SemanticaId.iri}/`; hand-concatenated `${BASE}ontology/EvidenceClaim`, `claim/${id}`, `chunk/${id}`; `:~33-37` re-hard-codes RDF IRIs instead of using `rdf/Vocab`. Pinned by `apps/labs/semantica/fixtures/gold/v1/g-projection.json:21,26`. |
| `apps/labs/ciops/src/projection/Turtle.ts:17-18` | `https://oip.law/ontology/ci-ops#`: **a different authority,** a law-firm domain for CI ops |
| `packages/documents/domain/src/values/Taxonomy/Taxonomy.seed.ts:14,42,364-366` | `$BeepId.create("documents/taxonomy/legal-document")`, then `${iri}#` plus `beep:folderSegment`: a redefined `beep` prefix meaning something different from `SemanticFoundationVocab.beep` |
| `packages/ontology/use-cases/src/aggregates/Session/Session.pizza-tutorial.ts:17` | `https://beep.example/ontology/tutorial/pizza#` (tutorial; acceptable) |
| `packages/drivers/shacl/src/Shacl.validation.ts:63,306` | `urn:beep:shacl:path:unknown`, `urn:beep:shacl:focus:unknown` sentinels, a third scheme |
| `packages/tooling/test-kit/test-runner/src/Vitest.errors.ts:23-151` | String-pinned `https://beep-effect.com/ns/test-utils/Vitest/...` under **`test-utils`, not `test-runner`**. Deliberate parity test `identity/test/VitestErrorsParity.test.ts`; shows the path-derived IRI has already outlived a package rename. **Inference** on the cause. |
| `identity/src/Id.ts:1425` doc | `https://opip.law/ns/patent#`, a domain that redirects to `oip.law` (`apps/oip-web/src/config/OipRedirects.ts:35`) |
| `rdf/Adapters/DocumentAnnotation.ts:36-45` | Hand-pinned JSON-LD context |
| `ontology/Fold.projections.ts:146-147` | `OWL_*` string constants despite `rdf/Vocab/Owl` |
| `rdf/Adapters/MdSections.ts:37,68` | `md-v1/b/` mini-scheme |
| `ontology/Classification.models.ts:397-424` | Composer-derived IRI with `Str.replace("/","-")`, which flattens notation into a path segment. **Inference:** reversible only by convention. |

`rg '\$\{[A-Za-z_]*BASE'` was otherwise Graph-URL and test noise. `rg 'ontology/'` otherwise hit file paths.

---

## 8. Cross-package concept table

| Concept | identity | rdf | provenance | epistemics | ontology | md / markdown | schema-org | nlp (x-ref) |
|---|---|---|---|---|---|---|---|---|
| **Text anchor/span** | | `TextQuoteSelector{exact,prefix,suffix}` `Evidence.ts:78`, `TextPositionSelector{start,end}` `:122`, `FragmentSelector` `:164`, `WebAnnotation*` `Adapters/WebAnnotation.ts:60-138` | `TextAnchor{startChar,endChar,quote}` `TextAnchor.ts:156` | `EvidenceSpan{+confidence}` `EvidenceSpan.model.ts:147` | | `MdSourceMap` `Md.syntax.ts:426`; offsets in `@beep/markdown` | | `Contract.Span{start,end}` `Handoff/Contract.ts:249`; `Graph.Span{Finite}` `Graph/Schema.ts:358` |
| **Source identity** | | `EvidenceTarget.source: IRIReference` `Evidence.ts:247` | `SourceTextIdentity` `:125` | Reused in `ClaimEvidenceBasis` | `sourceIri` on concept | No doc id | `NodeId` | `Provenance.source: string` |
| **Digest** | | Via semantic-web (RDFC) | `sha256:<hex>` `SourceTextDigest` `:30` (service `Digest`) | Bare hex: `BasisDigest` unbranded `Claim.model.ts:128`; `LogicalEdgeKey` `:106`; 6 in `Contradiction.model.ts:300-335` (`@noble`, sync) | | | | |
| **Confidence** | | | Explicitly excluded | `Confidence` `:48` versus `Measurement` `Claim.model.ts:94` | | | | `UnitInterval` `Contract.ts:318`; `S.Finite` `Graph/Schema.ts:390` |
| **Provenance record** | | `ProvBundle`, `ProvRecord` `Prov.ts:1089,1020` | `TextAnchorVerificationReceipt` `:354` | `EvidenceSignals`, `producedBy` `Claim.model.ts:311,319` | `sourceNote` | | | `Provenance` `Contract.ts:316` |
| **Agent/actor** | | `Agent`, `SoftwareAgent`, `Person`, `Organization` `Prov.ts:391-596` | `SourceTextExtractor{name,version}` `:71` | `ids.principal`, `ids.activity` `Claim.model.ts:276` | | | `Person`, `Organization` | `generatedBy: string` |
| **Claim/assertion** | | `DocumentCitation` reified `rdf:Statement` `DocumentAnnotation.ts:87` | | `ClaimVersion`, `ids.assertion` `:343`; `ClaimEvidenceBasis{assertion,subject}` | `AssembledFact` `Fold.models.ts:485` | | | `Relation` `Contract.ts:465` |
| **Graph node/edge** | `Predicate<V>` `^` marker `Vocab.ts:464` | `Quad`, `Dataset` `Rdf.ts:764,798` | | `EdgeEndpoint` `:~`, `LogicalEdgeIdentity`, `EdgeRelation` | `TripleValue`, `AssembledFact` | | `JsonLdNode`, `NodeRef` | `Entity`, `Relation`, `EntityNode`, `RelationNode` |
| **Document/section/paragraph** | | `MdSection`, `MdSourceBlock`, `MdNodeId` `MdSections.ts:108,86,37`; `DOCO_*`; `DeoType` | | | `DocumentClass` `SemanticFoundation.models.ts:104` (a *lifecycle* class) | `Document`, `Heading`, `P` `Md.model.ts:3518,1814,1623`; `DocumentSection` `markdown/src/MarkdownDocument.ts:158`; `Paragraph` `markdown/src/internal/nodes.ts:1797` | `CreativeWork`, `TechArticle` | `Document`, `Paragraph` kinds `Ontology/Kind.ts:215,231` |
| **Vocabulary term** | `VocabEntry` `Vocab.ts:63` | `DOCO_SECTION` etc. | | `EdgeRelation` literals | `VocabularyConcept`, `TaxonomyConcept` | `po` annotation | `Vocabulary` `:140` | Strata kinds |
| **Classification code** | `SkosClassification` (*different sense*) `Id.ts:689` | | | | `ClassificationConcept`, `IpcSymbol`, `CpcSymbol`, `NiceClassNumber` `Classification.models.ts:147-270` | | | |
| **Time interval** | | `ProvDateTime` ISO `Prov.ts:201`, `LifecycleTimes` `:252` | | `ValidInterval`, `KnowledgeInterval`, `ValidTime`; `makeValidIntervalCheck` `Contradiction.model.ts:224` (millis) | | | | `timestamp` epoch-ms `Finite` |

**Outside the seven:**

- `party-domain.EvidenceAnchor` union (`HeaderField | TextSpan | MetadataTag | RecordRow`) `packages/party/domain/src/entities/Provenance/Provenance.model.ts:470`: a **sixth anchor encoding,** and arguably the most honest about non-text evidence.
- `documents-domain` Taxonomy and `law-practice-domain` `LegalRole` re-implement what ontology seeds claim to own.
- `shared/domain` `ClaimLifecycle` adds another claim state vocabulary (`["candidate","shape_valid","consistency_checked","admitted"]`, `ClaimLifecycle.model.ts:20`).

**Morphisms that exist:**

- `EvidenceAnchor ↔ WebAnnotation` (`WebAnnotation.ts:358-716`)
- `ProvBundle ↔ Dataset`
- `Md → MdSection`
- `Text → TextAnchor proof`

**Morphisms missing, all verified by empty grep or absent deps:**

- `TextAnchor ↔ selector` (no `@beep/provenance` in rdf or semantic-web)
- `SourceTextIdentity → prov:Entity`
- `AssembledOntology → Dataset` (Fold imports only `IRI` and `LanguageTag` from rdf, `Fold.models.ts:17-18`)
- `EvidenceSpan`/`Claim → rdf`
- `Md → TextAnchor` (no `@beep/provenance` in md deps)

---

## 9. Ontology skills

| Skill | One line |
|---|---|
| `ontology-requirements` | Elicit competency questions, ORSD and CQ test suites |
| `ontology-scout` | Reuse search over OLS, BioPortal, OBO, LOV; ROBOT module extraction |
| `ontology-foundational-auditor` | UFO/OntoClean gate on code-to-T-Box; has `prompts/`, `references/`, `scripts/`, `templates/` |
| `ontology-conceptualizer` | Glossaries, taxonomies, BFO alignment, anti-patterns |
| `ontology-architect` | OWL axioms via ROBOT, oaklib, KGCL, OWLAPY, owlready2, LinkML |
| `ontology-mapper` | SSSOM mappings, oaklib lexical matching |
| `ontology-validator` | Reasoners, SHACL, CQ suites, ROBOT reports |
| `ontology-curator` | Deprecation, KGCL, diff, release |

`rg -w` hits (code = ts/json in `packages apps`; docs = `docs standards`; goals = `goals explorations`):

| Term | code | docs | goals/explorations |
|---|---|---|---|
| ROBOT | 0 | 2 | 42 |
| oaklib | 0 | 0 | 4 |
| LinkML | 0 | 0 | 29 |
| OntoUML | 0 | 0 | 20 |
| BFO | 0 | 2 | 37 |
| UFO | 2 | 0 | 92 |
| OntoClean | 0 | 0 | 45 |
| SSSOM | 0 | 0 | 13 |

- The UFO code hits: `packages/law-practice/server/test/CompetencyQuestions.test.ts:11-12,854-866` (real UFO-L power-subjection CQs) and a gold fixture cluster label that is an unrelated word (`apps/labs/semantica/fixtures/gold/v1/06df406f321e.entity.json:763`).
- **No package invokes any of these tools.** SHACL does have a driver (`packages/drivers/shacl`).
- Docs say host-side ROBOT validation is outstanding: `docs/product/ontology-workbench.md:33`, `docs/product/ontology-agent-surface.md:3`.
- `docs/PROSE_TO_PROOF_ARCHITECTURE_MAP.md:72` names BFO as the upper ontology, and no schema carries a BFO alignment.
- **Conclusion:** the ontological rigor lives in skills and exploration packets. `SkosMappingKind` (`exactMatch`/`closeMatch`, `SemanticFoundation.models.ts:148`) is the closest code gets to a mapping model, and it is not SSSOM-shaped.
- The existing legal CQ test is the exception and worth elevating. The packets (`goals`, `explorations`) were counted but not read here.

---

## 10. Ranked design smells

| # | Where | What | Why it matters | Clean design |
|---|---|---|---|---|
| 1 | `provenance/src/TextAnchor.ts:156`, `rdf/src/Evidence.ts:78-164`, `epistemics/.../EvidenceSpan.model.ts:147`, `nlp/src/Handoff/Contract.ts:249`, `nlp/src/Graph/Schema.ts:358`, `party/domain/.../Provenance.model.ts:470` | Six anchor encodings, no codecs; `TextAnchor` isn't bound to a source | Legal citation integrity depends on this path, and the pipeline loses the digest between stages | One `Selector` algebra with `Anchored<Source, Selector>`; explicit unit; lawful codecs to WA |
| 2 | `identity/src/Id.ts:60-77`, `identity/test/IriBinding.test.ts:58-71` | IRIs derive from TS package and file paths (`Ontology.models`) | Refactoring changes published identifiers; code identity is confused with term identity; `Vitest.errors.ts:23` already shows the fossil | Separate `CodeId` from `TermIri`; terms minted in a versioned, explicit namespace |
| 3 | `identity/src/Vocab.ts:130,548,590`, `rdf/src/Vocab/Prov.ts:25`, `Oa.ts:26`, `Xsd.ts:27`, `schema-org/src/internal/vocabulary.ts` | Registry fragments; `prov:`/`oa:`/`xsd:` not expandable | CURIE closed-world guarantees apply only to part of the vocabulary, and the most important term sets are outside it | One generated vocabulary registry with pinned source and license per namespace |
| 4 | `identity/src/Vocab.ts:63-67`, `IdentityRegistry.ts:104-109`, `rdf/src/Iri.ts:995`, `ontology/.../SemanticFoundation.models.ts:224`, `rdf/src/Rdf.ts:301` | IRI schema is downstream of the registry; relative refs admitted as concept identity; two `Curie`s | Registry can hold non-IRIs; concept identity may be unresolvable | Move IRI/CURIE syntax to the identity layer; `IRI` for identity, `IRIReference` for syntax only |
| 5 | `rdf/src/Prov.ts:298,1089`, `ProvRdf.ts:569` (consumers: 1 test), `provenance/src/SourceTextIdentity.ts:71`, `nlp/.../Contract.ts:316` | Real PROV-O is unused while the used "provenance" isn't PROV; verification emits no PROV record | Agent and law-practice work needs auditable derivation chains, and the model for that sits idle | `Verify` emits `prov:Activity`; `SourceTextIdentity` projects to `prov:Entity`; delete nlp's lookalike |
| 6 | `ontology/src/Vocabulary.seed.ts:22,389`, `SemanticFoundation.models.ts:104,254`, `identity/src/Vocab.ts:548-557`, `Ontology.models.ts:311`, `documents/domain/.../Taxonomy.seed.ts:42`, `law-practice/domain/.../LegalRole.model.ts` | Product seeds and FOLIO DTOs in foundation with 0 consumers, while slices re-declare them | Foundation's own law is broken and the shared taxonomies have no users | Foundation owns SKOS/classification **shapes**; a law-practice vocabulary package owns data; DTOs move to a driver |
| 7 | `epistemics/README.md:3`, `LogicalEdgeIdentity.model.ts:82,120`, `provenance/src/SourceTextIdentity.ts:89` | "Tenant-free" and "product-agnostic" claims versus required org and matter language | Boundary doctrine isn't true, which weakens every other claim | Generic `Scope` parameter supplied by the slice |
| 8 | `epistemics/.../EvidenceSpan.model.ts:48`, `ContradictionDetection.model.ts:32,48`, `Claim.model.ts:94,317` | Bare confidence and `0.9` sit beside "never a blended score" | The package contradicts its own best idea; uncalibrated numbers in legal evidence read as authority | `Measurement` everywhere; `EvidenceSpan` loses `confidence`; `ValueConflict` is a typed rule id, not 0.9 |
| 9 | `rdf/src/Rdf.ts:484,798,1289,1014`, `test/Rdf.test.ts:475` | `Literal` invariant missing and contradicted by tests; `Dataset` is a list; equality ignores bnode isomorphism | The package named after a formal model does not satisfy it, and laws can't be stated | `Literal` as `Simple \| Typed \| LangTagged`; `Dataset` as a set with quotient equality; canonicalization law in tests |
| 10 | `epistemics/test/*` (0 props), `epistemics` examples 0 executable, `ontology/test/Ontology.models.test.ts:139` | Highest-stakes logic has no property laws; the only ontology properties cover dead DTOs | Direct conflict with the owner's "provable, testable" stated value | Law suites: interval algebra, key injectivity, edge symmetry, `versionsAt` monotonicity |
| 11 | `epistemics/src/Claim/Claim.model.ts:186,304,331`, `ClaimDispositionStatus.model.ts`, `ClaimGate/ClaimGateResult.model.ts`, `Claim.model.ts:157`, `ClaimEvidenceReview.model.ts`, `shared/domain/.../ClaimLifecycle.model.ts:20` | 7 overlapping status vocabularies, no transition system | A claim's status can't be defined in one place; invalid state combinations go unmodelled | One labelled transition system; verdicts are transitions or projections |
| 12 | `provenance/.../SourceTextIdentity.ts:30`, `Claim.model.ts:128`, `LogicalEdgeIdentity.model.ts:106`, `Contradiction.model.ts:300-335`, `epistemics/src/internal/CanonicalJson.ts`, `epistemic/domain/src/values/internal/CanonicalJson.ts` | Prefixed versus bare digests, service versus `@noble`, unbranded; private canonical JSON with two differing copies | Content addressing is a contract, and two copies can diverge. **Inference:** not RFC 8785 (numbers go through ordinary JSON encoding; verify if interop is needed) | `ContentHash<Domain>` multihash-style with domain separation; one canonicalization |
| 13 | `rdf/src/Adapters/MdSections.ts:8,37,108`, `rdf/package.json`, `md/src/Md.model.ts:3518,2885` | rdf depends on md to invent sections and index ids; md has no revision or node identity, but has a `YouTube` block | The dependency points the wrong way; documents, the natural anchor host for legal work, lack identity | md owns `Revision` and structural addresses; adapter package for md→rdf |
| 14 | `ontology/src/Fold.projections.ts:640,146`, `Fold.models.ts:485`, `apps/labs/semantica/src/layers/RdfProjectionLive.ts:41-60`, `Rdf.ts:798` | Four graph encodings; `toTurtle` writes strings, bypassing `Dataset`; hand-minted IRIs in labs | No common semantics for "graph", so the owner can't state a theorem across them | All graph forms get a morphism to `rdf.Dataset`; serialization only from `Dataset` |
| 15 | `ontology` (name), `rdf/src/Evidence.ts`, `Fold.assembly.ts:893`, `standards/ARCHITECTURE.md:717`, `schema-org` (0 imports, 7.9k LOC), `epistemics/src/Contradiction/Contradiction.model.ts` (1657 lines) | Names don't denote; file conventions unobserved; a whole orphan package | Semantic accuracy and API taste suffer; agents cannot navigate by name | Rename by denotation; conform or rewrite the standard; retire schema-org into a Web/SEO capability, or justify it |

### Worth keeping (alpha)

- `VerifiedTextAnchor` unforgeable proofs with a serializable-but-powerless receipt (`provenance/src/VerifiedTextAnchor.ts:172-263,354`, `test/...:148,359`). Add laws.
- `SourceTextIdentity`'s split of artifact digest versus text digest plus pinned extractor (`SourceTextIdentity.ts:136-145`).
- `makeClaimEnvelope` parametric `Claim<P>` with slice-owned propositions (`Claim.model.ts:276`; decision `DECISIONS.md:2290`).
- Bitemporal half-open intervals, unified behind one generic.
- `EvidenceSignals`: five separate signals (`Claim.model.ts:311`).
- `Fibered` restriction with functoriality tests (`identity/src/Fibered.ts`, `test/Fibered.test.ts:115`). Single consumer today (`repo-utils/.../JSDocTagDefinition.model.ts:280`). The name is accurate only for restriction along inclusions. **Inference.**
- `SafeDocument` over a same-encoding persistence truth, plus the md round-trip property.
- Pattern Ontology annotations, tested.
- SPAR pinned acquisition with digest and license (`rdf/README.md` "SPAR provenance").
- `DocumentAnnotation`'s separation of structural (DoCO/DEO) from syntax nodes.
- `ClassificationRegistry` edition pins with "no latest alias" (`ontology/README.md`). This is excellent law-grade discipline, and it needs a consumer.
- The UFO-L and FLINT competency questions (`law-practice/server/test/CompetencyQuestions.test.ts`), the seed of a real CQ methodology.

### Not done

- `nlp` is cross-reference only.
- `goals/` and `explorations/` packets were counted but not read.
- `Contradiction.model.ts` was scanned by exports and header, not read line by line.
- `Md.syntax.ts`, `Md.render.ts`, `Conformance.ts` and `TaxonomyLoader.ts` were scanned by exports.
- A few line references marked `~` are approximate. No code was run.
