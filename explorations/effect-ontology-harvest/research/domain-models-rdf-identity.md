# Domain Models, RDF, Identity, and Errors — Harvest Inventory

### Ontology definitions, hierarchy, and search projection
- **Source:** `packages/@core-v2/src/Domain/Model/Ontology.ts:82-1030` (effect-ontology)
- **What:** `ClassDefinition` and `PropertyDefinition` combine OWL/SKOS metadata with deterministic search-document projection, while `OntologyContext` adds inherited-property lookup, superclass closure, and class/property hierarchy queries (`packages/@core-v2/src/Domain/Model/Ontology.ts:82-388,411-800,812-1030`). Tests make alternative/hidden labels, definitions, related concepts, camel-case expansion, inherited properties, and subclass recognition observable contracts (`packages/@core-v2/test/Domain/Model/Ontology.test.ts:11-218`; `packages/@core-v2/test/Domain/Model/OntologyHierarchy.test.ts:42-70`).
- **Category:** model
- **Proposed beep home:** design-reference → `packages/foundation/modeling/ontology`
- **beep overlap & design delta:** Beep's `OWLClass` and `OWLObjectProperty` preserve a FOLIO/OpenAPI wire model with explicit optionality, translations, governance notes, semantic field identifiers, and representative wire round-trip tests (`packages/foundation/modeling/ontology/src/Ontology.models.ts:1-14,292-581`; `packages/foundation/modeling/ontology/test/Ontology.models.test.ts:66-108`). Core-v2 is the stronger generic behavioral read model and search projector; beep is the stronger annotated external-boundary model, so hierarchy/search behavior should be a separate ontology-slice capability rather than replacing the FOLIO DTOs.
- **Goal linkage:** `semantic-foundation`, `ontology-agent-surface` — useful for repo-owned concept-scheme traversal and explainable ontology retrieval.
- **v3→v4 notes:** Redesign the source's `Schema.Class`, native collection helpers, and instance-heavy projection code (`packages/@core-v2/src/Domain/Model/Ontology.ts:82-1030`) as annotated `S.Class` values plus pure `Effect.fn` projectors; use `LiteralKit`, `S.OptionFromOptionalKey`, Effect helper modules, and cycle-safe traversal.
- **Effort:** L
- **Verdict hint:** design-reference

### Extraction-oriented knowledge graph with grounded evidence
- **Source:** `packages/@core-v2/src/Domain/Model/Entity.ts:38-495` (effect-ontology)
- **What:** The extraction aggregate carries quote offsets and optional confidence, entity source/chunk/document provenance, extraction time versus event time, and relation evidence (`packages/@core-v2/src/Domain/Model/Entity.ts:38-86,117-299,326-382`). `KnowledgeGraph` then groups entities and relations with lookup/navigation helpers, although relation-object identity is inferred with a string regex (`packages/@core-v2/src/Domain/Model/Entity.ts:387-414,439-495`).
- **Category:** model
- **Proposed beep home:** design-reference → `packages/ontology/domain`
- **beep overlap & design delta:** Beep separates the reusable substrate: `TextAnchor` owns non-negative offsets, quote text, and offset/quote consistency (`packages/foundation/modeling/provenance/src/TextAnchor.ts:37-107`), while epistemic `EvidenceSpan` adds required unit-interval confidence and the persisted `Evidence` entity owns artifact/span references (`packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:40-105`; `packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts:54-80`). Core-v2 contributes the cohesive extraction graph and dual-time distinction; beep contributes stronger provenance reuse and typed ownership, so a beep aggregate should reference those values and RDF terms rather than duplicate the span or regex-discriminate objects.
- **Goal linkage:** `agentic-professional-runtime`, `ip-law-knowledge-graph` — extraction candidates need traceable evidence before durable admission.
- **v3→v4 notes:** Reuse beep `TextAnchor`, `EvidenceSpan`, `Confidence`, and RDF value schemas; replace raw optional keys with `S.OptionFromOptionalKey` and the primitive relation-object union with the canonical RDF term union.
- **Effort:** M
- **Verdict hint:** design-reference

