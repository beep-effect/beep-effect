# P5 map: stored formats, consumers, census rows and gates for L3 and L6

Read-only measurement at b61b79aa79f (`git rev-parse --short HEAD` in the tksr-p5 lane). Source formats and committed fixtures only; no corpus, client document or private live data was read.

Counting rules. "Outside" means outside the owning package. File lists come from `git ls-files -- '*.ts' '*.tsx'` minus `goals/`, `scratchpad/`, `explorations/` and `.repos/` (10,090 files); scratchpad is reported separately where it matters. Counts are lexical lines and include imports and JSDoc examples. Kind is `import` (a `src` module), `test` (a `test/` path or `*.test.ts`), `story`, `root-export` (a barrel re-export) or `indirect` (a string pin, path read or composer path with no import). No `story` file matched any facet below.

## 1. Ontology seed exports (`Vocabulary.seed.ts`, `SemanticFoundation.seed.ts`)

Command: `rg -n '\b(DocketingVocabulary|PartyKindVocabulary|LegalRoleVocabulary|SemanticFoundationSeed|SemanticFoundationSchemeIri|Vocabulary\.seed|SemanticFoundation\.seed)\b'` over the tree minus `goals/` and `scratchpad/`. No package outside `@beep/ontology` imports a seed symbol.

| File:line | Symbol | Kind |
| --- | --- | --- |
| packages/foundation/modeling/ontology/src/index.ts:67 | `export * from "./SemanticFoundation.seed.ts"` | root-export |
| packages/foundation/modeling/ontology/src/index.ts:83 | `export * from "./Vocabulary.seed.ts"` | root-export |
| packages/foundation/modeling/ontology/src/VocabularyRegistry.ts:15 | `DocketingVocabulary`, `LegalRoleVocabulary`, `PartyKindVocabulary` | import |
| packages/foundation/modeling/ontology/src/VocabularyRegistry.ts:73-75 | the three seeds, chosen by `Match.when` on the pin kind inside `VocabularyRegistry.load` | import |
| packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:30 | `SemanticFoundationSeed` | import |
| packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:919-928 | `SemanticFoundationSeed` as the base of every merge in `TaxonomyLoader.mergeSlices` | import |
| packages/foundation/modeling/ontology/src/TaxonomyRegistry.ts:160 | `SemanticFoundationSeed` (JSDoc example) | indirect |
| packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:305 | `SemanticFoundationSeed` (JSDoc example) | indirect |
| packages/foundation/modeling/ontology/src/Vocabulary.models.ts:58,86 | `DocketingVocabulary`, `PartyKindVocabulary` (JSDoc examples) | indirect |
| packages/foundation/modeling/ontology/test/Vocabulary.test.ts:3-5,33,84-85,126-132 | the three vocabulary seeds | test |
| packages/foundation/modeling/ontology/test/Vocabulary.test.ts:90,92 | reads `src/seed/${file}.jsonld` and `src/seed/${file}.ttl` by path and asserts TS, JSON-LD and TTL are identical | indirect (path read) |
| packages/foundation/modeling/ontology/test/SemanticFoundation.test.ts:11,90,158,161,553 | `SemanticFoundationSeed` | test |
| standards/coverage.regression-baseline.jsonc:31265 | `SemanticFoundation.seed.ts` row (100) | indirect |
| standards/architecture/DECISIONS.md:2903-2904 | names both seed modules and `src/seed` | indirect |
| packages/foundation/modeling/ontology/package.json:47-48 | `files` entries `src/**/*.ttl`, `src/**/*.jsonld` | indirect |

Seed IRIs are minted from the path composer `$SemanticFoundationId` (`packages/foundation/modeling/identity/src/packages.ts:529`, `https://beep-effect.com/ns/ontology/semantic-foundation`), at `SemanticFoundation.seed.ts:21-28` and `Vocabulary.seed.ts:21`. The registry declares the namespace with no terms (`packages/foundation/modeling/identity/registry/namespaces/semantic-foundation.json`, snapshot `term-snapshot.json:126-127`, `:552`). No SQL migration, table package or committed JSONL outside the ontology package stores a seed IRI. The only matches for `semantic-foundation`, `vocabulary/docketing`, `vocabulary/legal-role` or `vocabulary/party-kind` are prose under `explorations/`, `docs/ROADMAP.md` and `standards/memory-architecture/`.

Slice re-declarations that import nothing from the seeds, so they are not consumers: `packages/law-practice/domain/src/values/LegalRole/LegalRole.model.ts` and `packages/documents/domain/src/values/Taxonomy/Taxonomy.seed.ts`. The second mints different IRIs under `documents-taxonomy:`.

## 2. FOLIO HTTP DTOs (`Ontology.models.ts`, 15 exported schemas, 911 lines)

| File:line | Symbol | Kind |
| --- | --- | --- |
| packages/foundation/modeling/ontology/src/index.ts:53 | `export * as Ontology from "./Ontology.models.ts"` | root-export |
| packages/foundation/modeling/ontology/test/Ontology.models.test.ts:1-12 | `GraphInfo`, `HealthResponse`, `HTTPValidationError`, `HttpUrl`, `OWLClass`, `OWLClassList`, `OWLObjectProperty`, `OWLObjectPropertyList`, `OWLSearchResults`, `OWLSearchScore` | test |
| packages/foundation/modeling/ontology/test/Fold.test.ts:8 | `OWLClass` | test |
| packages/foundation/modeling/ontology/test/Fold.test.ts:947-976 | "Ontology.fold FOLIO-derived module": folds `OWLClass` and asserts the IRI `https://beep-effect.com/ns/ontology/Ontology.models/OWLClass` | test |
| scratchpad/effect-ontology/Domain/Schema/LinkIngestion.ts:8 | `HttpUrl` | import (scratchpad) |
| scratchpad/effect-ontology/test/Domain/Schema/PublicSchemas.test.ts:1 | `HttpUrl as CanonicalHttpUrl` | test (scratchpad) |
| packages/foundation/modeling/identity/test/IriBinding.test.ts:53-71,97-120 | composer path `$OntologyId.create("Ontology.models")` and its IRI/CURIE strings | indirect |
| packages/foundation/modeling/identity/test/Identity.test.ts:215,253-258 | same composer path, annotation identifier strings | indirect |
| packages/foundation/modeling/identity/test/shape-stable.test.ts:416,429,440-442 | same composer path | indirect |
| packages/foundation/modeling/identity/test/PnLocal.test.ts:57,74,142-146; identity/src/PnLocal.ts:259-474; identity/src/Id.ts:403,1422 | the string `Ontology.models/HttpUrl` as an unsafe-local example | indirect |
| standards/schema-catalog/@beep/ontology.generated.jsonc:26-39 | 14 catalog rows | indirect (generated) |
| standards/coverage.regression-baseline.jsonc:31241 | `Ontology.models.ts` row (100) | indirect |

The identity tests build the composer path themselves and import nothing from `@beep/ontology`, so deleting the module breaks none of them. The census asks for them to be rewritten on a registry term; whether that is required is S16. `scratchpad/package.json` depends on `@beep/ontology` but has no `check` or `test` script (see S13). The FOLIO vendor-alignment path is a separate thing and stays: the `folio` manifest rows of `explorations/legal-ontology-landscape/assets/manifest.jsonl` and the `folio-email-communication` cases in `SemanticFoundation.test.ts`.

