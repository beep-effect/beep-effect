/**
 * Edge authority server adapter entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Edge authority repository layer exports.
 *
 * **Example** (Repository layer export check)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as EdgeAuthority from "@beep/epistemic-server/EdgeAuthority"
 *
 * strictEqual(typeof EdgeAuthority.EdgeAuthorityRepositoryDrizzle, "object")
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./EdgeAuthority.layer.ts";
/**
 * Edge authority repository adapter exports.
 *
 * **Example** (Adapter factory export check)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as EdgeAuthority from "@beep/epistemic-server/EdgeAuthority"
 *
 * strictEqual(typeof EdgeAuthority.makeDrizzleEdgeAuthorityRepository, "function")
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export { makeDrizzleEdgeAuthorityRepository } from "./EdgeAuthority.repo.ts";
