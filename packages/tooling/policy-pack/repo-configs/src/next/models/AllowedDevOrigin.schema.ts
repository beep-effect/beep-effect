/**
 * A module containing the AllowedDevOrigin schema for Next.js configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoConfigsId.create("next/models/AllowedDevOrigin.schema");

const allowedDevOriginPattern =
  /^(?:\*\.)?(?:localhost|[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*)$/;

/**
 * A hostname or leading-wildcard hostname entry for Next.js `allowedDevOrigins`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { AllowedDevOrigin } from "@beep/repo-configs/next"
 * const program = S.decodeUnknownEffect(AllowedDevOrigin)("*.local-origin.dev")
 * console.log(Effect.runPromise(program))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const AllowedDevOrigin = S.Trim.check(
  S.isPattern(allowedDevOriginPattern, {
    identifier: $I`AllowedDevOriginPatternCheck`,
    title: "Allowed Dev Origin",
    description: "A Next.js dev origin entry must be a hostname or a hostname prefixed with '*.'.",
    message: "Expected a Next.js allowedDevOrigins hostname entry",
  })
).pipe(
  S.brand("AllowedDevOrigin"),
  $I.annoteSchema("AllowedDevOrigin", {
    description: "A hostname or leading-wildcard hostname entry for Next.js allowedDevOrigins.",
    documentation:
      "Next.js allowedDevOrigins entries are additional development hostnames, such as local-origin.dev or *.local-origin.dev.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Hostname entry for one element of Next.js `allowedDevOrigins`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { AllowedDevOrigin } from "@beep/repo-configs/next"
 * const origin: AllowedDevOrigin = S.decodeSync(AllowedDevOrigin)("local-origin.dev")
 * console.log(origin)
 * ```
 * @category models
 * @since 0.0.0
 */
export type AllowedDevOrigin = typeof AllowedDevOrigin.Type;