## 3. Ontology fold serialization (`fold -> Dataset`)

Exports at `Fold.assembly.ts:954` (`foldWith`), `:981` (`fold`), `Fold.projections.ts:249` (`toContext`), `:413` (`toJsonLd`), `:666` (`toTurtle`), `Fold.markdown.ts:304` (`toMarkdown`). Command: whole-word `rg` of the fold symbols over the cli Research tree, the cli test and scratchpad. Scratchpad hits are unrelated `toTurtle`/`Triple`/`fold` names in its own services.

| File:line | Symbol | Kind |
| --- | --- | --- |
| packages/foundation/modeling/ontology/src/index.ts:27,34,41,48 | fold modules | root-export |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.ontology.ts:8 | `fold`, `toTurtle` | import |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.ontology.ts:35 | `AssembledClass`, `AssembledOntology`, `Triple` (type) | import |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.ontology.ts:81,97,116,232-248 | `Triple`, `fold("research-library", ...)`, `AssembledClass` | import |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.ontology.ts:405,423 | `toTurtle(assembled)` written to `ontology/research-library.ttl` | import |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.projection.ts:27,217,234,239 | `AssembledClass` (type) | import |
| packages/tooling/tool/cli/test/research-library-ontology.test.ts:6,317,345 | `toTurtle`; parses it with N3 and asserts `toTurtle(again) === toTurtle(assembled)` | test |
| packages/tooling/tool/cli/test/research-library-ontology.test.ts:485-486 | reads `ontology/research-library.ttl` and `.shacl.ttl` from a temp root | indirect |
| packages/foundation/modeling/ontology/test/Fold.test.ts | 50 lines of `fold`/`toTurtle`/`toJsonLd`/`toMarkdown`/`toContext`, including "byte-identically" at :948 | test |

Inside the package, `rg -c` counts fold-projection names in Fold.assembly.ts (14), Fold.models.ts (10), Fold.projections.ts (19) and Fold.markdown.ts (6). `Fold.assembly.ts:17` and `Fold.models.ts:19` import `LanguageTag` from `@beep/rdf/Rdf`, and `Fold.assembly.ts:316` reads `.datatype`/`.language` 9 times, so the `Literal` cases reach the fold too. A second, independent `Dataset` is built at `Library.ontology.ts:349-357` (`libraryShapesDataset`, `Rdf.makeDataset(Rdf.sortDatasetQuads(...))`) and at `Library.projection.ts:308`.

## 4. `@beep/rdf` `Dataset` (list to set, quotient, digest)

Today: `Rdf.ts:728-740` `Dataset { quads: S.Array(Quad) }`, `makeDataset` `:1113`, `sortDatasetQuads` `:1221`, `areDatasetsEquivalent` `:1243-1251` (sorted N-Quads string equality). In the Effect v4 reference, `Schema.HashSet` encodes to an array built by `Arr.fromIterable`, in iteration order (`packages/effect/src/Schema.ts:16119-16126`). `Equal` compares plain objects structurally by default (`packages/effect/src/Equal.ts:117-121`).

### 4a. `makeDataset | sortDatasetQuads | areDatasetsEquivalent | Rdf.Dataset | Dataset.make`, outside rdf: 254 lines / 58 files (census at base: 232 / 59)

| File:first line | Lines | Kind |
| --- | ---: | --- |
| apps/labs/lejeune-bolt-workbench/src/runtime/Projections.ts:348 | 2 | import |
| apps/labs/semantica/src/layers/RdfProjectionLive.ts:113 | 3 | import |
| apps/labs/semantica/src/services/RdfProjection.ts:30 | 1 | import |
| apps/professional-desktop/src/ontology/OntologyWorkspaceSeed.ts:34 | 2 | import |
| apps/professional-desktop/test/ontology-sidecar-registration.test.ts:14 | 2 | test |
| packages/drivers/n3/src/N3.service.ts:69 | 7 | import |
| packages/drivers/n3/test/N3TurtleCodec.test.ts:5 | 4 | test |
| packages/drivers/oxigraph/src/Oxigraph.sparql.ts:189 | 4 | import |
| packages/drivers/oxigraph/test/OxigraphLazyImport.test.ts:2 | 3 | test |
| packages/drivers/rdf-canonize/src/adapters/canonicalization.ts:16 | 6 | import |
| packages/drivers/rdf-canonize/test/CanonicalizationIntegration.test.ts:1 | 6 | test |
| packages/drivers/rdf-canonize/test/CanonicalizationSecurity.test.ts:1 | 4 | test |
| packages/drivers/shacl/src/Shacl.validation.ts:166 | 3 | import |
| packages/drivers/shacl/test/ShaclEngineValidation.test.ts:1 | 6 | test |
| packages/drivers/shacl/test/ShaclLazyImport.test.ts:1 | 2 | test |
| packages/epistemic/server/test/BoundedShaclValidator.test.ts:10 | 2 | test |
| packages/epistemic/server/test/IdentityShaclProjection.e2e.test.ts:5 | 3 | test |
| packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:20 | 2 | import |
| packages/foundation/capability/semantic-web/src/identity/IdentityRdfBinding.ts:11 | 4 | import |
| packages/foundation/capability/semantic-web/src/identity/IdentityRegistryDataset.ts:35 | 2 | import |
| packages/foundation/capability/semantic-web/test/IdentityRdfBindingCoverage.test.ts:4 | 2 | test |
| packages/foundation/capability/semantic-web/test/ServicesAndSurface.test.ts:2 | 5 | test |
| packages/foundation/modeling/annotation/src/rdf/OaCodec.ts:598 | 14 | import |
| packages/foundation/modeling/annotation/test/rdf/OaCodec.laws.test.ts:82 | 8 | test |
| packages/foundation/modeling/annotation/test/support/generators.ts:712 | 2 | test |
| packages/ontology/client/test/auto-open.test.ts:18 | 3 | test |
| packages/ontology/client/test/failure-messages.test.ts:9 | 2 | test |
| packages/ontology/client/test/inspector-actions.test.ts:23 | 2 | test |
| packages/ontology/client/test/Session.atoms.test.ts:34 | 6 | test |
| packages/ontology/client/test/stale-read.test.ts:16 | 2 | test |
| packages/ontology/client/test/workbench-state-lifetime.test.ts:10 | 2 | test |
| packages/ontology/client/test/worker-wire.test.ts:15 | 2 | test |
| packages/ontology/domain/src/aggregates/Session/Session.model.ts:17 | 28 | import |
| packages/ontology/domain/test/Session.test.ts:18 | 6 | test |
| packages/ontology/server/test/OntoauthorMatCompetency.test.ts:22 | 2 | test |
| packages/ontology/ui/test/Session.workbench.test.ts:14 | 2 | test |
| packages/ontology/use-cases/src/aggregates/Session/Session.commands.ts:57 | 6 | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.ports.ts:222 | 4 | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.projections.ts:862 | 5 | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:19 | 9 | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts:68 | 12 | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.service.ts:15 | 2 | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts:10 | 7 | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts:16 | 8 | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts:55 | 4 | import |
| packages/ontology/use-cases/src/tools/OntologyToolService.ts:17 | 2 | import |
| packages/ontology/use-cases/test/GraphLayout.test.ts:8 | 2 | test |
| packages/ontology/use-cases/test/PizzaTutorial.e2e.test.ts:12 | 2 | test |
| packages/ontology/use-cases/test/SchemaParity.test.ts:29 | 2 | test |
| packages/ontology/use-cases/test/Session.test.ts:47 | 7 | test |
| packages/ontology/use-cases/test/Session.validation.test.ts:25 | 6 | test |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.ontology.ts:284 | 2 | import |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.projection.ts:308 | 1 | import |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.render.ts:49 | 2 | import |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.views.ts:278 | 3 | import |
| packages/tooling/tool/cli/test/knowledge-coverage-examples.test.ts:40 | 6 | test |
| packages/tooling/tool/cli/test/research-library-ontology.test.ts:380 | 3 | test |
| packages/tooling/tool/cli/test/Research/research-library-mine.test.ts:759 | 3 | test |

