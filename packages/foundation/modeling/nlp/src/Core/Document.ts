/**
 * Core document model for NLP runtime services.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Brand, Chunk, pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Sentence } from "./Sentence.ts";
import { Token } from "./Token.ts";
import type * as O from "effect/Option";
import type { SentenceIndex } from "./Sentence.ts";
import type { TokenIndex } from "./Token.ts";

const $I = $NlpId.create("Core/Document");
const getRangeEnd = (
  options:
    | {
        readonly end: number;
      }
    | number
): number => (P.isNumber(options) ? options : options.end);

/**
 * Stable non-empty identifier for a text document moving through NLP pipelines.
 *
 * @example
 * ```ts
 * import { DocumentId } from "@beep/nlp/Core/Document"
 *
 * const id = DocumentId.make("doc-001")
 * console.log(id) // "doc-001"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocumentId = S.NonEmptyString.pipe(
  S.brand("DocumentId"),
  $I.annoteSchema("DocumentId", {
    description: "Stable identifier for an NLP document.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime TypeScript type decoded by the {@link DocumentId} schema.
 *
 * @example
 * ```ts
 * import type { DocumentId } from "@beep/nlp/Core/Document"
 *
 * const label = (id: DocumentId): string => `document:${id}`
 * console.log(typeof label) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentId = typeof DocumentId.Type;

/**
 * Zero-based position of a document inside an ordered corpus or batch.
 *
 * @example
 * ```ts
 * import type { DocumentIndex } from "@beep/nlp/Core/Document"
 *
 * const next = (index: DocumentIndex): number => index + 1
 * console.log(typeof next) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentIndex = Brand.Branded<NonNegativeInt, "DocumentIndex">;

/**
 * Construct a branded document index after validating it is non-negative.
 *
 * @example
 * ```ts
 * import { documentIndex } from "@beep/nlp/Core/Document"
 *
 * const first = documentIndex(0)
 * console.log(first) // 0
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const documentIndex: Brand.Constructor<DocumentIndex> = Brand.check<DocumentIndex>(
  S.makeFilter(S.is(NonNegativeInt))
);

/**
 * Schema that decodes non-negative numbers into {@link DocumentIndex} values.
 *
 * @example
 * ```ts
 * import { DocumentIndex } from "@beep/nlp/Core/Document"
 *
 * const index = DocumentIndex.make(3)
 * console.log(index) // 3
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const DocumentIndex = NonNegativeInt.pipe(
  S.fromBrand("DocumentIndex", documentIndex),
  $I.annoteSchema("DocumentIndex", {
    description: "Non-negative ordered index for an NLP document.",
  }),
  SchemaUtils.withCodecStatics
);

const rebuildSentence: {
  (sentenceTokens: A.NonEmptyReadonlyArray<Token>, sentence: Sentence): Result.Result<Sentence>;
  (sentence: Sentence): (sentenceTokens: A.NonEmptyReadonlyArray<Token>) => Result.Result<Sentence>;
} = dual(2, (sentenceTokens: A.NonEmptyReadonlyArray<Token>, sentence: Sentence) => {
  const [firstToken, ...remainingTokens] = sentenceTokens;
  const lastToken = A.reduce(remainingTokens, firstToken, (_, token) => token);

  return Result.succeed(
    Sentence.make({
      end: lastToken.index,
      importance: sentence.importance,
      index: sentence.index,
      markedUpText: sentence.markedUpText,
      negationFlag: sentence.negationFlag,
      sentiment: sentence.sentiment,
      start: firstToken.index,
      text: sentence.text,
      tokens: Chunk.fromIterable(sentenceTokens),
    })
  );
});

const filterSentence = (predicate: (token: Token) => boolean) => (sentence: Sentence) =>
  pipe(
    Chunk.filter(sentence.tokens, predicate),
    Chunk.toReadonlyArray,
    A.match({
      onEmpty: () => Result.failVoid,
      onNonEmpty: rebuildSentence(sentence),
    })
  );

const filterDocument = (document: Document, predicate: (token: Token) => boolean): Document =>
  Document.make({
    id: document.id,
    sentences: pipe(
      Chunk.toReadonlyArray(document.sentences),
      A.filterMap(filterSentence(predicate)),
      Chunk.fromIterable
    ),
    sentiment: document.sentiment,
    text: document.text,
    tokens: Chunk.filter(document.tokens, predicate),
  });

/**
 * Immutable document containing source text plus aligned tokens and sentences.
 *
 * @remarks
 * `tokens` and `sentences` preserve source order. Filtering operations rebuild
 * sentence token spans so derived documents remain internally consistent.
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 * import * as O from "effect/Option"
 * import { Document as NLPDocument, DocumentId } from "@beep/nlp/Core/Document"
 *
 * const document = NLPDocument.make({
 *   id: DocumentId.make("doc-001"),
 *   text: "Effect works.",
 *   tokens: Chunk.empty(),
 *   sentences: Chunk.empty(),
 *   sentiment: O.none()
 * })
 * console.log(document.tokenCount) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Document extends S.Class<Document>($I`Document`)(
  {
    id: DocumentId,
    text: S.String,
    tokens: S.Chunk(Token),
    sentences: S.Chunk(Sentence),
    sentiment: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Document", {
    description: "Immutable NLP document with token and sentence structure.",
  })
) {
  /**
   * Number of tokens in the document.
   * @since 0.0.0
   * @category utilities
   */
  get tokenCount(): number {
    return Chunk.size(this.tokens);
  }

  /**
   * Number of sentences in the document.
   * @since 0.0.0
   * @category utilities
   */
  get sentenceCount(): number {
    return Chunk.size(this.sentences);
  }

  /**
   * Number of characters in the source text.
   * @since 0.0.0
   * @category utilities
   */
  get characterCount(): number {
    return Str.length(this.text);
  }

  /**
   * Get tokens whose character spans overlap a half-open source range.
   * @since 0.0.0
   * @category utilities
   */
  static readonly getTokensInRange: {
    (
      document: Document,
      start: number,
      options: {
        readonly end: number;
      }
    ): Chunk.Chunk<Token>;
    (
      start: number,
      options: {
        readonly end: number;
      }
    ): (document: Document) => Chunk.Chunk<Token>;
  } = dual(
    3,
    (
      document: Document,
      start: number,
      options: {
        readonly end: number;
      }
    ): Chunk.Chunk<Token> => {
      const end = getRangeEnd(options);
      return Chunk.filter(document.tokens, (token) => token.start < end && token.end > start);
    }
  );

  /**
   * Safely get a token by zero-based index.
   * @since 0.0.0
   * @category utilities
   */
  static readonly getToken: {
    (document: Document, index: number): O.Option<Token>;
    (index: number): (document: Document) => O.Option<Token>;
  } = dual(2, (document: Document, index: number): O.Option<Token> => Chunk.get(document.tokens, index));

  /**
   * Safely get a token by branded token index.
   * @since 0.0.0
   * @category utilities
   */
  static readonly getTokenByIndex: {
    (document: Document, index: TokenIndex): O.Option<Token>;
    (index: TokenIndex): (document: Document) => O.Option<Token>;
  } = dual(
    2,
    (document: Document, index: TokenIndex): O.Option<Token> =>
      A.findFirst(Chunk.toReadonlyArray(document.tokens), (token) => token.index === index)
  );

  /**
   * Safely get a sentence by zero-based index.
   * @since 0.0.0
   * @category utilities
   */
  static readonly getSentence: {
    (document: Document, index: number): O.Option<Sentence>;
    (index: number): (document: Document) => O.Option<Sentence>;
  } = dual(2, (document: Document, index: number): O.Option<Sentence> => Chunk.get(document.sentences, index));

  /**
   * Safely get a sentence by branded sentence index.
   * @since 0.0.0
   * @category utilities
   */
  static readonly getSentenceByIndex: {
    (document: Document, index: SentenceIndex): O.Option<Sentence>;
    (index: SentenceIndex): (document: Document) => O.Option<Sentence>;
  } = dual(
    2,
    (document: Document, index: SentenceIndex): O.Option<Sentence> =>
      A.findFirst(Chunk.toReadonlyArray(document.sentences), (sentence) => sentence.index === index)
  );

  /**
   * Filter tokens while dropping sentences that no longer contain any tokens.
   * @since 0.0.0
   * @category utilities
   */
  static readonly filterTokens: {
    (document: Document, predicate: (token: Token) => boolean): Document;
    (predicate: (token: Token) => boolean): (document: Document) => Document;
  } = dual(2, filterDocument);

  /**
   * Extract token texts in order.
   * @since 0.0.0
   * @category utilities
   */
  static readonly tokenTexts = (document: Document): Chunk.Chunk<string> =>
    Chunk.map(document.tokens, (token) => token.text);

  /**
   * Extract sentence texts in order.
   * @since 0.0.0
   * @category utilities
   */
  static readonly sentenceTexts = (document: Document): Chunk.Chunk<string> =>
    Chunk.map(document.sentences, (sentence) => sentence.text);
}
