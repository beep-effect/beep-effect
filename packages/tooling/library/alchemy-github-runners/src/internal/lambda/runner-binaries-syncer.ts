/**
 * Runner-binaries syncer Lambda entry (EventBridge schedule).
 *
 * @internal
 */

import * as Effect from "effect/Effect";
import { handleRunnerBinariesSync } from "../../RunnerBinariesSyncer.program.ts";
import { SyncerRuntimeConfig } from "../../RunnerRuntime.models.ts";
import { awsLive, defineLambda, lambdaHandler } from "./Runtime.ts";

/**
 * Lambda handler: refresh the S3 mirror of the runner tarball.
 *
 * @internal
 */
export const definition = defineLambda({
  config: SyncerRuntimeConfig,
  layer: () => awsLive,
  run: (config) =>
    handleRunnerBinariesSync(config).pipe(
      Effect.tap((uploaded) => Effect.logInfo("runner binaries", { uploaded })),
      Effect.asVoid
    ),
  fallback: (): void => undefined,
});

/**
 * The Lambda entry point.
 *
 * @internal
 */
export const handler = lambdaHandler(definition);
