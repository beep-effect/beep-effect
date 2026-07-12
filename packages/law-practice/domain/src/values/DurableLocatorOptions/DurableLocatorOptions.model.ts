/**
 * Durable-locator options value object: the settings controlling how spans are
 * projected into durable locators, ported from the eyecite
 * `DurableLocatorOptions` interface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/DurableLocatorOptions/DurableLocatorOptions.model");

/**
 * Options for `toDurableLocator` / `toDurableLocators`.
 *
 * Every field is optional and decodes to `None` when omitted, so a bare
 * `DurableLocatorOptions.make({})` carries no overrides and callers apply their
 * own defaults (`space` "original", `fullSpan` false, `contextLength` 32).
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { DurableLocatorOptions } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const options = DurableLocatorOptions.make({
 *   space: O.some("clean"),
 *   fullSpan: O.some(true),
 *   contextLength: O.some(NonNegativeInt.make(64)),
 * })
 *
 * console.log(O.getOrElse(options.space, () => "original")) // "clean"
 * console.log(O.isNone(DurableLocatorOptions.make({}).fullSpan)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DurableLocatorOptions extends S.Class<DurableLocatorOptions>($I`DurableLocatorOptions`)(
  {
    space: S.Literals(["original", "clean"]).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          'Coordinate space. Default "original": source must be the text passed to extractCitations. "clean": source must be eyecite\'s cleaned text.',
      })
    ),
    fullSpan: S.Boolean.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Use fullSpan (case name through final parenthetical) when present, else the core span. Default false.",
      })
    ),
    contextLength: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Max characters per context side after sentence-bounding. Default 32.",
      })
    ),
  },
  $I.annote("DurableLocatorOptions", {
    description: "Options for toDurableLocator / toDurableLocators.",
  })
) {}

/**
 * Companion namespace for `DurableLocatorOptions`.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace DurableLocatorOptions {
  /**
   * Wire-encoded representation of a decoded {@link DurableLocatorOptions}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { DurableLocatorOptions } from "@beep/law-practice-domain"
   *
   * type Wire = DurableLocatorOptions.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof DurableLocatorOptions.Encoded;
}