Named imports of the `Dataset` type or class from `@beep/rdf/Rdf` that the table's pattern misses: `rdf-canonize/test/CanonicalizationIntegration.test.ts:1`, `CanonicalizationSecurity.test.ts:1`, `epistemic/server/test/BoundedShaclValidator.test.ts:10`, `epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:36`, `semantic-web/src/services/shacl-validation.ts:9`, `semantic-web/src/services/canonicalization.ts:9`, `semantic-web/src/services/sparql-query.ts:9`, `semantic-web/src/identity/IdentityRdfBinding.ts:23`, `semantic-web/src/identity/IdentityRegistryDataset.ts:14`, `semantic-web/test/IdentityRdfBindingCoverage.test.ts:18`, `semantic-web/test/ServicesAndSurface.test.ts:2`, `ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts:10`, `Session.ports.ts:9`, `Session.sparql.ts:29`, `Session.validation.ts:79`, `ontology/server/test/OntoauthorMatCompetency.test.ts:35`, `ontology/server/test/SessionServer.test.ts:51` (paths under `packages/`).

Inside rdf: `Rdf.test.ts:18,40,311-316`. `ProvRdf.test.ts:18,25,175-176,197,225,264,360,386,592`. 38 `makeDataset` lines in rdf src and tests.

### 4b. `.quads` field reads outside rdf (they break when the carrier becomes a set): 136 lines / 38 files

This is a name match. `apps/labs/ciops` (3 lines) is excluded because its `.quads()` is an Oxigraph store method.

| File:first line | Lines | Kind |
| --- | ---: | --- |
| packages/drivers/n3/src/N3.service.ts:75 | 3 | import |
| packages/drivers/n3/test/N3TurtleCodec.test.ts:36 | 1 | test |
| packages/drivers/oxigraph/src/Oxigraph.sparql.ts:202 | 1 | import |
| packages/drivers/oxigraph/test/OxigraphLazyImport.test.ts:61 | 2 | test |
| packages/drivers/rdf-canonize/src/adapters/canonicalization.ts:238 | 4 | import |
| packages/drivers/rdf-canonize/test/CanonicalizationIntegration.test.ts:48 | 1 | test |
| packages/drivers/shacl/src/Shacl.validation.ts:170 | 1 | import |
| packages/epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts:275 | 2 | import |
| packages/epistemic/server/test/IdentityShaclProjection.e2e.test.ts:53 | 2 | test |
| packages/epistemic/use-cases/test/EpistemicUseCases.test.ts:61 | 1 | test |
| packages/foundation/capability/semantic-web/src/identity/IdentityRdfBinding.ts:392 | 3 | import |
| packages/foundation/capability/semantic-web/src/services/canonicalization.ts:208 | 1 | import |
| packages/foundation/capability/semantic-web/src/services/sparql-query.ts:176 | 1 | import |
| packages/foundation/capability/semantic-web/test/IdentityRdfBindingCoverage.test.ts:39 | 1 | test |
| packages/foundation/modeling/annotation/src/rdf/OaCodec.ts:585 | 8 | import |
| packages/foundation/modeling/annotation/test/rdf/OaCodec.laws.test.ts:83 | 13 | test |
| packages/ontology/client/src/aggregates/Session/Session.atoms.ts:954 | 4 | import |
| packages/ontology/domain/src/aggregates/Session/Session.model.ts:203 | 16 | import |
| packages/ontology/domain/test/Session.test.ts:88 | 11 | test |
| packages/ontology/server/test/OntoauthorMatCompetency.test.ts:127 | 2 | test |
| packages/ontology/server/test/SessionServer.test.ts:136 | 1 | test |
| packages/ontology/ui/src/aggregates/Session/Session.metrics.tsx:50 | 1 | import |
| packages/ontology/ui/src/aggregates/Session/Session.sparql.tsx:60 | 2 | import |
| packages/ontology/ui/test/Session.workbench.test.ts:185 | 2 | test |
| packages/ontology/use-cases/src/aggregates/Session/Session.ports.ts:228 | 2 | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.projections.ts:783 | 1 | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:298 | 3 | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.service.ts:45 | 1 | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts:547 | 6 | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts:395 | 6 | import |
| packages/ontology/use-cases/src/tools/OntologyToolService.ts:208 | 3 | import |
| packages/ontology/use-cases/test/Session.test.ts:124 | 8 | test |
| packages/ontology/use-cases/test/Session.validation.test.ts:115 | 2 | test |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.ontology.ts:421 | 1 | import |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.views.ts:397 | 1 | import |
| packages/tooling/tool/cli/test/research-library-ontology.test.ts:273 | 14 | test |
| packages/tooling/tool/cli/test/research-library-views.test.ts:106 | 1 | test |
| packages/tooling/tool/cli/test/Research/research-library-mine.test.ts:769 | 3 | test |

Inside rdf: `Rdf.ts` 3, `ProvRdf.ts` 1, `ProvRdf.test.ts` 3.

## 5. `@beep/rdf` `Literal` (three cases)

Today: `Rdf.ts:414-431` is one struct, `{ termType: "Literal", value, language: Option<LanguageTag>, datatype: NamedNode }`. `makeLiteral` is at `:981`. `serializeTerm` at `:1166-1175` prints `"v"@lang` whenever a language is present, whatever the datatype, and `"v"^^<dt>` otherwise, so a `Simple` literal prints today with `^^<xsd:string>`.

### 5a. `makeLiteral | LanguageTag | Rdf.Literal | MakeLiteralOptions`, outside rdf: 112 lines / 37 files (census: `makeLiteral(` 87 / 36 repo-wide)

