# Workflow, Cluster, and Streaming Inventory

Grounding note: a repository search under `packages/**/use-cases/**` found
`*.workflows.ts`, `*.processes.ts`, and `*.schedulers.ts` **NOT FOUND**. Those
role names are reserved but optional (`standards/ARCHITECTURE.md:983-1012`). The
live attachment points read for this inventory are folder-based process
contracts such as `AgentTurnKernel`, which exposes a streaming port through a
`Context.Service` (`packages/agents/use-cases/src/processes/AssistantTurn/AssistantTurn.kernel.ts:40-73`),
and `ProfessionalRuntimeSdk`, which exposes Effect-returning use-case methods
(`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.service.ts:28-44`).
Live selection and Layer composition already occur at app runtime
(`apps/professional-desktop/src/runtime/Layer.ts:114-130`), matching the law that
use-cases do not own live runtime Layers (`standards/ARCHITECTURE.md:1119-1122`).
Accordingly, each durable-workflow proposal below attaches a slice contract to
a server handler and a technical engine driver rather than inventing a second
orchestration home (`standards/ARCHITECTURE.md:1512-1544`).

### Effect v3 workflow/cluster runtime seam

- **Source:** `packages/@core-v2/package.json:36-65`; `bun.lock:737-775`; `packages/@core-v2/src/server.ts:73-89` (effect-ontology)
- **What:** The source is concretely on Effect 3.19 with `@effect/cluster` 0.55.0 and `@effect/workflow` 0.15.2; its server chooses a SQL-backed cluster workflow engine when PostgreSQL is configured and otherwise installs the memory engine (`packages/@core-v2/package.json:42-65`; `packages/@core-v2/src/server.ts:73-89`). The split-package imports and Layer plumbing are version-specific boilerplate, while explicit durable-versus-ephemeral engine selection is the reusable policy insight (`packages/@core-v2/src/server.ts:84-89`).
- **Category:** design-idea
- **Proposed beep home:** design-reference → slice workflow contracts in `<slice>/use-cases`, handlers in `<slice>/server`, and NET-NEW `drivers/workflow`; this is the topology already prescribed for workflows and technical engines (`standards/ARCHITECTURE.md:1512-1544`).
- **beep overlap & design delta:** A durable workflow engine is **NOT FOUND** in the target; the architecture reserves `.workflows.ts` and server workflow handlers without requiring placeholder files (`standards/ARCHITECTURE.md:997-1012`). Existing process seams are Effect service contracts, and engine selection already belongs at app runtime (`packages/agents/use-cases/src/processes/AssistantTurn/AssistantTurn.kernel.ts:40-73`; `apps/professional-desktop/src/runtime/Layer.ts:114-130`).
- **Goal linkage:** `trustgraph-port` requires deterministic workflow identity, durable state, and typed progress, making it the clearest first consumer of an engine seam (`goals/trustgraph-port/SPEC.md:219-280`).
- **v3→v4 notes:** beep pins Effect `4.0.0-beta.97` (`package.json:168`), where cluster, workflow, persistence, and event log are exported from `effect/unstable/*`, not the v3 split packages (`effect-smol@f643dbb/packages/effect/package.json:35-49`). Any adoption must begin as a v4-native driver, not by copying source imports or package Layers.
- **Effort:** L
- **Verdict hint:** design-reference

### Deterministic durable batch workflow contract

- **Source:** `packages/@core-v2/src/Service/WorkflowOrchestrator.ts:123-160`; `packages/@core-v2/src/Service/WorkflowOrchestrator.ts:216-299`; `packages/@core-v2/src/Service/WorkflowOrchestrator.ts:922-1002` (effect-ontology)
- **What:** `BatchExtractionWorkflow` declares payload, success, failure, deterministic execution identity, suspend-on-failure, defect capture, and a bounded retry schedule; the facade adds start, wait, poll, interrupt, and resume (`packages/@core-v2/src/Service/WorkflowOrchestrator.ts:123-160`; `packages/@core-v2/src/Service/WorkflowOrchestrator.ts:922-1002`). Its identity suffix is only eight hexadecimal characters from `Hash.string`, so the contract shape is useful but its fingerprint is not suitable as beep's durable identity primitive (`packages/@core-v2/src/Service/WorkflowOrchestrator.ts:142-152`).
- **Category:** pattern
- **Proposed beep home:** `ontology/use-cases` or the first consuming slice's `.workflows.ts` contract, with its handler in that slice's `server` package and execution delegated to NET-NEW `drivers/workflow` (`standards/ARCHITECTURE.md:997-1008`; `standards/ARCHITECTURE.md:1528-1544`).
- **beep overlap & design delta:** beep already has a 64-hex `OntologyFingerprint` for semantic CAS (`packages/ontology/use-cases/src/tools/OntologyToolkit.ts:31-49`) and typed recoverable CAS conflicts (`packages/ontology/use-cases/src/tools/OntologyToolkit.ts:128-146`), but a durable execution lifecycle is **NOT FOUND** (`standards/ARCHITECTURE.md:997-1012`). Reuse the full fingerprint discipline; do not reuse the source's `Schema.String` workflow error or short hash (`packages/@core-v2/src/Service/WorkflowOrchestrator.ts:137-152`).
- **Goal linkage:** `trustgraph-port` explicitly requires execution identity to include workflow kind, input fingerprint, scope, and selected revisions, plus accepted/running/completed/failed states (`goals/trustgraph-port/SPEC.md:229-244`).
- **v3→v4 notes:** v4 `Workflow.make` takes the workflow tag as its first argument and options second, and the workflow value itself exposes execute, poll, interrupt, resume, and `toLayer` (`effect-smol@f643dbb/packages/effect/src/unstable/workflow/Workflow.ts:343-397`; `effect-smol@f643dbb/packages/effect/src/unstable/workflow/Workflow.ts:429-459`). The source facade is therefore partly boilerplate; retain only product authorization, lookup, and projection behavior not already supplied by v4.
- **Effort:** M
- **Verdict hint:** adapt-improve

