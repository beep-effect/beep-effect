/**
 * Package-local identity leaf for `@beep/infra-ci-runners`.
 *
 * **Details**
 *
 * The reaper Lambda handler bundles this package's modules, and a bundle's
 * source map embeds every module it loads. Taking the composer from this leaf
 * instead of `@beep/identity/packages` keeps the identity registry out of the
 * handler bundle, so registering a new workspace package does not change its
 * code hash. The value equals the registry's `$InfraCiRunnersId`; a test in
 * this package asserts it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BeepId } from "@beep/identity/Root";
import type { IdentityComposer } from "@beep/identity/Id";

/**
 * Identity composer for the `@beep/infra-ci-runners` package, built without
 * the identity registry.
 *
 * **Example** (Derive a stack identifier)
 *
 * ```ts
 * import { $InfraCiRunnersId } from "@beep/infra-ci-runners/internal/InfraCiRunnersId"
 *
 * console.log($InfraCiRunnersId.make("Reaper"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $InfraCiRunnersId: IdentityComposer<"@beep/infra-ci-runners"> = /*#__PURE__*/ $BeepId.create(
  "infra-ci-runners"
);
