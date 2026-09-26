import { SentenceIndex } from "@beep/nlp/Core/Sentence";
import { BowCosineSimilarity } from "@beep/nlp-processing/Tools/BowCosineSimilarity";
import { ChunkBySentences } from "@beep/nlp-processing/Tools/ChunkBySentences";
import { CreateCorpus } from "@beep/nlp-processing/Tools/CreateCorpus";
import { ExtractKeywords } from "@beep/nlp-processing/Tools/ExtractKeywords";
import { NlpToolkit } from "@beep/nlp-processing/Tools/NlpToolkit";
import { TextSimilarity } from "@beep/nlp-processing/Tools/TextSimilarity";
import { TverskySimilarity } from "@beep/nlp-processing/Tools/TverskySimilarity";
import { fcRuns } from "@beep/test-utils";
import {
  CorpusManagerError,
  CustomEntityExample,
  EntityGroupName,
  InstanceId,
  SentenceSpanFailure,
  VectorizerError,
  WinkEngine,
  WinkEngineCustomEntities,
  WinkEngineError,
  WinkEngineLive,
  WinkEngineState,
  WinkError,
  WinkNlpToolkitLive,
} from "@beep/wink";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Equal, Exit, Layer, Schema, Stream } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";

const decodeBowCosineSimilaritySuccess = Schema.decodeEffect(BowCosineSimilarity.successSchema);
const decodeChunkBySentencesParameters = Schema.decodeEffect(ChunkBySentences.parametersSchema);
const decodeCreateCorpusParameters = Schema.decodeEffect(CreateCorpus.parametersSchema);
const decodeExtractKeywordsParameters = Schema.decodeEffect(ExtractKeywords.parametersSchema);
const decodeTextSimilaritySuccess = Schema.decodeEffect(TextSimilarity.successSchema);
const decodeTverskySimilarityParameters = Schema.decodeEffect(TverskySimilarity.parametersSchema);
const decodeTverskySimilaritySuccess = Schema.decodeEffect(TverskySimilarity.successSchema);
const encodeCorpusManagerError = Schema.encodeEffect(CorpusManagerError);
const encodeCustomEntityExample = Schema.encodeEffect(CustomEntityExample);
const encodeEntityGroupName = Schema.encodeEffect(EntityGroupName);
const encodeInstanceId = Schema.encodeEffect(InstanceId);
const encodeSentenceSpanFailure = Schema.encodeEffect(SentenceSpanFailure);
const encodeVectorizerError = Schema.encodeEffect(VectorizerError);

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const assertRoundTrip = Effect.fn("assertRoundTrip")(function* <
  SchemaT extends Schema.ConstraintCodec<unknown, unknown, never, never>,
>(schema: SchemaT) {
  const result = yield* Arbitrary.checkEffect(
    Arbitrary.all([Arbitrary.schema(schema)]),
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* Schema.encodeEffect(schema)(value);
        const decoded = yield* Schema.decodeEffect(schema)(encoded);
        expect(Equal.equals(decoded, value)).toBe(true);

        return true;
      }),
    fcRuns(25)
  );

  expect(result).toMatchObject({ _tag: "Passed" });
});

const assertDecodeFailure = Effect.fn("assertDecodeFailure")(function* <A, E>(decode: Effect.Effect<A, E>) {
  expect(Exit.isFailure(yield* Effect.exit(decode))).toBe(true);
});

