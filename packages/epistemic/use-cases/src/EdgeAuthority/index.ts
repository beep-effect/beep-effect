/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Edge authority command exports.
 *
 * **Example** (RecordEdgeFact command export)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as EdgeAuthority from "@beep/epistemic-use-cases/EdgeAuthority"
 *
 * strictEqual(typeof EdgeAuthority.RecordEdgeFact, "function")
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export * from "./EdgeAuthority.commands.ts";
/**
 * Edge authority typed error exports.
 *
 * **Example** (SupersessionConflict error export)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as EdgeAuthority from "@beep/epistemic-use-cases/EdgeAuthority"
 *
 * strictEqual(typeof EdgeAuthority.SupersessionConflict, "function")
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./EdgeAuthority.errors.ts";
/**
 * Edge authority repository port exports.
 *
 * **Example** (EdgeAuthorityRepository port export)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as EdgeAuthority from "@beep/epistemic-use-cases/EdgeAuthority"
 *
 * strictEqual(typeof EdgeAuthority.EdgeAuthorityRepository, "function")
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export * from "./EdgeAuthority.ports.ts";