| File:first line | Lines | Kind |
| --- | ---: | --- |
| apps/labs/semantica/src/layers/RdfProjectionLive.ts:62 | 1 | import |
| apps/professional-desktop/test/integration/ontology-mcp-http.test.ts:23 | 2 | test |
| packages/drivers/n3/src/N3.service.ts:211 | 1 | import |
| packages/drivers/n3/test/N3TurtleCodec.test.ts:6 | 4 | test |
| packages/drivers/oxigraph/src/Oxigraph.sparql.ts:96 | 2 | import |
| packages/drivers/oxigraph/test/OxigraphLazyImport.test.ts:2 | 3 | test |
| packages/drivers/rdf-canonize/src/adapters/canonicalization.ts:17 | 2 | import |
| packages/drivers/rdf-canonize/test/CanonicalizationIntegration.test.ts:1 | 6 | test |
| packages/drivers/rdf-canonize/test/CanonicalizationSecurity.test.ts:1 | 2 | test |
| packages/drivers/shacl/src/Shacl.validation.ts:133 | 3 | import |
| packages/drivers/shacl/test/ShaclEngineValidation.test.ts:1 | 3 | test |
| packages/epistemic/server/test/BoundedShaclValidator.test.ts:10 | 2 | test |
| packages/epistemic/server/test/IdentityShaclProjection.e2e.test.ts:5 | 2 | test |
| packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:20 | 2 | import |
| packages/foundation/capability/semantic-web/src/identity/IdentityRdfBinding.ts:11 | 4 | import |
| packages/foundation/capability/semantic-web/src/identity/IdentityShaclProjection.ts:9 | 2 | import |
| packages/foundation/capability/semantic-web/test/IdentityRdfBindingCoverage.test.ts:4 | 11 | test |
| packages/foundation/capability/semantic-web/test/ServicesAndSurface.test.ts:2 | 2 | test |
| packages/foundation/modeling/annotation/src/rdf/OaCodec.ts:715 | 6 | import |
| packages/foundation/modeling/annotation/test/support/generators.ts:640 | 4 | test |
| packages/foundation/modeling/ontology/src/Fold.assembly.ts:17 | 2 | import |
| packages/foundation/modeling/ontology/src/Fold.models.ts:19 | 3 | import |
| packages/ontology/client/src/aggregates/Session/Session.atoms.ts:50 | 2 | import |
| packages/ontology/domain/test/Session.test.ts:19 | 2 | test |
| packages/ontology/server/test/OntologyTools.test.ts:16 | 3 | test |
| packages/ontology/server/test/SessionServer.test.ts:24 | 2 | test |
| packages/ontology/use-cases/src/aggregates/Session/Session.pizza-tutorial.ts:9 | 2 | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts:17 | 4 | import |
| packages/ontology/use-cases/test/SchemaParity.test.ts:29 | 2 | test |
| packages/ontology/use-cases/test/Session.test.ts:48 | 4 | test |
| packages/ontology/use-cases/test/Session.validation.test.ts:26 | 5 | test |
| packages/tooling/tool/cli/src/commands/Kb/Kb.projection.ts:6 | 2 | import |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.ontology.ts:141 | 5 | import |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.projection.ts:192 | 4 | import |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.views.ts:412 | 3 | import |
| packages/tooling/tool/cli/test/knowledge-coverage-examples.test.ts:33 | 2 | test |
| packages/tooling/tool/cli/test/research-library-ontology.test.ts:436 | 1 | test |

### 5b. Sites that build a language-tagged `xsd:string` literal (they move to `LangTagged`)

`packages/foundation/capability/semantic-web/test/IdentityRdfBindingCoverage.test.ts:135`. Inside rdf: `test/Rdf.test.ts:223,292,293,326`, `test/ProvRdf.test.ts:336,443`, and the JSDoc example at `src/Rdf.ts:968`. Already correct (`rdf:langString`): `packages/tooling/tool/cli/test/knowledge-coverage-examples.test.ts:33-34`.

### 5c. Pass-through decoders and literal field readers (forward any datatype with a language)

| File:line | What it does | Kind |
| --- | --- | --- |
| packages/drivers/n3/src/N3.service.ts:211-213, 261-263 | decodes N3 literal language; encodes `DataFactory.literal(value, language)` | import |
| packages/drivers/oxigraph/src/Oxigraph.sparql.ts:100-108, 147-149 | same, both directions | import |
| packages/drivers/rdf-canonize/src/adapters/canonicalization.ts:113-118, 148-153 | maps `datatype` and `language` to and from rdf-canonize terms | import |
| packages/drivers/shacl/src/Shacl.validation.ts:133-138, 216-218 | same for the SHACL engine | import |
| packages/epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts:220 | reads `.datatype` | import |
| packages/foundation/capability/semantic-web/src/identity/IdentityRdfBinding.ts:365 | reads `.datatype` | import |
| packages/foundation/modeling/annotation/src/rdf/OaCodec.ts:1043 | reads `.datatype` | import |
| packages/foundation/modeling/ontology/src/Fold.assembly.ts:316; Fold.models.ts:260 | fold literal datatype and language | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts:567 | reads `.datatype` | import |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.ontology.ts:318 | reads `.datatype` | import |

Sites that discriminate `termType === "Literal"`, a `"Literal"` match branch or `isLiteral`, outside rdf, from `rg` over files importing `@beep/rdf`. They are affected if the `Literal` cases change the tag. N3.service.ts 2, Oxigraph.sparql.ts 3, canonicalization.ts 3, Shacl.validation.ts 2, BoundedShaclValidator.layer.ts 1, BoundedShaclValidator.test.ts 1, IdentityRdfBinding.ts 1, OaCodec.laws.test.ts 1, Fold.assembly.ts 1, Session.projections.ts 1, Session.validation.ts 2, Library.ontology.ts 1 and research-library-ontology.test.ts 1: 20 lines in 13 files.

`xsd#string`/`XSD_STRING` is used outside rdf in 25 tracked files plus 7 in scratchpad. The largest is `semantic-web/test/IdentityRdfBindingCoverage.test.ts` with 10 lines. These are the `Simple` construction sites if `Simple` drops the explicit datatype argument.

### 5d. `serializeQuad | serializeTerm`, outside rdf: 81 lines / 19 files (their bytes move if `Simple` prints without `^^xsd:string`; see S9)

| File:first line | Lines | Kind |
| --- | ---: | --- |
| apps/labs/semantica/src/layers/RdfProjectionLive.ts:101 | 5 | import |
| packages/drivers/n3/src/N3.service.ts:182 | 1 | import |
| packages/drivers/rdf-canonize/src/rdf-canonize.d.ts:38 | 1 | import |
| packages/epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts:9 | 7 | import |
| packages/foundation/modeling/annotation/src/rdf/OaCodec.ts:732 | 6 | import |
| packages/foundation/modeling/annotation/test/rdf/OaCodec.laws.test.ts:83 | 5 | test |
| packages/ontology/client/src/aggregates/Session/Session.atoms.ts:50 | 3 | import |
| packages/ontology/domain/src/aggregates/Session/Session.model.ts:22 | 4 | import |
| packages/ontology/domain/test/Session.test.ts:22 | 9 | test |
| packages/ontology/ui/src/aggregates/Session/Session.changelog.tsx:10 | 3 | import |
| packages/ontology/ui/src/aggregates/Session/Session.sparql.tsx:20 | 4 | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:25 | 9 | import |
| packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts:23 | 5 | import |
| packages/ontology/use-cases/src/tools/OntologyToolService.ts:17 | 3 | import |
| packages/ontology/use-cases/test/Session.test.ts:52 | 7 | test |
| packages/ontology/use-cases/test/Session.validation.test.ts:30 | 5 | test |
| packages/tooling/tool/cli/src/commands/Kb/Kb.projection.ts:6 | 2 | import |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.projection.ts:303 | 1 | import |
| packages/tooling/tool/cli/src/commands/Research/Library/Library.views.ts:48 | 1 | import |

