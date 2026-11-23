# P5 map: taxonomy, alignments and the legal seeds (L3)

Read-only measurement at b61b79aa79f. No source was edited. Paths are repo-relative; `ontology/` abbreviates `packages/foundation/modeling/ontology/`. Effect APIs were checked against the v4 reference checkout (`effect` 4.1.5 in both `node_modules/effect/package.json` and the reference `packages/effect/package.json`). The census rows quoted below (`research/consumer-census.md:241-248`) were measured at f9982f3b5e6; every count here is re-measured on this head, and where they differ this map wins.

## 1. The package today

`@beep/ontology` holds 17 source modules (7,445 lines, barrel and `internal/` included) and 6 seed data files (1,281 lines). Its runtime dependencies are `@beep/identity`, `@beep/rdf`, `@beep/schema`, `@beep/utils` and `effect` (`ontology/package.json:66-70`); `@beep/rdf` is declared but no `src` module imports it (`rg -n "Dataset|@beep/rdf" ontology/src`: 0 matches). The root barrel re-exports every module, including the FOLIO DTOs as the namespace `Ontology` (`ontology/src/index.ts:53`) and both seed modules (`:67`, `:83`).

| Module | Lines | Facet | P5 disposition (SPEC) |
| --- | --- | --- | --- |
| `Vocabulary.seed.ts` | 515 | legal seed: docketing (25 concepts), party kinds (6), legal roles (11) | move to the law-practice asset pack |
| `SemanticFoundation.seed.ts` | 145 | legal seed: intake taxonomy, document classes, filing roots | move |
| `src/seed/{docketing,legal-intake,party-roles}.{ttl,jsonld}` | 1,281 | seed data files | move |
| `Ontology.models.ts` | 911 | FOLIO HTTP DTOs, 15 exported schemas (`:49-896`) | delete |
| `Vocabulary.models.ts`, `VocabularyRegistry.ts` | 144, 94 | models and pinned lookup over the three vocabulary seeds | not routed by the SPEC (T3) |
| `SemanticFoundation.models.ts`, `TaxonomyRegistry.ts` | 326, 199 | intake models (`DocumentClass`, `FilingRoot`, `SkosMappingKind`, `ConceptAlignment`) and the librarian loop | `SkosMappingKind` becomes `MappingPredicate`; the rest not routed (T3) |
| `TaxonomyLoader.ts` | 1,013 | the manifested loader | stays; changed (section 2) |
| `Classification.models.ts`, `ClassificationRegistry.ts`, `internal/ClassificationXml.ts` | 425, 351, 418 | IPC, CPC and Nice editions | stays; L3-4 (section 6) |
| `Fold.{assembly,models,projections,markdown}.ts` | 983, 807, 691, 307 | the identity-triple fold | `fold -> Dataset` (section 9) |

## 2. The manifested loader and the asset pack

**The loader exists.** It is `TaxonomyLoader` (`ontology/src/TaxonomyLoader.ts:946`), a `Context.Service` with one method, `load(manifestPath, vendorRoot)`, and a `layer` that needs only `FileSystem` (`:999-1012`). It reads a JSONL manifest, decodes each row through the shared row schema `VendorAssetManifestRow` (`:556-567`: `format`, `id`, optional `loadKind`, optional `loadStatus`) and routes it in `decodeLoadManifestEntry` (`:647-669`):

- `loadKind: "concept-alignment"` decodes as `VendorAlignmentManifestEntry` (`:223-260`): an external concept IRI, its fetch URL, a namespace check (`:240-253`), the local concept IRI and a `mappingKind: SkosMappingKind` (`:236`);
- `loadKind: "classification-scheme"` is skipped here and read by `ClassificationRegistry` through the same `decodeVendorManifestRow` (`ClassificationRegistry.ts:217-234`);
- a row with `loadStatus` but no `loadKind` decodes as the legacy `VendorManifestEntry` (`:172-187`), a JSON slice decoded as `TaxonomySeed` (`:767-781`), not as SKOS JSON-LD;
- any other row is a reference row and is skipped.