### Two-tier mention-to-canonical entity resolution graph
- **Source:** `packages/@core-v2/src/Domain/Model/EntityResolution.ts:1-461`; `packages/@core-v2/src/Domain/Model/EntityResolutionGraph.ts:20-110` (effect-ontology)
- **What:** Core-v2 preserves immutable mention records separately from canonical resolved entities, distinguishes resolution edges from semantic relation edges, records resolution method/confidence, and supplies weighted matching configuration (`packages/@core-v2/src/Domain/Model/EntityResolution.ts:1-12,24-208,231-363,381-461`). Its graph wrapper carries original/canonical indexes and resolution statistics, and schema tests lock in provenance round-trips plus tagged node/edge decoding (`packages/@core-v2/src/Domain/Model/EntityResolutionGraph.ts:20-110`; `packages/@core-v2/test/Domain/EntityResolution.test.ts:21-340`).
- **Category:** model
- **Proposed beep home:** design-reference → `packages/ontology/domain`
- **beep overlap & design delta:** An exact mention-to-canonical resolution aggregate was NOT FOUND in the inspected ontology, epistemic, RDF, and agents sources. Beep does provide typed encoded nodes/edges and an immutable Effect graph transform (`packages/foundation/modeling/schema/src/Graph/Graph.encoded.ts:30-69`; `packages/foundation/modeling/schema/src/Graph/Graph.transforms.ts:166-201`), so core-v2's valuable delta is product-domain node/edge/index semantics rather than a new generic graph implementation.
- **Goal linkage:** `ip-law-knowledge-graph`, `agentic-professional-runtime` — canonicalization should retain mention provenance and resolution confidence.
- **v3→v4 notes:** Express nodes and edges as annotated `S.Class` tagged unions, use `LiteralKit` for methods, typed IDs and Option fields, layer them on the existing graph codec, and add a whole-config invariant for the independently bounded weights (`packages/@core-v2/src/Domain/Model/EntityResolution.ts:381-452`).
- **Effort:** L
- **Verdict hint:** design-reference

### Staged batch lifecycle and handoff contracts
- **Source:** `packages/@core-v2/src/Domain/Model/BatchWorkflow.ts:20-315`; `packages/@core-v2/src/Domain/Schema/Batch.ts:18-150` (effect-ontology)
- **What:** The workflow is an exhaustive tagged lifecycle from pending through preprocessing, extraction, resolution, validation, ingestion, and complete/failed states, retaining per-document outcomes and partial-failure data (`packages/@core-v2/src/Domain/Model/BatchWorkflow.ts:20-138`). Its explicit transition table permits same-state progress and failure from active stages while rejecting skips, reversals, and terminal transitions; companion DTOs propagate ontology version, storage locations, source metadata, and validation policy across activity boundaries (`packages/@core-v2/src/Domain/Model/BatchWorkflow.ts:150-315`; `packages/@core-v2/src/Domain/Schema/Batch.ts:18-150`; `packages/@core-v2/test/Domain/Model/BatchWorkflow.test.ts:18-215`).
- **Category:** pattern
- **Proposed beep home:** design-reference → `packages/documents/domain`
- **beep overlap & design delta:** Beep's current `IntakeBatch` aggregate records only its ID, workspace ownership, and file count (`packages/documents/domain/src/aggregates/IntakeBatch/IntakeBatch.model.ts:30-89`); ontology batch mutation instead emphasizes a non-empty operation list, expected fingerprint, and semantic delta (`packages/ontology/use-cases/src/tools/OntologyToolkit.ts:404-444`). Core-v2 contributes durable document-pipeline visibility and partial outcomes, while beep contributes tenant ownership and CAS-safe ontology mutation; these are adjacent workflows rather than interchangeable batch models.
- **Goal linkage:** `agentic-professional-runtime` — replayable, evidence-producing intake benefits from explicit stage state and partial outcomes.
- **v3→v4 notes:** Model each state and handoff as an annotated `S.Class` variant with `LiteralKit` and `S.OptionFromOptionalKey`; replace string transition errors (`packages/@core-v2/src/Domain/Model/BatchWorkflow.ts:266-280`) with a boundary-local tagged error and keep storage URIs in server/driver contracts.
- **Effort:** L
- **Verdict hint:** design-reference

