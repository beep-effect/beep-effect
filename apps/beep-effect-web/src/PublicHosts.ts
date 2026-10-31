/**
 * Public hostnames of the `prod` stage, derived from the `@beep/public-site`
 * origin so the deploy cannot drift from it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { PublicOrigin } from "@beep/public-site";

/**
 * Hostname that serves this app in the `prod` stage.
 *
 * **Example** (Read the apex host)
 *
 * ```ts
 * import { apexHost } from "@/PublicHosts"
 *
 * console.log(apexHost) // "beep-effect.com"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const apexHost = new URL(PublicOrigin.literal).hostname;

/**
 * Hostname that 301-redirects to {@link apexHost} before the Worker runs.
 *
 * **Example** (Read the redirect host)
 *
 * ```ts
 * import { wwwHost } from "@/PublicHosts"
 *
 * console.log(wwwHost) // "www.beep-effect.com"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const wwwHost = `www.${apexHost}`;
