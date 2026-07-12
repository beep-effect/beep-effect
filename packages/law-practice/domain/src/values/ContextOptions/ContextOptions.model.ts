/**
 * Context-options value object: options for surrounding context extraction,
 * ported from the eyecite `ContextOptions` interface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/ContextOptions/ContextOptions.model");

/**
 * Options for surrounding context extraction.
 *
 * Both fields are optional: a missing `type` or `maxLength` decodes to `None`,
 * so callers can apply their own defaults (boundary `"sentence"`, `500`
 * characters) when neither is supplied.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { ContextOptions } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const options = ContextOptions.make({
 *   type: O.some("paragraph"),
 *   maxLength: O.some(NonNegativeInt.make(1000)),
 * })
 *
 * console.log(O.getOrNull(options.type)) // "paragraph"
 * console.log(O.isNone(ContextOptions.make({}).maxLength)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ContextOptions extends S.Class<ContextOptions>($I`ContextOptions`)(
  {
    type: S.Literals(["sentence", "paragraph"]).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Boundary type (default: 'sentence').",
      })
    ),
    maxLength: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Max characters to return (default: 500).",
      })
    ),
  },
  $I.annote("ContextOptions", {
    description: "Options for surrounding context extraction.",
  })
) {}

/**
 * Companion namespace for `ContextOptions`.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ContextOptions {
  /**
   * Wire-encoded representation of a decoded {@link ContextOptions}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { ContextOptions } from "@beep/law-practice-domain"
   *
   * type Wire = ContextOptions.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof ContextOptions.Encoded;
}
