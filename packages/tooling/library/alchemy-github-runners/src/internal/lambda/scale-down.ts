/**
 * Scale-down Lambda entry (EventBridge schedule).
 *
 * @internal
 */

import * as Effect from "effect/Effect";
import { PoolRuntimeConfig } from "../../RunnerRuntime.models.ts";
import { handleScaleDown } from "../../ScaleDown.program.ts";
import { fleetLive, lambdaHandler } from "./Runtime.ts";

/**
 * Lambda handler: one scale-down pass over the pool.
 *
 * @internal
 */
export const handler = lambdaHandler({
  config: PoolRuntimeConfig,
  layer: fleetLive,
  run: (config) =>
    handleScaleDown(config).pipe(
      Effect.tap((decisions) => Effect.logInfo("scale-down decisions", decisions)),
      Effect.asVoid
    ),
  fallback: (): void => undefined,
});
