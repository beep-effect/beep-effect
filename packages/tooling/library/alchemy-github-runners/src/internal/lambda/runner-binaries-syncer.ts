/**
 * Runner-binaries syncer Lambda entry (EventBridge schedule).
 *
 * @internal
 */

import * as Effect from "effect/Effect";
import { handleRunnerBinariesSync } from "../../RunnerBinariesSyncer.program.ts";
import { SyncerRuntimeConfig } from "../../RunnerRuntime.models.ts";
import { awsLive, lambdaHandler } from "./Runtime.ts";

/**
 * Lambda handler: refresh the S3 mirror of the runner tarball.
 *
 * @internal
 */
export const handler = lambdaHandler({
  config: SyncerRuntimeConfig,
  layer: () => awsLive,
  run: (config) =>
    handleRunnerBinariesSync(config).pipe(
      Effect.tap((uploaded) => Effect.logInfo("runner binaries", { uploaded })),
      Effect.asVoid
    ),
  fallback: (): void => undefined,
});