### Agent execution checkpoints and termination policy
- **Source:** `packages/@core-v2/src/Domain/Model/Agent.ts:56-759` (effect-ontology)
- **What:** Core-v2 defines generic Effectful agent execution and optional validation, lifecycle/checkpoint events, intermediate results, resumable pipeline state, execution modes, termination conditions, and approval-aware checkpoint configuration (`packages/@core-v2/src/Domain/Model/Agent.ts:180-243,255-314,326-512,541-759`). Tests establish tagged event handling, intermediate-result lookup, terminal-state detection, checkpoint snapshots, and approval/iteration triggers (`packages/@core-v2/test/Domain/Model/Agent.test.ts:204-459`).
- **Category:** pattern
- **Proposed beep home:** design-reference → `packages/agents/use-cases/src/processes/ProfessionalRuntime`
- **beep overlap & design delta:** Beep's persisted `Agent` is deliberately narrow—fixture key, mode, name, and skill—while its professional-runtime contracts carry evidence-linked candidate claims, producing principals, human approval, provenance activities, and usage attribution (`packages/agents/domain/src/entities/Agent/Agent.model.ts:32-75`; `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:209-272,473-490,608-655`). Core-v2 adds generic checkpoint/resume and termination vocabulary; beep adds the domain evidence, principal, policy, and cost semantics that make durable execution accountable.
- **Goal linkage:** `agentic-professional-runtime` — checkpointing is relevant once the process becomes durably resumable.
- **v3→v4 notes:** Do not port the global `Agent` interface. Use narrow `Context.Service` ports with explicit Layers, schema-serializable event classes instead of `Data.TaggedClass` (`packages/@core-v2/src/Domain/Model/Agent.ts:326-477`), typed time, `LiteralKit`, and typed result payloads instead of `Schema.Unknown` (`packages/@core-v2/src/Domain/Model/Agent.ts:489-512`).
- **Effort:** L
- **Verdict hint:** design-reference

### Content-addressed image assets and owner-context references
- **Source:** `packages/@core-v2/src/Domain/Model/Image.ts:27-496` (effect-ontology)
- **What:** The image model separates discovered candidates, hashed stored assets, document/link-owned contextual references, ordered manifests, and prompt-ready base64/media payloads (`packages/@core-v2/src/Domain/Model/Image.ts:27-213,225-369,394-496`). Tests require ordered owner manifests with contextual metadata and verify reference-to-multimodal projection (`packages/@core-v2/test/Service/ImageStore.test.ts:172-304`; `packages/@core-v2/test/Prompt/PromptGenerator.multimodal.test.ts:216-265`).
- **Category:** model
- **Proposed beep home:** design-reference → `packages/documents/domain`
- **beep overlap & design delta:** Beep's file-processing substrate already models runtime-neutral source artifacts and materialized references with digest, MIME, size, optional bytes/text, and path (`packages/foundation/capability/file-processing/src/Artifact/index.ts:298-399`); its editor attachment model explicitly remains ephemeral UI state rather than a persisted wire model (`packages/foundation/ui-system/editor/src/chat/attachment-model.ts:263-313`). Core-v2's useful delta is the asset-versus-owner-context split and ordered manifest, while beep's generic artifacts are the stronger reusable binary substrate.
- **Goal linkage:** `agentic-professional-runtime` — multimodal evidence needs stable artifacts plus document-specific context.
- **v3→v4 notes:** Compose existing `ContentDigest`, image MIME, bytes, artifact, and Option schemas; keep owner manifests in the documents slice and convert to `effect/unstable/ai` prompt parts only at the AI boundary rather than storing base64 in the domain.
- **Effort:** M
- **Verdict hint:** design-reference

