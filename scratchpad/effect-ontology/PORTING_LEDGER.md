# Effect Ontology Domain semantic port ledger

This ledger accounts for the frozen source module by semantic value rather than
source API compatibility.

## Dispositions

- **ported** — the source contract remains useful and is represented directly.
- **subsumed** — a live `@beep/*` owner or another target schema already carries
  the contract.
- **redesigned** — the value remains, but the v4 shape or behavior changes to
  make invariants executable.
- **rejected-with-doctrine** — the source construct conflicts with a binding
  repository decision; the reason and replacement are recorded.

Every completed row must identify its target, encoded/decoded boundary,
defaults and invariants, arbitrary strategy, source-test disposition, and
promotion status.

## Module completion

| Source family | Files | Status | Governing disposition |
| --- | ---: | --- | --- |
| Root | 3 | implemented | split identity/storage; exact path adapters |
| Error | 16 | implemented | boundary-local tagged error families |
| Model | 15 | implemented | rich schema models and canonical reuse |
| Rdf | 3 | implemented | canonical `@beep/rdf` adapters |
| Schema | 18 | implemented | decoded v4 models and selective ingress |

The target contains exactly the same 55 relative TypeScript module paths as the
frozen source. `Domain/Shacl.ts`, which predated the experiment in this
scratchpad, moved to its correct upstream path at `Domain/Schema/Shacl.ts`.

## Arbitrary and boundary policy

- Every refined, transformed, or union schema has an explicit `toArbitrary`
  annotation. `S.Class`, `S.TaggedClass`, and tagged error classes use their
  v4 declaration-level arbitrary annotation; class refinements that can reject
  generated fields override it explicitly.
- Opaque foundation checks are retained on the encoded side of an
  encoded-to-declaration codec. The declaration side owns a constructive
  `toArbitrary`, eliminating inherited filter warnings without weakening
  boundary validation.
- The public-schema property audit calls `S.toArbitrary(schema, {
  report: true })`, requires zero warnings, samples each exported schema, and
  checks every sample with `S.is(schema)`.
- Optional wire properties decode to `Option`; nullable and undefined values do
  not escape into domain behavior.
- Obvious configuration and collection defaults are applied by schemas.
- Every check carries a stable identifier, title, description, and `message`.
- Every module remains scratchpad-only. Promotion status is **quarantined** for
  every row below.

## Root modules

| Source | Disposition and target | Boundary, defaults, invariants, arbitrary, and tests |
| --- | --- | --- |
| `Identity.ts` | **redesigned** in the same path | Full SHA-256 content identity is distinct from the explicit legacy prefix; GCS, namespace, ontology, document, chunk, run, and batch identities are branded and schema-owned. Static constructors replace free helpers. Explicit bounded/pattern arbitraries; `Identity.test.ts`. |
| `PathLayout.ts` | **redesigned** in the same path | Reversible path codecs own parsing and construction; run/image/canonical paths reject traversal and non-canonical encodings. Explicit arbitraries and round-trip properties; `PathLayout.test.ts`. |
| `index.ts` | **ported** in the same path | Namespaced Error, Identity, Model, PathLayout, RDF, and Schema exports preserve family boundaries; package remains quarantined. |

## Error modules

All source error names not listed in the symbol-redesign table retain their
names. Each family is a tagged schema error with Option-normalized context,
schema defaults for obvious diagnostics, a family union, explicit arbitrary
support, and coverage in `test/Domain/Error/All.test.ts`.

