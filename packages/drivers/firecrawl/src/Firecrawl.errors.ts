/**
 * Typed technical errors for the Firecrawl driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FirecrawlId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $FirecrawlId.create("Firecrawl.errors");
const FirecrawlErrorReasonKit = LiteralKit([
  "config",
  "transport",
  "unauthorized",
  "rate-limited",
  "response-status",
  "response-bound",
  "response-decoding",
  "scrape-failed",
  "unsupported-content",
]);

/**
 * Technical Firecrawl driver failure reasons.
 *
 * **Example** (List failure reasons)
 *
 * ```ts
 * import { FirecrawlErrorReason } from "@beep/firecrawl"
 *
 * console.log(FirecrawlErrorReason.literals.includes("response-bound")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const FirecrawlErrorReason = FirecrawlErrorReasonKit.pipe(
  $I.annoteSchema("FirecrawlErrorReason", {
    description: "Redacted technical failure reasons emitted by the Firecrawl driver.",
  }),
  SchemaUtils.withLiteralKitStatics(FirecrawlErrorReasonKit)
);

/**
 * Type for {@link FirecrawlErrorReason}.
 *
 * **Example** (Assign a transport reason)
 *
 * ```ts
 * import type { FirecrawlErrorReason } from "@beep/firecrawl"
 *
 * const reason: FirecrawlErrorReason = "transport"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type FirecrawlErrorReason = typeof FirecrawlErrorReason.Type;

/**
 * Technical failure raised inside the Firecrawl driver boundary.
 *
 * **Details**
 *
 * `message` is a sanitized description; the API key never appears in it. `status` carries the
 * Firecrawl HTTP status when the failure came from a response.
 *
 * **Example** (Create a bound failure)
 *
 * ```ts
 * import { FirecrawlError } from "@beep/firecrawl"
 *
 * const error = FirecrawlError.fromReason("response-bound", "Body exceeded 20000000 bytes.")
 * console.log(error.reason) // "response-bound"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FirecrawlError extends S.TaggedError<FirecrawlError, { readonly brand: unique symbol }>(
  $I`FirecrawlError`
)(
  "FirecrawlError",
  {
    reason: FirecrawlErrorReason.annotateKey({ description: "Redacted technical failure reason." }),
    message: S.String.annotateKey({ description: "Sanitized failure description without credentials." }),
    status: S.OptionFromOptionalKey(S.Int).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Firecrawl HTTP status when the failure came from a response." })
    ),
  },
  $I.annoteError<FirecrawlError>("FirecrawlError", {
    description: "Redacted technical failure raised inside the Firecrawl driver boundary.",
  })
) {
  /**
   * Create a Firecrawl error from a reason, message and optional HTTP status.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (reason: FirecrawlErrorReason, message: string, status?: number): FirecrawlError =>
    FirecrawlError.make({ reason, message, status: O.fromUndefinedOr(status) });
}