## 6. `rdf -> md` edge

| File:line | Symbol | Kind |
| --- | --- | --- |
| packages/foundation/modeling/rdf/package.json:73 | `"@beep/md": "workspace:^"` | indirect (manifest) |
| packages/foundation/modeling/rdf/tsconfig.json:15; tsconfig.test.json:21; tsconfig.check.json:9 | project reference `../md/tsconfig.json` | indirect |
| packages/foundation/modeling/rdf/src/Adapters/MdSections.ts:8,14 | `Block`, `Heading`, `HeadingLevel`, `Document` from `@beep/md/Md.model` (and JSDoc :77,101,196,272) | import |
| packages/foundation/modeling/rdf/src/index.ts:19 | `export * from "./Adapters/MdSections.ts"` | root-export |
| packages/foundation/modeling/rdf/src/Adapters/DocumentAnnotation.ts:21 | `MdNodeId` from `./MdSections.ts`; the edge's only in-package dependent | import |
| packages/foundation/modeling/rdf/test/DocumentAnnotation.test.ts:1,7,18 | `@beep/md/Md.model`; `foldMdSections`, `MdNodeId`, `MdSection`, `MdSectionFold`, `mdNodeId`, `MdSourceBlock` | test |
| standards/schema-catalog/@beep/rdf.generated.jsonc:10-15 | 6 MdSections rows | indirect (generated) |
| standards/coverage.regression-baseline.jsonc:36650 | `MdSections.ts` (100) | indirect |
| standards/architecture/16-knowledge-stack.md:424, 468 | "The `@beep/rdf` to `@beep/md` edge" (Pending P5) | indirect |

No `MdSections` or `DocumentAnnotation` symbol is consumed outside rdf, the generated catalogs and a comment at `identity/test/KeptValues.test.ts:92`. `MdSections.ts` imports `DOCO_NAMESPACE` from `../Vocab/Doco.ts` (`:13`), so moving it into `@beep/md` would add an `md -> rdf` edge (S11). `@beep/annotation` (`annotation/package.json:67-71`) depends on rdf but not on md, and its src and tests name no `@beep/md`. The transitive edge accepted by decision `2026-11-22-p3-oa-adapter-subpath` disappears with this one.

## 7. `SkosMappingKind` to SSSOM `MappingPredicate`

`SemanticFoundation.models.ts:148` (`LiteralKit(["exactMatch", "closeMatch"])`) is used at `:194` (`ConceptAlignment.kind`) and `TaxonomyLoader.ts:26,236` (`VendorAlignmentManifestEntry.mappingKind`). `ConceptAlignment` is used at `Vocabulary.models.ts:11,73`, `TaxonomyRegistry.ts:14,85`, `TaxonomyLoader.ts:24,581,598,803` and `SemanticFoundation.test.ts:4,184,211-213,232,265,290,367-369,617,647`. Nothing outside the package uses either. The design sketch (`ops/design/L3.taxonomy.ts:36-44`) uses prefixed spellings (`skos:exactMatch`, ...) and `semapv:` justifications (`:50-56`). The registry has no `semapv` or `sssom` namespace: `identity/registry/namespaces/` holds 38 shards and neither prefix is among them. `rg 'semapv|sssom'` finds only false positives, such as `sesssomers` in eyecite court fixtures.

## 8. gUFO pilot relator

The only relator in code is `LegalPositionRelator` (`packages/law-practice/domain/src/entities/LegalPositionRelator/LegalPositionRelator.model.ts:18,103`), and its check is `LegalPositionRelatorPolicy` (`packages/law-practice/use-cases/src/LegalPositionRelatorPolicy/*.ts`, 42 matching lines in `.service.ts`). It is stored in `law_practice_legal_position_relator` (`packages/law-practice/tables/src/entities/LegalPositionRelator/LegalPositionRelator.table.ts`). The registry has no term IRI for it or its roles: the only `Relator` match under `identity/registry/` is `gufo#Relator` (`term-snapshot.json:276`, `namespaces/gufo.json:15`). A typing record keyed by term IRI therefore needs new declared terms (S12). The pilot changes no stored column: `grounding` holds no anchor (decision `2026-11-22-p2-persisted-anchor-facts-corrected`).

## 9. Schema-org and nlp touchpoints

None. Of `@beep/schema-org` (`package.json:67-72`), `@beep/nlp` (`:84-92`) and `@beep/nlp-processing` (`:82-95`), none depends on `@beep/rdf`, `@beep/ontology` or `@beep/md`, and no src file of theirs imports either. The every-namespace pin test reaches schema.org only as the `schema` registry namespace pinned in `@beep/rdf` (`rdf/src/Vocab/SchemaOrg.ts`, `Vocab/generated/SchemaOrg.terms.ts`). Retiring `@beep/schema-org` stays in P7.

## 10. Stored formats whose bytes P5 changes or moves

The law, from decision `2026-11-19-p0-chapter-11-amendment-yields-to-the-stored-format-law`: where rows are stored, bytes are never rewritten and an incompatible change is one read-time transform. Encodings with no stored rows may bump their version and regenerate. That decision already names the rdf `Dataset` and `Literal` shapes and the gold projection fixture as having no stored rows.

