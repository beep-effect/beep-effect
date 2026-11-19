# P1 map: how identifiers are derived and published today (2026-11-19)

Input to phase P1 ("L0 identity: declared terms, one digest"). Measured at
`3dbdd1e46ba` (branch `goals/text-knowledge-stack-rebuild-p0-design`, clean tree) with
`effect@4.1.4`. Tracked files only; `scratchpad/` and `.repos/` are excluded
throughout. The census figures in `research/consumer-census.md` section g were taken
at `f9982f3b5e6`; where this map's numbers differ, the head moved (three composers and
about 50 `create(` sites were added since).

Method for the counts in sections 5 and 6: a one-off scanner, run outside the
repository, read every tracked `*.ts`/`*.tsx` file and matched
`const $X = $<Pkg>Id.create("<lit>")(.create("<lit>"))*` bindings, then every
`$X.annote|annoteSchema|annoteKey|annoteClass|annoteError|annoteHttp|class("<name>"`
call on that binding. A binding's module argument is classed `path` when it equals the
file's path relative to its package's `src/` (or package root), extension dropped, or
a suffix of it with at least one `/`; `path-partial` when only the file stem matches;
`free` otherwise. Dynamic arguments (8 sites) and identifiers minted through
factories or `appendLocal` are not counted, so every IRI total below is a lower bound.
The raw `create(` totals can be checked with
`git grep -cP '\$[A-Za-z0-9]+Id\.create\(' -- '*.ts' '*.tsx' ':!scratchpad' ':!.repos'`
(3,311 lines).

## 1. Derivation mechanics (`identity/src/Id.ts`)

- Authority: `IdentityAuthority = "https://beep-effect.com/ns/"`
  (`packages/foundation/modeling/identity/src/Id.ts:77`).
- A composer is a value `@beep/<slug>(/<segment>)*`. `create(seg)` appends one
  validated segment (`composeNext`, `Id.ts:1802-1808`); `compose(...)` builds sibling
  package composers; `make(base, binding)` builds a root (`Id.ts:2173`).
- `toIri(authority, identity)` drops the first `/`-segment (`@beep`) and appends the
  rest (`localPathFromIdentity`, `Id.ts:1680`; `toIri`, `Id.ts:1682-1688`), so
  `@beep/a/b` maps to `https://beep-effect.com/ns/a/b`. `toCurie` gives `beep:a/b`
  (`Id.ts:1690-1696`). The IRI is a pure string function of the identity value; it
  depends on the file path only because callers pass the path as the `create`
  argument (section 5).
- Type-level mirrors: `IriFromIdentity` (`Id.ts:376`) and `CurieFromIdentity`
  (`Id.ts:405`) make `.iri` and `.curie` exact literal types. `.iri`, `.curie`,
  `.identifier`, `.slug`, `.value`, `string()`, `symbol()` are on every composer
  (`IdentityComposer`, `Id.ts:1011`, members at `:1325-1497`).
- Every annotation helper writes the same record: `identityAnnotation`
  (`Id.ts:1810-1827`) returns `schemaId: Symbol.for(identity)`, `identifier: identity`,
  `iri`, `curie` (when the composer has an authority and prefix, which every exported
  package composer has) and `title`. `annote`, `annoteSchema` (`:1909`), `annoteKey`
  (`:1931`), `annoteClass`, `annoteError`, `annoteHttp` and `class` all route through
  it, so each annotated schema, key, check and error carries a path-derived IRI and
  CURIE as schema annotations. `make("X")` and the template tag `` $I`X` `` return the
  identifier string only (no IRI in the result).
- `rebase({ iri, prefix })` (`Id.ts:2058-2068`) keeps the identity and symbol and swaps
  the authority; it is the only mechanism today that publishes a code identity under a
  different IRI, and it still appends the full path (`IriBinding.test.ts:77-90`,
  `https://opip.law/ns/patent#ontology/patent/Claim`).

## 2. `packages.ts`: generation and owners

