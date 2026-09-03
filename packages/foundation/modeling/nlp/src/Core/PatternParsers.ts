/**
 * Pattern string parsers.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Effect, flow, pipe, SchemaGetter, SchemaIssue } from "effect";
import * as Bool from "effect/Boolean";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  EntityPatternElement,
  EntityPatternOption,
  LiteralPatternElement,
  LiteralPatternOption,
  Pattern,
  PatternElement,
  POSPatternElement,
  POSPatternOption,
} from "./Pattern.ts";
import type { PatternElement as PatternElementType } from "./Pattern.ts";

const $I = $NlpId.create("Core/PatternParsers");
type NonEmptyChoices<A> = readonly [A, ...A[]];

const invalidBracketString = (message: string): SchemaIssue.InvalidValue => new SchemaIssue.InvalidValue({ message });

const ensureNonEmpty = <A>(values: ReadonlyArray<A>): O.Option<NonEmptyChoices<A>> =>
  A.match(values, {
    onEmpty: O.none,
    onNonEmpty: O.some,
  });

const parseBracketContent = (input: string): O.Option<string> =>
  pipe(Str.slice(1, -1)(input), O.liftPredicate(Str.isNonEmpty));

const parseBracketValues = (input: string): O.Option<NonEmptyChoices<string>> =>
  Bool.match(pipe(Str.startsWith("[")(input), Bool.and(Str.endsWith("]")(input))), {
    onFalse: O.none,
    onTrue: () => pipe(input, parseBracketContent, O.flatMap(flow(Str.split("|"), ensureNonEmpty))),
  });

const decodePOSPatternElement = (input: string): O.Option<POSPatternElement> =>
  O.map(O.filter(parseBracketValues(input), S.is(POSPatternOption)), (parts) =>
    POSPatternElement.make({ value: parts })
  );

const decodeEntityPatternElement = (input: string): O.Option<EntityPatternElement> =>
  O.map(O.filter(parseBracketValues(input), S.is(EntityPatternOption)), (parts) =>
    EntityPatternElement.make({ value: parts })
  );

const decodeLiteralPatternElement = (input: string): O.Option<LiteralPatternElement> =>
  O.map(O.filter(parseBracketValues(input), S.is(LiteralPatternOption)), (parts) =>
    LiteralPatternElement.make({ value: parts })
  );

const succeedPatternElement = (element: PatternElementType) => Effect.succeed(element);

const encodePatternElement = PatternElement.match({
  EntityPatternElement: (element) => Pattern.Entity.toBracketString(element.value),
  LiteralPatternElement: (element) => Pattern.Literal.toBracketString(element.value),
  POSPatternElement: (element) => Pattern.POS.toBracketString(element.value),
});

const decodePatternElement = (input: string) =>
  pipe(
    A.make(decodePOSPatternElement(input), decodeEntityPatternElement(input), decodeLiteralPatternElement(input)),
    O.firstSomeOf,
    O.match({
      onNone: () =>
        Effect.fail(
          invalidBracketString(
            "Pattern element must be bracketed and contain valid POS, entity, or non-empty literal choices."
          )
        ),
      onSome: succeedPatternElement,
    })
  );

/**
 * Decode a POS bracket string into a pattern element.
 *
 * **Example** (Decode POS alternatives)
 *
 * ```ts import.meta.vitest name="Decode POS alternatives"
 * import * as S from "effect/Schema"
 * import { BracketStringToPOSPatternElement } from "@beep/nlp/Core/PatternParsers"
 *
 * const element = S.decodeUnknownSync(BracketStringToPOSPatternElement)("[ADJ|NOUN]")
 * element.value // => ["ADJ", "NOUN"]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const BracketStringToPOSPatternElement = S.String.pipe(
  S.decodeTo(POSPatternElement, {
    decode: SchemaGetter.transformOrFail((input) =>
      Effect.fromOption(decodePOSPatternElement(input), () =>
        invalidBracketString("POS pattern must be bracketed and contain valid wink POS tags.")
      )
    ),
    encode: SchemaGetter.transform((element) => Pattern.POS.toBracketString(element.value)),
  }),
  $I.annoteSchema("BracketStringToPOSPatternElement", {
    description: "Decoder for POS bracket strings such as [ADJ|NOUN].",
  })
);

/**
 * Runtime type for {@link BracketStringToPOSPatternElement}.
 *
 * **Example** (POS element type alias)
 *
 * ```ts import.meta.vitest name="POS element type alias"
 * import type { BracketStringToPOSPatternElement } from "@beep/nlp/Core/PatternParsers"
 *
 * type Example = BracketStringToPOSPatternElement
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BracketStringToPOSPatternElement = typeof BracketStringToPOSPatternElement.Type;

/**
 * Decode an entity bracket string into a pattern element.
 *
 * **Example** (Decode entity alternatives)
 *
 * ```ts import.meta.vitest name="Decode entity alternatives"
 * import * as S from "effect/Schema"
 * import { BracketStringToEntityPatternElement } from "@beep/nlp/Core/PatternParsers"
 *
 * const element = S.decodeUnknownSync(BracketStringToEntityPatternElement)("[EMAIL|URL]")
 * element._tag // => "EntityPatternElement"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const BracketStringToEntityPatternElement = S.String.pipe(
  S.decodeTo(EntityPatternElement, {
    decode: SchemaGetter.transformOrFail((input) =>
      Effect.fromOption(decodeEntityPatternElement(input), () =>
        invalidBracketString("Entity pattern must be bracketed and contain valid wink entity types.")
      )
    ),
    encode: SchemaGetter.transform((element) => Pattern.Entity.toBracketString(element.value)),
  }),
  $I.annoteSchema("BracketStringToEntityPatternElement", {
    description: "Decoder for entity bracket strings such as [DATE|TIME].",
  })
);

/**
 * Runtime type for {@link BracketStringToEntityPatternElement}.
 *
 * **Example** (Entity element type alias)
 *
 * ```ts import.meta.vitest name="Entity element type alias"
 * import type { BracketStringToEntityPatternElement } from "@beep/nlp/Core/PatternParsers"
 *
 * type Example = BracketStringToEntityPatternElement
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BracketStringToEntityPatternElement = typeof BracketStringToEntityPatternElement.Type;

/**
 * Decode a literal bracket string into a pattern element.
 *
 * **Example** (Decode literal alternatives)
 *
 * ```ts import.meta.vitest name="Decode literal alternatives"
 * import * as S from "effect/Schema"
 * import { BracketStringToLiteralPatternElement } from "@beep/nlp/Core/PatternParsers"
 *
 * const element = S.decodeUnknownSync(BracketStringToLiteralPatternElement)("[Effect|Schema]")
 * element.value[0] // => "Effect"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const BracketStringToLiteralPatternElement = S.String.pipe(
  S.decodeTo(LiteralPatternElement, {
    decode: SchemaGetter.transformOrFail((input) =>
      Effect.fromOption(decodeLiteralPatternElement(input), () =>
        invalidBracketString("Literal pattern must be bracketed and contain non-empty literal choices.")
      )
    ),
    encode: SchemaGetter.transform((element) => Pattern.Literal.toBracketString(element.value)),
  }),
  $I.annoteSchema("BracketStringToLiteralPatternElement", {
    description: "Decoder for literal bracket strings such as [Apple|Google].",
  })
);

/**
 * Runtime type for {@link BracketStringToLiteralPatternElement}.
 *
 * **Example** (Literal element type alias)
 *
 * ```ts import.meta.vitest name="Literal element type alias"
 * import type { BracketStringToLiteralPatternElement } from "@beep/nlp/Core/PatternParsers"
 *
 * type Example = BracketStringToLiteralPatternElement
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BracketStringToLiteralPatternElement = typeof BracketStringToLiteralPatternElement.Type;

/**
 * Decode any supported bracket string element.
 *
 * **Example** (Decode any bracket element)
 *
 * ```ts import.meta.vitest name="Decode any bracket element"
 * import * as S from "effect/Schema"
 * import { BracketStringToPatternElement } from "@beep/nlp/Core/PatternParsers"
 *
 * const element = S.decodeUnknownSync(BracketStringToPatternElement)("[NOUN]")
 * element._tag // => "POSPatternElement"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const BracketStringToPatternElement = S.String.pipe(
  S.decodeTo(PatternElement, {
    decode: SchemaGetter.transformOrFail(decodePatternElement),
    encode: SchemaGetter.transform(encodePatternElement),
  }),
  $I.annoteSchema("BracketStringToPatternElement", {
    description: "Decoder for bracket strings that resolve to exactly one supported pattern element variant.",
  })
);

/**
 * Runtime type for {@link BracketStringToPatternElement}.
 *
 * **Example** (Pattern element type alias)
 *
 * ```ts import.meta.vitest name="Pattern element type alias"
 * import type { BracketStringToPatternElement } from "@beep/nlp/Core/PatternParsers"
 *
 * type Example = BracketStringToPatternElement
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BracketStringToPatternElement = typeof BracketStringToPatternElement.Type;

/**
 * Decode a non-empty string array into ordered pattern elements.
 *
 * **Example** (Parse string array elements)
 *
 * ```ts import.meta.vitest name="Parse string array elements"
 * import { PatternElementsFromString } from "@beep/nlp/Core/PatternParsers"
 *
 * const elements = PatternElementsFromString.decodeUnknownSync(["[NOUN]"])
 * elements[0]?._tag // => "POSPatternElement"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PatternElementsFromString = S.NonEmptyArray(BracketStringToPatternElement).pipe(
  $I.annoteSchema("PatternElementsFromString", {
    description: "Decoder for non-empty arrays of supported bracket-string pattern elements.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownSync"])
);

/**
 * Runtime type for {@link PatternElementsFromString}.
 *
 * **Example** (Elements from string type)
 *
 * ```ts import.meta.vitest name="Elements from string type"
 * import type { PatternElementsFromString } from "@beep/nlp/Core/PatternParsers"
 *
 * type Example = PatternElementsFromString
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PatternElementsFromString = typeof PatternElementsFromString.Type;

/**
 * Decode a string array into ordered pattern elements.
 *
 * **Example** (Decode mixed bracket patterns)
 *
 * ```ts import.meta.vitest name="Decode mixed bracket patterns"
 * import { PatternFromString } from "@beep/nlp/Core/PatternParsers"
 *
 * const elements = PatternFromString(["[ADJ]", "[Effect]"])
 * elements[1]?._tag // => "LiteralPatternElement"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PatternFromString = (input: unknown) => PatternElementsFromString.decodeUnknownSync(input);
