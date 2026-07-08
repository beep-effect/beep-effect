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

const invalidBracketString = (input: string, message: string): SchemaIssue.InvalidValue =>
  new SchemaIssue.InvalidValue(O.some(input), { message });

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
            input,
            "Pattern element must be bracketed and contain valid POS, entity, or non-empty literal choices."
          )
        ),
      onSome: succeedPatternElement,
    })
  );

/**
 * Decode a POS bracket string into a pattern element.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BracketStringToPOSPatternElement } from "@beep/nlp/Core/PatternParsers"
 *
 * const element = S.decodeUnknownSync(BracketStringToPOSPatternElement)("[ADJ|NOUN]")
 * console.log(element.value) // ["ADJ", "NOUN"]
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const BracketStringToPOSPatternElement = S.String.pipe(
  S.decodeTo(POSPatternElement, {
    decode: SchemaGetter.transformOrFail((input) =>
      O.match(decodePOSPatternElement(input), {
        onNone: () =>
          Effect.fail(invalidBracketString(input, "POS pattern must be bracketed and contain valid wink POS tags.")),
        onSome: Effect.succeed,
      })
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
 * @example
 * ```ts
 * import type { BracketStringToPOSPatternElement } from "@beep/nlp/Core/PatternParsers"
 *
 * type Example = BracketStringToPOSPatternElement
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type BracketStringToPOSPatternElement = typeof BracketStringToPOSPatternElement.Type;

/**
 * Decode an entity bracket string into a pattern element.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BracketStringToEntityPatternElement } from "@beep/nlp/Core/PatternParsers"
 *
 * const element = S.decodeUnknownSync(BracketStringToEntityPatternElement)("[EMAIL|URL]")
 * console.log(element._tag) // "EntityPatternElement"
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const BracketStringToEntityPatternElement = S.String.pipe(
  S.decodeTo(EntityPatternElement, {
    decode: SchemaGetter.transformOrFail((input) =>
      O.match(decodeEntityPatternElement(input), {
        onNone: () =>
          Effect.fail(
            invalidBracketString(input, "Entity pattern must be bracketed and contain valid wink entity types.")
          ),
        onSome: Effect.succeed,
      })
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
 * @example
 * ```ts
 * import type { BracketStringToEntityPatternElement } from "@beep/nlp/Core/PatternParsers"
 *
 * type Example = BracketStringToEntityPatternElement
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type BracketStringToEntityPatternElement = typeof BracketStringToEntityPatternElement.Type;

/**
 * Decode a literal bracket string into a pattern element.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BracketStringToLiteralPatternElement } from "@beep/nlp/Core/PatternParsers"
 *
 * const element = S.decodeUnknownSync(BracketStringToLiteralPatternElement)("[Effect|Schema]")
 * console.log(element.value[0]) // "Effect"
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const BracketStringToLiteralPatternElement = S.String.pipe(
  S.decodeTo(LiteralPatternElement, {
    decode: SchemaGetter.transformOrFail((input) =>
      O.match(decodeLiteralPatternElement(input), {
        onNone: () =>
          Effect.fail(
            invalidBracketString(input, "Literal pattern must be bracketed and contain non-empty literal choices.")
          ),
        onSome: Effect.succeed,
      })
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
 * @example
 * ```ts
 * import type { BracketStringToLiteralPatternElement } from "@beep/nlp/Core/PatternParsers"
 *
 * type Example = BracketStringToLiteralPatternElement
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type BracketStringToLiteralPatternElement = typeof BracketStringToLiteralPatternElement.Type;

/**
 * Decode any supported bracket string element.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BracketStringToPatternElement } from "@beep/nlp/Core/PatternParsers"
 *
 * const element = S.decodeUnknownSync(BracketStringToPatternElement)("[NOUN]")
 * console.log(element._tag) // "POSPatternElement"
 * ```
 *
 * @since 0.0.0
 * @category validation
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
 * @example
 * ```ts
 * import type { BracketStringToPatternElement } from "@beep/nlp/Core/PatternParsers"
 *
 * type Example = BracketStringToPatternElement
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type BracketStringToPatternElement = typeof BracketStringToPatternElement.Type;

/**
 * Decode a non-empty string array into ordered pattern elements.
 *
 * @example
 * ```ts
 * import { PatternElementsFromString } from "@beep/nlp/Core/PatternParsers"
 *
 * const elements = PatternElementsFromString.fromUnknown(["[NOUN]"])
 * console.log(elements[0]?._tag) // "POSPatternElement"
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const PatternElementsFromString = S.NonEmptyArray(BracketStringToPatternElement).pipe(
  $I.annoteSchema("PatternElementsFromString", {
    description: "Decoder for non-empty arrays of supported bracket-string pattern elements.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link PatternElementsFromString}.
 *
 * @example
 * ```ts
 * import type { PatternElementsFromString } from "@beep/nlp/Core/PatternParsers"
 *
 * type Example = PatternElementsFromString
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PatternElementsFromString = typeof PatternElementsFromString.Type;

/**
 * Decode a string array into ordered pattern elements.
 *
 * @example
 * ```ts
 * import { PatternFromString } from "@beep/nlp/Core/PatternParsers"
 *
 * const elements = PatternFromString(["[ADJ]", "[Effect]"])
 * console.log(elements[1]?._tag) // "LiteralPatternElement"
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const PatternFromString = (input: unknown) => PatternElementsFromString.fromUnknown(input);
