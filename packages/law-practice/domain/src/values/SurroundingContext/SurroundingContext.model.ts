/**
 * Surrounding-context value object: the sentence or paragraph text extracted
 * around a citation, ported from the eyecite `SurroundingContext` interface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/SurroundingContext/SurroundingContext.model");

/**
 * Result of surrounding context extraction.
 *
 * **Details**
 *
 * Pairs the extracted sentence or paragraph `text` with the absolute character
 * `span` locating that text in the source document, so consumers can render the
 * snippet or map it back to its position.
 *
 * **Example** (Make with text and span)
 *
 * ```ts
 * import { SurroundingContext } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const context = SurroundingContext.make({
 *   text: "The court in Roe v. Wade, 410 U.S. 113, held that...",
 *   span: { start: NonNegativeInt.make(0), end: NonNegativeInt.make(51) },
 * })
 *
 * console.log(context.text) // "The court in Roe v. Wade, 410 U.S. 113, held that..."
 * console.log(context.span.start) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SurroundingContext extends S.Class<SurroundingContext>($I`SurroundingContext`)(
  {
    text: S.String.annotateKey({
      description: "The sentence or paragraph text.",
    }),
    span: S.Struct({
      start: NonNegativeInt.annotateKey({
        description: "Absolute character offset where the context begins in the source document.",
      }),
      end: NonNegativeInt.annotateKey({
        description: "Absolute character offset where the context ends in the source document.",
      }),
    }).annotateKey({
      description: "Absolute character offsets in the source document.",
    }),
  },
  $I.annote("SurroundingContext", {
    description: "Result of surrounding context extraction.",
  })
) {}

/**
 * Companion namespace for `SurroundingContext`.
 *
 * **Example** (Alias Encoded wire type)
 *
 * ```ts
 * import type { SurroundingContext } from "@beep/law-practice-domain"
 *
 * type SurroundingContextWire = SurroundingContext.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace SurroundingContext {
  /**
   * Wire-encoded representation of a decoded {@link SurroundingContext}.
   *
   * **Example** (Declare Encoded wire type)
   *
   * ```ts
   * import type { SurroundingContext } from "@beep/law-practice-domain"
   *
   * type Wire = SurroundingContext.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof SurroundingContext.Encoded;
}
