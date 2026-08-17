/**
 * Activity Runner Entry Point
 *
 * **Details**
 *
 * Single Cloud Run Job that dispatches activities based on ACTIVITY_NAME env var.
 * Receives ACTIVITY_PAYLOAD as JSON and routes to the appropriate activity.
 *
 * Environment Variables:
 * - ACTIVITY_NAME: "extraction" | "resolution" | "validation" | "ingestion"
 * - ACTIVITY_PAYLOAD: JSON string containing activity input
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Config, Console, Effect, Layer, Match } from "effect";
import * as S from "effect/Schema";
import { Workflow, WorkflowEngine } from "effect/unstable/workflow";
import { WorkflowInstance } from "effect/unstable/workflow/WorkflowEngine";
import {
  ExtractionActivityInput,
  IngestionActivityInput,
  ResolutionActivityInput,
  ValidationActivityInput,
} from "../Domain/Schema/Batch.ts";
import {
  makeIngestionActivity,
  makeResolutionActivity,
  makeValidationActivity,
} from "../Workflow/DurableActivities.ts";
import { makeStreamingExtractionActivity } from "../Workflow/StreamingExtractionActivity.ts";
import { ActivityDependenciesLayer, ConfigServiceDefault, EmbeddingBundleOpen } from "./WorkflowLayers.ts";

// -----------------------------------------------------------------------------
// Activity Name Schema
// -----------------------------------------------------------------------------

const ActivityName = S.Literals(["extraction", "resolution", "validation", "ingestion"]);
type ActivityName = typeof ActivityName.Type;

// -----------------------------------------------------------------------------
// Activity Dispatcher
// -----------------------------------------------------------------------------

/**
 * Parse activity name from environment
 */
const getActivityName = Config.string("ACTIVITY_NAME").pipe(Config.withDefault("extraction"));

/**
 * Parse activity payload from environment
 */
const getActivityPayload = Config.string("ACTIVITY_PAYLOAD").pipe(Config.withDefault("{}"));

/**
 * Dispatch to correct activity based on ACTIVITY_NAME
 *
 * Schema validation happens at ingress - the decoded payload is passed directly to the activity.
 */
const dispatchActivity = (name: ActivityName, payloadJson: string) =>
  Match.value(name).pipe(
    Match.when(
      "extraction",
      Effect.fn(function* () {
        const payload = yield* S.decodeEffect(S.fromJsonString(ExtractionActivityInput))(payloadJson);
        // ExtractionActivityInput has: batchId, documentId, sourceUri, ontologyUri, targetNamespace
        // Use unified 6-phase streaming extraction activity
        const activity = makeStreamingExtractionActivity(payload);
        return yield* activity.execute;
      })
    ),
    Match.when(
      "resolution",
      Effect.fn(function* () {
        const payload = yield* S.decodeEffect(S.fromJsonString(ResolutionActivityInput))(payloadJson);
        // ResolutionActivityInput has: batchId, documentGraphUris
        const activity = makeResolutionActivity(payload);
        return yield* activity.execute;
      })
    ),
    Match.when(
      "validation",
      Effect.fn(function* () {
        const payload = yield* S.decodeEffect(S.fromJsonString(ValidationActivityInput))(payloadJson);
        // ValidationActivityInput has: batchId, resolvedGraphUri, shaclUri (optional)
        const activity = makeValidationActivity(payload);
        return yield* activity.execute;
      })
    ),
    Match.when(
      "ingestion",
      Effect.fn(function* () {
        const payload = yield* S.decodeEffect(S.fromJsonString(IngestionActivityInput))(payloadJson);
        // IngestionActivityInput has: batchId, validatedGraphUri, targetNamespace
        const activity = makeIngestionActivity(payload);
        return yield* activity.execute;
      })
    ),
    Match.exhaustive
  );

// -----------------------------------------------------------------------------
// Main Entry Point
// -----------------------------------------------------------------------------

const program = Effect.gen(function* () {
  const activityNameRaw = yield* getActivityName;
  const payloadJson = yield* getActivityPayload;

  yield* Console.log(`ActivityRunner starting`);
  yield* Console.log(`  ACTIVITY_NAME: ${activityNameRaw}`);
  yield* Console.log(`  ACTIVITY_PAYLOAD length: ${payloadJson.length} chars`);

  // Parse and validate activity name
  const activityName = yield* S.decodeUnknownEffect(ActivityName)(activityNameRaw);

  // Dispatch to activity
  const result = yield* dispatchActivity(activityName, payloadJson).pipe(
    Effect.tapError((error) => Console.error(`Activity ${activityName} failed: ${error}`))
  );

  yield* Console.log(`Activity ${activityName} completed successfully`);
  const resultJson = yield* S.encodeUnknownEffect(S.fromJsonString(S.Unknown, { space: 2 }))(result);
  yield* Console.log(`Result: ${resultJson}`);

  return result;
}).pipe(
  Effect.catchDefect((defect) =>
    Effect.gen(function* () {
      yield* Console.error(`Activity runner crashed with defect: ${defect}`);
      return yield* Effect.die(defect);
    })
  )
);

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
const ActivityRunnerWorkflow = Workflow.make("activity-runner", {
  payload: { activityName: ActivityName },
  idempotencyKey: ({ activityName }) => activityName,
});

const ActivityServices = ActivityDependenciesLayer.pipe(
  Layer.provideMerge(EmbeddingBundleOpen.pipe(Layer.provide(ConfigServiceDefault)))
);

const ActivityRunnerLive = Layer.mergeAll(
  ActivityServices,
  WorkflowEngine.layerMemory,
  Layer.succeed(WorkflowInstance, WorkflowInstance.initial(ActivityRunnerWorkflow, "activity-runner")),
  BunServices.layer
);

// Build the layer inside a scope so every acquired service is released after
// the one-shot activity program completes.
const main = Effect.scoped(
  Effect.gen(function* () {
    const context = yield* Layer.build(ActivityRunnerLive);
    return yield* program.pipe(Effect.provide(context));
  })
);

BunRuntime.runMain(main);

// -----------------------------------------------------------------------------
// Run
// -----------------------------------------------------------------------------

// (execution starts above)