| Source | Disposition | Boundary/invariant emphasis |
| --- | --- | --- |
| `Error/Activity.ts` | **redesigned** | Activity names, timeouts, cancellation, and defects are variant-owned. |
| `Error/Auth.ts` | **redesigned** | Ticket/authentication failures retain only safe diagnostics and typed context. |
| `Error/Base.ts` | **redesigned** | Shared messages, codes, status, causes, URLs, and retry metadata are canonical schema values. |
| `Error/Circuit.ts` | **redesigned** | Circuit-open and execution failures own non-negative timing/retry data. |
| `Error/Embedding.ts` | **redesigned** | Embedding provider, input, response, and dimension failures are discriminated. |
| `Error/EventBus.ts` | **redesigned** | Publish, subscribe, serialization, and handler failures own their legal payloads. |
| `Error/Extraction.ts` | **redesigned** | Extraction-stage, response, and output failures use stable variants. |
| `Error/Image.ts` | **redesigned** | Image discovery/fetch/validation/storage failures use validated URL and media context. |
| `Error/Jina.ts` | **redesigned** | Jina API, parse, timeout, and rate-limit failures use bounded retry metadata. |
| `Error/Llm.ts` | **redesigned** | Provider, response, parse, rate-limit, and timeout failures are distinct variants. |
| `Error/Ontology.ts` | **redesigned** | Ontology lookup/load/parse/validation failures use canonical ontology and storage identities. |
| `Error/Rdf.ts` | **redesigned** | RDF parse, serialize, term, graph, and query failures carry RDF-specific context. |
| `Error/Shacl.ts` | **redesigned** | Shape generation and validation failures are separate from standards-level result conformance. |
| `Error/Sparql.ts` | **redesigned** | Parse, execution, endpoint, timeout, and result failures use validated query/endpoint metadata. |
| `Error/Workflow.ts` | **redesigned** | Workflow, transition, activity, suspension, and terminal failures own stage-specific data. |
| `Error/index.ts` | **ported** | Complete public error barrel. |

## Model modules

| Source | Disposition and target | Boundary, defaults, invariants, arbitrary, and tests |
| --- | --- | --- |
| `Model/Agent.ts` | **redesigned** | LiteralKit agent/pipeline domains, tagged lifecycle/event values, Option-normalized state, positive termination/checkpoint settings; model arbitrary audit and `Model/Behavior.test.ts`. |
| `Model/BatchWorkflow.ts` | **redesigned** | Stage-specific data is nested in `BatchState`; transition/progress/terminal behavior is attached to the schema; collections and optional progress context are normalized; model behavior properties. |
| `Model/CoreOntology.ts` | **redesigned** | Canonical `@beep/rdf` IRI ownership, LiteralKit core vocabulary, content-derived IDs, ordered event intervals, tagged event time, typed domain errors; arbitrary and behavior coverage. |
| `Model/EnrichedContent.ts` | **ported and hardened** | Recognized source types, MIME/content metadata, Option-normalized enrichment fields, non-negative measurements; public arbitrary audit. |
| `Model/Entity.ts` | **redesigned** | Ordered evidence spans, canonical RDF/IRI types, `RelationObject` tagged values, Option/default collections, schema-owned relation behavior; behavior coverage. |
| `Model/EntityResolution.ts` | **redesigned** | Tagged mention/resolved nodes and resolution/relation edges, unit-interval confidence, schema-owned complete default config; behavior and arbitrary coverage. |
| `Model/EntityResolutionGraph.ts` | **ported and hardened** | Non-negative cluster/stat values, canonical IDs/IRIs, normalized collections, graph lookup/statics; consolidated model tests. |
| `Model/ExtractionRun.ts` | **redesigned** | Tagged run status replaces optional terminal bags; bounded chunking/LLM/concurrency, content identities, durations, normalized audit/output collections; model behavior coverage. |
| `Model/Image.ts` | **ported and hardened** | Positive dimensions, validated base64/media/storage fields, Option-normalized candidates/assets/manifests, class-owned guards; public arbitrary audit. |
| `Model/Ontology.ts` | **redesigned** | Canonical IRI terms, Option/default label and hierarchy collections, cycle-safe hierarchy traversal, schema-owned document generation and path parsing; model behavior coverage. |
| `Model/OntologyAgent.ts` | **redesigned** | Complete default agent/extraction policy, Option-normalized query/reasoning/validation data, derived validation counts, consistent metrics; model behavior coverage. |
| `Model/OntologyEmbeddings.ts` | **redesigned** | Full content version, finite non-empty vectors, uniform dimension check, JSON codec, schema-owned semantic text/version/path behavior; model behavior and arbitrary coverage. |
| `Model/OutputType.ts` | **redesigned** | LiteralKit filename/type domains and total registry lookups replace parallel conditionals; `OutputType.test.ts`. |
| `Model/shared.ts` | **subsumed and hardened** | `@beep/schema` UnitInterval and canonical RDF attributes are reused; entity IDs are validated and expose schema-owned equivalence; `shared.test.ts`. |
| `Model/index.ts` | **redesigned** | Complete barrel now exports all 14 model modules instead of the incomplete upstream subset. |

