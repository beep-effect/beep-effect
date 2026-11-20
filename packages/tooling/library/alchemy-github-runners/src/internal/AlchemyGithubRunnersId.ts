/**
 * Package-local identity leaf for `@beep/alchemy-github-runners`.
 *
 * **Details**
 *
 * Every Lambda handler under `internal/lambda/` bundles this package's
 * modules, and a bundle's source map embeds every module it loads. Taking the
 * composer from this leaf instead of `@beep/identity/packages` keeps the
 * identity registry out of the handler bundles, so registering a new
 * workspace package does not change their code hash. The value equals the
 * registry's `$AlchemyGithubRunnersId`; a test in this package asserts it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BeepId } from "@beep/identity/Root";

/**
 * Identity composer for the `@beep/alchemy-github-runners` package, built
 * without the identity registry.
 *
 * **Example** (Derive a runner fleet identifier)
 *
 * ```ts
 * import { $AlchemyGithubRunnersId } from "@beep/alchemy-github-runners/internal/AlchemyGithubRunnersId"
 *
 * console.log($AlchemyGithubRunnersId.make("RunnerFleet"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AlchemyGithubRunnersId = /*#__PURE__*/ $BeepId.create("alchemy-github-runners");
