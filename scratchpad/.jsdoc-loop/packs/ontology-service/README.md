# Pack ontology-service

- modules: 78
- owning exports: 470
- re-exports: 39
- open modules: 0
- open owning exports: 6

## Files

- `effect-ontology/Service/Agent/AgentCoordinator.ts` owning=6 moduleFindings=none
- `effect-ontology/Service/Agent/AgentKit.ts` owning=2 moduleFindings=none
- `effect-ontology/Service/Agent/CorrectorAgent.ts` owning=11 moduleFindings=none
- `effect-ontology/Service/Agent/index.ts` owning=0 moduleFindings=none
- `effect-ontology/Service/Agent/types.ts` owning=21 moduleFindings=none
- `effect-ontology/Service/Assertion.ts` owning=7 moduleFindings=none
- `effect-ontology/Service/BatchState.ts` owning=8 moduleFindings=none
- `effect-ontology/Service/BatchStateBridge.ts` owning=4 moduleFindings=none
- `effect-ontology/Service/Claim.ts` owning=3 moduleFindings=none
- `effect-ontology/Service/ClaimPersistence.ts` owning=3 moduleFindings=none
- `effect-ontology/Service/Config.ts` owning=5 moduleFindings=none
- `effect-ontology/Service/ContentEnrichmentAgent.ts` owning=2 moduleFindings=none
- `effect-ontology/Service/CrossBatchEntityResolver.ts` owning=7 moduleFindings=none
- `effect-ontology/Service/Curation.ts` owning=3 moduleFindings=none
- `effect-ontology/Service/CurationJobProcessor.ts` owning=3 moduleFindings=none
- `effect-ontology/Service/DocumentClassifier.ts` owning=11 moduleFindings=none
- `effect-ontology/Service/Embedding.ts` owning=4 moduleFindings=none
- `effect-ontology/Service/EmbeddingCache.ts` owning=12 moduleFindings=none
- `effect-ontology/Service/EmbeddingCircuitBreaker.ts` owning=8 moduleFindings=none
- `effect-ontology/Service/EmbeddingFallback.ts` owning=5 moduleFindings=none
- `effect-ontology/Service/EmbeddingProvider.ts` owning=9 moduleFindings=none
- `effect-ontology/Service/EmbeddingRateLimiter.ts` owning=9 moduleFindings=none
- `effect-ontology/Service/EmbeddingRequest.ts` owning=3 moduleFindings=none
- `effect-ontology/Service/EmbeddingResolver.ts` owning=2 moduleFindings=none
- `effect-ontology/Service/EntityIndex.ts` owning=13 moduleFindings=none
- `effect-ontology/Service/EntityLinker.ts` owning=3 moduleFindings=none
- `effect-ontology/Service/EntityResolution.ts` owning=1 moduleFindings=none
- `effect-ontology/Service/EventBus.ts` owning=10 moduleFindings=none
- `effect-ontology/Service/Examples.ts` owning=6 moduleFindings=none
- `effect-ontology/Service/ExecutionDeduplicator.ts` owning=5 moduleFindings=none
- `effect-ontology/Service/Extraction.ts` owning=4 moduleFindings=none
- `effect-ontology/Service/ExtractionCache.ts` owning=8 moduleFindings=none
- `effect-ontology/Service/ExtractionRun.ts` owning=6 moduleFindings=none
- `effect-ontology/Service/ExtractionWorkflow.ts` owning=2 moduleFindings=none
- `effect-ontology/Service/GenerateWithFeedback.ts` owning=3 moduleFindings=none
- `effect-ontology/Service/GraphRAG.ts` owning=20 moduleFindings=none
- `effect-ontology/Service/Grounder.ts` owning=7 moduleFindings=none
- `effect-ontology/Service/ImageBlobStore.ts` owning=2 moduleFindings=none
- `effect-ontology/Service/ImageExtractor.ts` owning=3 moduleFindings=none
- `effect-ontology/Service/ImageFetcher.ts` owning=4 moduleFindings=none
- `effect-ontology/Service/ImagePromptAdapter.ts` owning=4 moduleFindings=none
- `effect-ontology/Service/ImageStore.ts` owning=2 moduleFindings=none
- `effect-ontology/Service/Inheritance.ts` owning=1 moduleFindings=none
- `effect-ontology/Service/JinaReaderClient.ts` owning=4 moduleFindings=none
- `effect-ontology/Service/LinkIngestionService.ts` owning=6 moduleFindings=none
- `effect-ontology/Service/LlmControl/RateLimiter.ts` owning=6 moduleFindings=none
- `effect-ontology/Service/LlmControl/StageTimeout.ts` owning=8 moduleFindings=none
- `effect-ontology/Service/LlmControl/TokenBudget.ts` owning=6 moduleFindings=none
- `effect-ontology/Service/LlmControl/index.ts` owning=0 moduleFindings=none
- `effect-ontology/Service/LlmProvider.ts` owning=2 moduleFindings=none
- `effect-ontology/Service/LlmWithRetry.ts` owning=2 moduleFindings=none
- `effect-ontology/Service/Nlp.ts` owning=12 moduleFindings=none
- `effect-ontology/Service/NomicEmbeddingProvider.ts` owning=2 moduleFindings=none
- `effect-ontology/Service/NomicNlp.ts` owning=10 moduleFindings=none
- `effect-ontology/Service/Ontology.ts` owning=2 moduleFindings=none
- `effect-ontology/Service/OntologyAgent.ts` owning=2 moduleFindings=none
- `effect-ontology/Service/OntologyLoader.ts` owning=1 moduleFindings=none
- `effect-ontology/Service/OntologyRegistry.ts` owning=5 moduleFindings=none
- `effect-ontology/Service/ProgressStreaming.ts` owning=23 moduleFindings=none
- `effect-ontology/Service/PromptCache.ts` owning=2 moduleFindings=none
- `effect-ontology/Service/PubSubClient.ts` owning=9 moduleFindings=none
- `effect-ontology/Service/Rdf.ts` owning=17 moduleFindings=none
- `effect-ontology/Service/Reasoner.ts` owning=7 moduleFindings=none
- `effect-ontology/Service/ReconciliationService.ts` owning=7 moduleFindings=none
- `effect-ontology/Service/RelationLinker.ts` owning=3 moduleFindings=none
- `effect-ontology/Service/Retry.ts` owning=5 moduleFindings=none
- `effect-ontology/Service/Shacl.ts` owning=6 moduleFindings=none
- `effect-ontology/Service/SimilarityScorer.ts` owning=2 moduleFindings=none
- `effect-ontology/Service/SparqlGenerator.ts` owning=4 moduleFindings=none
- `effect-ontology/Service/Storage.ts` owning=10 moduleFindings=none
- `effect-ontology/Service/SubgraphExtractor.ts` owning=10 moduleFindings=none
- `effect-ontology/Service/Ticket.ts` owning=3 moduleFindings=none
- `effect-ontology/Service/ViolationExplainer.ts` owning=5 moduleFindings=none
- `effect-ontology/Service/VoyageEmbeddingProvider.ts` owning=13 moduleFindings=none
- `effect-ontology/Service/WikidataClient.ts` owning=11 moduleFindings=none
- `effect-ontology/Service/WorkflowOrchestrator.ts` owning=9 moduleFindings=none
- `effect-ontology/Service/WorkflowPersistence.ts` owning=4 moduleFindings=none
- `effect-ontology/Service/index.ts` owning=0 moduleFindings=none

## Open modules

- none

## Open owning exports

- `effect-ontology/Service/EntityIndex.ts:28` `cosineSimilarity` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `effect-ontology/Service/Extraction.ts:51` `Mention` (type/re-export) missing=@category|@since findings=missing-summary|missing-required-tags
- `effect-ontology/Service/NomicNlp.ts:126` `NomicNlpService` (value/class) missing=none findings=missing-summary
- `effect-ontology/Service/Shacl.ts:44` `ShaclValidationReport` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `effect-ontology/Service/Shacl.ts:44` `ValidationPolicy` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `effect-ontology/Service/WorkflowOrchestrator.ts:1161` `BatchWorkflowPayload` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags

