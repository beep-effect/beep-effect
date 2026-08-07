/**
 * Schemas for Next.js subresource integrity plugin configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";

const $I = $RepoConfigsId.create("next/models/SubresourceIntegrityPlugin.schema");

/**
 * Supported subresource integrity hash algorithms.
 *
 * **Example** (Inspect algorithm schema)
 *
 * ```ts
 * import { SubresourceIntegrityAlgorithm } from "@beep/repo-configs/next/models/SubresourceIntegrityPlugin.schema"
 * const algorithm = SubresourceIntegrityAlgorithm
 * console.log(algorithm)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SubresourceIntegrityAlgorithm = LiteralKit(["sha256", "sha384", "sha512"]).pipe(
  $I.annoteSchema("SubresourceIntegrityAlgorithm", {
    description: "Subresource Integrity algorithm",
  })
);

/**
 * Supported subresource integrity hash algorithm.
 *
 * **Example** (Type-check sha384 algorithm)
 *
 * ```ts
 * import type { SubresourceIntegrityAlgorithm } from "@beep/repo-configs/next/models/SubresourceIntegrityPlugin.schema"
 * const algorithm = "sha384" satisfies SubresourceIntegrityAlgorithm
 * console.log(algorithm)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SubresourceIntegrityAlgorithm = typeof SubresourceIntegrityAlgorithm.Type;
