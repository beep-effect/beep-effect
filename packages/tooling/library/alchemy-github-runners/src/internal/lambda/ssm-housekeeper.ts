/**
 * SSM housekeeper Lambda entry (EventBridge schedule).
 *
 * @internal
 */

import * as Effect from "effect/Effect";
import { HousekeeperRuntimeConfig } from "../../RunnerRuntime.models.ts";
import { handleSsmHousekeeping } from "../../SsmHousekeeper.program.ts";
import { awsLive, defineLambda, lambdaHandler } from "./Runtime.ts";

/**
 * Lambda handler: delete stale runner tokens.
 *
 * @internal
 */
export const definition = defineLambda({
  config: HousekeeperRuntimeConfig,
  layer: () => awsLive,
  run: (config) =>
    handleSsmHousekeeping(config).pipe(
      Effect.tap((names) => Effect.logInfo("stale tokens", names)),
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