### Compact RDF values versus beep's RDF/JS substrate
- **Source:** `packages/@core-v2/src/Domain/Rdf/Types.ts:26-245` (effect-ontology)
- **What:** Core-v2 models IRIs and blank nodes as branded strings, literals with optional language/datatype, and triples/quads as classes with direct JSON projection and `Quad.toTriple` (`packages/@core-v2/src/Domain/Rdf/Types.ts:26-73,83-120,149-245`). Its IRI brand has no format refinement and a quad's graph is only an optional IRI (`packages/@core-v2/src/Domain/Rdf/Types.ts:26-34,220-223`).
- **Category:** model
- **Proposed beep home:** design-reference → `packages/foundation/modeling/rdf`
- **beep overlap & design delta:** Beep validates RFC 3987 IRI/reference families and models RDF/JS-discriminated named nodes, blank nodes, literals, default graphs, role-safe term unions, quads, and datasets (`packages/foundation/modeling/rdf/src/Iri.ts:863-1043`; `packages/foundation/modeling/rdf/src/Rdf.ts:392-775`). It also supplies validated constructors and deterministic serialization/sort/equivalence behavior (`packages/foundation/modeling/rdf/src/Rdf.ts:879-1066,1118-1199`); core-v2's explicit triple projection is convenient, but beep's standards-aligned substrate should remain canonical.
- **Goal linkage:** `semantic-foundation`, `ontology-agent-surface` — both require one unambiguous RDF term model.
- **v3→v4 notes:** Do not port a parallel term system. If useful, add a pure triple projection to beep's existing tagged `S.Class`/`S.toTaggedUnion` values; do not retain `Schema.instanceOf(Literal)` or optional-IRI graph discrimination (`packages/@core-v2/src/Domain/Rdf/Types.ts:130-139,192-245`).
- **Effort:** S
- **Verdict hint:** design-reference

### Standard and product vocabulary bundles
- **Source:** `packages/@core-v2/src/Domain/Rdf/Constants.ts:20-490` (effect-ontology)
- **What:** Core-v2 groups RDF, RDFS, OWL, PROV-O, DCTERMS, XSD, SKOS, product vocabularies, aliases, and import metadata into asserted-IRI namespace objects (`packages/@core-v2/src/Domain/Rdf/Constants.ts:20-178,189-444,452-490`). Its OWL bundle includes restriction, value-constraint, and cardinality predicates (`packages/@core-v2/src/Domain/Rdf/Constants.ts:62-93`).
- **Category:** design-idea
- **Proposed beep home:** design-reference → `packages/foundation/modeling/rdf`
- **beep overlap & design delta:** Beep's per-vocabulary modules construct typed RDF `NamedNode` values and its SKOS inventory includes transitive, notation, collection, and note terms (`packages/foundation/modeling/rdf/src/Vocab/Skos.ts:26-125`), while its current OWL inventory stops before the restriction/cardinality family (`packages/foundation/modeling/rdf/src/Vocab/Owl.ts:25-114`). Selectively completing beep's OWL module is useful; copying core-v2's mixed standard/product mega-object would weaken term typing and ownership.
- **Goal linkage:** `semantic-foundation` — OWL restriction coverage can support repo-owned schemes and validation work.
- **v3→v4 notes:** Add only verified missing local names through the existing `makeNamedNode` vocabulary pattern; do not copy the trusted `value as IRI` constructor (`packages/@core-v2/src/Domain/Rdf/Constants.ts:13-20`) or promote application namespaces into foundation.
- **Effort:** S
- **Verdict hint:** adapt-improve

