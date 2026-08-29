/**
 * Durable-locator options value object: the settings controlling how spans are
 * projected into durable locators, ported from the eyecite
 * `DurableLocatorOptions` interface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { Effect, Tuple } from "effect";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/DurableLocatorOptions/DurableLocatorOptions.model");

const DurableLocatorSpace = LiteralKit(["original", "clean"]);

const DurableLocatorOptionFields = {
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
};

/**
 * Options for `toDurableLocator` / `toDurableLocators`.
 *
 * **Details**
 *
 * Omitted fields use the durable-locator defaults: `space` is `"original"`,
 * `fullSpan` is `false`, and `contextLength` is 32.
 *
 * **Example** (Build custom locator options)
 *
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
export const DurableLocatorOptions = DurableLocatorSpace.mapMembers(
  Tuple.evolve([
    (literal: S.Literal<"original">) =>
      S.Struct({
        space: S.tag(literal.literal).pipe(
          S.withDecodingDefaultKey(Effect.succeed("original")),
          S.annotateKey({
            description: "Original source-text coordinate space (the default).",
          })
        ),
        ...DurableLocatorOptionFields,
      }),
    (literal: S.Literal<"clean">) =>
      S.Struct({
        space: S.tag(literal.literal).annotateKey({
          description: "Cleaned-text coordinate space.",
        }),
        ...DurableLocatorOptionFields,
      }),
  ])
).pipe(
  S.toTaggedUnion("space"),
  $I.annoteSchema("DurableLocatorOptions", {
    description: "Options for toDurableLocator / toDurableLocators.",
  })
);

/**
 * Runtime type for {@link DurableLocatorOptions}.
 *
 * @see {@link DurableLocatorOptions} for the tagged-union schema and locator defaults.
 * @category models
 * @since 0.0.0
 */
export type DurableLocatorOptions = typeof DurableLocatorOptions.Type;

/**
 * Companion namespace for `DurableLocatorOptions`.
 *
 * **Example** (Read Encoded space field)
 *
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
   * **Example** (Alias Encoded wire type)
   *
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
