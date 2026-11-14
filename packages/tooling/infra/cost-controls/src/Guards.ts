/**
 * Guards the `CostControls` stack runs before it declares any resource.
 *
 * @packageDocumentation
 * @category guards
 * @since 0.0.0
 */

import { AWSEnvironment } from "@alchemy.run/aws/Environment";
import { $InfraCostControlsId } from "@beep/identity/packages";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { productionStage } from "./Config.ts";
import type { CostControlsConfig } from "./Config.ts";

const $I = $InfraCostControlsId.create("Guards");

/**
 * Fail unless the deploying identity is in the expected account and region.
 *
 * **Details**
 *
 * The account comes from the resolved AWS environment (an STS
 * `GetCallerIdentity` for env credentials), so a session exported from the
 * wrong profile or a role in another account stops here, before any read or
 * write. The failure is a `ConfigError` because that is the only error an
 * Alchemy stack program may raise; its message names the expected account
 * and never the credentials.
 *
 * **Example** (Guard a stack program)
 *
 * ```ts
 * import { resolveStageConfig } from "@beep/infra-cost-controls/Config"
 * import { requireExpectedAccount } from "@beep/infra-cost-controls/Guards"
 * import * as Effect from "effect/Effect"
 *
 * const guard = Effect.flatMap(resolveStageConfig("prod"), requireExpectedAccount)
 * console.log(typeof guard) // "object"
 * ```
 *
 * @param config - The stage configuration naming the expected account.
 * @returns An effect that succeeds with the verified account id.
 * @category guards
 * @since 0.0.0
 */
export const requireExpectedAccount = Effect.fn("CostControls.requireExpectedAccount")(function* (
  config: CostControlsConfig
) {
  const environment = yield* AWSEnvironment.current;
  const target = S.Struct({
    accountId: S.tag(config.expectedAccountId).annotate({
      message: `CostControls deploys only to AWS account ${config.expectedAccountId}`,
    }),
    region: S.tag(config.region).annotate({ message: `CostControls deploys only to ${config.region}` }),
  }).pipe($I.annoteSchema("DeployTarget", { description: "The account and region the stack may touch." }));
  const verified = yield* S.decodeUnknownEffect(target)({
    accountId: environment.accountId,
    region: environment.region,
  }).pipe(Effect.mapError((error) => new Config.ConfigError(error)));
  return verified.accountId;
});

/**
 * Fail a `prod` plan or deploy that does not run in CI.
 *
 * **Details**
 *
 * `prod` deploys only from the `cost-controls-prod` GitHub environment under
 * its concurrency group; the S3 state lease is the second guard. Every other
 * stage passes.
 *
 * **Example** (Guard a personal stage)
 *
 * ```ts
 * import { requireCiForProduction } from "@beep/infra-cost-controls/Guards"
 * import * as Effect from "effect/Effect"
 *
 * Effect.runSync(requireCiForProduction("dev_alice"))
 * ```
 *
 * @param stage - The Alchemy stage being planned or deployed.
 * @returns An effect that fails with a `ConfigError` when `prod` runs outside CI.
 * @category guards
 * @since 0.0.0
 */
export const requireCiForProduction = Effect.fn("CostControls.requireCiForProduction")(function* (stage: string) {
  if (stage === productionStage) {
    yield* Config.Literal("true", "CI");
  }
});