### Content-derived IDs versus semantic identity authority
- **Source:** `packages/@core-v2/src/Domain/Identity.ts:20-207` (effect-ontology)
- **What:** One module combines truncated content hashes, full idempotency keys, GCS addresses, ontology namespace/name/version values, and deterministic document/chunk/batch IDs (`packages/@core-v2/src/Domain/Identity.ts:20-122,128-207`). The document helper takes the first twelve hash characters and asserts the branded result (`packages/@core-v2/src/Domain/Identity.ts:128-145`).
- **Category:** design-idea
- **Proposed beep home:** design-reference → `packages/ontology/domain`
- **beep overlap & design delta:** Beep's `IdentityComposer` owns hierarchical package/schema identity, annotations, composition, IRI/CURIE projection, and authority rebasing (`packages/foundation/modeling/identity/src/Id.ts:768-1053`); canonical full SHA-256 validation and hashing live separately in `@beep/schema` (`packages/foundation/modeling/schema/src/Sha256.ts:14-71,92-120`). Core-v2 contributes useful content-lineage formats, but beep has the stronger semantic authority boundary; storage-provider addresses should remain driver/server types and content IDs should wrap the canonical hash in the owning slice.
- **Goal linkage:** `ontology-agent-surface`, `agentic-professional-runtime` — stable content lineage supports CAS and reproducible evidence.
- **v3→v4 notes:** Split semantic identity, content identity, and storage location by owner; construct validated IDs with annotated schemas and full hashes rather than unchecked casts or native substring helpers.
- **Effort:** M
- **Verdict hint:** design-reference

### Machine-actionable error taxonomy without a global error barrel
- **Source:** `packages/@core-v2/src/Domain/Error/index.ts:8-21`; `packages/@core-v2/src/Domain/Error/Base.ts:13-62`; `packages/@core-v2/src/Domain/Error/Activity.ts:13-114`; `packages/@core-v2/src/Domain/Error/Embedding.ts:19-144`; `packages/@core-v2/src/Domain/Error/Shacl.ts:19-73` (effect-ontology)
- **What:** The high-value pattern is serializable tagged failures with remediation data such as workflow stage/retryability, provider/retry timing, vector-dimension mismatch, and SHACL counts/severity (`packages/@core-v2/src/Domain/Error/Activity.ts:16-101`; `packages/@core-v2/src/Domain/Error/Embedding.ts:34-64,91-129`; `packages/@core-v2/src/Domain/Error/Shacl.ts:56-73`). Boundary ownership is inconsistent: the barrel centralizes unrelated concern families, and `BaseError` says errors extend it even though representative subsystem errors directly extend `Schema.TaggedError` (`packages/@core-v2/src/Domain/Error/index.ts:8-21`; `packages/@core-v2/src/Domain/Error/Base.ts:13-30`; `packages/@core-v2/src/Domain/Error/Shacl.ts:19-25`).
- **Category:** pattern
- **Proposed beep home:** design-reference → `packages/foundation/capability/semantic-web`
- **beep overlap & design delta:** Beep already provides an extensible v4 `TaggedErrorClass` substrate (`packages/foundation/modeling/schema/src/TaggedErrorClass/TaggedErrorClass.errors.ts:89-113,250-321`), and semantic-web keeps finite reason vocabularies and typed failures adjacent to each service channel (`packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:274-344`; `packages/foundation/capability/semantic-web/src/services/sparql-query.ts:237-307`). Harvest core-v2's actionable fields and reason checklist, while retaining beep's boundary-local taxonomy instead of adding a cross-package `Domain/Error` hierarchy.
- **Goal linkage:** `agentic-professional-runtime`, `ontology-agent-surface` — retry, refusal, and remediation metadata must remain visible to tools and operators.
- **v3→v4 notes:** Replace `Schema.TaggedError` with annotated repo `TaggedErrorClass`, finite reasons with `LiteralKit`, causes with the repo defect/Option pattern, and locate each error union at its public action, server port, or driver-internal boundary.
- **Effort:** M
- **Verdict hint:** design-reference