### Partial-success staged batch process

- **Source:** `packages/@core-v2/src/Service/WorkflowOrchestrator.ts:306-450`; `packages/@core-v2/src/Service/WorkflowOrchestrator.ts:495-818` (effect-ontology)
- **What:** The batch handler moves through preprocessing, extraction, resolution, validation, and ingestion while emitting newer-only state; preprocessing can fall back to the original manifest and later stages retain per-document success/failure accounting (`packages/@core-v2/src/Service/WorkflowOrchestrator.ts:306-450`; `packages/@core-v2/src/Service/WorkflowOrchestrator.ts:495-818`). The valuable idea is an explicit partial-success policy per stage, not the source's single thousand-line handler (`packages/@core-v2/src/Service/WorkflowOrchestrator.ts:308-818`).
- **Category:** pattern
- **Proposed beep home:** a slice-local `.processes.ts` saga coordinating smaller workflow/activity contracts, with runtime handlers in the same slice's `server` package (`standards/ARCHITECTURE.md:997-1008`; `standards/ARCHITECTURE.md:1569-1576`).
- **beep overlap & design delta:** Current folder-based process contracts expose narrow ports such as streaming an assistant turn and proposing candidate output sets (`packages/agents/use-cases/src/processes/AssistantTurn/AssistantTurn.kernel.ts:40-73`; `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.service.ts:28-44`), but a persisted multi-stage saga is **NOT FOUND** (`standards/ARCHITECTURE.md:997-1012`). beep's explicit port/handler split should replace the source handler's direct acquisition of storage, config, event bus, and stage services (`packages/@core-v2/src/Service/WorkflowOrchestrator.ts:308-315`).
- **Goal linkage:** `trustgraph-port` already specifies per-workflow stage vocabularies and partial-result rules when only some corpora are ready (`goals/trustgraph-port/SPEC.md:246-268`).
- **v3→v4 notes:** Replace v3 `Effect.catchAll` branches with boundary-specific typed recovery using `Effect.catch`/tagged errors, and express orchestration functions with `Effect.fn`; these are target laws (`explorations/effect-ontology-harvest/research/MAPPING-CONTEXT.md:117-128`). Split registration Layers from the use-case contract because live Layer composition cannot live in `use-cases` (`standards/ARCHITECTURE.md:1119-1122`).
- **Effort:** L
- **Verdict hint:** adapt-improve

### Durable activity boundary, not the legacy activity wrapper

