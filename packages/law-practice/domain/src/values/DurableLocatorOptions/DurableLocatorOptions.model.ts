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
 * Omitted fields use the durable-locator defaults: `space` is `"original"`,
 * `fullSpan` is `false`, and `contextLength` is 32.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { DurableLocatorOptions } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const options = DurableLocatorOptions.make({
 *   space: "clean",
 *   fullSpan: true,
 *   contextLength: NonNegativeInt.make(64),
 * })
 *
 * console.log(options.space) // "clean"
 * console.log(DurableLocatorOptions.make({}).fullSpan) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DurableLocatorOptions extends S.Class<DurableLocatorOptions>($I`DurableLocatorOptions`)(
  {
    space: S.Literals(["original", "clean"]).pipe(
      SchemaUtils.withKeyDefaults("original"),
      S.annotateKey({
        description:
          'Coordinate space. Default "original": source must be the text passed to extractCitations. "clean": source must be eyecite\'s cleaned text.',
      })
    ),
    fullSpan: SchemaUtils.BoolKeyDefaultFalse.pipe(
      S.annotateKey({
        description:
          "Use fullSpan (case name through final parenthetical) when present, else the core span. Default false.",
      })
    ),
    contextLength: NonNegativeInt.pipe(
      SchemaUtils.withKeyDefaults(NonNegativeInt.make(32)),
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
 * @example
 * ```ts
 * import type { DurableLocatorOptions } from "@beep/law-practice-domain"
 *
 * const space: DurableLocatorOptions.Encoded["space"] = "clean"
 * console.log(space) // "clean"
 * ```
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