### Faceted claim, entity, and article search DTOs
- **Source:** `packages/@core-v2/src/Domain/Schema/Search.ts:22-195` (effect-ontology)
- **What:** Separate DTOs cover claim filters/facets/pagination, entity results with top claims, typeahead suggestions, and article results with conflict and claim counts (`packages/@core-v2/src/Domain/Schema/Search.ts:22-64,74-107,122-149,159-195`).
- **Category:** design-idea
- **Proposed beep home:** design-reference → `packages/epistemic/use-cases`
- **beep overlap & design delta:** Beep's ontology foundation has only a focused class search result with a finite score and wire collection (`packages/foundation/modeling/ontology/src/Ontology.models.ts:662-767`); its epistemic `ClaimProjection` instead provides deterministic lifecycle counts and admitted-claim keys (`packages/epistemic/domain/src/values/ClaimProjection/ClaimProjectionView.model.ts:35-80`; `packages/epistemic/use-cases/src/ClaimProjection/ClaimProjection.ts:24-101`). Core-v2 contributes richer product read-model semantics, but the DTOs should split by slice and preserve beep's deterministic projection and bounded-agent concerns rather than expand a foundation model.
- **Goal linkage:** `agentic-professional-runtime`, `ontology-agent-surface` — professional UI and tools need bounded, explainable retrieval views.
- **v3→v4 notes:** Use annotated `S.Class` request/result models, `S.OptionFromOptionalKey`, branded IRIs and bounded integers; model finite filter domains with `LiteralKit` and impose server-owned ceilings for agent-facing search.
- **Effort:** M
- **Verdict hint:** design-reference

### Asynchronous inference API envelope
- **Source:** `packages/@core-v2/src/Domain/Schema/Inference.ts:22-134` (effect-ontology)
- **What:** Core-v2 accepts serialized Turtle/TriG, selectable RDFS/subclass/sameAs/custom-rule profiles and delta-only behavior, then exposes pollable job status, serialized output, and aggregate inference statistics (`packages/@core-v2/src/Domain/Schema/Inference.ts:22-134`). Tests lock in the `rdfs`/Turtle/delta defaults, custom rules, and a real subclass inference result (`packages/@core-v2/test/Runtime/InferenceRouter.test.ts:32-117`).
- **Category:** capability
- **Proposed beep home:** design-reference → `packages/ontology/server`
- **beep overlap & design delta:** Beep's reasoner is already graph-native: it returns changed signatures, per-module full/incremental/reused results, disjointness violations, and a typed RDF `Dataset`, with full recomputation when history rewinds or drift exceeds the cap (`packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:178-349,767-830`). It also exposes a narrow `Context.Service` and Layer (`packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:898-919`); core-v2 is useful as an external async adapter contract, while beep's internal reasoner model is materially richer.
- **Goal linkage:** `ontology-agent-surface`, `semantic-foundation` — asynchronous transport may be useful without changing the reasoner core.
- **v3→v4 notes:** Keep typed `Dataset` internally, use `LiteralKit` profiles, make pending/succeeded/failed job outcomes a tagged union instead of optional result/error fields, and route custom N3 rules through the existing driver boundary.
- **Effort:** M
- **Verdict hint:** design-reference

### SHACL observability report and workflow policy
- **Source:** `packages/@core-v2/src/Domain/Schema/Shacl.ts:19-60` (effect-ontology)
- **What:** The report adds validation timestamp, data/shapes triple counts, duration, and severity-bearing findings, while a separate policy decides whether violations or warnings fail a workflow (`packages/@core-v2/src/Domain/Schema/Shacl.ts:19-60`). Policy tests distinguish a successful non-conforming report from typed policy failure and require the telemetry fields on successful reports (`packages/@core-v2/test/Service/Shacl.policy.test.ts:68-217`).
- **Category:** pattern
- **Proposed beep home:** design-reference → `packages/foundation/capability/semantic-web`
- **beep overlap & design delta:** Beep's SHACL service already owns typed RDF paths/values/shapes, dataset-backed requests, bounded/truncated findings, a typed failure channel, and a `Context.Service` boundary (`packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:92-148,175-256,274-385`). Core-v2's timing/count telemetry is a useful service-result improvement, but its fail/warn policy belongs in the ontology or epistemic consumer so validation findings do not become foundation infrastructure failures.
- **Goal linkage:** `semantic-foundation`, `ontology-agent-surface`, `agentic-professional-runtime` — validation must be observable while admission policy remains explicit.
- **v3→v4 notes:** Preserve typed RDF terms and bounded results, use `LiteralKit` severities and Option fields, add metrics without conflating non-conformance with service failure, and represent consuming policy outcomes as tagged domain verdicts.
- **Effort:** M
- **Verdict hint:** design-reference