- `packages/foundation/modeling/identity/src/packages.ts` (4,026 lines) holds the root
  `$I = make("beep", { authority, prefix: "beep" }).$BeepId` (`:47`), one
  `$I.compose(...)` slug list (`generatedComposers`, `:49`), a generated labs list
  between `GENERATED LAB COMPOSERS START/END` (`:273-282`), the merged record
  (`composers`, `:284`; `RepoPkgs`, `:1090`) and one `export const $<Pkg>Id` per
  package, the labs exports generated between `:290-395`.
- 219 composer exports, 219 distinct IRIs (runtime check: every export's `.iri` equals
  the authority plus its identity tail). 215 are package composers; four are
  vocabulary composers: `$I` (the authority itself), `$SemanticFoundationId =
  $OntologyId.create("semantic-foundation")` (`:509`), `$EpistemicId =
  $I.create("epistemic")` (`:535`) and `$QaId = $I.create("qa")` (`:561`). 203 exports
  carry an explicit `IdentityComposer<"@beep/...">` type.
- Slug = npm package name without `@beep/`, not the directory: renaming a package
  renames every IRI under it.
- Writers: `bun run beep create-package` and `delete-package`
  (`packages/tooling/tool/cli/src/commands/CreatePackage/internal/IdentityRegistration.ts:29,44`,
  `IdentityBulkRegistration.ts`, `LabIdentitySegment.ts`; `DeletePackage.command.ts:41,355`)
  and `bun run beep lint identity-registry --fix` (section 8). Deleting a package
  removes its composer and every IRI under it with no record.
- Module composers are written by hand or by generators that print the file path:
  `codegen-kit` (`packages/tooling/library/codegen-kit/src/internal/postProcess.ts:625,733`,
  `config.identity.moduleId`) and the model-first templates
  (`packages/tooling/tool/cli/src/commands/Architecture/internal/ModelFirstTemplates.ts:233,282,360,645`,
  `"${M}/${M}.id"` and siblings).

## 3. `IdentityRegistry.ts`

- `IdentityEncoding = S.Literals(["identity","iri","curie"])` (`:34`, a bare
  `S.Literals`), `IdentityRef` tagged by encoding (`:66`), `IdentityEntry { identity,
  iri, curie, fibers }` with `iri: S.String` (`:104-110`), `IdentityEntry.fromComposer`
  (`:133`), `IdentityNotFoundError` (`:183`), `IdentityRegistryConflictError` (`:211`).
- `IdentityRegistry` is a `Context.Service` (`:253`) with one method,
  `resolve(ref)`. `layerLocal(entries)` (`:276`, `makeLocalRegistry` `:282-317`) builds
  three `HashMap` indexes and fails on a duplicate identity, IRI or CURIE.
- No production layer is built over the 219 composers. The only `src` provider
  outside identity is `packages/foundation/capability/semantic-web/src/identity/IdentityRegistryDataset.ts:50`
  (entries decoded from an RDF dataset), and the semantic-web identity modules have no
  `src` importer outside semantic-web. The registry is a service with test and adapter
  callers only.
- Vocabularies are separate: `VocabEntry { iri, terms }` (`Vocab.ts:63`), `CoreVocab`
  (`Vocab.ts:130`; dcat 45, rdf 17, rdfs 15, skos 32, owl 25, dcterms 98, schema 13
  terms), `SparVocab` (`:590`; doco 6, deo 2, fabio 1, cito 2) and
  `SemanticFoundationVocab` (`:548`), whose `beep` namespace declares four terms. Those
  four are the only declared `beep:` terms in the repository. No entry has a source
  pin, license, version or digest.

## 4. Exported API and consumers outside the package

Files outside `packages/foundation/modeling/identity` that import each name (named
imports from `@beep/identity`, `@beep/identity/<Module>`; JSDoc example imports
included).