Every admitted row must be `verified: true` and `VETTED` (`:854-859`); reads go through realpath containment under the vendor root (`resolveVendorPath`, `:696-735`).

**What the loader does not do.**

1. It never checks a digest. Neither `TaxonomyLoader` nor `ClassificationRegistry` hashes a byte: `rg -n "sha|digest" ontology/src` finds only the `sha256` field declaration in the private `ClassificationAsset` (`ClassificationRegistry.ts:50`), which is decoded and never compared. The four classification fixture rows carry `sha256` sixty-four zeros (`ontology/test/fixtures/classification/manifest.jsonl:2-5`) and load green. Digest verification exists only in the exploration's `fetch.sh`, outside TypeScript.
2. It has no route for a vocabulary seed. `VendorLoadKind` is `["concept-alignment", "classification-scheme"]` (`:99`); a `VocabularySeed` (docketing, party kinds, legal roles) cannot be admitted, and the six seed data files are SKOS Turtle and SKOS JSON-LD, which no loader path decodes.
3. It hard-codes the seed it is meant to stop owning. `mergeSlices` starts from `SemanticFoundationSeed` (`:914-931`, importing it at `:30`), so the loader cannot leave `@beep/ontology` without the seed, and the seed cannot leave without changing the loader's signature: the base seed must become an input or a manifest row.

**The asset pack.** The only manifested asset pack in the tree is `explorations/legal-ontology-landscape/assets/` (`README.md:1-40`): a committed `manifest.jsonl` (21 rows), a `fetch.sh` that reproduces the gitignored `vendor/` and checks each `sha256`, and the `vendor/` directory itself (`assets/.gitignore:1`). The exploration is `graduated` (`explorations/legal-ontology-landscape/ops/manifest.json:6-7`). Its rows carry the approval metadata the SPEC says must be preserved: `verified`, `loadStatus`, `license`, `licenseEvidenceUrl`, `reuseVerdict`, `verdictRationale`, `maintenanceStatus` and `sha256` (`README.md:16-40`). Five rows are loader directives: one `concept-alignment` (`folio-email-communication`, `manifest.jsonl:17`, `mappingKind: "closeMatch"`, local concept `semantic-foundation/concept/email-message`) and four `classification-scheme` rows (`:18-21`: IPC 2026.01, CPC 2026.08, Nice 13-2026 texts and structure). An ontology test reads this file across the package boundary (`ontology/test/SemanticFoundation.test.ts:105-128`, path `../../../../explorations/legal-ontology-landscape/assets/manifest.jsonl`) and skips when the packet directory is absent.

**No law-practice asset pack exists.** `packages/law-practice/domain` has no data directory and no `FileSystem` use (`rg -l effect/FileSystem packages/law-practice/domain/src`: 0); its package `files` are TypeScript only (`domain/package.json:79-85`). The nearest law-practice precedent for a sealed data pack is `packages/law-practice/server/assets/citation/` (shipped through `server/package.json:59-63`), where each asset has a `CitationAssetSeal { byteLength, sha256 }` (`server/src/internal/Citation/Asset.ts:46-50`) checked on load (`SemanticVocabulary.ts:70-76`, `:101-115`). That pattern is server-internal and sealed in code, not manifested. Decision `2026-11-19-p0-routing-annotation-asset-pack-and-write-tool-host` names the owner as "the law-practice domain package" and leaves the directory to P5 "when it reads the loader protocol" (SPEC `:714`).

## 3. The legal seeds and everything that reads them

