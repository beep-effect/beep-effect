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
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const assertSchemaRoundTrip = Effect.fn("assertSchemaRoundTrip")(function* <
  Schema extends S.Codec<unknown, unknown, never, never>,
>(schema: Schema) {
  const equals = S.toEquivalence(schema);
  const result = yield* Arbitrary.checkEffect(
    Arbitrary.all([Arbitrary.schema(schema)]),
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
        expect(equals(decoded, value)).toBe(true);

        return true;
      }),
    fcRuns(50)
  );
  expect(result._tag).toBe("Passed");
});

describe("AI tool shared schemas", () => {
  it.effect("round-trips schema-derived shared result models", () =>
    Effect.gen(function* () {
      yield* assertSchemaRoundTrip(AiToken);
      yield* assertSchemaRoundTrip(AiAnalysis);
      yield* assertSchemaRoundTrip(AiSentence);
      yield* assertSchemaRoundTrip(AiDocumentStats);
      yield* assertSchemaRoundTrip(AiSentenceChunk);
      yield* assertSchemaRoundTrip(AiRankedText);
      yield* assertSchemaRoundTrip(AiEntity);
      yield* assertSchemaRoundTrip(AiNGram);
      yield* assertSchemaRoundTrip(AiPhoneticMatch);
      yield* assertSchemaRoundTrip(AiCorpusSummary);
      yield* assertSchemaRoundTrip(AiCorpusRankedDocument);
      yield* assertSchemaRoundTrip(AiCorpusMatrixShape);
      yield* assertSchemaRoundTrip(AiCorpusStats);
    })
  );
});

describe("AI tool success schemas", () => {
  it.effect("round-trips schema-derived success payloads", () =>
    Effect.gen(function* () {
      yield* assertSchemaRoundTrip(WordCount.successSchema);
      yield* assertSchemaRoundTrip(Tokenize.successSchema);
      yield* assertSchemaRoundTrip(Stem.successSchema);
      yield* assertSchemaRoundTrip(Sentences.successSchema);
      yield* assertSchemaRoundTrip(RemoveStopWords.successSchema);
      yield* assertSchemaRoundTrip(Paragraphize.successSchema);
      yield* assertSchemaRoundTrip(BagOfWords.successSchema);
      yield* assertSchemaRoundTrip(NGrams.successSchema);
      yield* assertSchemaRoundTrip(LearnCustomEntities.successSchema);
      yield* assertSchemaRoundTrip(ExtractEntities.successSchema);
      yield* assertSchemaRoundTrip(ChunkBySentences.successSchema);
      yield* assertSchemaRoundTrip(QueryCorpus.successSchema);
      yield* assertSchemaRoundTrip(RankByRelevance.successSchema);
    })
  );
});
