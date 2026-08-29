/**
 * Context-options value object: options for surrounding context extraction,
 * ported from the eyecite `ContextOptions` interface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { Effect, Tuple } from "effect";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/ContextOptions/ContextOptions.model");

const ContextType = LiteralKit(["sentence", "paragraph"]);

const ContextMaxLength = NonNegativeInt.pipe(
  S.OptionFromOptionalKey,
  SchemaUtils.withNoneDefault,
  S.annotateKey({
    description: "Maximum characters to return. Omit for no explicit length limit.",
  })
);

/**
 * Options for surrounding context extraction.
 *
 * **Details**
 *
 * `type` defaults to `"sentence"`. `maxLength` remains optional so omitting it
 * leaves context extraction unbounded.
 *
 * **Example** (Make with type and maxLength)
 *
 * ```ts
 * import { ContextOptions } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const options = ContextOptions.make({
 *   type: "paragraph",
 *   maxLength: O.some(NonNegativeInt.make(1000)),
 * })
 *
 * console.log(options.type) // "paragraph"
 * console.log(O.isNone(ContextOptions.make({}).maxLength)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ContextOptions = ContextType.mapMembers(
  Tuple.evolve([
    (literal: S.Literal<"sentence">) =>
      S.Struct({
        type: S.tag(literal.literal).pipe(
          S.withDecodingDefaultKey(Effect.succeed("sentence")),
          S.annotateKey({
            description: "Sentence context boundary (the default).",
          })
        ),
        maxLength: ContextMaxLength,
      }),
    (literal: S.Literal<"paragraph">) =>
      S.Struct({
        type: S.tag(literal.literal).annotateKey({
          description: "Paragraph context boundary.",
        }),
        maxLength: ContextMaxLength,
      }),
  ])
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ContextOptions", {
    description: "Options for surrounding context extraction.",
  })
);

/**
 * Runtime type for {@link ContextOptions}.
 *
 * @see {@link ContextOptions} for the tagged-union schema and context-boundary options.
 * @category models
 * @since 0.0.0
 */
export type ContextOptions = typeof ContextOptions.Type;

/**
 * Companion namespace for `ContextOptions`.
 *
 * **Example** (Accessing Encoded type field)
 *
 * ```ts
 * import type { ContextOptions } from "@beep/law-practice-domain"
 *
 * const boundary: ContextOptions.Encoded["type"] = "sentence"
 * console.log(boundary) // "sentence"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ContextOptions {
  /**
   * Wire-encoded representation of a decoded {@link ContextOptions}.
   *
   * **Example** (Aliasing Encoded wire type)
   *
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