| Seed surface | Readers in `ontology/src` | Readers in `ontology/test` | Readers outside the package |
| --- | --- | --- | --- |
| `DocketingVocabulary`, `PartyKindVocabulary`, `LegalRoleVocabulary` (`Vocabulary.seed.ts:23`, `:304`, `:390`) | `VocabularyRegistry.ts` (load by `Match` over `VocabularySchemeKind`) | `Vocabulary.test.ts` (14 lines; also asserts 25/6/11 concept counts and byte equality of the TTL and JSON-LD files with a serializer written in the test, `:39-95`) | 0 |
| `SemanticFoundationSeed`, `SemanticFoundationSchemeIri` (`SemanticFoundation.seed.ts:33`, `:54`) | `TaxonomyLoader.ts:30`, `:919-928`; JSDoc examples at `SemanticFoundation.models.ts:305` and `TaxonomyRegistry.ts:160` | `SemanticFoundation.test.ts` (5 lines) | 0 |
| `src/seed/docketing.*`, `party-roles.*` | none | `Vocabulary.test.ts:90-93` (`Bun.file` on `src/seed/<file>`) | a path-string fixture in `packages/tooling/tool/cli/test/laws-retired-iri-authorities.test.ts:417-418` (scope test; reads nothing) |
| `src/seed/legal-intake.*` | none | none: no test compares it with `SemanticFoundationSeed` | 0 |

Outside the package the generated catalogs name these symbols (`standards/schema-catalog/@beep/ontology.generated.jsonc`, `standards/instrumentation-catalog/@beep/ontology.generated.jsonc`) and the coverage baseline has rows for `SemanticFoundation.seed.ts` and `TaxonomyLoader.ts` (`standards/coverage.regression-baseline.jsonc:31265`, `:31277`); all are regenerated, none is a consumer. `rg -l` for each seed symbol outside `ontology/`, `goals/`, `explorations/` and `research/` returns only those generated files. The census sums (0 consumers outside the package) hold.

**IRIs to preserve.** Every seed IRI is minted by the composer `$SemanticFoundationId` (`identity/src/packages.ts:529`), for example `vocabulary/docketing/concept/Deadline` (`Vocabulary.seed.ts:21-31`) and `concept/legal-document` (`SemanticFoundation.seed.ts:12-18`), under `https://beep-effect.com/ns/ontology/semantic-foundation/`. That namespace is a registry shard with no terms (`identity/registry/namespaces/semantic-foundation.json`) and is in the snapshot because instances are minted under it; decision `2026-11-19-p1-instances-minted-under-a-declared-namespace` lists "the semantic-foundation seed concepts" as a kept instance family whose bytes stay. The classification scheme IRIs are minted under the same composer (`Classification.models.ts:379-380`) and stay in `@beep/ontology`. The vocabulary seeds carry `version: "1.0.0"` per scheme and `sourceIri` per concept (MPEP and USPTO pages); no seed carries approval metadata of its own. Approval lives in the asset-pack manifest rows (`verified`, `loadStatus`, `license`), so "approval metadata preserved" means the moved seeds get manifest rows that carry it.

**Overlap with law-practice values.** `packages/law-practice/domain` already owns `PartyKind` (`LiteralKit(["natural-person", "juristic-person"])`, `values/PartyKind/PartyKind.model.ts:12`), `LegalRole` (a free `name`, `values/LegalRole/LegalRole.model.ts:27-55`) and `DocketDeadline` (`values/DocketDeadline/DocketDeadline.model.ts:53`, `:160`, `:462`). None references a seed IRI. After the move the slice holds two unaligned vocabularies for party kinds and legal roles (T4).

## 4. The FOLIO DTOs and their consumers

`Ontology.models.ts` exports `SourceType`, `HttpUrl`, `GraphInfo`, `HealthStatus`, `HealthResponse`, `OWLClass`, `OWLObjectProperty`, `OWLClassList`, `OWLObjectPropertyList`, `OWLSearchScore`, `OWLSearchResult`, `OWLSearchResults`, `ValidationErrorLocationSegment`, `ValidationError` and `HTTPValidationError` (`:49-896`). No module in `ontology/src` imports them; the barrel re-exports them (`index.ts:53`). Consumers, re-measured:

