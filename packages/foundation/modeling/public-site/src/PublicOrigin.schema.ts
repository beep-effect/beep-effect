/**
 * The single public origin that hosts ring-0 projections of the repository.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PublicSiteId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $PublicSiteId.create("PublicOrigin");

/**
 * Schema for the apex origin `https://beep-effect.com`.
 *
 * **Details**
 *
 * The apex hosts public projections only. Services and authenticated instances
 * live on subdomains and are not modeled here. Build hosted URLs with
 * `hostedUrl` and `labRoute` instead of writing the origin as a string literal.
 *
 * **Example** (Read the public origin)
 *
 * ```ts import.meta.vitest name="Read the public origin"
 * import { PublicOrigin } from "@beep/public-site/PublicOrigin.schema"
 *
 * PublicOrigin.literal // => "https://beep-effect.com"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PublicOrigin = S.Literal("https://beep-effect.com").pipe(
  $I.annoteSchema("PublicOrigin", {
    description: "The apex origin that hosts public, unauthenticated projections of the beep-effect substrate.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type PublicOrigin = typeof PublicOrigin.Type;
