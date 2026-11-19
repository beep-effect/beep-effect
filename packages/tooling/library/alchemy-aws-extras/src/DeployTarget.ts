/**
 * The AWS account and region a stack may deploy to, and the guard that
 * refuses any other before the stack declares a resource.
 *
 * @packageDocumentation
 * @category guards
 * @since 0.0.0
 */

import { AWSEnvironment } from "@alchemy.run/aws/Environment";
import { $AlchemyAwsExtrasId } from "@beep/identity/packages";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $AlchemyAwsExtrasId.create("DeployTarget");

/**
 * A twelve-digit AWS account id.
 *
 * **Example** (Decode an account id)
 *
 * ```ts
 * import { AwsAccountId } from "@beep/alchemy-aws-extras/DeployTarget"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AwsAccountId)("123456789012")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AwsAccountId = S.String.check(S.isPattern(/^\d{12}$/u)).pipe(
  $I.annoteSchema("AwsAccountId", {
    description: "A twelve-digit AWS account id.",
    message: "Expected a twelve-digit AWS account ID",
  })
);

/**
 * The account and region one stack is allowed to touch.
 *
 * **Example** (Name a target)
 *
 * ```ts
 * import { DeployTarget } from "@beep/alchemy-aws-extras/DeployTarget"
 *
 * const target = DeployTarget.make({ stack: "CiRunners", accountId: "123456789012", region: "us-east-1" })
 * console.log(target.region) // "us-east-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeployTarget extends S.Opaque<DeployTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    stack: S.NonEmptyString,
    accountId: AwsAccountId,
    region: S.NonEmptyString,
  }).pipe($I.annoteSchema("DeployTarget", { description: "The stack name, account and region it may touch." }))
) {}

/**
 * Fail unless the resolved AWS environment is the target's account and
 * region.
 *
 * **Details**
 *
 * The account comes from the resolved `AWSEnvironment` (an STS
 * `GetCallerIdentity` for environment credentials), so a session exported
 * from the wrong profile stops here, before any read or write. The failure
 * is a `ConfigError`, the only error an Alchemy stack program may raise; its
 * message names the expected target, never the credentials.
 *
 * **Example** (Guard a stack program)
 *
 * ```ts
 * import { DeployTarget, requireDeployTarget } from "@beep/alchemy-aws-extras/DeployTarget"
 *
 * const guard = requireDeployTarget(
 *   DeployTarget.make({ stack: "CiRunners", accountId: "123456789012", region: "us-east-1" })
 * )
 * console.log(typeof guard) // "object"
 * ```
 *
 * @param target - The stack's allowed account and region.
 * @returns The verified account id, or a `ConfigError`.
 * @category guards
 * @since 0.0.0
 */
export const requireDeployTarget = Effect.fn("DeployTarget.require")(function* (target: DeployTarget) {
  const { accountId, region } = yield* AWSEnvironment.current;
  if (accountId === target.accountId && region === target.region) {
    return accountId;
  }
  return yield* Effect.fail(
    new Config.ConfigError(
      new ConfigProvider.SourceError({
        message: `${target.stack} deploys only to AWS account ${target.accountId} in ${target.region}`,
      })
    )
  );
});