| Consumer | Evidence | Change in P5 |
| --- | --- | --- |
| `ontology/test/Ontology.models.test.ts` (190 lines) | imports `OWLClass`, `OWLClassList` and others (`:1-25`) | deleted with the module |
| `ontology/test/Fold.test.ts` | imports `OWLClass` (`:8`) as the fold fixture of "renders the migrated OWLClass module through all four projections byte-identically" (`:948-966`), asserting `https://beep-effect.com/ns/ontology/Ontology.models/OWLClass` | the fixture is rewritten on a schema the test owns |
| `scratchpad/effect-ontology/Domain/Schema/LinkIngestion.ts:8` and `scratchpad/effect-ontology/test/Domain/Schema/PublicSchemas.test.ts:1` | both import `HttpUrl`; tracked files of the `@beep/scratchpad` workspace, which depends on `@beep/ontology` (`scratchpad/package.json:36`) and type-checks them in `check:effect-ontology` (`:13`) | a new home for `HttpUrl` or a local copy (T6) |
| `identity/test/shape-stable.test.ts:416` | `$OntologyId.create("Ontology.models").create("OWLClass")` as a composer path | none: it imports nothing from the module |

The census line naming `IriBinding.test.ts:58-75` and `Identity.test.ts:253-258` (`consumer-census.md:244`) is stale: neither file mentions `Ontology.models` on this head. `identity/src/PnLocal.ts:259-474` uses the string `Ontology.models/HttpUrl` as a JSDoc example of an unsafe local and is unaffected.

## 5. SKOS schemes, `broader` and cycles

There is no `ConceptScheme` or `Concept` schema. Three concept shapes coexist:

| Shape | `broader` | Cycle handling |
| --- | --- | --- |
| `TaxonomyConcept` (`SemanticFoundation.models.ts:224-236`) | `S.Array(IRIReference)` | none: `mergeSlices` appends imported concepts with no hierarchy check (`TaxonomyLoader.ts:914-931`) |
| `VocabularyConcept` (`Vocabulary.models.ts`, `broader: S.Array(IRIReference)`) | array | none in code; the test checks only that every `broader` target is in the same scheme (`Vocabulary.test.ts:113`) |
| `ClassificationConcept` (`Classification.models.ts:271-286`) | `S.Array(IRIReference).check(S.isMaxLength(1))` plus `depth` (`:279-280`) | refused: `validateSnapshot` fails `hierarchy-invalid` unless every parent exists and has a smaller depth (`ClassificationRegistry.ts:155-171`), which makes cycles unrepresentable |

The repo-owned seeds hold 35 non-empty `broader` arrays (`Vocabulary.seed.ts` and `SemanticFoundation.seed.ts`), 29 `skos:broader` triples in the data files. The repo already depends on the right algorithms: `effect/Graph` exports `isAcyclic` (`Graph.ts:4316`), `findCycle` (`:4212`) and `stronglyConnectedComponents` (`:5747`), present in the installed `dist/Graph.d.ts:4182`, `:4227`, `:5046`; the repo law forbids hand-rolling them. `@beep/ontology` does not use `effect/Graph` today.

L3-1 says an imported cycle is recorded (rebuild report `research/2026-11-08-rebuild-report.md:236`: "admitted with a recorded exception"), but the only imported hierarchies are the classification editions, which the registry refuses (T7).

## 6. Classification editions and pinning (L3-4)

`ClassificationPin { kind, edition }` (`Classification.models.ts:310-336`) checks the edition against the scheme's notation (`IpcEdition`, `CpcEdition`, `NiceEdition`, `:58`, `:88`, `:118`); there is no `latest`. `load` fails `edition-unpinned` for an unknown edition (`ClassificationRegistry.ts:258-263`; tested at `test/Classification.test.ts:192-205`) and detects source drift only through the edition and version strings inside the XML (`test/Classification.test.ts:279-300`). `ClassificationSnapshot` describes itself as "complete immutable" (`:305-306`) but nothing seals it: no digest over the source bytes or over the snapshot. `VocabularyPin { kind, version }` (`Vocabulary.models.ts`) is the second pin; it compares a version string with a constant (`VocabularyRegistry.ts` `load`).

What "a pinned edition is immutable" needs that is missing: the manifest `sha256` compared with the bytes read (the field exists and is ignored, section 2), and a stated equality for two loads of one pin. The failure the report names is "a classification symbol changes meaning" (`rebuild-report.md:359`): a same-edition source whose title changed must be refused, which only a byte digest catches.

## 7. SSSOM, mapping sets and alignment code

