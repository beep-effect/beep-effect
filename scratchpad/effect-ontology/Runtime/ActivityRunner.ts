/**
 * Activity Runner Entry Point
 *
 * Single Cloud Run Job that dispatches activities based on ACTIVITY_NAME env var.
 * Receives ACTIVITY_PAYLOAD as JSON and routes to the appropriate activity.
 *
 * Environment Variables:
 * - ACTIVITY_NAME: "extraction" | "resolution" | "validation" | "ingestion"
 * - ACTIVITY_PAYLOAD: JSON string containing activity input
 *
 * @since 2.0.0
 * @module Runtime/ActivityRunner
 */

import { BunServices, BunRuntime } from "@effect/platform-bun"
import { Config, Console, Effect, Layer, Match, Schema } from "effect"
import {
  ExtractionActivityInput,
  IngestionActivityInput,
  ResolutionActivityInput,
  ValidationActivityInput
} from "../Domain/Schema/Batch.ts"
import { ConfigServiceDefault } from "../Service/Config.ts"
import { EntityExtractor, RelationExtractor } from "../Service/Extraction.ts"
import { StageTimeoutServiceLive } from "../Service/LlmControl/StageTimeout.ts"
import { NlpService } from "../Service/Nlp.ts"
import { OntologyService } from "../Service/Ontology.ts"
import { RdfBuilder } from "../Service/Rdf.ts"
import { ShaclService } from "../Service/Shacl.ts"
import { StorageServiceLive } from "../Service/Storage.ts"
import { makeIngestionActivity, makeResolutionActivity, makeValidationActivity } from "../Workflow/DurableActivities.ts"
import { ExtractionWorkflowLive } from "../Workflow/StreamingExtraction.ts"
import { makeStreamingExtractionActivity } from "../Workflow/StreamingExtractionActivity.ts"
import { makeLanguageModelLayer } from "./ProductionRuntime.ts"

// -----------------------------------------------------------------------------
// Activity Name Schema
// -----------------------------------------------------------------------------

const ActivityName = Schema.Literals(["extraction", "resolution", "validation", "ingestion"])
type ActivityName = typeof ActivityName.Type

// -----------------------------------------------------------------------------
// Activity Dispatcher
// -----------------------------------------------------------------------------

/**
 * Parse activity name from environment
 */
const getActivityName = Config.string("ACTIVITY_NAME").pipe(
  Config.withDefault("extraction")
)

/**
 * Parse activity payload from environment
 */
const getActivityPayload = Config.string("ACTIVITY_PAYLOAD").pipe(
  Config.withDefault("{}")
)

/**
 * Dispatch to correct activity based on ACTIVITY_NAME
 *
 * Schema validation happens at ingress - the decoded payload is passed directly to the activity.
 */
const dispatchActivity = (name: ActivityName, payloadJson: string) =>
  Match.value(name).pipe(
    Match.when("extraction",
      Effect.fn(function*() {
        const payload = yield* Schema.decodeUnknownEffect(ExtractionActivityInput)(JSON.parse(payloadJson))
        // ExtractionActivityInput has: batchId, documentId, sourceUri, ontologyUri, targetNamespace
        // Use unified 6-phase streaming extraction activity
        const activity = makeStreamingExtractionActivity(payload)
        return yield* activity.execute
      })),
    Match.when("resolution",
      Effect.fn(function*() {
        const payload = yield* Schema.decodeUnknownEffect(ResolutionActivityInput)(JSON.parse(payloadJson))
        // ResolutionActivityInput has: batchId, documentGraphUris
        const activity = makeResolutionActivity(payload)
        return yield* activity.execute
      })),
    Match.when("validation",
      Effect.fn(function*() {
        const payload = yield* Schema.decodeUnknownEffect(ValidationActivityInput)(JSON.parse(payloadJson))
        // ValidationActivityInput has: batchId, resolvedGraphUri, shaclUri (optional)
        const activity = makeValidationActivity(payload)
        return yield* activity.execute
      })),
    Match.when("ingestion",
      Effect.fn(function*() {
        const payload = yield* Schema.decodeUnknownEffect(IngestionActivityInput)(JSON.parse(payloadJson))
        // IngestionActivityInput has: batchId, validatedGraphUri, targetNamespace
        const activity = makeIngestionActivity(payload)
        return yield* activity.execute
      })),
    Match.exhaustive
  )