### Claim to curated assertion to derived assertion
- **Source:** `packages/@core-v2/src/Domain/Schema/KnowledgeModel.ts:1-453` (effect-ontology)
- **What:** The model separates source-backed RDF claims, curated assertions derived from claim IDs, and rule-produced assertions that retain a rule ID plus supporting assertion IDs (`packages/@core-v2/src/Domain/Schema/KnowledgeModel.ts:1-10,181-208,233-304,316-453`). Claims also carry exact evidence spans, confidence, rank, and temporal validity; adjacent event contracts require source documents, which tests enforce (`packages/@core-v2/src/Domain/Schema/KnowledgeModel.ts:101-169,233-304,466-673`; `packages/@core-v2/test/Domain/Schema/KnowledgeModel.test.ts:98-190`).
- **Category:** model
- **Proposed beep home:** design-reference → `packages/epistemic/domain`
- **beep overlap & design delta:** Beep's persisted `CandidateClaim` strongly models entity identity and lifecycle but keeps claim content in an open `UnknownRecord`, while evidence is separately persisted over the canonical provenance anchor (`packages/epistemic/domain/src/entities/CandidateClaim/CandidateClaim.model.ts:48-72`; `packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts:54-80`; `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:65-105`). Beep also owns an explicit admission lifecycle and typed gate result (`packages/shared/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts:17-102`; `packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts:58-136`); core-v2 is stronger on typed RDF statement content, temporal rank, and derivation lineage, while beep is stronger on persistence, admission, and evidence ownership.
- **Goal linkage:** `agentic-professional-runtime`, `semantic-foundation`, `ip-law-knowledge-graph` — durable assertions need typed content and derivation lineage without losing admission provenance.
- **v3→v4 notes:** Adapt the design, not the classes: compose beep entity IDs, lifecycle, RDF terms, evidence/`TextAnchor`, and provenance activities into annotated `S.Class` models; remove storage/news-specific fields and replace unsafe hash-derived casts (`packages/@core-v2/src/Domain/Schema/KnowledgeModel.ts:685-710`) with canonical identities.
- **Effort:** L
- **Verdict hint:** adapt-improve

