/**
 * Wink-backed tokenization layer.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $WinkId } from "@beep/identity";
import { Document, DocumentId } from "@beep/nlp/Core/Document";
import { Sentence, SentenceIndex } from "@beep/nlp/Core/Sentence";
import { CharPosition, Token, TokenIndex } from "@beep/nlp/Core/Token";
import { Tokenization, TokenizationError } from "@beep/nlp-processing/Core";
import { A, thunkEmptyStr, thunkUndefined } from "@beep/utils";
import { Chunk, Clock, Effect, Layer, pipe, Ref, Result } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { WinkEngine, WinkEngineLive } from "./Wink.service.ts";
import { observeWinkWorkflow, textLengthAttribute } from "./WinkObservability.ts";
import type { ItemSentence, ItemToken, ItsHelpers, Document as WinkDocument } from "wink-nlp";

const $I = $WinkId.create("Wink/WinkTokenizer");

const makeTokenizationError =
  (operation: string) =>
  (cause: unknown): TokenizationError =>
    TokenizationError.make({
      cause,
      operation,
    });

const observeTokenizer = (operation: string) =>
  observeWinkWorkflow({
    metricAttributes: { operation },
    name: `tokenizer.${operation}`,
  });

/**
 * Typed failure used when wink sentence spans cannot be aligned to token indexes.
 *
 * **Example** (Creating a span failure)
 *
 * ```ts
 * import { SentenceIndex } from "@beep/nlp/Core/Sentence"
 * import { SentenceSpanFailure } from "@beep/wink"
 *
 * const failure = SentenceSpanFailure.make({
 *   reason: "Unable to derive a stable sentence token span.",
 *   sentenceIndex: SentenceIndex.make(0),
 *   sentenceText: "Hello world."
 * })
 *
 * console.log(failure.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SentenceSpanFailure extends S.TaggedClass<SentenceSpanFailure>($I`SentenceSpanFailure`)(
  "SentenceSpanFailure",
  {
    reason: S.String,
    sentenceIndex: SentenceIndex,
    sentenceText: S.String,
  },
  $I.annote("SentenceSpanFailure", {
    description: "Failure raised when wink sentence spans cannot be derived from token positions.",
  })
) {}

const decodeDocumentIdOption = S.decodeUnknownOption(DocumentId);

const isSpan = (value: unknown): value is readonly [number, number] =>
  A.isArray(value) && value.length >= 2 && P.isNumber(value[0]) && P.isNumber(value[1]);

const getSentenceSpan = (sentence: ItemSentence, its: ItsHelpers): readonly [number, number] | undefined => {
  const span = sentence.out(its.span);
  return isSpan(span) ? [span[0], span[1]] : undefined;
};

const countSentenceTokens = (sentence: ItemSentence): number => {
  let count = 0;

  sentence.tokens().each(() => {
    count += 1;
  });

  return count;
};

const deriveSequentialSentenceSpan = (
  sentence: ItemSentence,
  nextTokenStart: number,
  totalTokenCount: number
): O.Option<readonly [number, number]> => {
  const sentenceTokenCount = countSentenceTokens(sentence);

  if (sentenceTokenCount <= 0) {
    return O.none();
  }

  const end = nextTokenStart + sentenceTokenCount - 1;
  return end >= totalTokenCount ? O.none() : O.some([nextTokenStart, end] as const);
};

const resolveSentenceSpan = (
  sentence: ItemSentence,
  its: ItsHelpers,
  nextTokenStart: number,
  totalTokenCount: number
): O.Option<readonly [number, number]> =>
  pipe(
    (() => {
      const span = getSentenceSpan(sentence, its);
      return P.isUndefined(span) ? O.none() : O.some(span);
    })(),
    O.filter(([start, end]) => start >= 0 && end >= start && end < totalTokenCount),
    O.orElse(() => deriveSequentialSentenceSpan(sentence, nextTokenStart, totalTokenCount))
  );

const tryOut = (token: ItemToken, itsFunction: unknown): unknown =>
  Result.getOrElse(
    Result.try({
      try: () => Reflect.apply(token.out, token, [itsFunction]),
      catch: thunkUndefined,
    }),
    thunkUndefined
  );

const optionFromTokenString = (token: ItemToken, itsFunction: unknown): O.Option<string> => {
  const value = tryOut(token, itsFunction);
  return value === undefined || !P.isString(value) ? O.none() : O.some(value);
};

const optionFromTokenBoolean = (token: ItemToken, itsFunction: unknown): O.Option<boolean> => {
  const value = tryOut(token, itsFunction);
  return P.isUndefined(value) || !P.isBoolean(value) ? O.none() : O.some(value);
};

const optionFromTokenNumber = (token: ItemToken, itsFunction: unknown): O.Option<number> => {
  const value = tryOut(token, itsFunction);
  return P.isUndefined(value) || !P.isNumber(value) ? O.none() : O.some(value);
};

const readPrecedingSpaces = (token: ItemToken, its: ItsHelpers): string =>
  O.getOrElse(optionFromTokenString(token, its.precedingSpaces), thunkEmptyStr);

const makeToken = (token: ItemToken, index: number, its: ItsHelpers, previousEnd: number): readonly [Token, number] => {
  const text = token.out();
  const precedingSpaces = readPrecedingSpaces(token, its);
  const start = previousEnd + precedingSpaces.length;
  const end = start + text.length;

  return [
    Token.make({
      abbrevFlag: optionFromTokenBoolean(token, its.abbrevFlag),
      case: optionFromTokenString(token, its.case),
      contractionFlag: optionFromTokenBoolean(token, its.contractionFlag),
      end: CharPosition.make(end),
      index: TokenIndex.make(index),
      lemma: optionFromTokenString(token, its.lemma),
      negationFlag: optionFromTokenBoolean(token, its.negationFlag),
      normal: optionFromTokenString(token, its.normal),
      pos: optionFromTokenString(token, its.pos),
      prefix: optionFromTokenString(token, its.prefix),
      precedingSpaces: precedingSpaces.length === 0 ? O.none() : O.some(precedingSpaces),
      shape: optionFromTokenString(token, its.shape),
      start: CharPosition.make(start),
      stem: optionFromTokenString(token, its.stem),
      stopWordFlag: optionFromTokenBoolean(token, its.stopWordFlag),
      suffix: optionFromTokenString(token, its.suffix),
      tags: A.empty(),
      text,
      uniqueId: optionFromTokenNumber(token, its.uniqueId),
    }),
    end,
  ] as const;
};

const collectTokens = (doc: WinkDocument, its: ItsHelpers): Chunk.Chunk<Token> => {
  const tokens = A.empty<Token>();
  let previousEnd = 0;

  doc.tokens().each((token, index) => {
    const [mappedToken, nextEnd] = makeToken(token, index, its, previousEnd);
    A.appendInPlace(tokens, mappedToken);
    previousEnd = nextEnd;
  });

  return Chunk.fromIterable(tokens);
};

const collectSentences = (
  doc: WinkDocument,
  tokens: Chunk.Chunk<Token>,
  its: ItsHelpers
): Effect.Effect<Chunk.Chunk<Sentence>, SentenceSpanFailure> => {
  const tokenArray = Chunk.toReadonlyArray(tokens);
  const sentences = A.empty<Sentence>();
  let failure: O.Option<SentenceSpanFailure> = O.none();
  let nextTokenStart = 0;

  doc.sentences().each((sentence, index) => {
    if (O.isSome(failure)) {
      return;
    }

    const resolvedSpan = resolveSentenceSpan(sentence, its, nextTokenStart, tokenArray.length);

    if (O.isNone(resolvedSpan)) {
      failure = O.some(
        SentenceSpanFailure.make({
          reason: "Unable to derive a stable sentence token span.",
          sentenceIndex: SentenceIndex.make(index),
          sentenceText: sentence.out(),
        })
      );
      return;
    }

    const [safeStart, safeEnd] = resolvedSpan.value;
    const sentenceTokens = pipe(tokenArray, A.drop(safeStart), A.take(safeEnd - safeStart + 1));
    const maybeFirstToken = A.head(sentenceTokens);

    if (O.isNone(maybeFirstToken)) {
      failure = O.some(
        SentenceSpanFailure.make({
          reason: "Resolved sentence span produced no tokens.",
          sentenceIndex: SentenceIndex.make(index),
          sentenceText: sentence.out(),
        })
      );
      return;
    }

    const firstToken = maybeFirstToken.value;
    const lastToken = A.reduce(sentenceTokens, firstToken, (_, token) => token);

    A.appendInPlace(
      sentences,
      Sentence.make({
        end: lastToken.index,
        importance: O.none(),
        index: SentenceIndex.make(index),
        markedUpText: O.none(),
        negationFlag: O.none(),
        sentiment: O.none(),
        start: firstToken.index,
        text: sentence.out(),
        tokens: Chunk.fromIterable(sentenceTokens),
      })
    );

    nextTokenStart = safeEnd + 1;
  });

  return O.match(failure, {
    onNone: () => Effect.succeed(Chunk.fromIterable(sentences)),
    onSome: Effect.fail,
  });
};

const buildDocument = (
  text: string,
  documentId: DocumentId,
  tokens: Chunk.Chunk<Token>,
  sentences: Chunk.Chunk<Sentence>,
  doc: WinkDocument,
  its: ItsHelpers
): Document => {
  const sentiment = doc.out(its.sentiment);

  return Document.make({
    id: documentId,
    sentiment: P.isNumber(sentiment) ? O.some(sentiment) : O.none(),
    sentences,
    text,
    tokens,
  });
};

const resolveDocumentId = (
  rawId: DocumentId | string,
  operation: string
): Effect.Effect<DocumentId, TokenizationError> =>
  Effect.fromOption(decodeDocumentIdOption(rawId), () =>
    TokenizationError.make({
      cause: {
        input: rawId,
        reason: "Document ids must be non-empty strings.",
      },
      operation,
    })
  );

const makeWinkTokenization = Effect.gen(function* () {
  const engine = yield* WinkEngine;
  const documentIdCounterRef = yield* Ref.make(0);

  const allocateDocumentId = Ref.updateAndGet(documentIdCounterRef, (current) => current + 1).pipe(
    Effect.flatMap(
      Effect.fnUntraced(function* (counter) {
        return yield* Clock.currentTimeMillis.pipe(Effect.map((nowMs) => `doc-${nowMs}-${counter}`));
      })
    )
  );

  return Tokenization.of({
    document: Effect.fn("Wink.WinkTokenizer.document")(function* (text: string, id?: DocumentId | string) {
      yield* Effect.annotateCurrentSpan({
        has_document_id: `${!P.isUndefined(id)}`,
        ...textLengthAttribute(text, "text"),
      });
      const doc = yield* engine.getWinkDoc(text).pipe(Effect.mapError(makeTokenizationError("document")));
      const its = yield* engine.its.pipe(Effect.mapError(makeTokenizationError("document")));
      const tokens = collectTokens(doc, its);
      const sentences = yield* collectSentences(doc, tokens, its).pipe(
        Effect.mapError(makeTokenizationError("document"))
      );
      const rawDocumentId = P.isUndefined(id) ? yield* allocateDocumentId : id;
      const documentId = yield* resolveDocumentId(rawDocumentId, "document");
      return buildDocument(text, documentId, tokens, sentences, doc, its);
    }, observeTokenizer("document")),
    sentences: Effect.fn("Wink.WinkTokenizer.sentences")(
      function* (text: string) {
        yield* Effect.annotateCurrentSpan(textLengthAttribute(text, "text"));
        const doc = yield* engine.getWinkDoc(text);
        const its = yield* engine.its;
        const tokens = collectTokens(doc, its);
        return yield* collectSentences(doc, tokens, its).pipe(Effect.map(Chunk.toReadonlyArray));
      },
      (effect) => effect.pipe(Effect.mapError(makeTokenizationError("sentences")), observeTokenizer("sentences"))
    ),
    tokenCount: Effect.fn("Wink.WinkTokenizer.tokenCount")(function* (text: string) {
      yield* Effect.annotateCurrentSpan(textLengthAttribute(text, "text"));
      return yield* engine.getWinkTokenCount(text).pipe(Effect.mapError(makeTokenizationError("tokenCount")));
    }, observeTokenizer("token_count")),
    tokenize: Effect.fn("Wink.WinkTokenizer.tokenize")(
      function* (text: string) {
        yield* Effect.annotateCurrentSpan(textLengthAttribute(text, "text"));
        const doc = yield* engine.getWinkDoc(text);
        const its = yield* engine.its;
        return Chunk.toReadonlyArray(collectTokens(doc, its));
      },
      (effect) => effect.pipe(Effect.mapError(makeTokenizationError("tokenize")), observeTokenizer("tokenize"))
    ),
  });
}).pipe(observeWinkWorkflow({ name: "tokenizer.make" }));

/**
 * Engine-dependent layer implementing the core tokenization service with wink.
 *
 * **Example** (Providing wink tokenization layer)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { Tokenization } from "@beep/nlp-processing/Core"
 * import { WinkEngineLive } from "@beep/wink"
 * import { WinkTokenization } from "@beep/wink"
 *
 * const program = Effect.gen(function* () {
 *   const tokenization = yield* Tokenization
 *   return yield* tokenization.sentences("One sentence. Then another.")
 * })
 *
 * Effect.runPromise(
 *   program.pipe(Effect.provide(WinkTokenization.pipe(Layer.provide(WinkEngineLive))))
 * ).then((sentences) => console.log(sentences.length))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkTokenization = Layer.effect(Tokenization, makeWinkTokenization);

/**
 * Live tokenization layer with the wink engine already provided.
 *
 * **Example** (Using live wink tokenization)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Tokenization } from "@beep/nlp-processing/Core"
 * import { WinkTokenizationLive } from "@beep/wink"
 *
 * const program = Effect.gen(function* () {
 *   const tokenization = yield* Tokenization
 *   return yield* tokenization.tokenCount("Count these wink tokens.")
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(WinkTokenizationLive))).then(console.log)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkTokenizationLive = WinkTokenization.pipe(Layer.provide(WinkEngineLive));
