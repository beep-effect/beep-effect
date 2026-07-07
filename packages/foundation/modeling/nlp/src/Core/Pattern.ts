/**
 * Schema-first NLP pattern model.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Result } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $NlpId.create("Core/Pattern");
const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

const EmptyPatternChoice = S.Literal("").pipe(
  $I.annoteSchema("EmptyPatternChoice", {
    description: "Empty placeholder choice used to represent a wildcard in pattern alternatives.",
  })
);
const MeaningfulPatternOptionChoice = S.makeFilter(A.some<string>(Str.isNonEmpty), {
  description: "Pattern options must include at least one non-empty choice.",
  identifier: $I`MeaningfulPatternOptionChoice`,
  message: "Pattern options must include at least one non-empty choice.",
  title: "Meaningful Pattern Option Choice",
});
const UniversalPOSTagKit = LiteralKit([
  "ADJ",
  "ADP",
  "ADV",
  "AUX",
  "CCONJ",
  "DET",
  "INTJ",
  "NOUN",
  "NUM",
  "PART",
  "PRON",
  "PROPN",
  "PUNCT",
  "SCONJ",
  "SYM",
  "VERB",
  "X",
  "SPACE",
]).annotate(
  $I.annote("UniversalPOSTagKit", {
    description: "LiteralKit backing schema for wink part-of-speech tags.",
  })
);
const NamedEntityTypeKit = LiteralKit([
  "DATE",
  "ORDINAL",
  "CARDINAL",
  "MONEY",
  "PERCENT",
  "TIME",
  "DURATION",
  "HASHTAG",
  "EMOJI",
  "EMOTICON",
  "EMAIL",
  "URL",
  "MENTION",
]).annotate(
  $I.annote("NamedEntityTypeKit", {
    description: "LiteralKit backing schema for wink named-entity types.",
  })
);

const renderBracketString = (values: ReadonlyArray<string>): string => `[${A.join(values, "|")}]`;

/**
 * Universal part-of-speech tags accepted by wink-backed pattern matching.
 *
 * @remarks
 * These tags follow wink-nlp's Universal POS vocabulary and are used only for
 * grammatical pattern positions. Literal token text belongs in
 * {@link LiteralPatternElement}.
 *
 * @example
 * ```ts
 * import { UniversalPOSTag } from "@beep/nlp/Core/Pattern"
 *
 * console.log(UniversalPOSTag.is.NOUN("NOUN")) // true
 * console.log(UniversalPOSTag.is.NOUN("VERB")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UniversalPOSTag = UniversalPOSTagKit.pipe(
  $I.annoteSchema("UniversalPOSTag", {
    description: "Universal part-of-speech tags supported by wink-nlp.",
  }),
  SchemaUtils.withLiteralKitStatics(UniversalPOSTagKit)
);

/**
 * Runtime TypeScript union decoded by {@link UniversalPOSTag}.
 *
 * @example
 * ```ts
 * import type { UniversalPOSTag } from "@beep/nlp/Core/Pattern"
 *
 * const describe = (tag: UniversalPOSTag): string => `pos:${tag}`
 * console.log(typeof describe) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UniversalPOSTag = typeof UniversalPOSTag.Type;

/**
 * Named-entity labels accepted by wink-backed entity pattern matching.
 *
 * @example
 * ```ts
 * import { NamedEntityType } from "@beep/nlp/Core/Pattern"
 *
 * console.log(NamedEntityType.is.EMAIL("EMAIL")) // true
 * console.log(NamedEntityType.is.EMAIL("URL")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NamedEntityType = NamedEntityTypeKit.pipe(
  $I.annoteSchema("NamedEntityType", {
    description: "Named-entity types supported by wink-nlp custom entity patterns.",
  }),
  SchemaUtils.withLiteralKitStatics(NamedEntityTypeKit)
);

/**
 * Runtime TypeScript union decoded by {@link NamedEntityType}.
 *
 * @example
 * ```ts
 * import type { NamedEntityType } from "@beep/nlp/Core/Pattern"
 *
 * const describe = (entityType: NamedEntityType): string => `entity:${entityType}`
 * console.log(typeof describe) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NamedEntityType = typeof NamedEntityType.Type;

const DisambiguatedLiteralPatternOptionChoice = S.makeFilter(
  (values: ReadonlyArray<string>) =>
    A.some(values, (value) =>
      P.every([Str.isNonEmpty, P.not(S.is(UniversalPOSTag)), P.not(S.is(NamedEntityType))])(value)
    ),
  {
    description: "Literal pattern options must include at least one non-reserved literal choice.",
    identifier: $I`DisambiguatedLiteralPatternOptionChoice`,
    message: "Literal pattern options must include at least one non-reserved literal choice.",
    title: "Disambiguated Literal Pattern Option Choice",
  }
);

/**
 * Non-empty set of POS choices for one pattern slot.
 *
 * @remarks
 * The empty string is allowed as one alternative so bracket syntax can express
 * wildcard-ish optional choices, but every option set must include at least one
 * meaningful POS tag.
 *
 * @example
 * ```ts
 * import { POSPatternOption } from "@beep/nlp/Core/Pattern"
 *
 * const option = POSPatternOption.make(["NOUN", "PROPN"])
 * console.log(option.includes("NOUN")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const POSPatternOption = S.NonEmptyArray(S.Union([UniversalPOSTag, EmptyPatternChoice]))
  .check(MeaningfulPatternOptionChoice)
  .pipe(
    $I.annoteSchema("POSPatternOption", {
      description: "One or more POS tag alternatives for a pattern position.",
    }),
    SchemaUtils.withCodecStatics
  );

/**
 * Runtime type for {@link POSPatternOption}.
 *
 * @example
 * ```ts
 * import type { POSPatternOption } from "@beep/nlp/Core/Pattern"
 *
 * type Example = POSPatternOption
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type POSPatternOption = typeof POSPatternOption.Type;

/**
 * Non-empty set of entity-type choices for one pattern slot.
 *
 * @example
 * ```ts
 * import { EntityPatternOption } from "@beep/nlp/Core/Pattern"
 *
 * const option = EntityPatternOption.make(["EMAIL", "URL"])
 * console.log(option.includes("URL")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EntityPatternOption = S.NonEmptyArray(S.Union([NamedEntityType, EmptyPatternChoice]))
  .check(MeaningfulPatternOptionChoice)
  .pipe(
    $I.annoteSchema("EntityPatternOption", {
      description: "One or more entity-type alternatives for a pattern position.",
    }),
    SchemaUtils.withCodecStatics
  );

/**
 * Runtime type for {@link EntityPatternOption}.
 *
 * @example
 * ```ts
 * import type { EntityPatternOption } from "@beep/nlp/Core/Pattern"
 *
 * type Example = EntityPatternOption
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type EntityPatternOption = typeof EntityPatternOption.Type;

/**
 * Non-empty set of literal token-text choices for one pattern slot.
 *
 * @remarks
 * At least one choice must be a non-reserved literal so a literal pattern cannot
 * be confused with a POS tag, entity label, or empty wildcard placeholder.
 *
 * @example
 * ```ts
 * import { LiteralPatternOption } from "@beep/nlp/Core/Pattern"
 *
 * const option = LiteralPatternOption.make(["Effect", "effect-ts"])
 * console.log(option[0]) // "Effect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LiteralPatternOption = S.NonEmptyArray(S.Union([S.NonEmptyString, EmptyPatternChoice]))
  .check(MeaningfulPatternOptionChoice)
  .check(DisambiguatedLiteralPatternOptionChoice)
  .pipe(
    $I.annoteSchema("LiteralPatternOption", {
      description: "One or more literal-text alternatives for a pattern position.",
    }),
    SchemaUtils.withCodecStatics
  );

/**
 * Runtime type for {@link LiteralPatternOption}.
 *
 * @example
 * ```ts
 * import type { LiteralPatternOption } from "@beep/nlp/Core/Pattern"
 *
 * type Example = LiteralPatternOption
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type LiteralPatternOption = typeof LiteralPatternOption.Type;

/**
 * Tagged pattern element that matches grammatical POS alternatives.
 *
 * @example
 * ```ts
 * import { POSPatternElement } from "@beep/nlp/Core/Pattern"
 *
 * const element = POSPatternElement.make({ value: ["NOUN"] })
 * console.log(element._tag) // "POSPatternElement"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class POSPatternElement extends S.TaggedClass<POSPatternElement>($I`POSPatternElement`)(
  "POSPatternElement",
  {
    value: POSPatternOption,
  },
  $I.annote("POSPatternElement", {
    description: "Pattern element matching POS tag alternatives.",
  })
) {}

/**
 * Tagged pattern element that matches named-entity alternatives.
 *
 * @example
 * ```ts
 * import { EntityPatternElement } from "@beep/nlp/Core/Pattern"
 *
 * const element = EntityPatternElement.make({ value: ["EMAIL"] })
 * console.log(element._tag) // "EntityPatternElement"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EntityPatternElement extends S.TaggedClass<EntityPatternElement>($I`EntityPatternElement`)(
  "EntityPatternElement",
  {
    value: EntityPatternOption,
  },
  $I.annote("EntityPatternElement", {
    description: "Pattern element matching entity-type alternatives.",
  })
) {}

/**
 * Tagged pattern element that matches literal token text alternatives.
 *
 * @example
 * ```ts
 * import { LiteralPatternElement } from "@beep/nlp/Core/Pattern"
 *
 * const element = LiteralPatternElement.make({ value: ["Effect"] })
 * console.log(element.value[0]) // "Effect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LiteralPatternElement extends S.TaggedClass<LiteralPatternElement>($I`LiteralPatternElement`)(
  "LiteralPatternElement",
  {
    value: LiteralPatternOption,
  },
  $I.annote("LiteralPatternElement", {
    description: "Pattern element matching literal-text alternatives.",
  })
) {}

/**
 * Schema union for every pattern element variant supported by this package.
 *
 * @example
 * ```ts
 * import { PatternElement } from "@beep/nlp/Core/Pattern"
 *
 * const element = PatternElement.make({ _tag: "LiteralPatternElement", value: ["Effect"] })
 * console.log(element._tag) // "LiteralPatternElement"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PatternElement = S.Union([POSPatternElement, EntityPatternElement, LiteralPatternElement]).pipe(
  $I.annoteSchema("PatternElement", {
    description: "Tagged union of supported NLP pattern element variants.",
  }),
  S.toTaggedUnion("_tag")
);

/**
 * Runtime type for {@link PatternElement}.
 *
 * @example
 * ```ts
 * import type { PatternElement } from "@beep/nlp/Core/Pattern"
 *
 * type Example = PatternElement
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PatternElement = typeof PatternElement.Type;

/**
 * Non-empty identifier for a reusable pattern definition.
 *
 * @example
 * ```ts
 * import { PatternId } from "@beep/nlp/Core/Pattern"
 *
 * const id = PatternId.make("package-name")
 * console.log(id) // "package-name"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PatternId = S.NonEmptyString.pipe(
  S.brand("PatternId"),
  $I.annoteSchema("PatternId", {
    description: "Stable identifier for a reusable NLP pattern.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link PatternId}.
 *
 * @example
 * ```ts
 * import type { PatternId } from "@beep/nlp/Core/Pattern"
 *
 * type Example = PatternId
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PatternId = typeof PatternId.Type;

/**
 * Inclusive `[start, end]` element-index range selected by a pattern.
 *
 * @remarks
 * Mark ranges let a broader pattern match context while highlighting a narrower
 * span for extraction.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { MarkRange } from "@beep/nlp/Core/Pattern"
 *
 * const range = S.decodeUnknownSync(MarkRange)([1, 2])
 * console.log(range[0]) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MarkRange = S.Tuple([NonNegativeInt, NonNegativeInt]).pipe(
  $I.annoteSchema("MarkRange", {
    description: "Inclusive [start, end] range of marked pattern elements.",
  })
);

/**
 * Runtime type for {@link MarkRange}.
 *
 * @example
 * ```ts
 * import type { MarkRange } from "@beep/nlp/Core/Pattern"
 *
 * type Example = MarkRange
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type MarkRange = typeof MarkRange.Type;

/**
 * Ordered pattern of POS, entity, and literal slots with an optional mark.
 *
 * @remarks
 * Patterns model bracket-style NLP matchers as schema values. Each element is a
 * token-position choice set; `mark` can select the subrange to emit after the
 * full pattern matches.
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 * import * as O from "effect/Option"
 * import { LiteralPatternElement, Pattern, PatternId } from "@beep/nlp/Core/Pattern"
 *
 * const pattern = Pattern.make({
 *   _tag: "Pattern",
 *   id: PatternId.make("effect-token"),
 *   elements: Chunk.of(LiteralPatternElement.make({ value: ["Effect"] })),
 *   mark: O.none()
 * })
 * console.log(Pattern.is(pattern)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Pattern extends S.TaggedClass<Pattern>($I`Pattern`)(
  "Pattern",
  {
    elements: S.Chunk(PatternElement),
    id: PatternId,
    mark: S.OptionFromOptionalKey(MarkRange).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Pattern", {
    description: "Ordered sequence of NLP pattern elements with optional marked span.",
  })
) {
  /**
   * Pattern identifier constructor.
   */
  static readonly Id: {
    (id: string): PatternId;
    (): (id: string) => PatternId;
  } = dual<() => (id: string) => PatternId, (id: string) => PatternId>((args) => args.length >= 1, PatternId.make);

  /**
   * Pattern element schema.
   */
  static readonly Element = PatternElement;

  /**
   * POS element helpers.
   */
  static readonly POS = POSPatternElement.pipe(
    SchemaUtils.withStatics(() => ({
      decode: (input: unknown) =>
        Result.getOrThrowWith(S.decodeUnknownResult(POSPatternElement)(input), schemaIssueToError),
      encode: (input: POSPatternElement) =>
        Result.getOrThrowWith(S.encodeResult(POSPatternElement)(input), schemaIssueToError),
      is: S.is(POSPatternElement),
      toBracketString: (value: POSPatternOption): string => renderBracketString(value),
    }))
  );

  /**
   * Entity element helpers.
   */
  static readonly Entity = EntityPatternElement.pipe(
    SchemaUtils.withStatics(() => ({
      decode: (input: unknown) =>
        Result.getOrThrowWith(S.decodeUnknownResult(EntityPatternElement)(input), schemaIssueToError),
      encode: (input: EntityPatternElement) =>
        Result.getOrThrowWith(S.encodeResult(EntityPatternElement)(input), schemaIssueToError),
      is: S.is(EntityPatternElement),
      toBracketString: (value: EntityPatternOption): string => renderBracketString(value),
    }))
  );

  /**
   * Literal element helpers.
   */
  static readonly Literal = LiteralPatternElement.pipe(
    SchemaUtils.withStatics(() => ({
      decode: (input: unknown) =>
        Result.getOrThrowWith(S.decodeUnknownResult(LiteralPatternElement)(input), schemaIssueToError),
      encode: (input: LiteralPatternElement) =>
        Result.getOrThrowWith(S.encodeResult(LiteralPatternElement)(input), schemaIssueToError),
      is: S.is(LiteralPatternElement),
      toBracketString: (value: LiteralPatternOption): string => renderBracketString(value),
    }))
  );

  /**
   * Encode a pattern into its schema representation.
   */
  static readonly encode: {
    (pattern: Pattern): S.Codec.Encoded<typeof Pattern>;
    (): (pattern: Pattern) => S.Codec.Encoded<typeof Pattern>;
  } = dual<
    () => (pattern: Pattern) => S.Codec.Encoded<typeof Pattern>,
    (pattern: Pattern) => S.Codec.Encoded<typeof Pattern>
  >(
    (args) => args.length >= 1,
    (pattern) => Result.getOrThrowWith(S.encodeResult(Pattern)(pattern), schemaIssueToError)
  );

  /**
   * Decode unknown input into a pattern.
   */
  static readonly decode: {
    (input: S.Codec.Encoded<typeof Pattern>): Pattern;
    (): (input: S.Codec.Encoded<typeof Pattern>) => Pattern;
  } = dual<
    () => (input: S.Codec.Encoded<typeof Pattern>) => Pattern,
    (input: S.Codec.Encoded<typeof Pattern>) => Pattern
  >(
    (args) => args.length >= 1,
    (input) => Result.getOrThrowWith(S.decodeUnknownResult(Pattern)(input), schemaIssueToError)
  );

  /**
   * Runtime predicate for pattern values.
   */
  static readonly is = S.is(Pattern);
}