- **Source:** `packages/@core-v2/src/Workflow/Activities.ts:16-20`; `packages/@core-v2/src/Workflow/Activities.ts:114-150`; `packages/@core-v2/src/Workflow/DurableActivities.ts:296-340` (effect-ontology)
- **What:** `Activities.ts` explicitly says its wrappers are deprecated and then implements a custom factory with no workflow dependency; `DurableActivities.ts` is the real boundary because each `Activity.make` carries encoded success/error schemas, execution, and retry policy (`packages/@core-v2/src/Workflow/Activities.ts:16-20`; `packages/@core-v2/src/Workflow/Activities.ts:114-150`; `packages/@core-v2/src/Workflow/DurableActivities.ts:296-340`). The deprecated file is boilerplate to skip; schema-journaled side-effect boundaries are the insight.
- **Category:** pattern
- **Proposed beep home:** activity contracts beside the owning slice workflow in `<slice>/use-cases`, with implementations in `<slice>/server`; technical journaling remains in NET-NEW `drivers/workflow` (`standards/ARCHITECTURE.md:1001-1008`; `standards/ARCHITECTURE.md:1528-1544`).
- **beep overlap & design delta:** Existing process ports already keep implementations out of use-cases (`packages/agents/use-cases/src/processes/AssistantTurn/AssistantTurn.kernel.ts:40-73`; `apps/professional-desktop/src/runtime/Layer.ts:114-130`), but activity journaling is **NOT FOUND** (`standards/ARCHITECTURE.md:997-1012`). Preserve that boundary rather than copying source activities that directly acquire concrete storage/config/RDF services (`packages/@core-v2/src/Workflow/DurableActivities.ts:329-340`).
- **Goal linkage:** `trustgraph-port` needs durable, auditable stage transitions and failure causes, which are natural activity boundaries (`goals/trustgraph-port/SPEC.md:246-280`).
- **v3→v4 notes:** v4 keeps `Activity.make` as an options object with schema-encoded success/error and an interrupt retry policy, so this concept migrates cleanly (`effect-smol@f643dbb/packages/effect/src/unstable/workflow/Activity.ts:116-178`). Redesign service acquisition and tagged errors to beep laws rather than mechanically porting the activity bodies (`explorations/effect-ontology-harvest/research/MAPPING-CONTEXT.md:117-128`).
- **Effort:** M
- **Verdict hint:** design-reference

### Ontology-version-bound extraction runs

- **Source:** `packages/@core-v2/src/Workflow/StreamingExtractionActivity.ts:82-158`; `packages/@core-v2/src/Workflow/StreamingExtractionActivity.ts:211-276` (effect-ontology)
- **What:** Before extraction, the activity loads ontology content, derives a content hash, and embeds that version into `RunConfig`, so caches and run identity can distinguish ontology revisions (`packages/@core-v2/src/Workflow/StreamingExtractionActivity.ts:211-276`). Its helper truncates SHA-256 to 16 hex characters and hard-codes chunk size, concurrency, and grounding, so only the content-binding invariant should survive (`packages/@core-v2/src/Workflow/StreamingExtractionActivity.ts:82-158`).
- **Category:** pattern
- **Proposed beep home:** extend `packages/ontology/use-cases` run/workflow contracts with the existing `OntologyFingerprint`; keep policy defaults in slice config and runtime resolution in `ontology/server` (`packages/ontology/use-cases/src/tools/OntologyToolkit.ts:31-49`; `standards/ARCHITECTURE.md:1119-1122`).
- **beep overlap & design delta:** beep already computes a semantic rdfc-1.0 64-hex fingerprint and uses it as a compare-and-set precondition (`packages/ontology/use-cases/src/tools/OntologyToolkit.ts:31-49`; `packages/ontology/use-cases/src/tools/OntologyToolService.ts:125-138`). The source adds the useful idea of freezing that fingerprint into an extraction run; its truncated byte hash and embedded policy defaults are worse (`packages/@core-v2/src/Workflow/StreamingExtractionActivity.ts:82-158`).
- **Goal linkage:** `ontology-agent-surface` locks saved-file mutation to rdfc-1.0 fingerprint CAS and static budgets, so extraction runs should bind to the same revision identity (`goals/ontology-agent-surface/GOAL.md:34-44`). `trustgraph-port` likewise requires selected revision identities in workflow identity and audit (`goals/trustgraph-port/SPEC.md:229-280`).
- **v3→v4 notes:** Reuse beep's schema-branded fingerprint rather than casts to `ContentHash`, and model optional policy fields with the target schema conventions (`packages/ontology/use-cases/src/tools/OntologyToolkit.ts:31-49`; `explorations/effect-ontology-harvest/research/MAPPING-CONTEXT.md:117-128`). Activity construction itself maps to v4 `effect/unstable/workflow` (`effect-smol@f643dbb/packages/effect/src/unstable/workflow/Activity.ts:116-178`).
- **Effort:** S
- **Verdict hint:** port-now

### Validate-before-persist durable assertion gate

