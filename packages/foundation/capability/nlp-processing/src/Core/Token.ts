/**
 * Core token model for NLP runtime services.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { Position } from "@beep/text/OffsetUnit";
import { thunkFalse, thunkTrue } from "@beep/utils";
import * as Brand from "effect/Brand";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $NlpProcessingId.create("Core/Token");

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
 * import type { TokenIndex } from "@beep/nlp-processing/Core/Token"
 *
 * const next = (index: TokenIndex): number => index + 1
 * typeof next // => "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TokenIndex = Brand.Branded<number, "TokenIndex">;

/**
 * Narrow an unknown value to a non-negative token index.
 *
 * **Example** (Reject negative token index)
 *
 * ```ts import.meta.vitest name="Reject negative token index"
 * import { isTokenIndex } from "@beep/nlp-processing/Core/Token"
 *
 * isTokenIndex(0) // => true
 * isTokenIndex(-1) // => false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isTokenIndex = (u: unknown): u is TokenIndex => S.is(TokenIndex)(u);

/**
 * Construct a branded token index after validating it is non-negative.
 *
 * **Example** (Construct zero token index)
 *
 * ```ts import.meta.vitest name="Construct zero token index"
 * import { tokenIndex } from "@beep/nlp-processing/Core/Token"
 *
 * const first = tokenIndex(0)
 * first // => 0
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const tokenIndex: Brand.Constructor<TokenIndex> = Brand.check<TokenIndex>(S.makeFilter(S.is(S.Natural)));

/**
 * **Example** (Make schema token index)
 *
 * ```ts import.meta.vitest name="Make schema token index"
 * import { TokenIndex } from "@beep/nlp-processing/Core/Token"
 *
 * const index = TokenIndex.make(2)
 * index // => 2
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const TokenIndex = S.make<(typeof S.Natural)["Rebuild"]>(S.Natural.ast).pipe(
  S.brand("TokenIndex"),
  $I.annoteSchema("TokenIndex", {
    description: "Non-negative ordered index for an NLP token.",
  })
);

/**
 * Immutable token with lexical text, source offsets, and optional NLP metadata.
 *
 * **Details**
 *
 * `index` identifies the token in document order, while `span` retains the
 * token's non-empty half-open UTF-16 code-unit range in the source text. Optional
 * fields mirror annotations commonly produced by wink-nlp.
 *
 * **Example** (Create token check position)
 *
 * ```ts import.meta.vitest name="Create token check position"
 * import * as O from "effect/Option"
 * import { Token, TokenIndex } from "@beep/nlp-processing/Core/Token"
 * import { Position } from "@beep/text/OffsetUnit"
 *
 * const token = Token.make({
 *   text: "Effect",
 *   index: TokenIndex.make(0),
 *   span: Position.make({ unit: "utf16-code-unit", start: 0, end: 6 }),
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
export class Token extends S.Class<Token, { readonly brand: unique symbol }>($I`Token`)(
  {
    text: S.String,
    index: TokenIndex,
    span: Position,
    pos: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    lemma: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    stem: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    normal: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    shape: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    prefix: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    suffix: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    case: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    uniqueId: S.OptionFromOptionalKey(S.Finite).pipe(S.withConstructorDefault(Effect.succeedNone)),
    abbrevFlag: S.OptionFromOptionalKey(S.Boolean).pipe(S.withConstructorDefault(Effect.succeedNone)),
    contractionFlag: S.OptionFromOptionalKey(S.Boolean).pipe(S.withConstructorDefault(Effect.succeedNone)),
    stopWordFlag: S.OptionFromOptionalKey(S.Boolean).pipe(S.withConstructorDefault(Effect.succeedNone)),
    negationFlag: S.OptionFromOptionalKey(S.Boolean).pipe(S.withConstructorDefault(Effect.succeedNone)),
    precedingSpaces: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    tags: S.Array(S.String),
  },
  $I.annote("Token", {
    description: "Immutable NLP token with lexical annotations, offsets, and optional wink metadata.",
  })
) {
  /**
   * Number of UTF-16 code units spanned by the token.
   */
  get length(): number {
    return this.span.end - this.span.start;
  }

  /**
   * Whether a UTF-16 code-unit offset falls inside the token span.
   */
  static readonly containsPosition: {
    (token: Token, pos: number): boolean;
    (pos: number): (token: Token) => boolean;
  } = dual(2, (token: Token, pos: number): boolean => pos >= token.span.start && pos < token.span.end);

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