describe("Tool validation", () => {
  it.effect("rejects fractional keyword limits at the schema boundary", () =>
    assertDecodeFailure(decodeExtractKeywordsParameters({ text: "hello", topN: 2.5 }))
  );

  it.effect("rejects non-positive chunk limits at the schema boundary", () =>
    assertDecodeFailure(decodeChunkBySentencesParameters({ maxChunkChars: 0, text: "One. Two." }))
  );

  it.effect("rejects invalid BM25 ranges at the schema boundary", () =>
    assertDecodeFailure(
      decodeCreateCorpusParameters({
        bm25Config: {
          b: 2,
          k: 0,
          k1: -1,
        },
      })
    )
  );

  it.effect("defaults Tversky parameters at the schema boundary", () =>
    Effect.gen(function* () {
      expect(yield* decodeTverskySimilarityParameters({ text1: "alpha", text2: "beta" })).toEqual({
        alpha: 0.5,
        beta: 0.5,
        text1: "alpha",
        text2: "beta",
      });
    })
  );

  it.effect("rejects out-of-range similarity scores in tool success schemas", () =>
    Effect.gen(function* () {
      yield* assertDecodeFailure(
        decodeBowCosineSimilaritySuccess({
          method: "bow.cosine",
          score: 1.2,
        })
      );
      yield* assertDecodeFailure(
        decodeTextSimilaritySuccess({
          method: "vector.cosine",
          score: -0.1,
        })
      );
      yield* assertDecodeFailure(
        decodeTverskySimilaritySuccess({
          alpha: 0.5,
          beta: 0.5,
          method: "set.tversky",
          score: 2,
        })
      );
    })
  );

  it.effect("round-trips Tversky success payloads derived from the source schema", () =>
    assertRoundTrip(TverskySimilarity.successSchema)
  );

  it.effect("round-trips wink schema models derived from the source schemas", () =>
    Effect.gen(function* () {
      yield* assertRoundTrip(EntityGroupName);
      yield* assertRoundTrip(InstanceId);
      yield* assertRoundTrip(CustomEntityExample);
      yield* assertRoundTrip(WinkEngineCustomEntities);
      yield* assertRoundTrip(WinkEngineState);
      yield* assertRoundTrip(SentenceSpanFailure);
    })
  );

  it.effect("keeps absorbed wink schema invariants byte-stable at the wire boundary", () =>
    Effect.gen(function* () {
      const entityGroupName = EntityGroupName.make("ProductName");
      const instanceId = InstanceId.make("wink-engine-example-4");
      const customEntityExample = CustomEntityExample.make({
        name: "SKU",
        patterns: ["[PROPN]"],
      });
      const sentenceSpanFailure = SentenceSpanFailure.make({
        reason: "Unable to derive a stable sentence token span.",
        sentenceIndex: SentenceIndex.make(0),
        sentenceText: "Hello world.",
      });
      const corpusManagerError = CorpusManagerError.fromMessage("Corpus does not exist", "support-docs");
      const vectorizerError = VectorizerError.fromMessage("Document index is out of range", "tf");
      const winkError = WinkEngineError.fromCause(new Error("missing model"), "initialize");

      expect(EntityGroupName.is(entityGroupName)).toBe(true);
      expect(InstanceId.is(instanceId)).toBe(true);
      expect(WinkError.is(winkError)).toBe(true);
      expect(yield* encodeEntityGroupName(entityGroupName)).toBe("ProductName");
      expect(yield* encodeInstanceId(instanceId)).toBe("wink-engine-example-4");
      expect(yield* encodeCustomEntityExample(customEntityExample)).toEqual({
        name: "SKU",
        patterns: ["[PROPN]"],
      });
      expect(yield* encodeSentenceSpanFailure(sentenceSpanFailure)).toEqual({
        _tag: "SentenceSpanFailure",
        reason: "Unable to derive a stable sentence token span.",
        sentenceIndex: 0,
        sentenceText: "Hello world.",
      });
      expect(yield* encodeCorpusManagerError(corpusManagerError)).toEqual({
        _tag: "CorpusManagerError",
        corpusId: "support-docs",
        message: "Corpus does not exist",
      });
      expect(yield* encodeVectorizerError(vectorizerError)).toEqual({
        _tag: "VectorizerError",
        message: "Document index is out of range",
        operation: "tf",
      });
    })
  );

  it.effect("rejects invalid custom-entity bracket patterns during engine learning", () =>
    Effect.gen(function* () {
      const brokenEntities = WinkEngineCustomEntities.make({
        name: EntityGroupName.make("custom-entities"),
        patterns: [
          CustomEntityExample.make({
            mark: O.none(),
            name: "BROKEN_ENTITY",
            patterns: ["[NOT_A_TAG]"],
          }),
        ],
      });

      const program = Effect.gen(function* () {
        const engine = yield* WinkEngine;
        yield* engine.learnCustomEntities(brokenEntities);
      }).pipe(provideScopedLayer(WinkEngineLive));
      const exitedProgram = Effect.exit(program);
      const result = yield* exitedProgram;
      const rendered = Exit.match(result, {
        onFailure: Cause.pretty,
        onSuccess: () => "",
      });

      expect(Exit.isFailure(result)).toBe(true);
      expect(rendered).toContain("learnCustomEntities");
      expect(rendered).toContain('incorrect token "not_a_tag"');
    })
  );

  it.effect("returns structured tool failures for expected toolkit errors", () =>
    Effect.gen(function* () {
      const result = yield* Effect.gen(function* () {
        const toolkit = yield* NlpToolkit;
        const stream = yield* toolkit.handle("QueryCorpus", {
          corpusId: "missing-corpus",
          query: "refund policy",
        });
        const results = yield* Stream.runCollect(stream);

        return results[0];
      }).pipe(provideScopedLayer(WinkNlpToolkitLive));

      expect(result?.isFailure).toBe(true);
      expect(result?.result).toMatchObject({
        operation: "corpus.query",
        reason: "CorpusManagerError",
        retryable: false,
        toolName: "QueryCorpus",
      });
      expect(result?.encodedResult).toMatchObject({
        operation: "corpus.query",
        reason: "CorpusManagerError",
        retryable: false,
        toolName: "QueryCorpus",
      });
    })
  );
});