- **Source:** `packages/@core-v2/src/Workflow/StreamingExtractionActivity.ts:318-411`; `packages/@core-v2/src/Workflow/DurableActivities.ts:871-1040` (effect-ontology)
- **What:** Extraction serializes entities, relations, claim quads, and provenance into a named TriG graph but defers database persistence until the later claim-persistence activity after validation (`packages/@core-v2/src/Workflow/StreamingExtractionActivity.ts:318-411`; `packages/@core-v2/src/Workflow/DurableActivities.ts:871-881`). The implementation weakens that invariant by treating a missing persistence service as zero persisted work and by suppressing per-document persistence failures into counters (`packages/@core-v2/src/Workflow/DurableActivities.ts:895-908`; `packages/@core-v2/src/Workflow/DurableActivities.ts:1003-1020`).
- **Category:** pattern
- **Proposed beep home:** `epistemic/use-cases` process/workflow contract coordinating `ClaimGate`, with persistence handlers in `epistemic/server`; evidence models remain in `epistemic/domain` (`packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:71-88`; `packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts:54-80`).
- **beep overlap & design delta:** beep already has a SHACL-backed `ClaimGate` whose rejection is an explicit value and persisted evidence spans (`packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:71-88`; `packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts:54-80`). The source contributes durable stage separation and named-graph staging, but beep's candidate/approval lifecycle is stronger than its silent zero-success paths (`goals/agentic-professional-runtime/README.md:93-102`; `packages/@core-v2/src/Workflow/DurableActivities.ts:895-908`).
- **Goal linkage:** `agentic-professional-runtime` requires candidate assertions with evidence/provenance and human promotion before authoritative state (`goals/agentic-professional-runtime/SPEC.md:28-54`; `goals/agentic-professional-runtime/README.md:93-102`).
- **v3→v4 notes:** Model gate rejection, unavailable persistence, and partial document failure as distinct tagged classes at their proper boundaries; do not map all activity failures to strings or silently skip them (`explorations/effect-ontology-harvest/research/MAPPING-CONTEXT.md:117-128`). Keep the v4 activity's encoded error schema (`effect-smol@f643dbb/packages/effect/src/unstable/workflow/Activity.ts:123-157`).
- **Effort:** M
- **Verdict hint:** adapt-improve

### Generation-locked namespace graph merge

- **Source:** `packages/@core-v2/src/Workflow/DurableActivities.ts:648-838` (effect-ontology)
- **What:** Ingestion writes a batch graph, loads the namespace graph with its storage generation, unions triples, conditionally writes against that generation, and retries only generation mismatches with bounded jitter (`packages/@core-v2/src/Workflow/DurableActivities.ts:694-828`). This is a concrete lost-update defense for concurrent workflow completions, while its storage-specific generation token and inline graph parsing are implementation details (`packages/@core-v2/src/Workflow/DurableActivities.ts:698-815`).
- **Category:** pattern
- **Proposed beep home:** an optimistic-write product port in `ontology/use-cases`, implemented by `ontology/server` through the chosen object/persistence driver; orchestration belongs in the slice workflow handler (`standards/ARCHITECTURE.md:990-1008`; `standards/ARCHITECTURE.md:1528-1544`).
- **beep overlap & design delta:** beep already performs semantic fingerprint CAS before applying and saving ontology changes (`packages/ontology/use-cases/src/tools/OntologyToolService.ts:125-138`; `packages/ontology/use-cases/src/tools/OntologyToolService.ts:216-240`). The source applies the same concurrency principle to a shared namespace graph; adapt it to the existing semantic fingerprint rather than introducing a second public generation-token language.
- **Goal linkage:** `ontology-agent-surface` requires fail-closed CAS mutations and typed recoverable conflicts (`goals/ontology-agent-surface/GOAL.md:34-44`); durable extraction adds a server-side concurrent writer that must obey the same rule.
- **v3→v4 notes:** Replace `instanceof GenerationMismatchError` and native conditionals with a schema-derived tagged error and match helpers at the storage boundary (`packages/@core-v2/src/Workflow/DurableActivities.ts:809-827`; `explorations/effect-ontology-harvest/research/MAPPING-CONTEXT.md:117-128`). Keep retry policy in the workflow/server implementation, not the use-case port.
- **Effort:** M
- **Verdict hint:** adapt-improve

### Bounded extraction stream with content-versus-systemic failure

- **Source:** `packages/@core-v2/src/Workflow/StreamingExtraction.ts:29-59`; `packages/@core-v2/src/Workflow/StreamingExtraction.ts:115-164`; `packages/@core-v2/src/Workflow/StreamingExtraction.ts:503-559` (effect-ontology)
- **What:** The extraction stream chunks and saves text, processes chunks with bounded unordered concurrency, suppresses content-local failures into empty fragments, propagates systemic failures/interruption, buffers at twice the concurrency, and folds graph fragments (`packages/@core-v2/src/Workflow/StreamingExtraction.ts:115-164`; `packages/@core-v2/src/Workflow/StreamingExtraction.ts:503-559`). Its systemic classifier relies partly on runtime error classes, Node-style codes, and message substrings, so the policy is valuable but the classifier is brittle (`packages/@core-v2/src/Workflow/StreamingExtraction.ts:29-59`).
- **Category:** capability
- **Proposed beep home:** extend `packages/foundation/capability/nlp-processing` with a typed, policy-parameterized chunk executor; product persistence and retry decisions stay in the consuming slice's workflow handler (`packages/foundation/capability/nlp-processing/src/Graph/GraphOperations/Operation.ts:29-67`; `standards/ARCHITECTURE.md:1528-1544`).
- **beep overlap & design delta:** `GraphOperation` already defines per-leaf execution and says leaf failures are recorded without discarding the whole execution, while `GraphExecutor` owns validation/cost/execution (`packages/foundation/capability/nlp-processing/src/Graph/GraphOperations/Operation.ts:29-67`; `packages/foundation/capability/nlp-processing/src/Graph/GraphOperations/Executor.ts:79-123`). The source adds streaming concurrency, buffering, and an explicit fatality policy; beep supplies the better typed operation seam.
- **Goal linkage:** `trustgraph-port` needs fixed workflow budgets, timeouts, typed progress, and explicit partial results (`goals/trustgraph-port/SPEC.md:246-280`).
- **v3→v4 notes:** Replace `catchAll` plus `instanceof`/message inspection with tagged content, infrastructure, timeout, rate-limit, and interruption errors and `Effect.catch`/match helpers (`explorations/effect-ontology-harvest/research/MAPPING-CONTEXT.md:117-128`). Do not copy the source's self-providing God Layer, which merges eight dependencies inside the capability (`packages/@core-v2/src/Workflow/StreamingExtraction.ts:614-628`).
- **Effort:** M
- **Verdict hint:** adapt-improve

