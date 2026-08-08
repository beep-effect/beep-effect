/**
 * Core sentence model for NLP runtime services.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import { Str } from "@beep/utils";
import { Brand, Chunk } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Token, TokenIndex } from "./Token.ts";

const $I = $NlpId.create("Core/Sentence");
const getRangeEnd = (options: { readonly end: number } | number): number =>
  P.isNumber(options) ? options : options.end;

/**
 * Zero-based position of a sentence within a document.
 *
 * **Example** (Type-safe index increment)
 *
 * ```ts
 * import type { SentenceIndex } from "@beep/nlp/Core/Sentence"
 *
 * const next = (index: SentenceIndex): number => index + 1
 * console.log(typeof next) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SentenceIndex = Brand.Branded<NonNegativeInt, "SentenceIndex">;

/**
 * Construct a branded sentence index after validating it is non-negative.
 *
 * **Example** (Construct zero sentence index)
 *
 * ```ts
 * import { sentenceIndex } from "@beep/nlp/Core/Sentence"
 *
 * const first = sentenceIndex(0)
 * console.log(first) // 0
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const sentenceIndex: Brand.Constructor<SentenceIndex> = Brand.check<SentenceIndex>(
  S.makeFilter(S.is(NonNegativeInt))
);

/**
 * Schema that decodes non-negative numbers into {@link SentenceIndex} values.
 *
 * **Example** (Decode non-negative index)
 *
 * ```ts
 * import { SentenceIndex } from "@beep/nlp/Core/Sentence"
 *
 * const index = SentenceIndex.make(1)
 * console.log(index) // 1
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SentenceIndex = NonNegativeInt.pipe(
  S.fromBrand("SentenceIndex", sentenceIndex),
  $I.annoteSchema("SentenceIndex", {
    description: "Non-negative ordered index for an NLP sentence.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Immutable sentence with its document token range and optional scoring data.
 *
 * **Gotchas**
 *
 * `start` and `end` are token indices in the surrounding document, not
 * character offsets. Use the contained token models when character spans are
 * needed.
 *
 * **Example** (Construct empty sentence model)
 *
 * ```ts
 * import { Chunk } from "effect"
 * import * as O from "effect/Option"
 * import { Sentence, SentenceIndex } from "@beep/nlp/Core/Sentence"
 * import { TokenIndex } from "@beep/nlp/Core/Token"
 *
 * const sentence = Sentence.make({
 *   text: "Effect works.",
 *   index: SentenceIndex.make(0),
 *   tokens: Chunk.empty(),
 *   start: TokenIndex.make(0),
 *   end: TokenIndex.make(0),
 *   sentiment: O.none(),
 *   importance: O.none(),
 *   negationFlag: O.none(),
 *   markedUpText: O.none()
 * })
 * console.log(sentence.tokenCount) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Sentence extends S.Class<Sentence>($I`Sentence`)(
  {
    text: S.String,
    index: SentenceIndex,
    tokens: S.Chunk(Token),
    start: TokenIndex,
    end: TokenIndex,
    sentiment: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    importance: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    negationFlag: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    markedUpText: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Sentence", {
    description: "Immutable NLP sentence with token offsets and optional scoring metadata.",
  })
) {
  /**
   * Number of characters in the sentence text.
   */
  get characterCount(): number {
    return Str.length(this.text);
  }

  /**
   * Number of tokens in the sentence.
   */
  get tokenCount(): number {
    return Chunk.size(this.tokens);
  }

  /**
   * Whether the sentence has sentiment metadata.
   */
  get hasSentiment(): boolean {
    return O.isSome(this.sentiment);
  }

  /**
   * Get tokens whose document token indices fall inside an inclusive range.
   */
  static readonly getTokensInRange: {
    (sentence: Sentence, startIdx: number, options: { readonly end: number }): Chunk.Chunk<Token>;
    (startIdx: number, options: { readonly end: number }): (sentence: Sentence) => Chunk.Chunk<Token>;
  } = dual(3, (sentence: Sentence, startIdx: number, options: { readonly end: number }): Chunk.Chunk<Token> => {
    const endIdx = getRangeEnd(options);
    return Chunk.filter(sentence.tokens, (token) => token.index >= startIdx && token.index <= endIdx);
  });

  /**
   * Safely get a token by zero-based index.
   */
  static readonly getToken: {
    (sentence: Sentence, index: number): O.Option<Token>;
    (index: number): (sentence: Sentence) => O.Option<Token>;
  } = dual(2, (sentence: Sentence, index: number): O.Option<Token> => Chunk.get(sentence.tokens, index));
}