| Surface | Importing files | Where |
| --- | --- | --- |
| package composers (`@beep/identity/packages`) | 2,741 files import the module; 3,148 import at least one `$...Id` from either entry; 207 distinct composer names | top: `$RepoCliId` 705, `$LawPracticeServerId` 308, `$LawPracticeDomainId` 127, `$LawPracticeUseCasesId` 98, `$SchemaId` 91 |
| `CoreVocab` | 6 | ontology `Fold.*` (4), ontology test, cli `SyncDataToTs/targets/VocabTerms.ts` |
| `IdentityEntry` | 5 (6 counting `@beep/identity/IdentityRegistry`) | semantic-web `IdentityRdfBinding.ts`, `IdentityShaclProjection.ts`, two semantic-web tests, `epistemic/server/test/IdentityShaclProjection.e2e.test.ts` |
| `IdentityComposer` (type) | 4 | `epistemics/src/Factory/Factory.model.ts`, ontology `Fold.assembly.ts`, shared/domain `entity/EntityId.ts`, `identity/index.ts` |
| `IdentityRegistry` | 3 | semantic-web `IdentityRegistryDataset.ts` and two tests |
| `make` | 3 | ontology `test/Fold.test.ts`, shared/domain `test/IdentityNamespaces.test.ts`, cli `test/lint-identity-registry.test.ts` |
| `expandOption`, `contractOption`, `expandPredicate` | 2 each | ontology `Fold.*` |
| `SparVocab`, `VocabShape` | 2 each | rdf `test/VocabDrift.test.ts`, cli `SparTerms.ts`; ontology `Fold.assembly.ts`, `internal/Fold.ts` |
| `expand`, `IdentityRegistryConflictError`, `SkosClassification`, `Curie`, `Predicate`, `prefixedNameOrIri`, `mergeVocab`, `IdentityAuthority`, `SegmentValue`, `Fibered`, `SafePnLocal`, `SafePnPrefix` | 1 each | ontology (most), `public-site/test/PublicSite.test.ts`, shared/domain `PublicEntityId.ts`, repo-utils `JSDocTagDefinition.model.ts`, the P0 design module |
| `IriFromIdentity`, `CurieFromIdentity`, `CurieFromIri`, `CoreCurieCodec`, `makeCurieCodec`, `IdentityRef`, `IdentityEncoding`, `IdentityNotFoundError`, `VocabEntry`, `VocabRegistry`, `SemanticFoundationVocab`, `BaseIdentityInput`, the `PnLocal` escape helpers | 0 | identity tests only |

Outside the composers, the consumed surface is one package (`@beep/ontology`'s fold,
which owns every CURIE read) plus the semantic-web identity adapter.

## 5. How many IRIs exist, and how many depend on a file path

| Measure | Count |
| --- | --- |
| Package and vocabulary composers (`packages.ts`) | 219 IRIs |
| `create("<literal>")` chains | 3,303 in 3,153 files (2,986 in `/src/` files) |
| Distinct module identities among them | 3,101 |
| Module identity bound in more than one file (shared on purpose, e.g. `$GitId:Git` in three files, `$FileProcessingId:SourceText`) | 44 |
| Distinct IRI-bearing annotation identifiers (schema, key, check, error, class) | 21,434 (20,643 in `/src/` files) |
| Annotation calls by helper (all, not distinct) | `annoteSchema` 14,933, `annoteKey` 4,366, `annote` 2,447, `class` 38, `annoteHttp` 2, `annoteError` 2; plus `make` 31 and template tags 3,032 (identifier only) |
| Schema catalog (`standards/schema-catalog/@beep/*.generated.jsonc`, 197 shards) | 11,485 exported schema entries, 11,242 with an `identity` field |

The schema catalog is the best existing inventory of exported schemas, but its
`identity` field is the annotation's last segment (`"identity":"IdentityEntry"`), not
the composer or the IRI (`packages/tooling/tool/cli/src/commands/Lint/SchemaCatalog.ts:597-656`).
It also omits non-exported schemas and key annotations, which is why it lists about
half as many entries as the scan.

Path dependence of the `create` argument (3,303 chains):

