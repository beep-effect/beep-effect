/**
 * Typed errors for the Discord REST driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DiscordId } from "@beep/identity";
import { LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import * as S from "effect/Schema";
import { DiscordHttpStatus } from "./Discord.models.ts";
import type * as O from "effect/Option";

const $I = $DiscordId.create("Discord.errors");

const DiscordErrorReasonBase = LiteralKit(["request", "transport", "response-status", "response-decoding"]);
// Shared driver codec-statics idiom; drivers are independent and have no in-family home — future foundation capability candidate.
// fallow-ignore-next-line code-duplication
const withDiscordErrorReasonCodecStatics = <Sch extends S.Top & S.ConstraintDecoder<unknown>>(
  schema: Sch
): Sch & {
  readonly decodeOption: (input: unknown) => O.Option<Sch["Type"]>;
  readonly fromUnknown: (input: unknown) => Sch["Type"];
} =>
  SchemaUtils.withStatics((self: Sch) => ({
    fromUnknown: S.decodeUnknownSync(self),
    decodeOption: S.decodeUnknownOption(self),
  }))(schema);

/**
 * Literal vocabulary for recoverable failures at the Discord REST boundary.
 *
 * @example
 * ```ts
 * import { DiscordErrorReason } from "@beep/discord"
 *
 * const isTransportFailure = DiscordErrorReason.is.transport("transport")
 * console.log(isTransportFailure) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DiscordErrorReason = DiscordErrorReasonBase.pipe(
  $I.annoteSchema("DiscordErrorReason", {
    description: "Literal vocabulary for recoverable failures at the Discord REST boundary.",
  }),
  SchemaUtils.withLiteralKitStatics(DiscordErrorReasonBase),
  withDiscordErrorReasonCodecStatics
);

/**
 * {@inheritDoc DiscordErrorReason}
 *
 * @example
 * ```ts
 * import type { DiscordErrorReason } from "@beep/discord"
 *
 * const reason: DiscordErrorReason = "response-status"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DiscordErrorReason = typeof DiscordErrorReason.Type;

/**
 * Redacted technical failure raised by the Discord REST driver.
 *
 * @remarks
 * `DiscordError` keeps the recovery reason, HTTP method, path, status, and a
 * sanitized cause string while avoiding bot tokens and raw Discord response
 * bodies.
 *
 * @example
 * ```ts
 * import { DiscordError } from "@beep/discord"
 * import * as O from "effect/Option"
 *
 * const failure = DiscordError.make({
 *   method: O.some("GET"),
 *   path: O.some("/channels/123456789012345678"),
 *   reason: "response-status",
 *   status: O.some(404)
 * })
 *
 * console.log(failure.reason) // "response-status"
 * ```
 *
 * @see {@link DiscordErrorReason} for the reason vocabulary.
 * @category errors
 * @since 0.0.0
 */
export class DiscordError extends TaggedErrorClass<DiscordError>($I`DiscordError`)(
  "DiscordError",
  {
    cause: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Sanitized technical cause string when one is safe to retain.",
      })
    ),
    method: S.OptionFromOptionalKey(S.Literals(["GET", "POST"])).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Discord REST method involved in the failure.",
      })
    ),
    path: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Discord REST path involved in the failure.",
      })
    ),
    reason: DiscordErrorReason,
    status: S.OptionFromOptionalKey(DiscordHttpStatus).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "HTTP status code involved in the failure when it was a recognized status.",
      })
    ),
  },
  $I.annote("DiscordError", {
    description: "Redacted technical failure raised by the Discord REST driver.",
  })
) {}