### Evidence-aware graph-fragment reducer

- **Source:** `packages/@core-v2/src/Workflow/Merge.ts:68-138`; `packages/@core-v2/src/Workflow/Merge.ts:161-368` (effect-ontology)
- **What:** `mergeGraphs` deterministically sorts output while merging entities by id, combining mentions, retaining provenance, taking maximum grounding confidence, and unioning relations; a companion reports conflicting attributes (`packages/@core-v2/src/Workflow/Merge.ts:161-247`; `packages/@core-v2/src/Workflow/Merge.ts:249-368`). The file claims an associative monoid, but supplies no law proof and leaves conflict chunk indexes empty, so the reducer needs property tests and stronger evidence preservation before reuse (`packages/@core-v2/src/Workflow/Merge.ts:129-138`; `packages/@core-v2/src/Workflow/Merge.ts:284-297`).
- **Category:** capability
- **Proposed beep home:** extend `packages/foundation/modeling/nlp` for the pure semantic reducer, with execution/caching in `packages/foundation/capability/nlp-processing` (`packages/foundation/modeling/nlp/src/Handoff/Contract.ts:334-440`; `packages/foundation/capability/nlp-processing/src/Graph/GraphOperations/Executor.ts:79-123`).
- **beep overlap & design delta:** beep's current graph `merge` remaps and copies nodes/edges structurally (`packages/foundation/modeling/nlp/src/Graph/GraphOps.ts:1072-1108`), while its handoff models already carry mention provenance, entity confidence, and relation evidence spans (`packages/foundation/modeling/nlp/src/Handoff/Contract.ts:334-440`). The source supplies semantic entity/relation reconciliation, but its ad-hoc entities should be projected onto beep's evidence-bearing schemas rather than ported.
- **Goal linkage:** `agentic-professional-runtime` makes claim plus evidence plus provenance plus lifecycle authoritative, so any reducer must retain rather than flatten evidence (`goals/agentic-professional-runtime/SPEC.md:43-54`).
- **v3→v4 notes:** Re-express inputs and conflict output as named `S.Class` schemas and derive guards; use Effect collection helpers instead of native `Map`/spread where repo law has equivalents (`explorations/effect-ontology-harvest/research/MAPPING-CONTEXT.md:117-128`). Add identity and associativity property proofs before using it under `Stream.runFold` (`packages/@core-v2/src/Workflow/Merge.ts:129-138`).
- **Effort:** M
- **Verdict hint:** adapt-improve

### Candidate-blocked entity-resolution overlay