| Class | Chains | `/src/` only |
| --- | --- | --- |
| mirrors the file path (`create("commands/Lint/IdentityRegistry")` in `src/commands/Lint/IdentityRegistry.ts`) | 2,704 (81.9%) | 2,620 |
| file stem only, or other directories plus the stem | 24 | 17 |
| free multi-segment (`"identity/fibers/display-name"`, `"test/Host"`, versioned `"evidence/failure/v2"`) | 364 | 213 |
| free single segment (`"errors"`, `"agent"`, `"WorkItemConfig"`) | 211 | 153 |

Path dependence of the 21,434 annotation IRIs: schema level 15,172 `path`, 65
`path-partial`, 1,878 `free`; key level 4,033 `path`, 327 `free` (41 identifiers
occur at both levels). So about 19,270 (90%) embed a file path, about 2,205 (10%)
embed only the package slug, a hand-chosen module segment and the symbol, and every one
of them embeds the package slug. Four annotation calls sit directly on a package
composer (package plus symbol only). The composer IRIs whose package P2 to P7 rename or
retire carry, in `/src/` files: `$ProvenanceId` 15, `$NlpId` 85, `$SchemaOrgId` 72,
`$OntologyId` 86, `$EpistemicsId` 80, `$RdfId` 123.

## 6. What "published" means concretely

An IRI or identifier is published when it leaves the process. Most of the 21,434
annotation IRIs never do: they are schema metadata read in-process. The exits:

