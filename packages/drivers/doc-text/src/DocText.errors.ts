/**
 * Typed technical errors for the JS-native document text driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $I as $RootId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { O } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RootId.create("doc-text").create("DocText.errors");
const DocTextErrorReasonBase = LiteralKit([
  "empty-text-layer",
  "extraction",
  "input-limit",
  "source-bytes-unavailable",
]);

/**
 * Technical failure reasons emitted by the document text driver.
 *
 * **Example** (Check empty-text-layer membership)
 *
 * ```ts
 * import { DocTextErrorReason } from "@beep/doc-text"
 *
 * console.log(DocTextErrorReason.is["empty-text-layer"]("empty-text-layer")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const DocTextErrorReason = DocTextErrorReasonBase.pipe(
  $I.annoteSchema("DocTextErrorReason", {
    description: "Redacted technical error reasons emitted by the JS-native document text driver.",
  }),
  SchemaUtils.withLiteralKitStatics(DocTextErrorReasonBase)
);

/**
 * Type for {@link DocTextErrorReason}.
 *
 * **Example** (Type an extraction reason)
 *
 * ```ts
 * import type { DocTextErrorReason } from "@beep/doc-text"
 *
 * const reason: DocTextErrorReason = "extraction"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type DocTextErrorReason = typeof DocTextErrorReason.Type;

const isDocTextErrorReason = S.is(DocTextErrorReason);

/**
 * Options used when constructing {@link DocTextError} instances.
 *
 * **Example** (Make options with cause)
 *
 * ```ts
 * import { DocTextErrorOptions } from "@beep/doc-text"
 *
 * const options = DocTextErrorOptions.make({ cause: "invalid document structure" })
 * console.log(options.cause)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DocTextErrorOptions extends S.Class<DocTextErrorOptions>($I`DocTextErrorOptions`)(
  {
    cause: S.optionalKey(S.String).annotateKey({
      description: "Sanitized technical cause string when one is safe to retain.",
    }),
  },
  $I.annote("DocTextErrorOptions", {
    description: "Options for configuring DocTextError instances.",
  })
) {}

/**
 * Technical failure raised inside the document text driver boundary.
 *
 * **Example** (Create error from reason)
 *
 * ```ts
 * import { DocTextError } from "@beep/doc-text"
 *
 * const error = DocTextError.fromReason("empty-text-layer")
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DocTextError extends TaggedErrorClass<DocTextError>($I`DocTextError`)(
  "DocTextError",
  {
    cause: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Sanitized technical cause string when one is safe to retain.",
      })
    ),
    reason: DocTextErrorReason.annotateKey({
      description: "Redacted technical error reason.",
    }),
  },
  $I.annote("DocTextError", {
    description: "Redacted technical failure raised inside the JS-native document text driver boundary.",
  })
) {
  /**
   * Create a document text driver error with sanitized context.
   *
   * **Example** (Create error and log tag)
   *
   * ```ts
   * import { DocTextError } from "@beep/doc-text"
   *
   * const error = DocTextError.fromReason("source-bytes-unavailable")
   * console.log(error._tag) // "DocTextError"
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason: {
    (options?: DocTextErrorOptions): (reason: DocTextErrorReason) => DocTextError;
    (reason: DocTextErrorReason, options?: DocTextErrorOptions): DocTextError;
  } = dual(
    (args) => isDocTextErrorReason(args[0]),
    (reason: DocTextErrorReason, options: DocTextErrorOptions = DocTextErrorOptions.make({})): DocTextError =>
      DocTextError.make({
        cause: O.fromUndefinedOr(options.cause),
        reason,
      })
  );
}

/**
 * Create a document text driver error with a typed reason.
 *
 * **Example** (Make extraction reason error)
 *
 * ```ts
 * import { makeDocTextError } from "@beep/doc-text"
 *
 * const error = makeDocTextError("extraction")
 * console.log(error.reason)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeDocTextError = DocTextError.fromReason;
