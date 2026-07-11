/**
 * Runtime constants for the Tailscale CLI driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Duration } from "effect";

/**
 * Default HTTPS port configured by Tailscale Serve.
 *
 * @example
 * ```ts
 * import { DEFAULT_TAILSCALE_SERVE_PORT } from "@beep/tailscale/Tailscale.config"
 * import { buildTailscaleHttpsBaseUrl } from "@beep/tailscale/Tailscale.service"
 *
 * const origin = buildTailscaleHttpsBaseUrl({
 *   magicDnsName: "host.tail.ts.net",
 *   servePort: DEFAULT_TAILSCALE_SERVE_PORT
 * })
 * console.log(origin) // "https://host.tail.ts.net/"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_TAILSCALE_SERVE_PORT = 443;

/**
 * Maximum time allowed for `tailscale status`.
 *
 * @example
 * ```ts
 * import { TAILSCALE_STATUS_TIMEOUT } from "@beep/tailscale/Tailscale.config"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toMillis(TAILSCALE_STATUS_TIMEOUT)) // 1500
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const TAILSCALE_STATUS_TIMEOUT = Duration.millis(1_500);

/**
 * Maximum time allowed for a Tailscale Serve mutation.
 *
 * @example
 * ```ts
 * import { TAILSCALE_SERVE_TIMEOUT } from "@beep/tailscale/Tailscale.config"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toSeconds(TAILSCALE_SERVE_TIMEOUT)) // 10
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const TAILSCALE_SERVE_TIMEOUT = Duration.seconds(10);

/**
 * Maximum time allowed for an HTTPS readiness probe.
 *
 * @example
 * ```ts
 * import { TAILSCALE_PROBE_TIMEOUT } from "@beep/tailscale/Tailscale.config"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toMillis(TAILSCALE_PROBE_TIMEOUT)) // 2500
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const TAILSCALE_PROBE_TIMEOUT = Duration.millis(2_500);
