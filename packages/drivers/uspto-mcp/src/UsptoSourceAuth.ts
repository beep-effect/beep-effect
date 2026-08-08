/**
 * USPTO `SourceAuth` registration.
 *
 * USPTO's Open Data Portal credential is optional at the driver layer
 * (`@beep/uspto`'s `Uspto.layer` always constructs; the `X-API-KEY` header is
 * attached only when a key is configured and the target is same-origin —
 * `Uspto.service.ts:249-255,398`), so this host registers it as `soft`: the
 * mounted tools stay registered and degrade at call time via the kit's
 * `api_key_required` envelope, rather than vanishing at composition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SourceAuthRegistration } from "@beep/mcp-kit";
import * as O from "effect/Option";

/**
 * The `SourceAuth` registration governing every USPTO-backed tool in this
 * host. `USPTO_API_KEY` is the same environment variable `@beep/uspto`'s own
 * `Uspto.layer` resolves.
 *
 * **Example** (Logging the soft gate)
 *
 * ```ts
 * import { UsptoSourceAuthRegistration } from "@beep/uspto-mcp/UsptoSourceAuth"
 *
 * console.log(UsptoSourceAuthRegistration.gate)
 * // "soft"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const UsptoSourceAuthRegistration: SourceAuthRegistration = SourceAuthRegistration.make({
  name: "USPTO Open Data Portal",
  envVar: "USPTO_API_KEY",
  gate: "soft",
  signupUrl: O.some("https://data.uspto.gov/apis/getting-started"),
});
