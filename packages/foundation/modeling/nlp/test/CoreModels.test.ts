import { Document, DocumentId } from "@beep/nlp/Core/Document";
import { Sentence, SentenceIndex } from "@beep/nlp/Core/Sentence";
import { SimilarityScore } from "@beep/nlp/Core/Similarity";
import { CharPosition, Token, TokenIndex } from "@beep/nlp/Core/Token";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { Chunk, Effect, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";

const TokenArbitrary = S.toArbitrary(Token)(fc);
const SentenceArbitrary = S.toArbitrary(Sentence)(fc);
const DocumentArbitrary = S.toArbitrary(Document)(fc);
const SimilarityScoreArbitrary = S.toArbitrary(SimilarityScore)(fc);

const makeToken = (index: number, text: string, start: number, end: number): Token =>
  Token.make({
    abbrevFlag: O.none(),
    case: O.none(),
    contractionFlag: O.none(),
    end: CharPosition.make(end),
    index: TokenIndex.make(index),
    lemma: O.none(),
    negationFlag: O.none(),
    normal: O.none(),
    pos: O.none(),
    prefix: O.none(),
    precedingSpaces: O.none(),
    shape: O.none(),
    start: CharPosition.make(start),
    stem: O.none(),
    stopWordFlag: O.none(),
    suffix: O.none(),
    tags: [],
    text,
    uniqueId: O.none(),
  });

const makeSentence = (index: number, text: string, tokens: ReadonlyArray<Token>): Sentence => {
  const [firstToken, ...remainingTokens] = tokens;

  if (firstToken === undefined) {
    throw new Error("Sentences in this test fixture must contain at least one token.");
  }

  const lastToken = A.reduce(remainingTokens, firstToken, (_, token) => token);

  return Sentence.make({
    end: lastToken.index,
    importance: O.none(),
    index: SentenceIndex.make(index),
    markedUpText: O.none(),
    negationFlag: O.none(),
    sentiment: O.none(),
    start: firstToken.index,
    text,
    tokens: Chunk.fromIterable(tokens),
  });
};

const makeDocument = (text: string, tokens: ReadonlyArray<Token>, sentences: ReadonlyArray<Sentence>): Document =>
  Document.make({
    id: DocumentId.make("core-models"),
    sentences: Chunk.fromIterable(sentences),
    sentiment: O.none(),
    text,
    tokens: Chunk.fromIterable(tokens),
  });

describe("Core models", () => {
  it("keeps constructor-defaulted optional fields absent in encoded core wire shapes", () => {
    const token = Token.make({
      end: CharPosition.make(6),
      index: TokenIndex.make(0),
      start: CharPosition.make(0),
      tags: [],
      text: "Effect",
    });
    const sentence = Sentence.make({
      end: TokenIndex.make(0),
      index: SentenceIndex.make(0),
      start: TokenIndex.make(0),
      text: "Effect",
      tokens: Chunk.of(token),
    });
    const document = Document.make({
      id: DocumentId.make("core-models"),
      sentences: Chunk.of(sentence),
      text: "Effect",
      tokens: Chunk.of(token),
    });
    const similarity = SimilarityScore.make({
      document1Id: DocumentId.make("doc-a"),
      document2Id: DocumentId.make("doc-b"),
      method: "set.tversky",
      score: UnitInterval.make(0.8),
    });

    expect(Effect.runSync(S.encodeUnknownEffect(Token)(token))).toEqual({
      end: 6,
      index: 0,
      start: 0,
      tags: [],
      text: "Effect",
    });
    const encodedSentence = Effect.runSync(S.encodeUnknownEffect(Sentence)(sentence));
    expect(encodedSentence).toEqual({
      end: 0,
      index: 0,
      start: 0,
      text: "Effect",
      tokens: encodedSentence.tokens,
    });
    expect(Chunk.toReadonlyArray(encodedSentence.tokens)).toEqual([
      {
        end: 6,
        index: 0,
        start: 0,
        tags: [],
        text: "Effect",
      },
    ]);

    const encodedDocument = Effect.runSync(S.encodeUnknownEffect(Document)(document));
    expect(encodedDocument).toEqual({
      id: "core-models",
      sentences: encodedDocument.sentences,
      text: "Effect",
      tokens: encodedDocument.tokens,
    });
    expect(Chunk.toReadonlyArray(encodedDocument.sentences)).toEqual([encodedSentence]);
    expect(Chunk.toReadonlyArray(encodedDocument.tokens)).toEqual([
      {
        end: 6,
        index: 0,
        start: 0,
        tags: [],
        text: "Effect",
      },
    ]);
    expect(Effect.runSync(S.encodeUnknownEffect(SimilarityScore)(similarity))).toEqual({
      document1Id: "doc-a",
      document2Id: "doc-b",
      method: "set.tversky",
      score: 0.8,
    });
  });

  it("round-trips schema-derived core model values", () => {
    fc.assert(
      fc.property(
        TokenArbitrary,
        SentenceArbitrary,
        DocumentArbitrary,
        SimilarityScoreArbitrary,
        (token, sentence, document, similarity) => {
          const encodedToken = Effect.runSync(S.encodeEffect(Token)(token));
          const encodedSentence = Effect.runSync(S.encodeEffect(Sentence)(sentence));
          const encodedDocument = Effect.runSync(S.encodeEffect(Document)(document));
          const encodedSimilarity = Effect.runSync(S.encodeEffect(SimilarityScore)(similarity));

          expect(Effect.runSync(S.decodeEffect(Token)(encodedToken))).toEqual(token);
          expect(Effect.runSync(S.decodeEffect(Sentence)(encodedSentence))).toEqual(sentence);
          expect(Effect.runSync(S.decodeEffect(Document)(encodedDocument))).toEqual(document);
          expect(Effect.runSync(S.decodeEffect(SimilarityScore)(encodedSimilarity))).toEqual(similarity);
        }
      ),
      fcRuns(50)
    );
  });

  it("returns tokens whose character spans overlap the requested range", () => {
    const tokens = [makeToken(0, "Ada", 0, 3), makeToken(1, "Loves", 3, 8), makeToken(2, "Code", 8, 12)];
    const sentence = makeSentence(0, "AdaLovesCode", tokens);
    const document = makeDocument("AdaLovesCode", tokens, [sentence]);
    const overlappingTokens: Chunk.Chunk<Token> = Document.getTokensInRange(document, 2, { end: 4 });

    const overlapping = pipe(
      overlappingTokens,
      Chunk.map((token) => token.text),
      Chunk.toReadonlyArray
    );

    expect(overlapping).toEqual(["Ada", "Loves"]);
  });

  it("uses document token indices for sentence range lookups", () => {
    const grace = makeToken(2, "Grace", 10, 15);
    const debugged = makeToken(3, "debugged", 16, 24);
    const sentence = makeSentence(1, "Grace debugged", [grace, debugged]);
    const rangedTokens: Chunk.Chunk<Token> = Sentence.getTokensInRange(sentence, 2, { end: 3 });

    const inRange = pipe(
      rangedTokens,
      Chunk.map((token) => token.text),
      Chunk.toReadonlyArray
    );

    expect(inRange).toEqual(["Grace", "debugged"]);
  });

  it("rebuilds filtered documents with consistent sentence and index lookups", () => {
    const ada = makeToken(0, "Ada", 0, 3);
    const wrote = makeToken(1, "wrote", 4, 9);
    const grace = makeToken(2, "Grace", 10, 15);
    const debugged = makeToken(3, "debugged", 16, 24);
    const tokens = [ada, wrote, grace, debugged];
    const sentences = [
      makeSentence(0, "Ada wrote", [ada, wrote]),
      makeSentence(1, "Grace debugged", [grace, debugged]),
    ];
    const document = makeDocument("Ada wrote Grace debugged", tokens, sentences);
    const filtered = Document.filterTokens(document, (token: Token) => token.index === 0 || token.index === 2);
    const filteredSentences: Chunk.Chunk<Sentence> = filtered.sentences;

    expect(filtered.tokenCount).toBe(2);
    expect(filtered.sentenceCount).toBe(2);
    expect(
      pipe(
        filteredSentences,
        Chunk.map((sentence) => {
          const sentenceTokens: Chunk.Chunk<Token> = sentence.tokens;

          return pipe(
            sentenceTokens,
            Chunk.map((token) => token.index),
            Chunk.toReadonlyArray
          );
        }),
        Chunk.toReadonlyArray
      )
    ).toEqual([[0], [2]]);
    expect(O.isSome(Document.getTokenByIndex(filtered, ada.index))).toBe(true);
    expect(O.isNone(Document.getTokenByIndex(filtered, wrote.index))).toBe(true);
    expect(O.isSome(Document.getSentenceByIndex(filtered, sentences[1].index))).toBe(true);
  });
});
