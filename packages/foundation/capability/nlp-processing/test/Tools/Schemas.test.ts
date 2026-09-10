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
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown, unknown, never, never>>(schema: Schema) => {
  const arbitrary = Arbitrary.schema(schema);
  const decode = S.decodeUnknownSync(schema);
  const encode = S.encodeSync(schema);
  const equals = S.toEquivalence(schema);

  expect(
    Effect.runSync(
      Arbitrary.checkEffect(
        Arbitrary.all([arbitrary]),
        ([value]) => {
          expect(equals(decode(encode(value)), value)).toBe(true);

          return true;
        },
        fcRuns(50)
      )
    )._tag
  ).toBe("Passed");
};

describe("AI tool shared schemas", () => {
  it("round-trips schema-derived shared result models", () => {
    assertSchemaRoundTrip(AiToken);
    assertSchemaRoundTrip(AiAnalysis);
    assertSchemaRoundTrip(AiSentence);
    assertSchemaRoundTrip(AiDocumentStats);
    assertSchemaRoundTrip(AiSentenceChunk);
    assertSchemaRoundTrip(AiRankedText);
    assertSchemaRoundTrip(AiEntity);
    assertSchemaRoundTrip(AiNGram);
    assertSchemaRoundTrip(AiPhoneticMatch);
    assertSchemaRoundTrip(AiCorpusSummary);
    assertSchemaRoundTrip(AiCorpusRankedDocument);
    assertSchemaRoundTrip(AiCorpusMatrixShape);
    assertSchemaRoundTrip(AiCorpusStats);
  });
});

describe("AI tool success schemas", () => {
  it("round-trips schema-derived success payloads", () => {
    assertSchemaRoundTrip(WordCount.successSchema);
    assertSchemaRoundTrip(Tokenize.successSchema);
    assertSchemaRoundTrip(Stem.successSchema);
    assertSchemaRoundTrip(Sentences.successSchema);
    assertSchemaRoundTrip(RemoveStopWords.successSchema);
    assertSchemaRoundTrip(Paragraphize.successSchema);
    assertSchemaRoundTrip(BagOfWords.successSchema);
    assertSchemaRoundTrip(NGrams.successSchema);
    assertSchemaRoundTrip(LearnCustomEntities.successSchema);
    assertSchemaRoundTrip(ExtractEntities.successSchema);
    assertSchemaRoundTrip(ChunkBySentences.successSchema);
    assertSchemaRoundTrip(QueryCorpus.successSchema);
    assertSchemaRoundTrip(RankByRelevance.successSchema);
  });
});
