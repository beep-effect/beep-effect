/**
 * Single source for the version this app reports about itself.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Version stamped into the `.mcpb` manifest and reported as the MCP server
 * version on `initialize`.
 *
 * **Gotchas**
 *
 * Claude Desktop identifies an installed extension by name and version, so two
 * packages with the same version are indistinguishable to it. Bump this for
 * every package that is handed to a user; the July 2026 hand-off shipped as
 * `0.0.0`.
 *
 * **Example** (Read the extension version)
 *
 * ```ts
 * import { PRACTICE_KG_EXTENSION_VERSION } from "../../src/Version.ts"
 *
 * console.log(PRACTICE_KG_EXTENSION_VERSION.split(".").length) // 3
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PRACTICE_KG_EXTENSION_VERSION = "0.3.0";