There is no SSSOM code: `rg -i "sssom|semapv|MappingSet\b|mapping_justification"` over `packages`, `apps`, `scratchpad` and `standards` finds only the knowledge-stack chapter (`standards/architecture/16-knowledge-stack.md:244`, `:287-298`) and substring false positives in court identifiers. The alignment surface is:

- `SkosMappingKind = LiteralKit(["exactMatch", "closeMatch"])` (`SemanticFoundation.models.ts:148`), read by `ConceptAlignment.kind` (`:194`) and `VendorAlignmentManifestEntry.mappingKind` (`TaxonomyLoader.ts:236`); 0 readers outside the package. The committed exploration row spells the unprefixed `"closeMatch"` (`manifest.jsonl:17`), and 12 test and fixture lines do too, so renaming the literals to `skos:closeMatch` breaks that row's decode unless the row is rewritten or the manifest codec maps the old spelling (T9).
- `ConceptAlignment { conceptIri, kind, sourceIri }` hangs on `TaxonomyConcept.alignments` and `VocabularyConcept.alignments`. It carries no justification, no confidence, no license and no set identity.

The registry already declares both sides of the first concrete mapping set: `annotation:{Section, Paragraph, Title, Figure}` (`identity/registry/namespaces/annotation.json`) and `doco:{Section, Paragraph, Title, Figure, List, SectionTitle}` (`doco.json`), with all five SKOS mapping predicates in `skos.json`. P3 deferred "bound to DoCO terms" for the structure kinds to "an SSSOM mapping in P5 (L3 MappingSet)" (SPEC `:1756`). No `semapv:` or `sssom:` namespace is registered (`ls identity/registry/namespaces`), so the sketch's `semapv:` CURIE literals name unregistered terms (T10).

## 8. gUFO, the audit and the one relator

**gUFO terms are registered, unused.** The `gufo` shard declares the twelve classes the L3 typing names plus `mediates` (`identity/registry/namespaces/gufo.json`), pinned by `PinnedVocabularies.ts:256-274` (gUFO 1.0.0 at nemo-ufes/gufo 12b0981, CC-BY-4.0). The only code reading a `gufo:` term is the CURIE law test (`identity/test/Curie.laws.test.ts:138`). gUFO declares no `Mode` class (only IntrinsicMode and ExtrinsicMode, SPEC `:1000` item 5), yet `GufoInstanceCategory` lists `Mode`.

**No audit code exists.** `rg -i "OntoAudit|OntoViolation|ontoclean|rigid"` over `packages` and `apps` finds only patent-claim test prose ("the frame is rigid").

**The relator.** `LegalPositionRelator` (`packages/law-practice/domain/src/entities/LegalPositionRelator/LegalPositionRelator.model.ts`) is the only class in the tree modeled as a relator: one stored advantage-side Hohfeld position between a `bearer: LegalRole` and a `counterparty: LegalRole`, with `content`, `scope`, `sourceNorm`, `grounding` and an `assertingInterpreter`. It drives a check: `LegalPositionRelatorPolicy.screenForOpposition` (`packages/law-practice/use-cases/src/LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.service.ts:183-217`) derives the correlative view by swapping the two roles (`:24-31`) and the opposite view by keeping them (`:33-40`), then emits an opposition candidate when two relators' scopes overlap on all five axes and the views agree on both role players (`:59-80`). The check depends on the relator mediating exactly those two roles, which is what the `mediates` field and the "a Relator mediates at least two roles" rule state. The rebuild report names this class as the pilot (`rebuild-report.md:104`). It is stored (`law_practice_legal_position_relator`; `packages/law-practice/tables/src/entities/LegalPositionRelator/LegalPositionRelator.table.ts`) and its id is `LawPractice.LegalPositionRelatorId` (`packages/shared/domain/src/identity/LawPractice/LegalPositionRelatorId.ts:37`).

**What the pilot lacks.** `LegalPositionRelator` has no term IRI: no registry shard names it (`rg LegalPositionRelator identity/registry`: 0), and no law-practice namespace exists among the 38 shards. The two roles have no terms either: `LegalRole.name` is free text set by the norm (`LegalRole.model.ts:27-32`), so the role terms a `GufoTyping.mediates` set would hold must be minted (for example the advantage bearer and the counterparty positions). The `RoleWithoutKind` rule needs a `Kind` for the roles to specialize; the candidates are the party-kind concepts, but those are SKOS concepts in a seed, not classes (critic 3, `research/2026-11-08-critic-3-product.md:93`) (T12).

## 9. The fold (shared with the L6 map)

`fold(prefix, input)` (`Fold.assembly.ts:981-983`) returns an `AssembledOntology`; `toTurtle` writes strings (`Fold.projections.ts:666-691`), as do `toJsonLd` (`:413`), `toContext` (`:249`) and `toMarkdown` (`Fold.markdown.ts:304`). Outside the package the consumers are the cli research library: `Library.ontology.ts:8` (`fold`, `toTurtle`), `:116` (the fold call), `:405` (`toTurtle(assembled)`), `Library.projection.ts:27` (a type), and `test/research-library-ontology.test.ts:6`, `:317`, `:345`. `Library.ontology.ts:345-357` already builds a second, independent `Dataset` for the SHACL shapes from its own quads and sorts it with `Rdf.sortDatasetQuads`. Whether `toJsonLd`, `toContext` and `toMarkdown` survive "fold -> Dataset as the only serialization path" is for the L6 map and design; this map records only that they are the fold's four string writers.

## 10. The sketch against the live tree

`ops/design/L3.taxonomy.ts` (191 lines) declares the SSSOM and gUFO surfaces; it has nothing for concept schemes, editions, the loader or the asset pack.

| Surface | Sketch | Live tree | Decision and gap |
| --- | --- | --- | --- |
| `MappingPredicate` | `LiteralKit` of five `skos:` CURIEs (`:36-44`) | `SkosMappingKind`, two unprefixed literals (`SemanticFoundation.models.ts:148`) | adopt; migrate `ConceptAlignment`, `VendorAlignmentManifestEntry` and the committed row in one PR (T9) |
| `MappingJustification` | five `semapv:` CURIEs (`:50-56`) | absent; `semapv` unregistered | register `semapv` (unpinned or pinned) or use term IRIs (T10) |
| `MappingConfidence` | `makeSignal(Measurement)` (`:62-64`) | `makeSignal`, `Measurement` live in `@beep/schema/Signal.ts:56`, `:150` (cases `Similarity`, `ClassifierProbability`, `OrdinalJudgment`) | adopt as is; no new edge. `ops/design/index.ts:29` still says "L3 -> @beep/epistemics" and is stale |
| `Mapping` | `S.Opaque` struct over `TermIri` (`:70-78`) | absent | adopt; subject and object are registry term IRIs, which holds for annotation to DoCO |
| `MappingSet` | id, version, `license: SpdxExpression.FromString`, `mappings: S.HashSet(Mapping)` (`:81-88`) | absent | `S.HashSet` encodes in iteration order (decision `2026-11-19-p0-items4-6-9-annotation-document-shape`, SPEC `:676`), and `CanonicalHashSet` admits only string-encoded items (`schema/src/CanonicalHashSet.ts:64`), so the set needs an explicit sorted encoding (T11). `SpdxExpression.FromString` exists (`spdx/src/SpdxExpression.ts:542`, export `:725`) but `@beep/ontology` does not depend on `@beep/spdx`; adding the edge mirrors `@beep/rdf` (decision `2026-11-19-p1-pin-scope-eight-namespaces`) |
| `GufoClassType`, `GufoInstanceCategory` | `LiteralKit`s (`:91-117`) | gUFO shard registered, unused | adopt; `Mode` has no gUFO class (T13) |
| `GufoTyping` | three fields; `mediates` present exactly for a Relator (`:120-140`) | absent | adopt; the filter states presence, the `RelatorUndermediated` violation states "at least two"; both are needed |
| `GufoTypings` | `S.HashMap(TermIri, GufoTyping)` (`:143-145`) | absent | schema in `@beep/ontology` per decision `2026-11-19-p0-l0-split-by-dependency`; the pilot's rows name law-practice terms (T12) |
| `TypedHierarchy` | terms, typing, `specializes` (`:151-159`) | absent; no specialization edges are recorded anywhere for slice classes | adopt; the pilot must state the edges by hand. No disjointness field, which L3-2 needs (T14) |
| `OntoViolation` | `RoleWithoutKind`, `RigidSpecializesAntiRigid`, `RelatorUndermediated` (`:162-171`) | absent | adopt; L3-3 is a `law` row, so its test generates hierarchies with `Arbitrary` over these schemas (`law-test-plan.md:3`) |
| `MappingIncoherence` | `DisjointUpperTypes`, `ConflictingPredicates` (`:177-180`) | absent | `ConflictingPredicates.predicates` uses `S.HashSet(MappingPredicate)`; a string item can use `CanonicalHashSet` |
| `audit`, `checkMappingCoherence` | `declare const` (`:186-191`) | absent | implement as pure functions; the first mapping set (annotation to DoCO) has untyped terms, so `DisjointUpperTypes` cannot fire on it (T14) |
| `ConceptScheme`, `Concept` (L3-1) | absent | three concept shapes (section 5) | not designed; L3-1's test path is `test/ConceptScheme.profile.test.ts` (`law-test-plan.md:22`) (T7, T8) |
| `ClassificationEdition` (L3-4) | absent | `ClassificationPin`, unsealed snapshot, unverified `sha256` (section 6) | digest verification on load (T15) |
| Asset pack and loader | absent | `TaxonomyLoader` with no vocabulary route, no digest check and a hard-coded base seed (section 2) | design needed (T1, T2) |