- **Source:** `packages/@core-v2/src/Workflow/EntityResolution.ts:54-117`; `packages/@core-v2/src/Workflow/EntityResolutionGraph.ts:38-284`; `packages/@core-v2/src/Workflow/EntityResolutionGraph.ts:357-503` (effect-ontology)
- **What:** The baseline does all-pairs similarity plus union-find, whereas the graph variant batches embeddings, switches to token blocking at 50 entities, builds similarity edges, applies connected components, and materializes a two-tier MentionRecord-to-ResolvedEntity graph with scored resolution edges (`packages/@core-v2/src/Workflow/EntityResolution.ts:54-117`; `packages/@core-v2/src/Workflow/EntityResolutionGraph.ts:38-284`; `packages/@core-v2/src/Workflow/EntityResolutionGraph.ts:357-503`). Relation edges are still stamped `grounded: false`, so this is a candidate overlay rather than authoritative identity (`packages/@core-v2/src/Workflow/EntityResolutionGraph.ts:464-484`).
- **Category:** capability
- **Proposed beep home:** design-reference → `packages/foundation/capability/nlp-processing` for candidate generation, with acceptance owned by the consuming product slice; pure Mention/Entity/Relation shapes stay in `packages/foundation/modeling/nlp` (`packages/foundation/modeling/nlp/src/Handoff/Contract.ts:334-440`).
- **beep overlap & design delta:** beep already distinguishes source mentions from canonical entities and carries provenance/evidence (`packages/foundation/modeling/nlp/src/Handoff/Contract.ts:334-440`), but arbitrary-email entity resolution is explicitly deferred (`goals/agentic-professional-runtime/SPEC.md:118-128`). The source's explainable overlay and blocking strategy are useful; automatic connected-component promotion conflicts with beep's rule that agent output remains candidate until human acceptance (`goals/agentic-professional-runtime/README.md:93-102`).
- **Goal linkage:** `agentic-professional-runtime` is the future consumer, but its current proof deliberately defers arbitrary entity resolution and requires candidate approval (`goals/agentic-professional-runtime/SPEC.md:118-128`; `goals/agentic-professional-runtime/README.md:93-102`).
- **v3→v4 notes:** Effect Graph is available in the target, but all overlay nodes/edges should be schema classes with branded ids and Option-modeled optional values (`explorations/effect-ontology-harvest/research/MAPPING-CONTEXT.md:117-128`). Embedding failure must become an explicit candidate-quality signal rather than the source's silent `null` fallback (`packages/@core-v2/src/Workflow/EntityResolutionGraph.ts:93-113`).
- **Effort:** L
- **Verdict hint:** design-reference

### Keyed cluster extraction entity and governed handler

- **Source:** `packages/@core-v2/src/Cluster/ExtractionEntity.ts:24-163`; `packages/@core-v2/src/Cluster/ExtractionEntityHandler.ts:171-761`; `packages/@core-v2/src/server.ts:15-20`; `packages/@core-v2/src/server.ts:73-89` (effect-ontology)
- **What:** The protocol groups streaming extraction, cached-result lookup, cancellation, and status RPCs into a cluster entity keyed by idempotency, while the handler coordinates rate limits, token budgets, timeouts, progress, and cancellation (`packages/@core-v2/src/Cluster/ExtractionEntity.ts:89-163`; `packages/@core-v2/src/Cluster/ExtractionEntityHandler.ts:171-540`). `Entity.make` is thin protocol boilerplate; per-key serialization and governance are the insight, but cached results return empty arrays and status is a hard-coded 0/50/100 approximation (`packages/@core-v2/src/Cluster/ExtractionEntityHandler.ts:701-755`). The actual server path read uses `@effect/cluster` for `ClusterWorkflowEngine` plus `SingleRunner`, while the keyed entity is only materialized as an exported handler Layer in its own module (`packages/@core-v2/src/server.ts:15-20`; `packages/@core-v2/src/server.ts:73-89`; `packages/@core-v2/src/Cluster/ExtractionEntityHandler.ts:759-761`).
- **Category:** service
- **Proposed beep home:** `<slice>/use-cases/<Concept>.cluster.ts` for the driver-neutral protocol, `<slice>/server/<Concept>.cluster-handlers.ts` for behavior, and NET-NEW `drivers/sharding` only when a real distributed consumer exists (`standards/ARCHITECTURE.md:996-1008`; `standards/ARCHITECTURE.md:1521-1544`).
- **beep overlap & design delta:** Concrete `.cluster.ts` files are **NOT FOUND**, although the role and handler placement are explicitly reserved (`standards/ARCHITECTURE.md:996-1008`; `standards/ARCHITECTURE.md:1569-1576`). The source protocol is not ready to copy because graph arrays use `Schema.Any` and all errors are strings (`packages/@core-v2/src/Cluster/ExtractionEntity.ts:71-83`; `packages/@core-v2/src/Cluster/ExtractionEntity.ts:98-143`).
- **Goal linkage:** `trustgraph-port` needs idempotent workflow admission, status, progress, budgets, and cancellation-like control-plane behavior, but does not itself require distributed sharding (`goals/trustgraph-port/SPEC.md:229-280`).
- **v3→v4 notes:** The v4 `Entity.make(type, rpcArray)` constructor retains the same conceptual shape (`effect-smol@f643dbb/packages/effect/src/unstable/cluster/Entity.ts:423-457`), but imports move to `effect/unstable/cluster` and `effect/unstable/rpc` (`effect-smol@f643dbb/packages/effect/package.json:35-49`). Replace `Schema.Any`, optional keys, string errors, `Context.GenericTag`, and `.toLayer(...orDie)` with beep schemas, tagged failures, `Context.Service`, and explicit server Layers (`explorations/effect-ontology-harvest/research/MAPPING-CONTEXT.md:117-128`).
- **Effort:** L
- **Verdict hint:** design-reference

### Typed progress, recovery, cancellation, and resumption protocol

