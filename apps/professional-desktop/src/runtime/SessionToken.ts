/**
 * Per-launch sidecar RPC session token configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Config from "effect/Config";

/**
 * Environment variable carrying the per-launch sidecar RPC session token.
 *
 * @category configuration
 * @since 0.0.0
 */
const DESKTOP_RPC_SESSION_TOKEN_ENV = "BEEP_DESKTOP_RPC_SESSION_TOKEN" as const;

/**
 * Optional redacted session token read by the sidecar on boot.
 *
 * **Example** (Check the optional token config)
 *
 * ```ts
 * import { DesktopRpcSessionToken } from "@/runtime/SessionToken"
 * import * as Config from "effect/Config"
 *
 * console.log(Config.isConfig(DesktopRpcSessionToken)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DesktopRpcSessionToken = Config.Redacted(DESKTOP_RPC_SESSION_TOKEN_ENV).pipe(Config.option);

/**
 * Required redacted session token, for clients such as the remote vault-sync CLI.
 *
 * **Example** (Check the required token config)
 *
 * ```ts
 * import { DesktopRpcSessionTokenRequired } from "@/runtime/SessionToken"
 * import * as Config from "effect/Config"
 *
 * console.log(Config.isConfig(DesktopRpcSessionTokenRequired)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DesktopRpcSessionTokenRequired = Config.Redacted(DESKTOP_RPC_SESSION_TOKEN_ENV);