| Artifact | Carries | Derivation | Sites |
| --- | --- | --- | --- |
| RDF T-Box and SHACL written by the research library | module-derived class and property IRIs (`.../repo-cli/commands/Research/Library/Library.schemas/<Class>`, property = class IRI + field) | path | `Library.ontology.ts:34,287,340,378`; `Library.projection.ts:28-29,225-275`; written to `ontology/research-library.ttl` and `.shacl.ttl` (`Library.paths.ts:39,53`) outside the repo; the fold reads the `iri` annotation (`ontology/src/Fold.assembly.ts:136`) and appends fields (`:436`) |
| ontology fold output (Turtle, JSON-LD, Markdown) | the same annotation IRIs for any folded schema | path | `Fold.assembly.ts:909`; pinned in `ontology/test/Fold.test.ts:295,744` (`.../ns/patent/Ontology.models/HttpUrl`, `.../ns/ontology/Ontology.models/OWLClass`) |
| Ontology seeds | 230 concept and scheme IRIs under `.../ns/ontology/semantic-foundation/` | package + free segment | `ontology/src/seed/{docketing,legal-intake,party-roles}.{ttl,jsonld}`; checked by prefix at `ontology/src/TaxonomyLoader.ts:134-138`; fixtures `ontology/test/fixtures/vocabulary-competency.json`, `fixture-slice.jsonld` |
| Practice KG DuckDB bundle (`practice.duckdb`, delivered as a folder) | instance IRIs `.../ns/practice-kg/<kind>/<key>` in `kg_node.iri`, `kg_edge.subject_iri` and `object_iri` (foreign keys, part of the primary key) | root composer, no path | `law-practice/server/src/PracticeKg.projections.ts:79,244-264,958`; pinned in `server/test/PracticeKg.projections.test.ts:1144-1197,1413` |
| SHACL validation reports stored with claim dispositions | `focusNode`/`path` IRIs `.../ns/epistemic/claim/...`, `.../hasEvidenceQuote`, class `.../epistemic/Claim` | vocabulary composer | `epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:39-41`; JSDoc and tests in `epistemic/tables` (`ClaimDisposition.converters.ts:45`, `EpistemicTables.test.ts:140,676`) and pglite integration tests |
| XMP metadata in QA recordings | namespace `.../ns/qa/1.0/` | vocabulary composer | `drivers/exiftool/src/ExiftoolConfig.ts:60`; type-pinned in `exiftool/test/Exiftool.models.test.ts:268-271` |
| in-toto predicate types and skill contracts | `.../ns/skill-contract/evidence/{failure,gate-summary,gate-certificate}/v*`, `.../ns/qa/receipts/<name>/v2`, `.../ns/contracts/qa-inventory/v1`, `.../ns/schemas/qa-judge-*/v1` | free, versioned | `skill-contract/src/Recovery.ts:340`, `EvidenceReceipt.ts:385`, `GateCertificate.ts:335`; `cli/src/commands/Qa/JudgeContract.ts:770-773,841-844,942`, `CitedArtifactExistsGate.ts:31`; committed in `cli/skills/qa-inventory-judge/SKILL.md:2,5` |
| JSON-LD document annotations | `.../ns/document/pattern`, `.../ns/document/citation` | root composer | `rdf/src/Adapters/DocumentAnnotation.ts:20-21` |
| Lab RDF projections | `.../ns/semantica/...`, `.../ns/lejeune/ontology/` | package or root | `apps/labs/semantica/src/layers/RdfProjectionLive.ts:26`, gold fixture `semantica/fixtures/gold/v1/g-projection.json:21,26`; `apps/labs/lejeune-bolt-workbench/src/runtime/Projections.ts:31` |
| Identity RDF binding | each `IdentityEntry` (identity, IRI, CURIE, fibers) as triples with predicates `.../semantic-web/identity/{identifier,curie}` | path-like | `semantic-web/src/identity/IdentityRdfBinding.ts:27-28`, round trip `IdentityRegistryDataset.ts:50` |
| Documents taxonomy seed | `.../ns/documents/taxonomy/legal-document` scheme | root composer | `documents/domain/src/values/Taxonomy/Taxonomy.seed.ts:14` |
| JSON Schema `$defs`/`$ref` names | the `identifier` (code path), not the IRI | path | effect uses the resolved identifier as the reference name (`node_modules/effect/src/SchemaRepresentation.ts:2596-2648`); committed in `packages/tooling/tool/docgen/schema.json` (`#/$defs/@beep~1repo-docgen~1Configuration~1...`, 6 identifiers; referenced by 196 of 198 `docgen.json` files); generated at runtime for MCP tool schemas (`mcp-kit`, `ai-metrics`) |
| OpenAPI component names | the `identifier` | path | `node_modules/effect/src/http-api/OpenApi.ts:682` (`SchemaAST.resolveIdentifier`) |
| JSON Schema `$id` | none | | the two committed repo schemas use relative `$id`s (`standards/effect-laws.allowlist.schema.json:3`); no generator writes an IRI as `$id` |
| Schema catalog shards | last identifier segment only | | `standards/schema-catalog/@beep/*.generated.jsonc` |

In-process only: `schemaId = Symbol.for(identifier)` (no reader outside identity
compares it), Context service keys built from template tags, and the class marker
`~effect/Schema/Class/<identifier>` that `jsonl` strips before persistence
(`jsonl/src/Envelope.ts:336-375`).

Test pins of the derivation:

- `identity/test/IriBinding.test.ts` (26 authority lines): the authority and
  `$I.create("x")` (`:16-33`), the epistemic and QA vocabularies (`:35-50`),
  `@beep/ontology/Ontology.models/HttpUrl` through `create`/`compose` with literal types
  (`:52-75`), `rebase` (`:77-90`), `$SemanticFoundationId` (`:12-14`).
- `identity/test/shape-stable.test.ts`: 85 composer exports pinned to identity strings
  (`expectedPackageComposerIdentities`, `:142`; asserted `:374-391`), `Symbol.for`
  interning (`:412-426`), the annotation record keys for `annote`/`annoteSchema`
  (`:428-446`) and `annoteKey` (`:448-467`). It pins identities, not IRIs.
- Literal-type pins: `public-site/test/PublicSite.test.ts:153-157`,
  `exiftool/test/Exiftool.models.test.ts:268-271`.