| Artifact | Bytes today | What P5 does to them | Stored rows? | Read-side converter required |
| --- | --- | --- | --- | --- |
| `packages/foundation/modeling/ontology/src/seed/*.ttl`, `*.jsonld` (6 files, 1,281 lines; sha256 `docketing.jsonld` acf3f27a…, `docketing.ttl` 34aeffab…, `legal-intake.jsonld` cb710548…, `legal-intake.ttl` d561ec29…, `party-roles.jsonld` e7dce855…, `party-roles.ttl` 0f51bfc1…) | Committed; IRIs under `https://beep-effect.com/ns/ontology/semantic-foundation/` (`docketing.ttl:5-10`, `legal-intake.ttl:1-5`) | Move to the law-practice asset pack, byte for byte; a pack `manifest.jsonl` gains one row per file with its sha256 | No: no table or JSONL stores them, and they are read only by `Vocabulary.test.ts:90,92` | No, as long as the bytes and IRIs are kept. Re-serializing them through `fold -> Dataset` would change their bytes, which makes it an S2 decision |
| `explorations/legal-ontology-landscape/assets/manifest.jsonl` row 17 (`folio-email-communication`, `"mappingKind":"closeMatch"`) | Committed JSONL decoded by `TaxonomyLoader` through `VendorAlignmentManifestEntry.mappingKind` (`TaxonomyLoader.ts:236`) | `SkosMappingKind` becomes prefixed `MappingPredicate`; the unprefixed spelling stops decoding | A committed manifest, not a DB row. The same schema also decodes any caller-supplied manifest under a vendor root | Yes, if the manifest counts as stored: a decode-side transform that accepts `exactMatch`/`closeMatch` and yields `skos:` (S5). If it does not, the row is rewritten in the same PR with `SemanticFoundation.test.ts` inline manifests (`:184,232,265,290,617`) |
| `apps/labs/semantica/fixtures/gold/v1/g-projection.json` (`g-projection/v1`, 968 bytes) | Model identity, kNN pair and two SPARQL `expectedCount`s (577, 22); no quads and no dataset digest | SPEC says "regenerated" | No (decision `p3-semantica-reads-the-handoff`: the lab ledger sits outside the law) | No. The list-to-set change cannot move these counts, because Oxigraph deduplicates quads. Regeneration only changes bytes if P5 adds a `DatasetDigest` field, as a `g-projection/v2` tag (S7) |
| `apps/labs/semantica/fixtures/gold/v1/g-entailment-rdfs.json` (9,332 bytes) | `serializeTerm` strings; 0 literals and 0 blank nodes in the file | Unchanged unless `serializeTerm` changes for IRIs | No | No |
| `.beep/semantica/runs/<id>/<mode>/c1` C1 reports (`CanaryC1Live.ts:132`) | Gitignored run output; `quadDelta` over sorted `serializedQuads` (`:89`, `RdfProjectionLive.ts:113-121`) | `quadDelta` becomes isomorphism or digest equality | No (gitignored per-run) | No |
| `packages/foundation/modeling/rdf/src/Vocab/generated/namespace-pins.data.json` (8,952 bytes) and `NamespacePins.data.ts` | 11 pins (`as cito deo doco fabio gufo nif oa prov skos xsd`) | 8 more pins (`dcat dcterms owl rdf rdfs schema sh void`; `NamespacePin.test.ts:20,66-72`) plus any P5 namespace (S6) | No (generated by `SyncDataToTs/targets/PinnedVocabularies.ts`) | No; regenerate after network acquisition |
| `packages/foundation/modeling/identity/registry/term-snapshot.json` (`release` `2.0.0`) and `namespaces/*.json`; generated `identity/src/internal/generated/Registry.data.ts` | Committed registry | New namespaces or terms (semapv, sssom, relator and role terms) need a snapshot release per decision `2026-11-22-p1-the-snapshot-release-is-a-property-of-the-change-against-its-base-ref` | No | No; a published IRI leaves only with a deprecation record |
| Research library `ontology/research-library.ttl`, `.shacl.ttl` under the library root (`Library.paths.ts:39,53`; root from `BEEP_RESEARCH_LIBRARY` or `XDG_DATA_HOME`, `:86-92`) | Out-of-repo, rewritten atomically by `renderLibraryOntology` (`Library.ontology.ts:399-427`) | Turtle text order and prefix choice change once `toTurtle` writes from a `Dataset` | No: the only reader is the writer's own reparse (`:420-421`) and the test (`research-library-ontology.test.ts:485-486`) | No |
| `kb` `dataset.nq` (`Kb.projection.ts:135`, written by `KbGraph.service.ts:248`) | N-Quads lines through `serializeTerm(makeLiteral(v, xsd:string))` (`Kb.projection.ts:19`) | Bytes change only if `Simple` prints without `^^<xsd:string>` (S9) | No: a regenerated build output; `Kb.test.ts:221-224` asserts substrings | No |
| User ontology workspace Turtle (`ontology/server/src/aggregates/Session/Session.file-store.ts:238-250`) | Turtle written through N3 | Serialization order may change with a set carrier; the content is equivalent | The user's files, read back through N3 parse | No: Turtle is order-insensitive. The RDFC-1.0 `OntologyFingerprint` (`OntologyToolService.ts:98-110`, `casAlgorithm` `:444`) is a transient CAS token, not stored |
| rdf-canonize `lexical-sort-v1` fingerprints (`drivers/rdf-canonize/src/adapters/canonicalization.ts:222-240`) | `serializeQuad` text | Move with S9 | No persisted user (`rg 'lexical-sort-v1'`: declaration only, `semantic-web/src/services/canonicalization.ts:51`) | No |
| OA import activity ids (`annotation/src/rdf/OaCodec.ts:318-413`, `sourceDigest` = SHA-256 of parsed RDF bytes) | Ids minted from that digest | Only if P5 switches the input to `DatasetDigest` (decision `p3-oa-codec-signatures-and-profile`) | No consumer of `@beep/annotation/rdf` outside the annotation package | No |
| Wire JSON of `Dataset` (ontology `Session.worker-protocol.ts:10`, `Session.rpc.ts`, `Session.ports.ts:9`) | `quads` array in list order | `S.HashSet` encodes in iteration order (S8) | No (in-process worker and RPC wire) | No |
| SQL | none | none | `rg 'termType\|"datatype"\|langString\|xsd#string' packages/_internal/db-admin` gives 0; no `*/tables/src` imports `@beep/rdf` or `@beep/ontology` | n/a |

Result: no artifact P5 changes holds stored rows in the law's sense, with one possible exception. The committed vendor manifest's unprefixed `mappingKind`, and the manifests callers keep under their own vendor roots, need a ruling (S5).

## 11. Census rows for P5 (research/consumer-census.md) and their dispositions

| Census line | Facet | Disposition | Re-measured at b61b79aa79f |
| --- | --- | --- | --- |
| 241 | `Vocabulary.seed.ts` | adapt: move to the law-practice asset pack (SPEC L3) [A, D]; IRIs and approval metadata preserved | 0 outside; inside: `VocabularyRegistry.ts:15,73-75` hard-wires the three seeds into `load` |
| 242 | `SemanticFoundation.seed.ts` | adapt: move to the asset pack [A, D] | 0 outside; inside: `TaxonomyLoader.ts:30,919-928` merges every slice onto it |
| 243 | `src/seed/*.ttl`, `*.jsonld` | adapt: move with the seeds [A, D] | Correction: read by path in `Vocabulary.test.ts:90,92`. The census said "no code reads them" |
| 244 | `Ontology.models.ts` FOLIO DTOs | retire: delete with their data [A, D]; rewrite identity tests on a registry term | Plus in-package test consumers `Fold.test.ts:8,947-976` and `Ontology.models.test.ts`; scratchpad 2 files |
| 245 | Fold string serialization | adapt: `fold -> Dataset` only (SPEC item 6) [D] | 4 cli usage lines confirmed; `Library.projection.ts` sort now at `:308` (census `:301`) |
| 246 | `TaxonomyLoader.ts` | keep (it is the loader the pack uses) [A] | 1,013 lines; it imports the seed it must stop owning |
| 247 | Classification and registries | keep [D] | unchanged |
| 248 | `SkosMappingKind` | adapt into SSSOM `MappingPredicate` [D] | unchanged; see §7 and S5 for the committed manifest row |
| 270 | `Dataset` as a list | adapt [D]; order and multiplicity lost; gold fixture regenerated | 254 lines / 58 files (census 232 / 59); `.quads` 136 / 38 |
| 271 | `Dataset` equality sites | adapt [D] | plus `annotation/test/rdf/OaCodec.laws.test.ts:627` (`areDatasetsEquivalent`) and `annotation/src/rdf/OaCodec.ts:737` (`sortDatasetQuads`), both created after the census |
| 272 | `Literal` | adapt to `Simple`, `Typed`, `LangTagged` [D] | 112 lines / 37 files (census 77 / 35) |
| 273 | tagged `xsd:string` construction sites | adapt [D] | 1 outside rdf (`IdentityRdfBindingCoverage.test.ts:135`), 6 inside plus 1 JSDoc |
| 274 | pass-through decoders | adapt [D] | 4 drivers confirmed (§5c); line numbers moved |
| 275 | already correct | keep | `knowledge-coverage-examples.test.ts:33-34` |
| 276 | `rdf -> md` edge | adapt: remove, moving the fold and its one test out of rdf [D] | confirmed; `DocumentAnnotation.ts:21` depends on `MdNodeId` (S11) |
| 279 | `nif:` and `gufo:` | keep: registry entries are new [Q3] | both pinned by P1; `gufo.json` declares 13 terms |
| 525 | `makeSignal`, `AbsenceReason`, `Measurement` | moved to `@beep/schema` in P4 so ontology can type a mapping confidence in P5 | `packages/foundation/modeling/schema/src/Signal.ts` exists |

