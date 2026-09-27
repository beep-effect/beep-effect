import {
  AiAnalysis,
  AiCorpusMatrixShape,
  AiCorpusRankedDocument,
  AiCorpusStats,
  AiCorpusSummary,
  AiDocumentStats,
  AiEntity,
  AiNGram,
  AiPhoneticMatch,
  AiRankedText,
  AiSentence,
  AiSentenceChunk,
  AiToken,
} from "@beep/nlp-processing/Tools/_schemas";
import { BagOfWords } from "@beep/nlp-processing/Tools/BagOfWords";
import { ChunkBySentences } from "@beep/nlp-processing/Tools/ChunkBySentences";
import { ExtractEntities } from "@beep/nlp-processing/Tools/ExtractEntities";
import { LearnCustomEntities } from "@beep/nlp-processing/Tools/LearnCustomEntities";
import { NGrams } from "@beep/nlp-processing/Tools/NGrams";
import { Paragraphize } from "@beep/nlp-processing/Tools/Paragraphize";
import { QueryCorpus } from "@beep/nlp-processing/Tools/QueryCorpus";
import { RankByRelevance } from "@beep/nlp-processing/Tools/RankByRelevance";
import { RemoveStopWords } from "@beep/nlp-processing/Tools/RemoveStopWords";
import { Sentences } from "@beep/nlp-processing/Tools/Sentences";
import { Stem } from "@beep/nlp-processing/Tools/Stem";
import { Tokenize } from "@beep/nlp-processing/Tools/Tokenize";
import { WordCount } from "@beep/nlp-processing/Tools/WordCount";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const assertSchemaRoundTrip = Effect.fn("assertSchemaRoundTrip")(function* <
  Schema extends S.Codec<unknown, unknown, never, never>,
>(schema: Schema, value: Schema["Type"], label: string) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
  expect(S.toEquivalence(schema)(decoded, value), label).toBe(true);
});

describe("AI tool shared schemas", () => {
  it.effect.prop(
    "round-trips schema-derived shared result models",
    {
      AiToken: Arbitrary.schema(AiToken),
      AiAnalysis: Arbitrary.schema(AiAnalysis),
      AiSentence: Arbitrary.schema(AiSentence),
      AiDocumentStats: Arbitrary.schema(AiDocumentStats),
      AiSentenceChunk: Arbitrary.schema(AiSentenceChunk),
      AiRankedText: Arbitrary.schema(AiRankedText),
      AiEntity: Arbitrary.schema(AiEntity),
      AiNGram: Arbitrary.schema(AiNGram),
      AiPhoneticMatch: Arbitrary.schema(AiPhoneticMatch),
      AiCorpusSummary: Arbitrary.schema(AiCorpusSummary),
      AiCorpusRankedDocument: Arbitrary.schema(AiCorpusRankedDocument),
      AiCorpusMatrixShape: Arbitrary.schema(AiCorpusMatrixShape),
      AiCorpusStats: Arbitrary.schema(AiCorpusStats),
    },
    (values) =>
      Effect.gen(function* () {
        yield* assertSchemaRoundTrip(AiToken, values.AiToken, "AiToken");
        yield* assertSchemaRoundTrip(AiAnalysis, values.AiAnalysis, "AiAnalysis");
        yield* assertSchemaRoundTrip(AiSentence, values.AiSentence, "AiSentence");
        yield* assertSchemaRoundTrip(AiDocumentStats, values.AiDocumentStats, "AiDocumentStats");
        yield* assertSchemaRoundTrip(AiSentenceChunk, values.AiSentenceChunk, "AiSentenceChunk");
        yield* assertSchemaRoundTrip(AiRankedText, values.AiRankedText, "AiRankedText");
        yield* assertSchemaRoundTrip(AiEntity, values.AiEntity, "AiEntity");
        yield* assertSchemaRoundTrip(AiNGram, values.AiNGram, "AiNGram");
        yield* assertSchemaRoundTrip(AiPhoneticMatch, values.AiPhoneticMatch, "AiPhoneticMatch");
        yield* assertSchemaRoundTrip(AiCorpusSummary, values.AiCorpusSummary, "AiCorpusSummary");
        yield* assertSchemaRoundTrip(AiCorpusRankedDocument, values.AiCorpusRankedDocument, "AiCorpusRankedDocument");
        yield* assertSchemaRoundTrip(AiCorpusMatrixShape, values.AiCorpusMatrixShape, "AiCorpusMatrixShape");
        yield* assertSchemaRoundTrip(AiCorpusStats, values.AiCorpusStats, "AiCorpusStats");
      }),
    { arbitrary: fcRuns(50) }
  );
});

describe("AI tool success schemas", () => {
  it.effect.prop(
    "round-trips schema-derived success payloads",
    {
      WordCount: Arbitrary.schema(WordCount.successSchema),
      Tokenize: Arbitrary.schema(Tokenize.successSchema),
      Stem: Arbitrary.schema(Stem.successSchema),
      Sentences: Arbitrary.schema(Sentences.successSchema),
      RemoveStopWords: Arbitrary.schema(RemoveStopWords.successSchema),
      Paragraphize: Arbitrary.schema(Paragraphize.successSchema),
      BagOfWords: Arbitrary.schema(BagOfWords.successSchema),
      NGrams: Arbitrary.schema(NGrams.successSchema),
      LearnCustomEntities: Arbitrary.schema(LearnCustomEntities.successSchema),
      ExtractEntities: Arbitrary.schema(ExtractEntities.successSchema),
      ChunkBySentences: Arbitrary.schema(ChunkBySentences.successSchema),
      QueryCorpus: Arbitrary.schema(QueryCorpus.successSchema),
      RankByRelevance: Arbitrary.schema(RankByRelevance.successSchema),
    },
    (values) =>
      Effect.gen(function* () {
        yield* assertSchemaRoundTrip(WordCount.successSchema, values.WordCount, "WordCount.successSchema");
        yield* assertSchemaRoundTrip(Tokenize.successSchema, values.Tokenize, "Tokenize.successSchema");
        yield* assertSchemaRoundTrip(Stem.successSchema, values.Stem, "Stem.successSchema");
        yield* assertSchemaRoundTrip(Sentences.successSchema, values.Sentences, "Sentences.successSchema");
        yield* assertSchemaRoundTrip(
          RemoveStopWords.successSchema,
          values.RemoveStopWords,
          "RemoveStopWords.successSchema"
        );
        yield* assertSchemaRoundTrip(Paragraphize.successSchema, values.Paragraphize, "Paragraphize.successSchema");
        yield* assertSchemaRoundTrip(BagOfWords.successSchema, values.BagOfWords, "BagOfWords.successSchema");
        yield* assertSchemaRoundTrip(NGrams.successSchema, values.NGrams, "NGrams.successSchema");
        yield* assertSchemaRoundTrip(
          LearnCustomEntities.successSchema,
          values.LearnCustomEntities,
          "LearnCustomEntities.successSchema"
        );
        yield* assertSchemaRoundTrip(
          ExtractEntities.successSchema,
          values.ExtractEntities,
          "ExtractEntities.successSchema"
        );
        yield* assertSchemaRoundTrip(
          ChunkBySentences.successSchema,
          values.ChunkBySentences,
          "ChunkBySentences.successSchema"
        );
        yield* assertSchemaRoundTrip(QueryCorpus.successSchema, values.QueryCorpus, "QueryCorpus.successSchema");
        yield* assertSchemaRoundTrip(
          RankByRelevance.successSchema,
          values.RankByRelevance,
          "RankByRelevance.successSchema"
        );
      }),
    { arbitrary: fcRuns(50) }
  );
});