- The test-runner pins: `packages/tooling/test-kit/test-runner/src/Vitest.errors.ts`
  hand-writes seven `iri` values, seven `curie`s, seven `identifier`s and seven
  `Symbol.for` ids under `@beep/test-utils/Vitest/...` (31 `test-utils` lines; IRIs at
  `:23,55,65,121,131,141,151`), for `PositiveTimeoutMillis`, `TestContextUnavailable`
  (+`.method`) and `TestHang` (+ three fields), with the comment at `:11-12`.
  `@beep/test-runner` depends on `effect` and `@effect/vitest` only, and
  `@beep/identity` has `@beep/test-runner` as a dev dependency, so test-runner cannot
  import identity without a workspace cycle. `identity/test/VitestErrorsParity.test.ts:23-61`
  re-derives the seven from `$TestUtilsId.create("Vitest")` and asserts equality. The
  `public-origin-literal` law exempts the identity and public-site owners and allowlists
  exactly this file (`cli/src/commands/Laws/RetiredIriAuthorities.model.ts:247-261`).
  These pins are the one place where a published IRI already outlived its package: the
  schemas moved to `@beep/test-runner` and kept the `test-utils` IRIs by hand.

## 7. Where an IRI string is persisted or compared at runtime

The authority literal `beep-effect.com/ns` occurs on 608 lines in 69 tracked files;
outside goals, explorations, standards, identity and the ontology seeds it occurs only
in tests, fixtures, JSDoc, the test-runner pins and `cli/skills/qa-inventory-judge/SKILL.md`.
Composer `.iri`/`.curie` reads outside identity: 62 lines, of which the `src` reads
are the sites in section 6 plus these comparisons:

- `IdentityRegistry` resolves by IRI or CURIE string (`IdentityRegistry.ts:282-317`).
- `TaxonomyLoader` rejects seed concepts not under `$BeepId.iri`
  (`ontology/src/TaxonomyLoader.ts:134-138`).
- The fold matches facts by `subjectIri === assembled.iri` (`Fold.assembly.ts:789,807`).
- The research library compares `property.path.value === \`${$I.iri}/${f.key}\``
  (`Library.ontology.ts:287`).
- `ClaimGate` mints subjects as `${CLAIM_SUBJECT_PREFIX}${encodeURIComponent(fixtureKey)}`
  and SHACL targets by class IRI (`ClaimGate.service.ts:41-67`).

Persisted: the practice KG bundle (DuckDB `kg_node`/`kg_edge`), the stored SHACL report
IRIs of claim dispositions, XMP namespaces in recorded media, and the research library
Turtle files. The first three use vocabulary or root composers with free segments, not
file paths; the research library is the only persisted output that embeds a file path.
No SQL column stores a module-derived schema IRI.

## 8. What `bun run beep lint identity-registry` checks

`packages/tooling/tool/cli/src/commands/Lint/IdentityRegistry.ts` (476 lines). It
reconciles workspace manifests with `packages.ts`: every `@beep/*` workspace has a slug
in a `compose(...)` list and an `export const $<Pkg>Id`; no slug or export is orphaned;
the generated labs segment matches `apps/labs/*`; no file outside `@beep/identity`
builds a local root composer with `make(...)` (test directories exempt). Violation kinds
at `:70-77`; `--fix` registers missing packages and rewrites the labs segment
(`:306-330`). At `3dbdd1e46ba` it prints
`OK: 215 workspace packages registered; 6 lab(s) in the generated labs segment; no orphan or local root composers.`
It does not read module composers, annotation IRIs, the vocabularies or any snapshot,
and nothing in the repository checks that a `create` argument matches its file path:
the 81.9% agreement is convention and generator output.

## 9. What breaks if a code id's IRI stops being a pure function of its path

1. Literal types. `.iri`/`.curie` are exact template-literal types computed from the
   identity (`Id.ts:376,405`). A table lookup returns `TermIri` (or `string`), so the
   `expectTypeOf` pins in `IriBinding.test.ts`, `PublicSite.test.ts:156-157` and
   `Exiftool.models.test.ts:271`, and `as const` consumers like
   `BEEP_QA_XMP_NAMESPACE_URI`, lose their literal type unless the binding table is a
   `const` record keyed by code id.
