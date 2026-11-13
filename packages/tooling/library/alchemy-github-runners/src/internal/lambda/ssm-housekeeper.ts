/**
 * SSM housekeeper Lambda entry (EventBridge schedule).
 *
 * @internal
 */

import * as Effect from "effect/Effect";
import { HousekeeperRuntimeConfig } from "../../RunnerRuntime.models.ts";
import { handleSsmHousekeeping } from "../../SsmHousekeeper.program.ts";
import { awsLive, lambdaHandler } from "./Runtime.ts";

/**
 * Lambda handler: delete stale runner tokens.
 *
 * @internal
 */
export const handler = lambdaHandler({
  config: HousekeeperRuntimeConfig,
  layer: () => awsLive,
  run: (config) =>
    handleSsmHousekeeping(config).pipe(
      Effect.tap((names) => Effect.logInfo("stale tokens", names)),
      Effect.asVoid
    ),
  fallback: (): void => undefined,
});
