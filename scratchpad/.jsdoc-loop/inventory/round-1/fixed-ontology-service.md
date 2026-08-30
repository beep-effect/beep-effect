# Pack ontology-service — round 1 JSDoc fix report

- fixer: jsdoc-annotation-specialist
- owned surface: `scratchpad/effect-ontology/Service/**`
- rejected graph edges left undocumented (as required):
  - `export { cosineSimilarity }` in `EntityIndex.ts`
  - `export type { Mention }` in `Extraction.ts`
  - `export { ShaclValidationReport, ValidationPolicy }` in `Shacl.ts`
  - `export { BatchWorkflowPayload }` in `WorkflowOrchestrator.ts`

## Changed files

JSDoc-only (and `$I.annote` / `$I.annoteSchema`) edits across the Service pack, including:

- `Agent/AgentCoordinator.ts`, `Agent/AgentKit.ts`, `Agent/CorrectorAgent.ts`, `Agent/types.ts`
- `Assertion.ts`, `BatchState.ts`, `BatchStateBridge.ts`, `Claim.ts`, `ClaimPersistence.ts`, `Config.ts`
- `ContentEnrichmentAgent.ts`, `CrossBatchEntityResolver.ts`, `Curation.ts`, `CurationJobProcessor.ts`
- `DocumentClassifier.ts`, `Embedding.ts`, `EmbeddingCache.ts`, `EmbeddingCircuitBreaker.ts`
- `EmbeddingFallback.ts`, `EmbeddingProvider.ts`, `EmbeddingRateLimiter.ts`, `EmbeddingRequest.ts`
- `EmbeddingResolver.ts`, `EntityIndex.ts`, `EntityResolution.ts`, `EventBus.ts`, `Examples.ts`
- `ExecutionDeduplicator.ts`, `Extraction.ts`, `ExtractionCache.ts`, `ExtractionRun.ts`
- `ExtractionWorkflow.ts`, `GenerateWithFeedback.ts`, `GraphRAG.ts`, `Grounder.ts`
- `ImageBlobStore.ts`, `ImageExtractor.ts`, `ImageFetcher.ts`, `ImagePromptAdapter.ts`, `ImageStore.ts`
- `Inheritance.ts`, `JinaReaderClient.ts`, `LinkIngestionService.ts`
- `LlmControl/RateLimiter.ts`, `LlmControl/StageTimeout.ts`, `LlmControl/TokenBudget.ts`
- `LlmWithRetry.ts`, `Nlp.ts`, `NomicEmbeddingProvider.ts`, `NomicNlp.ts`
- `Ontology.ts`, `OntologyAgent.ts`, `OntologyLoader.ts`, `OntologyRegistry.ts`
- `ProgressStreaming.ts`, `PromptCache.ts`, `PubSubClient.ts`, `Rdf.ts`
- `Reasoner.ts`, `ReconciliationService.ts`, `RelationLinker.ts`, `Shacl.ts`
- `SimilarityScorer.ts`, `SparqlGenerator.ts`, `Storage.ts`, `SubgraphExtractor.ts`
- `Ticket.ts`, `ViolationExplainer.ts`, `VoyageEmbeddingProvider.ts`, `WikidataClient.ts`
- `WorkflowOrchestrator.ts`, `WorkflowPersistence.ts`

Runtime code was not changed.

## Items closed

| ID | Fix |
| --- | --- |
| R1-001 | `NomicNlpService` lead rewritten from `Service Tag`. |
| R1-002–R1-073 | Placeholder Examples replaced with construction, dual calls, Layer.provide, or Effect composition. `Layer.isLayer` and unused-binding `acceptsX` examples removed from the pack. |
| R1-074 | `makeCachedPrompt` Details/Gotchas: `_enableCaching` ignored; no `cache_control`. |
| R1-075 | `cosineSimilarity` Gotchas + aligned/degenerate Examples; `@category utilities`. |
| R1-076 | `PersistentEmbeddingCache` Gotchas: `clear` is in-memory only. |
| R1-077 | `BatchExtractionWorkflow` Gotchas: default fail-closed SHACL (`failOnViolation=true`). |
| R1-078 | DocumentClassifier structs `$I.annoteSchema`. |
| R1-079 | EmbeddingCache `Embedding` `$I.annoteSchema`. |
| R1-080 | `EventEntry` `$I.annoteSchema`. |
| R1-081 | `CachedExtractionResult` `$I.annoteSchema`. |
| R1-082 | `SerializedEntityIndex` `$I.annoteSchema`. |
| R1-083 | LiteralKits annotated: `CorrectionStrategy`, `ReasoningProfile`, `TimedStage`, `BudgetedStage`. |
| R1-084 | Class `$I.annote` for listed models (PipelineConfig, RefinementConfig/Result, ExecutionContext, CorrectionResult, BatchCorrectionResult, ReasoningConfig/Result, ReconciliationConfig, ExplanationContext, LlmViolationExplanation, BatchExplanationResult, VerificationTask). |
| extra | Deleted orphaned cosineSimilarity JSDoc on private `updateTypeIndex`. |

## Residual risk

- This fixer session had no shell tool, so **`bun run docgen:local` was not executed here**. Compile-fix any remaining Example type errors after the bounded docgen run.
- LLM/network services compose `Effect.provide(Default)` without `runSync`.
- GraphRAG `RetrievalResult` / `GroundedAnswer` / `ReasoningStep` / `ReasoningTrace` still have reject-only `S.is({}) // false` Examples (ScoredNode was upgraded).
- `AgentTask.forCorrection` Example constructs `ShaclValidationReport.make` — verify constructor fields.
- `PubSubClientConfig` Example uses `Effect.withConfigProvider`; Effect v4 Config APIs may need a different combinator.
- `JinaContent.make` URL field may require `URLStr` branding.
- `CircuitStatus.make` `state: "closed"` must match `CircuitState`.
- Nested Reasoner/ViolationExplainer member Examples were upgraded but may still have fence-indent issues.

## Commands run

- Documentation edits only; **docgen:local not run in this session**.
- Operator should run:

```bash
bun run docgen:local
# or, if planning refuses:
cd scratchpad && bun run docgen:effect-ontology
```

Owning package `check` should be run after docgen is green. If a Example fails the TypeScript gate, fix the Example — do not delete it.