2. Module-load timing. Annotations are computed synchronously when a module is
   evaluated (`annoteSchema` returns `self.annotate(record)`). A binding that needs an
   Effect, a Layer or `IdentityRegistry` is unavailable there. The lookup must be a pure
   synchronous function over data `@beep/identity` itself holds, because identity
   depends on `effect` only.
3. Derived property IRIs. The fold builds property IRIs as `appendLocal(composer.iri,
   field)` (`Fold.assembly.ts:436`) and the research library rebuilds them for
   comparison (`Library.ontology.ts:287,340`). A field has no annotation of its own, so
   if class IRIs stop following the path, property IRIs need either a binding row per
   field or a rule (class term plus local name) that the binding table states.
4. The test-runner parity test derives the seven pins from `$TestUtilsId`
   (`VitestErrorsParity.test.ts:23-41`). Under bindings it must compare against binding
   rows, and test-runner itself still cannot import identity.
5. `shape-stable.test.ts:428-467` pins the annotation record's keys and values; a
   change in where `iri` comes from must keep the record shape (`schemaId`,
   `identifier`, `iri`, `curie`, `title`) or that test is rewritten with a recorded
   reason.
6. `IdentityEntry.fromComposer` (`IdentityRegistry.ts:133`) copies `composer.iri`; the
   semantic-web dataset round trip would then encode a bound IRI against a path
   identity, and its `layerLocal` duplicate check needs both sides from one table.
7. Snapshot scale. With roughly 21,500 IRIs and 3,100 module identities minted by
   about 3,300 `create` calls, a hand-written binding row per term is not viable; the
   L0-3 snapshot and any binding table must be generated (the schema-catalog lint
   already parses every export syntactically and is a candidate generator).
8. Package renames already planned (`@beep/provenance` to `@beep/text` in P2; the
   ontology, nlp, schema-org and rdf facets in P3 to P7) change every IRI under those
   slugs today. With a binding table, each rename edits `code` columns only, which is
   exactly what the module-rename test must prove.
9. Prior doctrine. `identity-iri-core` and `identity-iri-fold` (both
   `completed-retained`) made composer-derived `iri`/`curie` annotations the addressing
   source and deprecated the explicit address fields of `SemanticSchemaMetadata`
   (`rdf/src/SemanticSchemaMetadata/SemanticSchemaMetadata.schema.ts:300-314`). P1
   reverses that ruling and needs a decision file that names those packets.

What does not break: nothing persisted in SQL stores a module-derived IRI; the
persisted IRIs (practice KG, SHACL reports, XMP) come from root or vocabulary composers
with free segments and can be declared as terms with today's values. JSON Schema and
OpenAPI names are `identifier`s, not IRIs, and stay path-derived unless P1 also changes
`identifier`.

## 10. Constraints a `TermBinding` design must respect

- Home and dependencies: the binding table, `TermIri`, `Namespace` and the snapshot live
  in `@beep/identity`, which depends on `effect` only; `IRI` moves in from
  `rdf/src/Iri.ts` with its `@beep/utils` calls rewritten (decision
  `2026-11-19-p0-l0-homes-iri-in-identity-canonical-json-stays-in-jsonc`). Identity never
  imports `@beep/rdf`, `@beep/jsonc` or `@beep/schema`.
- Synchronous and total at module load: annotation helpers resolve a code id to its
  term without Effect or a service, from data compiled into identity.
- Generated, not hand-kept: about 3,100 module identities and 21,500 annotation IRIs;
  the table and the L0-3 snapshot are written by a `beep` command and checked in CI
  through `lint identity-registry` (the create-package contract, SPEC Verification).