## Sources (to merge)

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| eo-dom-01 | Ontology definitions, hierarchy, and search projection | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Model/Ontology.ts:27-1040` | OWL/SKOS metadata and ontology query behavior | design-reference |
| eo-dom-02 | Ontology search-document contracts | mepuka/effect-ontology | `packages/@core-v2/test/Domain/Model/Ontology.test.ts:11-218` | labels, definitions, relations, properties, and search text | design-reference |
| eo-dom-03 | Ontology hierarchy contracts | mepuka/effect-ontology | `packages/@core-v2/test/Domain/Model/OntologyHierarchy.test.ts:5-72` | inherited properties and subclass recognition | design-reference |
| eo-dom-04 | Extracted entity knowledge graph | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Model/Entity.ts:18-495` | evidence-grounded entities, relations, and dual time | design-reference |
| eo-dom-05 | Entity-resolution node and edge taxonomy | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Model/EntityResolution.ts:1-461` | mention-to-canonical resolution with provenance | design-reference |
| eo-dom-06 | Entity-resolution graph indexes | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Model/EntityResolutionGraph.ts:14-111` | canonical indexes, graph state, and statistics | design-reference |
| eo-dom-07 | Entity-resolution schema contracts | mepuka/effect-ontology | `packages/@core-v2/test/Domain/EntityResolution.test.ts:21-340` | tagged node and edge decoding with bounds | design-reference |
| eo-dom-08 | Batch lifecycle state machine | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Model/BatchWorkflow.ts:17-315` | staged processing, partial outcomes, and transitions | design-reference |
| eo-dom-09 | Batch stage handoff schemas | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Schema/Batch.ts:18-150` | manifest and workflow activity payloads | design-reference |
| eo-dom-10 | Batch transition contracts | mepuka/effect-ontology | `packages/@core-v2/test/Domain/Model/BatchWorkflow.test.ts:18-215` | progress, failure, and transition rejection | design-reference |
| eo-dom-11 | Agent execution and checkpoint model | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Model/Agent.ts:46-759` | events, resumable state, modes, and termination | design-reference |
| eo-dom-12 | Agent model contracts | mepuka/effect-ontology | `packages/@core-v2/test/Domain/Model/Agent.test.ts:30-459` | event, checkpoint, and pipeline-state behavior | design-reference |
| eo-dom-13 | Image asset and contextual-reference model | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Model/Image.ts:17-496` | candidates, content assets, manifests, and prompts | design-reference |
| eo-dom-14 | Owner image-manifest contracts | mepuka/effect-ontology | `packages/@core-v2/test/Service/ImageStore.test.ts:172-304` | ordered contextual image references | design-reference |
| eo-dom-15 | Multimodal image-adapter contracts | mepuka/effect-ontology | `packages/@core-v2/test/Prompt/PromptGenerator.multimodal.test.ts:216-265` | image-reference to prompt projection | design-reference |
| eo-dom-16 | RDF primitive and graph schemas | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Rdf/Types.ts:26-245` | branded RDF terms, triples, and quads | design-reference |
| eo-dom-17 | RDF and ontology vocabulary bundles | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Rdf/Constants.ts:13-490` | standard terms, product namespaces, and metadata | adapt-improve |
| eo-dom-18 | Domain and storage identity schemas | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Identity.ts:16-207` | hashes, deterministic IDs, versions, and GCS addresses | design-reference |
| eo-dom-19 | Domain error export topology | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Error/index.ts:8-21` | centralized cross-boundary error taxonomy | design-reference |
| eo-dom-20 | Base error model | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Error/Base.ts:13-62` | nominal base hierarchy and implementation gaps | design-reference |
| eo-dom-21 | Workflow activity errors | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Error/Activity.ts:13-114` | stage and retry metadata | design-reference |
| eo-dom-22 | Embedding errors | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Error/Embedding.ts:19-144` | provider, retry, dimension, and token metadata | design-reference |
| eo-dom-23 | SHACL processing and policy errors | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Error/Shacl.ts:19-73` | validation lifecycle versus policy failure | design-reference |
| eo-dom-24 | Product search schemas | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Schema/Search.ts:18-195` | faceted claim, entity, suggestion, and article search | design-reference |
| eo-dom-25 | Inference API schemas | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Schema/Inference.ts:16-134` | profiles, delta output, jobs, and statistics | design-reference |
| eo-dom-26 | Inference contracts | mepuka/effect-ontology | `packages/@core-v2/test/Runtime/InferenceRouter.test.ts:32-117` | defaults, custom rules, and inferred output | design-reference |
| eo-dom-27 | SHACL report and policy schemas | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Schema/Shacl.ts:13-60` | validation findings, telemetry, and workflow policy | design-reference |
| eo-dom-28 | SHACL policy contracts | mepuka/effect-ontology | `packages/@core-v2/test/Service/Shacl.policy.test.ts:68-217` | policy failure and telemetry semantics | design-reference |
| eo-dom-29 | Claim, assertion, derivation, and event schemas | mepuka/effect-ontology | `packages/@core-v2/src/Domain/Schema/KnowledgeModel.ts:1-710` | evidence-backed statements and derivation lineage | adapt-improve |
| eo-dom-30 | Knowledge-model event contracts | mepuka/effect-ontology | `packages/@core-v2/test/Domain/Schema/KnowledgeModel.test.ts:21-210` | event IDs, participants, facts, and source-document bounds | design-reference |
