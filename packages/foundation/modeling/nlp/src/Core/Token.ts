/**
 * Core token model for NLP runtime services.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import { thunkFalse, thunkTrue } from "@beep/utils";
import { Brand } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $NlpId.create("Core/Token");

/**
 * Zero-based position of a token within its document token stream.
 *
 * **Details**
 *
 * The brand prevents call sites from accidentally passing a character offset or
 * sentence index where a token ordinal is required.
 *
 * **Example** (Accept branded token index)
 *
 * ```ts import.meta.vitest name="Accept branded token index"
 * import type { TokenIndex } from "@beep/nlp/Core/Token"
 *
 * const next = (index: TokenIndex): number => index + 1
 * typeof next // => "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TokenIndex = Brand.Branded<NonNegativeInt, "TokenIndex">;

/**
 * Narrow an unknown value to a non-negative token index.
 *
 * **Example** (Reject negative token index)
 *
 * ```ts import.meta.vitest name="Reject negative token index"
 * import { isTokenIndex } from "@beep/nlp/Core/Token"
 *
 * isTokenIndex(0) // => true
 * isTokenIndex(-1) // => false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isTokenIndex = (u: unknown): u is TokenIndex => TokenIndex.is(u);

/**
 * Construct a branded token index after validating it is non-negative.
 *
 * **Example** (Construct zero token index)
 *
 * ```ts import.meta.vitest name="Construct zero token index"
 * import { tokenIndex } from "@beep/nlp/Core/Token"
 *
 * const first = tokenIndex(0)
 * first // => 0
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const tokenIndex: Brand.Constructor<TokenIndex> = Brand.check<TokenIndex>(S.makeFilter(S.is(NonNegativeInt)));

/**
 * Schema that decodes non-negative numbers into {@link TokenIndex} values.
 *
 * **Example** (Make schema token index)
 *
 * ```ts import.meta.vitest name="Make schema token index"
 * import { TokenIndex } from "@beep/nlp/Core/Token"
 *
 * const index = TokenIndex.make(2)
 * index // => 2
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const TokenIndex = S.make<(typeof NonNegativeInt)["Rebuild"]>(NonNegativeInt.ast).pipe(
  S.fromBrand("TokenIndex", tokenIndex),
  $I.annoteSchema("TokenIndex", {
    description: "Non-negative ordered index for an NLP token.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Zero-based character offset into the original source text.
 *
 * **Details**
 *
 * Token spans use half-open ranges: `start` is included and `end` is excluded.
 *
 * **Example** (Compute half-open span length)
 *
 * ```ts import.meta.vitest name="Compute half-open span length"
 * import type { CharPosition } from "@beep/nlp/Core/Token"
 *
 * const spanLength = (start: CharPosition, end: CharPosition): number => end - start
 * typeof spanLength // => "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CharPosition = Brand.Branded<NonNegativeInt, "CharPosition">;

/**
 * Narrow an unknown value to a non-negative character offset.
 *
 * **Example** (Reject negative char offset)
 *
 * ```ts import.meta.vitest name="Reject negative char offset"
 * import { isCharPosition } from "@beep/nlp/Core/Token"
 *
 * isCharPosition(12) // => true
 * isCharPosition(-1) // => false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isCharPosition = (u: unknown): u is CharPosition => CharPosition.is(u);

/**
 * Construct a branded character offset after validating it is non-negative.
 *
 * **Example** (Construct character offset)
 *
 * ```ts import.meta.vitest name="Construct character offset"
 * import { charPosition } from "@beep/nlp/Core/Token"
 *
 * const offset = charPosition(4)
 * offset // => 4
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const charPosition: Brand.Constructor<CharPosition> = Brand.check<CharPosition>(
  S.makeFilter(S.is(NonNegativeInt))
);

/**
 * Schema that decodes non-negative numbers into {@link CharPosition} values.
 *
 * **Example** (Make schema char position)
 *
 * ```ts import.meta.vitest name="Make schema char position"
 * import { CharPosition } from "@beep/nlp/Core/Token"
 *
 * const offset = CharPosition.make(7)
 * offset // => 7
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const CharPosition = S.make<(typeof NonNegativeInt)["Rebuild"]>(NonNegativeInt.ast).pipe(
  S.fromBrand("CharPosition", charPosition),
  $I.annoteSchema("CharPosition", {
    description: "Non-negative character offset in source NLP text.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Immutable token with lexical text, source offsets, and optional NLP metadata.
 *
 * **Details**
 *
 * `index` identifies the token in document order, while `start` and `end`
 * retain the token's half-open character span in the source text. Optional
 * fields mirror annotations commonly produced by wink-nlp.
 *
 * **Example** (Create token check position)
 *
 * ```ts import.meta.vitest name="Create token check position"
 * import * as O from "effect/Option"
 * import { CharPosition, Token, TokenIndex } from "@beep/nlp/Core/Token"
 *
 * const token = Token.make({
 *   text: "Effect",
 *   index: TokenIndex.make(0),
 *   start: CharPosition.make(0),
 *   end: CharPosition.make(6),
 *   pos: O.none(),
 *   lemma: O.none(),
 *   stem: O.none(),
 *   normal: O.none(),
 *   shape: O.none(),
 *   prefix: O.none(),
 *   suffix: O.none(),
 *   case: O.none(),
 *   uniqueId: O.none(),
 *   abbrevFlag: O.none(),
 *   contractionFlag: O.none(),
 *   stopWordFlag: O.none(),
 *   negationFlag: O.none(),
 *   precedingSpaces: O.none(),
 *   tags: []
 * })
 * Token.containsPosition(token, 3) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Token extends S.Class<Token>($I`Token`)(
  {
    text: S.String,
    index: TokenIndex,
    start: CharPosition,
    end: CharPosition,
    pos: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    lemma: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    stem: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    normal: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    shape: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    prefix: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suffix: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    case: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    uniqueId: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    abbrevFlag: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    contractionFlag: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopWordFlag: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    negationFlag: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    precedingSpaces: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    tags: S.Array(S.String),
  },
  $I.annote("Token", {
    description: "Immutable NLP token with lexical annotations, offsets, and optional wink metadata.",
  })
) {
  /**
   * Number of characters spanned by the token.
   */
  get length(): number {
    return this.end - this.start;
  }

  /**
   * Whether a character position falls inside the token range.
   */
  static readonly containsPosition: {
    (token: Token, pos: number): boolean;
    (pos: number): (token: Token) => boolean;
  } = dual(2, (token: Token, pos: number): boolean => pos >= token.start && pos < token.end);

  /**
   * Whether the token represents punctuation.
   */
  static readonly isPunctuation = (token: Token): boolean =>
    O.match(token.shape, {
      onNone: thunkFalse,
      onSome: (shape) => !/[Xxd]/.test(shape),
    });

  /**
   * Whether the token is word-like.
   */
  static readonly isWord = (token: Token): boolean =>
    O.match(token.shape, {
      onNone: thunkTrue,
      onSome: (shape) => /[Xx]/.test(shape),
    });

  /**
   * Whether the token is marked as a stop word.
   */
  static readonly isStopWord = (token: Token): boolean => O.getOrElse(token.stopWordFlag, thunkFalse);

  /**
   * Return a copy of the token with new text.
   */
  static readonly withText: {
    (token: Token, text: string): Token;
    (text: string): (token: Token) => Token;
  } = dual(2, (token: Token, text: string): Token => Token.make({ ...token, text }));

  /**
   * Return a copy of the token with a new part-of-speech tag.
   */
  static readonly withPos: {
    (token: Token, pos: string): Token;
    (pos: string): (token: Token) => Token;
  } = dual(2, (token: Token, pos: string): Token => Token.make({ ...token, pos: O.some(pos) }));

  /**
   * Return a copy of the token with a new lemma.
   */
  static readonly withLemma: {
    (token: Token, lemma: string): Token;
    (lemma: string): (token: Token) => Token;
  } = dual(2, (token: Token, lemma: string): Token => Token.make({ ...token, lemma: O.some(lemma) }));

  /**
   * Return a copy of the token with an updated stop-word flag.
   */
  static readonly withStopWordFlag: {
    (token: Token, flag: boolean): Token;
    (flag: boolean): (token: Token) => Token;
  } = dual(2, (token: Token, flag: boolean): Token => Token.make({ ...token, stopWordFlag: O.some(flag) }));
}
