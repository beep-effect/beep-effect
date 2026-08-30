# Pack ontology-runtime

- modules: 40
- owning exports: 210
- re-exports: 23
- open modules: 0
- open owning exports: 12

## Files

- `effect-ontology/Cluster/BackpressureHandler.ts` owning=5 moduleFindings=none
- `effect-ontology/Cluster/ExtractionEntity.ts` owning=16 moduleFindings=none
- `effect-ontology/Cluster/ExtractionEntityHandler.ts` owning=2 moduleFindings=none
- `effect-ontology/Cluster/index.ts` owning=0 moduleFindings=none
- `effect-ontology/Runtime/AssetRouter.ts` owning=1 moduleFindings=none
- `effect-ontology/Runtime/AuthRouter.ts` owning=1 moduleFindings=none
- `effect-ontology/Runtime/CircuitBreaker.ts` owning=7 moduleFindings=none
- `effect-ontology/Runtime/ClusterRuntime.ts` owning=5 moduleFindings=none
- `effect-ontology/Runtime/EmbeddingLayers.ts` owning=6 moduleFindings=none
- `effect-ontology/Runtime/EventBridge.ts` owning=5 moduleFindings=none
- `effect-ontology/Runtime/EventBroadcastRouter.ts` owning=16 moduleFindings=none
- `effect-ontology/Runtime/HealthCheck.ts` owning=6 moduleFindings=none
- `effect-ontology/Runtime/HttpMiddleware.ts` owning=4 moduleFindings=none
- `effect-ontology/Runtime/HttpServer.ts` owning=9 moduleFindings=none
- `effect-ontology/Runtime/ImageRouter.ts` owning=1 moduleFindings=none
- `effect-ontology/Runtime/InferenceRouter.ts` owning=4 moduleFindings=none
- `effect-ontology/Runtime/JobPushHandler.ts` owning=2 moduleFindings=none
- `effect-ontology/Runtime/LinkIngestionRouter.ts` owning=2 moduleFindings=none
- `effect-ontology/Runtime/LlmSemaphore.ts` owning=2 moduleFindings=none
- `effect-ontology/Runtime/Persistence/DatabaseReady.ts` owning=1 moduleFindings=none
- `effect-ontology/Runtime/Persistence/MigrationRunner.ts` owning=3 moduleFindings=none
- `effect-ontology/Runtime/Persistence/PostgresLayer.ts` owning=13 moduleFindings=none
- `effect-ontology/Runtime/Persistence/index.ts` owning=0 moduleFindings=none
- `effect-ontology/Runtime/ProductionRuntime.ts` owning=16 moduleFindings=none
- `effect-ontology/Runtime/RateLimitedLanguageModel.ts` owning=2 moduleFindings=none
- `effect-ontology/Runtime/Shutdown.ts` owning=4 moduleFindings=none
- `effect-ontology/Runtime/TestRuntime.ts` owning=4 moduleFindings=none
- `effect-ontology/Runtime/WorkflowLayers.ts` owning=12 moduleFindings=none
- `effect-ontology/Runtime/index.ts` owning=0 moduleFindings=none
- `effect-ontology/Schema/EntityFactory.ts` owning=3 moduleFindings=none
- `effect-ontology/Schema/MentionFactory.ts` owning=3 moduleFindings=none
- `effect-ontology/Schema/RelationFactory.ts` owning=3 moduleFindings=none
- `effect-ontology/Schema/index.ts` owning=0 moduleFindings=none
- `effect-ontology/Workflow/DurableActivities.ts` owning=35 moduleFindings=none
- `effect-ontology/Workflow/EntityResolution.ts` owning=4 moduleFindings=none
- `effect-ontology/Workflow/EntityResolutionGraph.ts` owning=2 moduleFindings=none
- `effect-ontology/Workflow/Merge.ts` owning=3 moduleFindings=none
- `effect-ontology/Workflow/StreamingExtraction.ts` owning=3 moduleFindings=none
- `effect-ontology/Workflow/StreamingExtractionActivity.ts` owning=5 moduleFindings=none
- `effect-ontology/Workflow/index.ts` owning=0 moduleFindings=none

## Open modules

- none

## Open owning exports

- `effect-ontology/Runtime/JobPushHandler.ts:305` `default` (value/default) missing=@category|@since|@example findings=missing-required-tags
- `effect-ontology/Runtime/ProductionRuntime.ts:50` `CentralRateLimiterServiceLive` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `effect-ontology/Runtime/ProductionRuntime.ts:51` `DEFAULT_SHUTDOWN_CONFIG` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `effect-ontology/Runtime/ProductionRuntime.ts:52` `ExtractionRouter` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `effect-ontology/Runtime/ProductionRuntime.ts:53` `HealthCheckService` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `effect-ontology/Runtime/ProductionRuntime.ts:54` `LlmSemaphoreService` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `effect-ontology/Runtime/ProductionRuntime.ts:55` `ShutdownError` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `effect-ontology/Runtime/ProductionRuntime.ts:56` `ShutdownService` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `effect-ontology/Runtime/ProductionRuntime.ts:57` `StageTimeoutServiceLive` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `effect-ontology/Runtime/ProductionRuntime.ts:58` `TokenBudgetServiceLive` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `effect-ontology/Runtime/WorkflowLayers.ts:597` `ConfigService` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags
- `effect-ontology/Runtime/WorkflowLayers.ts:597` `ConfigServiceDefault` (value/re-export) missing=@category|@since|@example findings=missing-summary|missing-required-tags