- A rename edits `code`, never `term` (SPEC acceptance "a test renames a module and
  proves no published IRI changes"); a removal from the published set needs a
  `Deprecation` record (L0-3), including removals by `delete-package`, which today drops
  IRIs silently.
- No parallel encoding: the path-derived value is not kept beside the bound one
  (chapter 16 section 4, `standards/architecture/16-knowledge-stack.md:375-411`).
- Public origin: literal IRIs may be spelled only inside the identity and public-site
  owners (`RetiredIriAuthorities.model.ts:247-254`); a generated table elsewhere must
  build IRIs from `IdentityAuthority`.
- Test-runner: it cannot import identity (workspace cycle). "Re-published from the
  registry" (SPEC L0 acceptance) therefore means either a generated pin file inside
  test-runner checked by the parity test, or moving the seven terms' schemas so that
  identity owns them; the allowlist entry in `RetiredIriAuthorities.model.ts:255-260`
  changes with it.
- Registry over every namespace: six new namespaces (`prov`, `oa`, `nif`, `xsd`,
  `gufo`, `as`) and source pin, license and digest on `skos` and `doco` (decision
  `2026-11-19-p0-rq3-external-vocabularies-as-adapters-confirmed`). Under decision
  `2026-11-19-p0-l0-split-by-dependency` (PR #3420 review), identity's `Namespace` is
  prefix plus IRI and `Term` is IRI, namespace and local name, with string versions and
  `S.Literals` domains; the pin (source, license, version, digest) is a `NamespacePin`
  keyed by prefix in `@beep/rdf`, and gUFO typing is a record keyed by term IRI in
  `@beep/ontology`. `VocabEntry { iri, terms }` (`Vocab.ts:63`) and the new `Namespace`
  are two shapes for one concept today and should become one.
- L0-1 is stated on registered terms: `beep:` CURIEs of bound terms must expand and
  contract through the same closed-world codec as external prefixes, so the `beep`
  namespace needs a declared term list (today 4 terms, `Vocab.ts:548`).
- Keep the annotation record shape that `shape-stable.test.ts` pins, or record its
  change.

## 11. Open design questions

1. Which IRIs are terms? Every annotated schema (about 21,500), only schemas that
   reach an exit in section 6 (the fold, the research library, vocabulary composers,
   instance prefixes), or only schemas a kind registry declares? The answer sets the
   size of the binding table and the L0-3 snapshot.
2. Re-published how? Bind each current path-derived IRI as a term with its current
   value (no published IRI changes, strings stay path-shaped but stop being derived),
   or mint new path-free term IRIs once under the breaking-changes ruling and record
   every old IRI as a `Deprecation` with `replacedBy` in the first snapshot.
3. Do unbound annotations keep an `iri`/`curie`? If the composer stops deriving IRIs,
   an unbound schema either has no IRI annotation or fails the build; the fold must then
   refuse an unbound class.
4. Property IRIs: one binding row per field, or a rule (class term plus field local
   name) recorded on the class binding?
5. Does `identifier` change too? It names JSON Schema `$defs` (committed
   `docgen/schema.json`), OpenAPI components and `Symbol.for` ids, and stays a code
   path if only the IRI is bound.
6. Instance IRI prefixes (`practice-kg/<kind>/`, `epistemic/claim/`, `qa/1.0/`,
   `lejeune/ontology/`): declared as namespaces with their own prefixes, or as terms of
   the `beep` namespace? They are the persisted ones.
7. Literal types: is the binding table a `const` record so `.iri` keeps a literal type,
   or do consumers accept `TermIri`?
8. Snapshot source: static extraction (extend `lint schema-catalog` to record composer,
   code id and term) or runtime import of every module? Static extraction misses the 8
   dynamic `create` calls and the factory-minted identifiers (`epistemics/src/Factory`,
   `ontology/src/Classification.models.ts:379`).
9. Do the 44 module identities shared across files, and the 364 free multi-segment
   arguments, become one code id per file, or keep their shared names?
10. Does `IdentityRegistry` become the binding table's runtime view, with a production
    layer built from the generated table, or is it retired in favour of the table plus
    the codec?