## 11. Inventories and gates touched

- S31: `standards/schema-first.inventory.jsonc:681-713` holds five ontology rows, none on a moved or deleted file. `standards/coverage.regression-baseline.jsonc:31169-31313` holds rows for `Ontology.models.ts`, `SemanticFoundation.seed.ts`, `SemanticFoundation.models.ts`, `TaxonomyLoader.ts` and `TaxonomyRegistry.ts`; deleted and moved files leave the baseline, and new `src` files need 100% coverage.
- Generated catalogs: `standards/schema-catalog/@beep/ontology.generated.jsonc` (66 lines naming the package, 15 DTO rows at `:26-39`) and the instrumentation catalog are regenerated.
- Docs: `standards/architecture/16-knowledge-stack.md:286-298` ("`MappingSet` and the gUFO typing are Pending P5") and `ontology/README.md:7-16`, `:37-56` (which calls the exploration manifest "the initial asset pack").
- Registry: a law-practice term shard (or terms in an existing one) for the relator pilot, and `semapv` if adopted, move the term snapshot release (decision `2026-11-19-p1-since-is-a-snapshot-vocabulary-release`).

## 12. Law rows and their test paths

| Row | Kind | Test file (planned, absent today) | Live surface it tests |
| --- | --- | --- | --- |
| `L3-1` | profile | `ontology/test/ConceptScheme.profile.test.ts` | none generic; seed and classification hierarchies |
| `L3-2` | profile | `ontology/test/MappingSet.profile.test.ts` | none |
| `L3-3` | law | `ontology/test/OntoAudit.laws.test.ts` | none |
| `L3-4` | acceptance | `ontology/test/ClassificationEdition.test.ts` | `ClassificationRegistry` |

The `profile` rows run over repo-owned data with planted violations (`law-test-plan.md:3`). After the move the repo-owned schemes live in the law-practice pack, so L3-1's repo-owned data is either the pack's files read from an ontology test across the package boundary or a fixture in `ontology/test` (T8).

## Open questions

T1. Where is the law-practice asset pack, physically? Options measured: a data directory in `packages/law-practice/domain` (no data files or `FileSystem` there today; its package `files` would grow), a directory in `packages/law-practice/server` beside `assets/citation`, or TypeScript constants in the domain package like `internal/generated/free-law-project/*`. The decision says "owned by the law-practice domain package"; a domain package that ships files nobody in it reads is new.