## RDF modules

| Source | Disposition and target | Boundary, defaults, invariants, arbitrary, and tests |
| --- | --- | --- |
| `Rdf/Types.ts` | **subsumed** by `@beep/rdf` plus a local `Triple` adapter | RDF/JS terms, dataset, prefix map, and constructors are canonical re-exports; graph-free triples convert explicitly to/from quads. Arbitrary and interop tests in `Rdf/Types.test.ts`. |
| `Rdf/Constants.ts` | **ported and hardened** | RDF/RDFS/OWL/XSD/SKOS/SHACL/PROV/DCTERMS/schema vocabularies use canonical IRI schemas and documented registries; arbitrary/registry tests. |
| `Rdf/index.ts` | **ported** | Complete canonical RDF adapter and vocabulary barrel. |

## Schema modules

| Source | Disposition and target | Boundary, defaults, invariants, arbitrary, and tests |
| --- | --- | --- |
| `Schema/Api.ts` | **redesigned** | `SubmitJobSource` nests exactly one Inline/Remote value; job responses are discriminated by lifecycle with terminal-only data; Option config and non-negative progress; public schema tests. |
| `Schema/Auth.ts` | **ported and hardened** | Ticket request/response/record values validate identity, TTL/time, and Option-normalized state; arbitrary audit. |
| `Schema/Batch.ts` | **redesigned** | Non-empty manifests/graph/document IDs, canonical identities/MIME, Option provenance/artifacts, default preprocessing and SHACL policy, non-negative activity outputs; behavior and arbitrary tests. |
| `Schema/BatchRequest.ts` | **redesigned** | Non-empty documents, recognized MIME types, Option generated/derived fields, complete default preprocessing; source boundary tests consolidated into `PublicSchemas.test.ts` and `DomainBehavior.test.ts`. |
| `Schema/BatchStatusResponse.ts` | **redesigned** | Active, Suspended, and NotFound values nest variant-owned payloads; suspension context is Option-normalized; arbitrary audit. |
| `Schema/CurationAction.ts` | **redesigned** | Actions, resulting events, and jobs are direct tagged unions using canonical RDF terms and defaults; arbitrary audit. |
| `Schema/DocumentMetadata.ts` | **redesigned** | LiteralKit classification, bounded chunking/batch size, complete preprocessing defaults, Option metadata, schema-owned recommend/priority/token/fallback behavior; boundary, behavior, and arbitrary properties. |
| `Schema/EventSchema.ts` | **redesigned** | Uses Effect v4 `EventGroup`; event payloads use validated models instead of unknown state blobs. |
| `Schema/Inference.ts` | **ported and hardened** | LiteralKit reasoning/status, non-negative stats, complete collections/options, canonical request/response boundaries; arbitrary audit. |
| `Schema/JobSchema.ts` | **redesigned** | Tagged jobs, HTTPS webhooks, JSON payloads, content-derived IDs, zero-attempt/default Option retry metadata; source timestamp-concatenation ID helper rejected below. |
| `Schema/KnowledgeModel.ts` | **redesigned** | Canonical RDF terms, content IDs, ordered spans/temporal intervals, tagged evidence source, non-empty evidence/support, defaults and schema-owned constructors; behavior/arbitrary tests. |
| `Schema/LinkIngestion.ts` | **redesigned** | HTTP(S) links, canonical content/GCS identities, Option metadata, tagged batch results, and response-summary invariant; arbitrary audit. |
| `Schema/OntologyBrowser.ts` | **ported and hardened** | Canonical ontology/IRI values, normalized labels/collections, non-negative counts; arbitrary audit. |
| `Schema/OntologyRegistry.ts` | **redesigned** | Canonical identities/storage paths, complete resources/entry defaults, typed JSON codecs, registry lookup statics; arbitrary audit. |
| `Schema/Search.ts` | **ported and hardened** | Trimmed queries, bounded pagination, non-negative totals, unit confidence, normalized results; arbitrary audit. |
| `Schema/Shacl.ts` | **redesigned** | Severity-tagged results, report conformance iff results are empty, finite duration, normalized fields, default policy with schema-owned `shouldFail`; dedicated property/behavior tests. |
| `Schema/Timeline.ts` | **redesigned** | Bitemporal nested values, canonical RDF/IRI terms, bounded query pagination, tagged claim conflicts, Option/default response data; arbitrary audit. |
| `Schema/index.ts` | **ported** | Upstream public surface retained; specialized collision-prone event/curation/job modules remain explicit subpaths. |

