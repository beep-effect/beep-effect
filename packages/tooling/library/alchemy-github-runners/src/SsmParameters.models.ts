/**
 * SSM Parameter Store layout of a runner fleet.
 *
 * The layout follows the `ssm` module of github-aws-runners/terraform-aws-github-runner
 * v7.10.1 (MIT; see the package README): App secrets under `<root>/app/`,
 * one-use runner tokens under `<root>/<pool>/tokens/<instance-id>`, and the
 * runner-group id cache under `<root>/<pool>/config/runner-group/<name>`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $AlchemyGithubRunnersId.create("SsmParameters.models");

/**
 * An absolute SSM parameter name or path.
 *
 * **Example** (Validate a path)
 *
 * ```ts
 * import { SsmParameterName } from "@beep/alchemy-github-runners/SsmParameters.models"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SsmParameterName)("/beep-ci/app/github_app_id")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SsmParameterName = S.String.check(S.isPattern(/^\/[A-Za-z0-9_./-]+$/u)).pipe(
  $I.annoteSchema("SsmParameterName", { description: "An absolute SSM parameter name or path." })
);

/**
 * The three App parameters every Lambda that talks to GitHub reads.
 *
 * **Details**
 *
 * All three are SecureString parameters whose values the stack's caller
 * supplies. `keyBase64` holds the App's PEM private key, base64-encoded, as
 * upstream stores it.
 *
 * **Example** (Default names under a root)
 *
 * ```ts
 * import { appParameterNames } from "@beep/alchemy-github-runners/SsmParameters.models"
 *
 * console.log(appParameterNames("/beep-ci").id) // "/beep-ci/app/github_app_id"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AppParameterNames extends S.Opaque<AppParameterNames, { readonly brand: unique symbol }>()(
  S.Struct({
    id: SsmParameterName,
    keyBase64: SsmParameterName,
    webhookSecret: SsmParameterName,
  }).pipe(
    $I.annoteSchema("AppParameterNames", {
      description: "The three App parameters every GitHub-facing Lambda reads.",
    })
  )
) {}

/**
 * The App parameter names under a fleet's SSM root.
 *
 * **Example** (The key parameter)
 *
 * ```ts
 * import { appParameterNames } from "@beep/alchemy-github-runners/SsmParameters.models"
 *
 * console.log(appParameterNames("/beep-ci").keyBase64)
 * ```
 *
 * @param root - The fleet's SSM root, without a trailing slash.
 * @returns The App id, key and webhook-secret parameter names.
 * @category constructors
 * @since 0.0.0
 */
export const appParameterNames = (root: string): AppParameterNames =>
  AppParameterNames.make({
    id: `${root}/app/github_app_id`,
    keyBase64: `${root}/app/github_app_key_base64`,
    webhookSecret: `${root}/app/github_app_webhook_secret`,
  });

/**
 * Where a pool's one-use runner tokens live.
 *
 * **Example** (The heavy pool's token path)
 *
 * ```ts
 * import { poolTokenPath } from "@beep/alchemy-github-runners/SsmParameters.models"
 *
 * console.log(poolTokenPath({ root: "/beep-ci", pool: "heavy" })) // "/beep-ci/heavy/tokens"
 * ```
 *
 * @param input - The fleet's SSM root and the pool name.
 * @returns The token path; each token is `<path>/<instance-id>`.
 * @category constructors
 * @since 0.0.0
 */
export const poolTokenPath = ({ root, pool }: { readonly root: string; readonly pool: string }): string =>
  `${root}/${pool}/tokens`;

/**
 * Where a pool caches configuration it resolves at runtime (the runner-group id).
 *
 * **Example** (The heavy pool's config path)
 *
 * ```ts
 * import { poolConfigPath } from "@beep/alchemy-github-runners/SsmParameters.models"
 *
 * console.log(poolConfigPath({ root: "/beep-ci", pool: "heavy" })) // "/beep-ci/heavy/config"
 * ```
 *
 * @param input - The fleet's SSM root and the pool name.
 * @returns `<root>/<pool>/config`.
 * @category constructors
 * @since 0.0.0
 */
export const poolConfigPath = ({ root, pool }: { readonly root: string; readonly pool: string }): string =>
  `${root}/${pool}/config`;

/**
 * The cached runner-group id parameter for a group name.
 *
 * **Example** (Cache key)
 *
 * ```ts
 * import { runnerGroupCacheName } from "@beep/alchemy-github-runners/SsmParameters.models"
 *
 * console.log(runnerGroupCacheName({ configPath: "/beep-ci/heavy/config", group: "beep-ec2-heavy" }))
 * ```
 *
 * @param input - The pool's config path and the runner group name.
 * @returns The parameter name.
 * @category constructors
 * @since 0.0.0
 */
export const runnerGroupCacheName = ({
  configPath,
  group,
}: {
  readonly configPath: string;
  readonly group: string;
}): string => `${configPath}/runner-group/${group}`;