- **Source:** `packages/@core-v2/src/Contract/ProgressStreaming.ts:27-946`; `packages/@core-v2/src/Contract/ProgressStreaming.ts:1003-1175`; `packages/@core-v2/src/Service/ProgressStreaming.ts:551-595` (effect-ontology)
- **What:** The source models extraction/chunk/stage lifecycle, rate limiting, recoverable/fatal failure, cancellation, partial results, and resumption as serializable events and protocol messages (`packages/@core-v2/src/Contract/ProgressStreaming.ts:27-946`; `packages/@core-v2/src/Contract/ProgressStreaming.ts:1003-1175`). The generic `StageStarted/Progress/Completed` events are the dense reusable core; the many extraction-specific event classes are product protocol, not generic workflow substrate (`packages/@core-v2/src/Contract/ProgressStreaming.ts:797-946`).
- **Category:** model
- **Proposed beep home:** a compact generic stage/lifecycle schema in the first slice's `.workflows.ts`, with extraction-specific refinements in `ontology/use-cases`; transport messages remain in `.rpc.ts` and handlers in `ontology/server` (`standards/ARCHITECTURE.md:983-1008`).
- **beep overlap & design delta:** beep already streams typed assistant blocks over RPC (`packages/agents/use-cases/src/processes/Chat/Chat.rpc.ts:99-127`) and its client interrupts active streams during cleanup (`packages/agents/client/src/Chat.atoms.ts:703-718`; `packages/agents/client/src/Chat.atoms.ts:815-825`), but durable workflow progress/resumption is **NOT FOUND** (`standards/ARCHITECTURE.md:997-1012`). Prefer a small lifecycle plus stage union over copying the source's entire extraction taxonomy.
- **Goal linkage:** `trustgraph-port` requires typed stage events, partial-result semantics, persisted budget explanations, and an audit surface containing stage transitions and failure causes (`goals/trustgraph-port/SPEC.md:246-280`).
- **v3→v4 notes:** Rebuild the v3 `Schema.Class` hierarchy as target `S.Class` schemas, use `LiteralKit` for tag families, `S.OptionFromOptionalKey` where absence is meaningful, and annotate fields (`explorations/effect-ontology-harvest/research/MAPPING-CONTEXT.md:117-128`). Avoid parallel event and WebSocket DTO hierarchies when the v4 RPC schema can be the transport contract.
- **Effort:** M
- **Verdict hint:** adapt-improve

### Criticality-aware progress overload policy

- **Source:** `packages/@core-v2/src/Cluster/BackpressureHandler.ts:25-282`; `packages/@core-v2/src/Service/ProgressStreaming.ts:343-545` (effect-ontology)
- **What:** Both implementations try to preserve lifecycle/error events while sampling or dropping detail events under load, but neither is safe to port as written (`packages/@core-v2/src/Cluster/BackpressureHandler.ts:25-168`; `packages/@core-v2/src/Service/ProgressStreaming.ts:343-545`). The cluster version uses `Queue.bounded`, whose offers suspend rather than fail, so its `catchAll` “drop if full” branch cannot implement the stated policy; the service version enqueues into a `Ref` but `withBackpressure` never dequeues and always emits the original event (`packages/@core-v2/src/Cluster/BackpressureHandler.ts:107-166`; `packages/@core-v2/src/Service/ProgressStreaming.ts:523-545`).
- **Category:** design-idea
- **Proposed beep home:** design-reference → the server transport or workflow handler that owns delivery, using a real queue primitive; do not create a generic package until two consumers need the same event-criticality policy (`explorations/effect-ontology-harvest/research/MAPPING-CONTEXT.md:37-41`; `standards/ARCHITECTURE.md:1528-1544`).
- **beep overlap & design delta:** beep's Graphiti proxy already uses `Queue.dropping`, observes the boolean offer result, records rejection/queue metrics, and returns overload explicitly (`packages/tooling/tool/cli/src/commands/Graphiti/internal/ProxyQueue.ts:53-74`; `packages/tooling/tool/cli/src/commands/Graphiti/internal/ProxyQueue.ts:194-234`). Reuse that correct primitive pattern and take only the source's critical-versus-detail event classification (`packages/@core-v2/src/Cluster/BackpressureHandler.ts:50-80`).
- **Goal linkage:** `trustgraph-port` requires typed progress and persisted timeout/budget explanations; overload must not discard terminal or audit-bearing events (`goals/trustgraph-port/SPEC.md:246-280`).
- **v3→v4 notes:** In v4, `Queue.bounded` suspends producers, `Queue.sliding` drops oldest, and `Queue.dropping` returns false for a rejected new item (`effect-smol@f643dbb/packages/effect/src/Queue.ts:463-563`). Select the primitive that exactly matches policy; do not translate exception-catching code mechanically.
- **Effort:** S
- **Verdict hint:** design-reference

### Storage-backed workflow persistence adapter

