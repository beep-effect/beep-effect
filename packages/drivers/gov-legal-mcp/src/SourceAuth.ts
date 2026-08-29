/**
 * Frozen eCFR and GovInfo source-auth registrations.
 *
 * eCFR is always mounted through the shipped `none` gate. GovInfo uses the
 * shipped `hard` gate and vanishes at composition when `GOVINFO_API_KEY` is
 * absent. The full `none | soft | hard` kit contract remains unchanged.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GOVINFO_API_KEY_ENV } from "@beep/govinfo";
import { SourceAuthRegistration } from "@beep/mcp-kit";

/**
 * Always-mounted eCFR registration. `ECFR_API_KEY` is an inert placeholder
 * because the `none` branch never resolves a credential.
 *
 * **Example** (Logging the none gate)
 *
 * ```ts
 * import { EcfrSourceAuthRegistration } from "@beep/gov-legal-mcp/SourceAuth"
 *
 * console.log(EcfrSourceAuthRegistration.gate)
 * // "none"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const EcfrSourceAuthRegistration: SourceAuthRegistration = SourceAuthRegistration.make({
  name: "eCFR",
  envVar: "ECFR_API_KEY",
  gate: "none",
});

/**
 * Hard-gated GovInfo registration using the driver's public credential name.
 *
 * **Example** (Logging the env var)
 *
 * ```ts
 * import { GovinfoSourceAuthRegistration } from "@beep/gov-legal-mcp/SourceAuth"
 *
 * console.log(GovinfoSourceAuthRegistration.envVar)
 * // "GOVINFO_API_KEY"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const GovinfoSourceAuthRegistration: SourceAuthRegistration = SourceAuthRegistration.make({
  name: "GovInfo",
  envVar: GOVINFO_API_KEY_ENV,
  gate: "hard",
});