## Renamed, absorbed, or rejected source symbols

The frozen tree declares 471 named runtime/type exports. Static per-module
comparison finds 415 same-named target exports and the 56 intentional mappings
below; no source export is unaccounted for. Every source export not listed here
retains its source name in the same relative target module.

| Source symbol(s) | Disposition | Replacement and reason |
| --- | --- | --- |
| `Identity.documentIdFromHash` | **absorbed** | `DocumentId.fromContentHash`; validated full-hash input and behavior live with the identifier. |
| `Identity.toGcsUri`, `resolveToGcsUri` | **absorbed** | `GcsUri.fromParts` and `GcsUri.resolve`; bucket/object schemas validate both paths. |
| `AgentIdSchema`, `AgentTypeSchema`, `PipelineModeSchema` | **subsumed** | `AgentId`, `AgentType`, and `PipelineMode` are schemas directly; no schema/type name split. |
| `BatchPending`, `BatchPreprocessing`, `BatchExtracting`, `BatchResolving`, `BatchValidating`, `BatchIngesting`, `BatchComplete`, `BatchFailed` | **absorbed** | `BatchState.cases.*`; variants remain colocated with their tagged union. |
| `VALID_TRANSITIONS`, `isValidTransition`, `validateTransition`, `isValidStateTransition`, `getValidNextStates`, `canFail`, `isTerminal`, `getError`, `progressPercent`, `stageDisplayName` | **absorbed** | `BatchState` statics; `getValidNextStates` is the terser `validNextStages`. |
| `CanonicalEntityIdSchema`, `EventIdSchema`, `MentionIdSchema`, `ParticipantSchema` | **subsumed** | Direct schemas `CanonicalEntityId`, `EventId`, `MentionId`, and `Participant`. |
| `CoreClasses`, `CoreProperties` | **redesigned** | `CoreClass` and `CoreProperty` LiteralKit domains expose `Enum`, matching, guards, and arbitrary generation. |
| `IRI`, `IRISchema` from `CoreOntology` | **subsumed** | Canonical `IRI` is imported from `@beep/rdf`; the experiment does not fork or re-export its owner. |
| `generateMentionId`, `generateEntityId`, `generateEventId` | **absorbed** | `MentionId.fromCoordinates`, `CanonicalEntityId.fromSeed`, and `EventId.fromSeed`; digest effects and validation are explicit. |
| `SourceTypeSchema`, `EvidenceSpanSchema`, all `Image*Schema` exports | **subsumed** | `SourceType`, `EvidenceSpan`, and the corresponding `S.Class` names are schemas directly. |
| `defaultEntityResolutionConfig` | **absorbed** | `EntityResolutionConfig.default()` avoids a detached defaults object. |
| `ExtractionRun.getChunkId` | **absorbed** | `ExtractionRun.chunkId` retains the stable `{documentId}-chunk-{index}` wire form while requiring a validated `DocumentId` and non-negative index. |
| `OntologyEmbeddings.buildEmbeddingText` | **absorbed** | `ElementEmbedding.buildText`; pure behavior lives with the element schema. |
| `computeOntologyVersion`, `embeddingsPathFromOntology` | **absorbed** | `OntologyEmbeddings.computeVersion` and `.storagePathFor`. |
| `selectChunkingStrategy`, `computePriority`, `estimateTokens`, `defaultDocumentMetadata` | **absorbed** | `ChunkingStrategy.recommend`/`.parameters` and `DocumentMetadata.computePriority`/`.estimateTokens`/`.fallback`. |
| `claimIdFromHash`, `assertionIdFromHash`, `derivedAssertionIdFromHash`, `eventIdFromHash` | **absorbed** | `ClaimId`, `AssertionId`, `DerivedAssertionId`, and `EventId` `.fromContentHash` statics. |
| `JobSchema.makeId` timestamp/delimiter helpers | **rejected-with-doctrine** | `BackgroundJobId.fromContentHash`; caller text plus wall-clock milliseconds was ambiguous and collision-prone. |