The census dispositions decision (`decisions/2026-11-19-p0-census-dispositions.md`) restates the ontology and rdf rows with the same sums. Decisions carrying P5 obligations:
- `2026-11-22-p3-oa-adapter-subpath`: DoCO binding of annotation structure kinds becomes an SSSOM mapping in P5 (S18).
- `2026-11-22-p3-capture-id-in-text`: the `prov:Entity` projection uses `CaptureId` or amends that decision.
- `2026-11-20-p1-namespace-pins-live-tree-calls` item 9: an external deprecation waits for the P5 pin work.
- `2026-11-22-p3-oa-codec-signatures-and-profile`: an optional `DatasetDigest` input (S14).

## 12. Gates and generated artifacts that move

| Artifact | Why it moves in P5 | Evidence |
| --- | --- | --- |
| `standards/schema-catalog/@beep/ontology.generated.jsonc` | 14 FOLIO rows leave (`:26-39`); `SkosMappingKind` (`:44`) is replaced; new `MappingPredicate`, `MappingJustification`, `MappingConfidence`, `Mapping`, `MappingSet`, `GufoClassType`, `GufoInstanceCategory`, `GufoTyping`, `GufoTypings`, `TypedHierarchy`, `OntoViolation`, `MappingIncoherence` | 66 rows today |
| `standards/schema-catalog/@beep/rdf.generated.jsonc` | 6 MdSections rows leave (`:10-15`); `Literal` splits into three; `Dataset` and `DatasetDigest` | 87 rows today |
| `standards/schema-catalog/@beep/law-practice-domain.generated.jsonc` (if seeds or pack schemas land there) | new rows only if pack-side schemas are added | (S2) |
| `standards/instrumentation-catalog/@beep/ontology.generated.jsonc` | 22 span names. `VocabularyRegistry.load`/`resolve` and `TaxonomyLoader.*` change if the loader takes the seed as input; `Ontology.fold`/`foldWith` stay | `:9-30` |
| `standards/instrumentation-catalog/@beep/law-practice-*.generated.jsonc` | new `Effect.fn` names if the pack ships a loader layer there | (S1, S2) |
| `standards/coverage.regression-baseline.jsonc` | rows leave: `Ontology.models.ts` `:31241`, `SemanticFoundation.seed.ts` `:31265`, `MdSections.ts` `:36650`; `Fold.markdown.ts` (80.32, `:31205`) and `TaxonomyRegistry.ts` (80, `:31289`) if touched; every new src file at 100% (repo law) | baseline lines cited |
| `standards/schema-first.inventory.jsonc:681-699` | `Fold.models.ts` `OntologyFoldInput`, `TypedLiteral`; `Fold.projections.ts` `JsonLdDocument`. These rows shrink or move if the fold's JSON-LD and typed-literal types change; S31 forbids growth | `:681,689,697` |
| `standards/fallow.boundaries.generated.jsonc` and `fallow.boundaries.provenance.jsonc` | edges: `@beep/rdf -> @beep/md` removed; `@beep/ontology -> @beep/spdx` added if `MappingSet.license` uses `SpdxExpression` (sketch `L3.taxonomy.ts:18`); `law-practice-* -> @beep/ontology` added for the pack loader | ontology rule at `.generated.jsonc:759,4092-4106`, provenance `:513-514` |
| `bun.lock` | every dependency edit above. `bun.lock` is in the CI binary closure, so a release and pin cycle follow | `bun run beep ci binary-closure --list`: 353 lines, `bun.lock` listed |
| CI binary closure (`packages/tooling/tool/cli/src/bin-ci.ts` import graph) | no ontology, rdf, md, annotation or law-practice file is in it. It does contain `identity/src/internal/generated/Registry.data.ts`, `identity/src/packages.ts`, `identity/src/Term.ts` and `identity/src/Iri.ts`, so a new registry namespace or term (S6, S12) or a new composer moves the closure digest | same listing |
| Runner-Lambda handler bundles (`packages/tooling/infra/ci-runners/test/HandlerBundles.test.ts` on origin/main) | none, if P5 leaves the five allowed identity sources alone: `Authority.ts`, `Id.ts`, `Root.ts`, `internal/Segment.ts`, `internal/schemaStatics.ts`. `Registry.data.ts` and `packages.ts` are outside every handler map | allowed list at that file's `:21-31` (origin/main) |
| Identity registry and term snapshot | see §10 rows | `identity/registry/` |
| `rdf/src/Vocab/generated/NamespacePins.data.ts`, `namespace-pins.data.json`; `rdf/test/NamespacePin.test.ts:20,44-73` | the every-namespace pin test replaces `unpinnedUntilP5` | §10 |
| `standards/cache-baseline/@beep/ontology.json`, `@beep/rdf.json`, `_root.json:2221`; `standards/policy-tools.fingerprint.json:648` | package.json edits (`files`, dependencies) of ontology and rdf, plus law-practice manifests | lines cited |
| package-scripts | unchanged unless a package is created. The asset pack is a data directory plus `files` entries, not a package. `create-package` is needed only if S2 rules for a new package | `ontology/package.json:45-53` `files` |
| tsconfig project references | `rdf/tsconfig.json:15`, `tsconfig.test.json:21`, `tsconfig.check.json:9` drop `../md`; law-practice tsconfigs gain `../../foundation/modeling/ontology` if the edge is added | lines cited |
| `packages/tooling/tool/cli/src/commands/Ci/CiOperational.schemas.ts:332-337` | goal-data consumer row: `@beep/ontology` reads `explorations/legal-ontology-landscape/assets/manifest.jsonl` (evidence `SemanticFoundation.test.ts`). It stays valid if that test keeps reading the manifest; otherwise it becomes stale | (S17) |
| `CiLanePartitions.ts:337,828`; `Quality/internal/CoverageScope.ts:403` (`"@beep/ontology": 3.4`) | partition and coverage-scope membership; they move only if a law-practice lane gains `@beep/ontology` | lines cited |
| Docs | `standards/architecture/16-knowledge-stack.md:303` (seeds "Pending P5"), `:424`, `:468` (rdf to md "Pending P5"); `DECISIONS.md:2903-2904`; `ontology/README.md:16,86`; JSDoc examples naming `@beep/ontology/Vocabulary.seed` and `@beep/ontology/SemanticFoundation.seed` (§1) and `@beep/ontology/Ontology.models` (`Ontology.models.ts` 22 example lines) | lines cited |
| Repo-local laws | `beep laws comments` against the merge base: `Rdf.ts` keeps pre-existing free comments at `:1115-1118`, `:1132-1133` and `:1143-1146` beside the code P5 edits; S31 no inventory growth; new src files need 100% coverage | lines cited |

