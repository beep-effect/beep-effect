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
 * @category configuration
 * @since 0.0.0
 */
export const DesktopRpcSessionToken = Config.Redacted(DESKTOP_RPC_SESSION_TOKEN_ENV).pipe(Config.option);

/**
 * Required redacted session token, for clients such as the remote vault-sync CLI.
 *
 * @category configuration
 * @since 0.0.0
 */
export const DesktopRpcSessionTokenRequired = Config.Redacted(DESKTOP_RPC_SESSION_TOKEN_ENV);