## Source-test disposition

The frozen source contains exactly 207 declared tests across 12 files. They are
accounted below by behavioral family. Repetitive v3 constructor/optional-field
tests are consolidated into property tests over v4 schemas rather than copied
line-for-line.

| Source test file | Declarations | Disposition and target proof |
| --- | ---: | --- |
| `EntityResolution.test.ts` | 16 | **redesigned/consolidated** into model arbitrary coverage and `Model/Behavior.test.ts` for ordered evidence, tagged relation objects, canonical IDs, and graph behavior. |
| `Model/Agent.test.ts` | 31 | **redesigned/consolidated** into arbitrary coverage and model behavior/default tests for agent/pipeline/event variants. |
| `Model/BatchWorkflow.test.ts` | 25 | **ported semantically** in `Model/Behavior.test.ts`; schema statics prove legal/illegal transitions, terminality, and progress. |
| `Model/ExtractionRun.test.ts` | 4 | **ported semantically** through model arbitrary coverage and bounded configuration/path behavior. |
| `Model/Ontology.test.ts` | 12 | **ported semantically** in `Model/Behavior.test.ts`; document text, hierarchy, cycle handling, and property inheritance are schema statics. |
| `Model/OntologyEmbeddings.test.ts` | 16 | **ported semantically** through dimension invariant, arbitrary coverage, and schema-owned build/version/path behavior. |
| `Model/OntologyHierarchy.test.ts` | 3 | **ported and strengthened** with cyclic hierarchy behavior in `Model/Behavior.test.ts`. |
| `PathLayout.test.ts` | 9 | **ported and strengthened** in `PathLayout.test.ts` with valid paths, invalid paths, parsing, and arbitrary round trips. |
| `Schema/BatchRequest.test.ts` | 27 | **ported and consolidated** in `PublicSchemas.test.ts` and `DomainBehavior.test.ts`: defaults, bounds, Option override, MIME, and non-empty documents. |
| `Schema/DocumentMetadata.test.ts` | 46 | **ported and consolidated** in the same schema tests: literal/bound checks, defaults, recommendations, priority, token estimation, fallback, and arbitrary validity. |
| `Schema/JobSchema.test.ts` | 5 | Four schema/default behaviors are consolidated; the timestamp-based `makeId` assertion is **rejected-with-doctrine** in favor of deterministic content identity. |
| `Schema/KnowledgeModel.test.ts` | 13 | **ported and strengthened** with content-derived IDs, ordered spans, canonical RDF values, non-empty provenance/support, and arbitrary validity. |

## Promotion status

All 55 modules are **quarantined**. Passing focused proof establishes the
quality of the experiment only; it does not authorize an import from a product
package or a root export from `scratchpad/index.ts`.