## 13. Test files named by the exit criteria

| Test | Exists at b61b79aa79f |
| --- | --- |
| ontology `test/ConceptScheme.profile.test.ts` (L3-1) | Absent |
| ontology `test/MappingSet.profile.test.ts` (L3-2) | Absent |
| ontology `test/OntoAudit.laws.test.ts` (L3-3) | Absent |
| ontology `test/ClassificationEdition.test.ts` (L3-4) | Absent |
| rdf `test/Dataset.laws.test.ts` (L6-1) | Absent |
| rdf `test/Projection.laws.test.ts` (L6-2) | Absent |
| rdf `test/NamespacePin.test.ts` (every-namespace pin) | Present; it asserts the P1 set and `unpinnedUntilP5` (`:20,66-72`) |
| `prov:Entity` round-trip for `SourceTextIdentity` | Absent: no rdf test names `SourceTextIdentity` or projects one; `Prov.ts:298` `Entity` exists |
| Exit grep `rg -l "@beep/md" packages/foundation/modeling/rdf/src packages/foundation/modeling/rdf/package.json` | 2 files today (`src/Adapters/MdSections.ts`, `package.json`) |

## Open questions

S1. Seed ownership inverts the loader. `TaxonomyLoader.mergeSlices` (`TaxonomyLoader.ts:914-930`) and `VocabularyRegistry.load` (`VocabularyRegistry.ts:66-80`) hard-wire the seeds, and a foundation package cannot import the law-practice slice. Do both take the seed as an input: a layer argument, a manifest row kind for a taxonomy seed, or a pack `Context` service? The instrumentation names in §12 follow that choice.

S2. What is the pack's home and source of truth? The routing decision says a manifested, digest-pinned pack owned by the law-practice domain package. The slice's only asset convention is `packages/law-practice/server/assets/<name>/` with `build-receipt.json` and no manifest. Two sub-questions follow. Do the TS seed modules move as TS beside the data files, or do the TTL and JSON-LD become the source the loader decodes? And where does the TS, TTL and JSON-LD parity test (`Vocabulary.test.ts:82-100`) move?

S3. How are the seed IRIs preserved? They come from the path composer `$SemanticFoundationId` (`identity/src/packages.ts:529`). Do they stay on that composer from law-practice code, or get minted with `Registry.mint` under the declared `semantic-foundation` namespace (0 terms today)? Should the scheme IRIs become declared terms in the term snapshot? `packages.ts` and `Registry.data.ts` are both in the CI binary closure.

S4. Does law-practice domain or server take a `@beep/ontology` dependency for the loader types? If so, `bun.lock` changes, and with it the CI binary closure, fallow boundaries, tsconfig references and possibly `CiLanePartitions`.

S5. Is the committed vendor manifest row (`explorations/legal-ontology-landscape/assets/manifest.jsonl:17`, `"mappingKind":"closeMatch"`), with any caller-held manifest, stored under the stored-format law? If yes, `VendorAlignmentManifestEntry` gets a decode-side transform from the unprefixed to the `skos:` spelling, with a frozen-row fixture. If no, the row is rewritten in the PR.

S6. Are `semapv:` (and `sssom:`, if `MappingSet` is ever exported as SSSOM RDF) registered namespaces? If they are, they need pins under the every-namespace test and a term-snapshot release, which moves the closure. The alternative is to keep `MappingJustification` as a LiteralKit of CURIE strings with no registry entry.

S7. `g-projection.json` holds no dataset bytes, so what does "regenerated" mean? Does P5 add a `DatasetDigest` field under a `g-projection/v2` tag and switch C1's `quadDelta` (`CanaryC1Live.ts:89`) to isomorphism, or is the fixture left unchanged with that recorded in a decision?

S8. Which set schema does `Dataset.quads` use? `S.HashSet` encodes in iteration order (Effect `Schema.ts:16119-16126`); `CanonicalHashSet` (`@beep/schema/CanonicalHashSet`) encodes a sorted array. The ontology worker and RPC wire and every JSON snapshot test depend on the choice. The sketch (`L6.interchange.ts`) uses `S.HashSet`.

S9. What N-Triples form does a `Simple` literal take? Keeping `"v"^^<xsd:string>` leaves `serializeQuad` bytes unchanged for 19 consumer files (§5d). Dropping it to the canonical `"v"` moves Kb `dataset.nq`, semantica `serializedQuads`, the `lexical-sort-v1` text, the OaCodec sort order and the test expectations.

S10. Which projections survive "`fold -> Dataset` as the only serialization path"? `toTurtle` writes from a `Dataset`. What happens to `toJsonLd`, `toContext` (JSON-LD context) and `toMarkdown`? Markdown is not RDF, and `Fold.markdown.ts` sits at 80.32% coverage. The schema-first inventory rows (`JsonLdDocument`, `TypedLiteral`) follow this answer.

S11. Where does the MdSections fold go? `@beep/md` would need `DOCO_NAMESPACE` (an `md -> rdf` edge) unless it reads `doco:` through `@beep/identity/Registry`. `@beep/annotation` has neither edge. `DocumentAnnotation.ts:21` keeps needing `MdNodeId`. Does `MdNodeId` (`md-v1/b/N`) stay in rdf as a plain template schema, or move too?

S12. Which terms does the gUFO pilot need? `LegalPositionRelator` is the one relator with a check (`LegalPositionRelatorPolicy`), but it and its mediated roles have no registry term IRIs. Is it confirmed as the pilot, and where are its terms declared (a law-practice namespace shard)? Can a `GufoTypings` record in `@beep/ontology` hold law-practice IRIs, or does the record's data live in the slice with only the schema in ontology?

S13. Deleting `Ontology.models.ts` breaks `scratchpad/effect-ontology/Domain/Schema/LinkIngestion.ts:8` and `scratchpad/effect-ontology/test/Domain/Schema/PublicSchemas.test.ts:1`, which import `HttpUrl`. The scratchpad workspace has no `check` script. Should P5 migrate them to a local or `@beep/schema` URL schema, or leave them red?

S14. Does P5 switch the OA import activity's `sourceDigest` to the canonical `DatasetDigest`? Decision `p3-oa-codec-signatures-and-profile` allows it, but it re-mints import activity ids, and no persisted consumer exists.

S15. `MappingSet.license` as `SpdxExpression` adds `@beep/ontology -> @beep/spdx`. Accept the edge, or carry the license as a `TermIri` or string?

S16. The identity tests that pin `@beep/ontology/Ontology.models/*` strings (`IriBinding.test.ts:53-120`, `Identity.test.ts:215-258`, `shape-stable.test.ts:416-442`) import nothing and stay green after the deletion. Does the census instruction to "rewrite them on a registry term" still bind, or is it dropped by decision?

S17. If the ontology tests stop reading `explorations/legal-ontology-landscape/assets/manifest.jsonl`, does the goal-data consumer row at `CiOperational.schemas.ts:332-337` move to the pack's manifest or retire?

S18. Is the DoCO SSSOM mapping for the annotation structure kinds (decision `p3-oa-adapter-subpath`) in P5's scope? If so, which package commits the `MappingSet` data, and does it register `doco` terms that are not yet declared?