- **Source:** `packages/@core-v2/src/Service/WorkflowPersistence.ts:19-103` (effect-ontology)
- **What:** The source adapts its storage service to workflow persistence under a `workflow-state/` prefix and supplies live, test, and pure-memory Layers (`packages/@core-v2/src/Service/WorkflowPersistence.ts:19-103`). Its reads collapse every storage error into a cache miss, while `clear` and `size` bypass the prefix entirely, so this implementation is evidence of the required port—not reusable code (`packages/@core-v2/src/Service/WorkflowPersistence.ts:33-57`).
- **Category:** service
- **Proposed beep home:** NET-NEW `drivers/workflow`, composed with an existing persistence driver at app runtime; slice use-cases see only the workflow contract (`standards/ARCHITECTURE.md:1537-1544`; `standards/ARCHITECTURE.md:1119-1122`).
- **beep overlap & design delta:** A workflow persistence driver is **NOT FOUND**; target browser state does use `KeyValueStore`, but only for client chat persistence (`packages/agents/client/src/Chat.atoms.ts:21-26`; `packages/agents/client/src/Chat.atoms.ts:311-325`). Keep storage failures distinguishable from missing entries, and define prefix-scoped administrative semantics instead of forwarding whole-store `clear`/`size`.
- **Goal linkage:** `trustgraph-port` requires persisted workflow identity, state, selected revisions, warnings, and failure causes (`goals/trustgraph-port/SPEC.md:229-280`).
- **v3→v4 notes:** Persistence moved from `@effect/experimental`/`@effect/platform` split packages to `effect/unstable/persistence` (`effect-smol@f643dbb/packages/effect/package.json:38-49`). v4 has `KeyValueStore.prefix` for ordinary keyed operations, but it deliberately only rewrites keyed methods, so whole-store operations still require an explicit design (`effect-smol@f643dbb/packages/effect/src/unstable/persistence/KeyValueStore.ts:290-323`). Preserve typed persistence failures rather than source-style `catchAll` misses.
- **Effort:** M
- **Verdict hint:** adapt-improve

### Authenticated per-ontology EventLog WebSocket router

- **Source:** `packages/@core-v2/src/Runtime/EventStreamRouter.ts:21-258` (effect-ontology)
- **What:** The router validates ontology existence, accepts a single-use ticket tied to that ontology (or an explicitly unauthenticated development mode), then delegates WebSocket synchronization to EventLogServer with memory or PostgreSQL storage (`packages/@core-v2/src/Runtime/EventStreamRouter.ts:33-81`; `packages/@core-v2/src/Runtime/EventStreamRouter.ts:87-168`; `packages/@core-v2/src/Runtime/EventStreamRouter.ts:174-258`). Per-resource authorization before protocol upgrade is the insight; the v3 experimental import and query-parameter authentication are not portable defaults (`packages/@core-v2/src/Runtime/EventStreamRouter.ts:21-27`; `packages/@core-v2/src/Runtime/EventStreamRouter.ts:102-168`).
- **Category:** service
- **Proposed beep home:** `ontology/server` for ontology lookup/auth/route adaptation plus NET-NEW `drivers/eventlog` only if production EventLog storage/transport becomes shared (`standards/ARCHITECTURE.md:1528-1544`).
- **beep overlap & design delta:** beep has an in-memory EventLog proof that writes and projects a typed event (`packages/tooling/library/ai-metrics/test/eventlog-proof.test.ts:13-60`), but an ontology EventLog transport is **NOT FOUND**. The ontology sidecar already requires loopback-only, Origin-validated, `RpcSessionAuth`-authenticated HTTP (`goals/ontology-agent-surface/GOAL.md:34-44`); the source route checks tickets and ontology ids but contains no Origin validation in its auth and route paths (`packages/@core-v2/src/Runtime/EventStreamRouter.ts:96-168`; `packages/@core-v2/src/Runtime/EventStreamRouter.ts:196-258`).
- **Goal linkage:** `ontology-agent-surface` supplies the binding sidecar authentication and Origin rules (`goals/ontology-agent-surface/GOAL.md:34-44`); `trustgraph-port` supplies the durable event/audit consumer (`goals/trustgraph-port/SPEC.md:246-280`).
- **v3→v4 notes:** Replace `@effect/experimental/EventLogServer` with `effect/unstable/eventlog` (`effect-smol@f643dbb/packages/effect/package.json:38-49`). v4 already provides an authentication middleware that rejects requests without an `EventLog.Identity`, plus authenticated RPC handler Layers (`effect-smol@f643dbb/packages/effect/src/unstable/eventlog/EventLogServer.ts:38-93`); compose that with beep's existing session auth and Origin gate rather than recreating v3 ticket middleware.
- **Effort:** L
- **Verdict hint:** design-reference

## Sources appended

`eo-wf-01` through `eo-wf-18`.
