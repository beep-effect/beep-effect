/**
 * Single source for the version the practice gateway reports about itself.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Version stamped into the `.mcpb` manifest, reported as the MCP server
 * version on `initialize`, and printed by `--self-check`.
 *
 * **Gotchas**
 *
 * Claude Desktop identifies an installed extension by name and version, so
 * bump this for every package handed to a user.
 *
 * **Example** (Read the gateway version)
 *
 * ```ts
 * import { PRACTICE_GATEWAY_VERSION } from "@beep/practice-gateway/Version"
 *
 * console.log(PRACTICE_GATEWAY_VERSION.split(".").length) // 3
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PRACTICE_GATEWAY_VERSION = "0.1.1";