T2. What does "manifested, digest-pinned" require of the loader? Today no TypeScript path hashes a byte. Does P5 add `sha256` (and byte length, like `CitationAssetSeal`) verification to `readVendorContent` for every row kind, which also fixes the classification fixtures' all-zero digests?

T3. Do the models and registries move with the seeds? `VocabularySchemeKind` is `["docketing", "party-kinds", "legal-roles"]`, `DocumentClass` includes `privileged`, and `FilingRoot`, `runLibrarianLoop` and `VocabularyRegistry` exist only to serve those seeds. Moving only the data leaves legal names in foundation, which the non-goal "Legal semantics in foundation" (SPEC `:125-127`) forbids; moving everything leaves `@beep/ontology` with no generic SKOS scheme model.

T4. After the move the slice has `PartyKind` and `LegalRole` literal kinds and the party-kind and legal-role seed schemes, unaligned. Does P5 align them (a law-practice `MappingSet`, which would be L3-2's first repo-owned data), or record the duplication for a later phase?

T5. How is the base seed supplied once `mergeSlices` (`TaxonomyLoader.ts:914-931`) cannot import it: as an argument to `load`, as a manifest row of a new `loadKind` (for example `vocabulary-scheme` or `taxonomy-seed`), or both? A new load kind also needs a decoder for the SKOS data files, which nothing reads today.

T6. Where does `HttpUrl` go when `Ontology.models.ts` is deleted? Two tracked `@beep/scratchpad` files import it and type-check in `check:effect-ontology`. A search of `packages/**/src` for an existing HTTP URL schema decides between reuse and a scratchpad-local copy.

T7. L3-1 says an imported cycle is admitted and recorded, but the only imported hierarchies (IPC, CPC, Nice) are refused on any reversed `broader` link and cannot hold a cycle (`ClassificationRegistry.ts:155-171`). Is the "recorded" half tested on a vendor `TaxonomySeed` slice, or is the classification refusal kept and the row restated?

T8. Is there one generic `ConceptScheme` and `Concept` schema in `@beep/ontology` that the three concept shapes project onto (so L3-1 has a subject), and which data does the profile test read once the seeds have left the package?

T9. Does `MappingPredicate` keep CURIE literals (`skos:exactMatch`) as the sketch has it, or term IRIs? Either way the exploration row at `manifest.jsonl:17` spells `closeMatch`: rewrite the committed row, or decode the old spelling at the manifest boundary.

T10. `semapv:` (and SSSOM's own `sssom:` terms, if a set is written as RDF) are not registry namespaces. Register them as unpinned shards (as `sh` and `void` were) or pinned ones, or keep the justification as an internal literal domain with no IRI?

T11. How is a `MappingSet` encoded canonically? `S.HashSet(Mapping)` encodes in iteration order; a sorted array by (subject, predicate, object) is the established answer for set-valued fields. Is SSSOM TSV an output in P5, or only the schema?

T12. Where do the pilot's typing rows and terms live? The schema is in `@beep/ontology` by decision, but the rows name `LegalPositionRelator` and its two roles, which are law-practice terms. Options: a law-practice registry shard plus a `GufoTypings` value exported by the law-practice domain package (the schema in foundation, the data in the slice), or the row in `@beep/ontology` as the PLAN wording reads literally.

T13. Which role terms does `LegalPositionRelator` mediate, and which `Kind` do they specialize? The bearer and counterparty positions are structural, while `LegalRole.name` is norm-given; party kinds exist only as SKOS concepts and as a two-literal `PartyKind`. `GufoInstanceCategory` also lists `Mode`, which gUFO 1.0.0 does not declare: keep it as a repo-side category, or split it as P1 noted?

T14. What does "disjoint upper types" mean for L3-2: different `GufoInstanceCategory`, different ultimate `Kind`, or declared disjointness? `TypedHierarchy` has no disjointness field, and the first mapping set (annotation to DoCO) has untyped terms on both sides, so the coherence check has nothing to fire on unless the planted violation types its terms.

T15. For L3-4, is immutability a byte digest of the source checked on load, a digest of the decoded `ClassificationSnapshot` (canonical JSON), or both? Does `VocabularyPin` get the same treatment once the vocabularies are pack rows?