// -----------------------------------------------------------------------------
// Main Entry Point
// -----------------------------------------------------------------------------

const program = Effect.gen(function*() {
  const activityNameRaw = yield* getActivityName
  const payloadJson = yield* getActivityPayload

  yield* Console.log(`ActivityRunner starting`)
  yield* Console.log(`  ACTIVITY_NAME: ${activityNameRaw}`)
  yield* Console.log(`  ACTIVITY_PAYLOAD length: ${payloadJson.length} chars`)

  // Parse and validate activity name
  const activityName = yield* Schema.decodeUnknownEffect(ActivityName)(activityNameRaw).pipe(
    Effect.mapError((_e) =>
      new Error(`Invalid ACTIVITY_NAME: ${activityNameRaw}. Expected: extraction, resolution, validation, or ingestion`)
    )
  )

  // Dispatch to activity
  const result = yield* dispatchActivity(activityName, payloadJson).pipe(
    Effect.tapError((error) => Console.error(`Activity ${activityName} failed: ${error}`))
  )

  yield* Console.log(`Activity ${activityName} completed successfully`)
  yield* Console.log(`Result: ${JSON.stringify(result, null, 2)}`)

  return result
}).pipe(
  Effect.catchDefect((defect) =>
    Effect.gen(function*() {
      yield* Console.error(`Activity runner crashed with defect: ${defect}`)
      return yield* Effect.die(defect)
    })
  )
)

// -----------------------------------------------------------------------------
// Layer Composition
// -----------------------------------------------------------------------------

/**
 * Activity runner layer - provides all dependencies for activities
 *
 * Layer composition order matters:
 * 1. BunServices provides FileSystem and Path (platform layer)
 * 2. ConfigServiceDefault provides ConfigService
 * 3. makeLanguageModelLayer provides LanguageModel (requires ConfigService)
 * 4. StageTimeoutServiceLive provides StageTimeoutService
 * 5. EntityExtractor/RelationExtractor require LanguageModel + ConfigService + StageTimeoutService
 * 6. NlpService requires ConfigService
 * 7. OntologyService requires RdfBuilder + NlpService + BunServices
 * 8. StorageServiceLive requires ConfigService + FileSystem/Path
 * 9. RdfBuilder.Default requires ConfigService
 *
 * Type Assertion Rationale:
 * The composed layer provides all services needed by the activities:
 * - StorageService, ConfigService, RdfBuilder, EntityExtractor, RelationExtractor
 * - OntologyService, NlpService, ShaclService, StageTimeoutService, LanguageModel
 * TypeScript's inference has difficulty with deep Effect layer compositions,
 * but the runtime composition is correct. The assertion documents this explicitly.
 */
const ActivityRunnerLive = Layer.mergeAll(
  StorageServiceLive,
  RdfBuilder.Default,
  EntityExtractor.Default,
  RelationExtractor.Default,
  OntologyService.Default,
  NlpService.Default,
  StageTimeoutServiceLive,
  ExtractionWorkflowLive // For unified streaming extraction activity
).pipe(
  Layer.provideMerge(makeLanguageModelLayer),
  Layer.provideMerge(ConfigServiceDefault),
  Layer.provideMerge(BunServices.layer),
  Layer.provideMerge(ShaclService.Default)
) as Layer.Layer<
  // All provided services (ROut)
  | import("../Service/Storage.ts").StorageService
  | import("../Service/Rdf.ts").RdfBuilder
  | import("../Service/Extraction.ts").EntityExtractor
  | import("../Service/Extraction.ts").RelationExtractor
  | import("../Service/Ontology.ts").OntologyService
  | import("../Service/Nlp.ts").NlpService
  | import("../Service/LlmControl/StageTimeout.ts").StageTimeoutService
  | import("effect/unstable/ai").LanguageModel.LanguageModel
  | import("../Service/Config.ts").ConfigService
  | import("../Service/Shacl.ts").ShaclService
  | import("../Service/ExtractionWorkflow.ts").ExtractionWorkflow,
  // Error type (E)
  never,
  // Requirements (RIn) - none, all satisfied
  never
>

// Run the program with all dependencies provided
BunRuntime.runMain(program.pipe(
  Effect.provide(ActivityRunnerLive)
) as Effect.Effect<unknown, unknown, never>)

// -----------------------------------------------------------------------------
// Run
// -----------------------------------------------------------------------------

// (execution starts above)
