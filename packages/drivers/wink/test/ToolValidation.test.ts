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
import { Cause, Effect, Equal, Exit, Layer, Schema, Stream } from "effect";
import * as O from "effect/Option";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const assertRoundTrip = <SchemaT extends Schema.ConstraintCodec<unknown, unknown, never, never>>(
  schema: SchemaT
): void => {
  const decode = Schema.decodeUnknownSync(schema);
  const encode = Schema.encodeSync(schema);

  fc.assert(
    fc.property(Schema.toArbitrary(schema)(fc), (value) => {
      expect(Equal.equals(decode(encode(value)), value)).toBe(true);
    }),
    fcRuns(25)
  );
};

describe("Tool validation", () => {
  it("rejects fractional keyword limits at the schema boundary", () => {
    expect(() => Schema.decodeSync(ExtractKeywords.parametersSchema)({ text: "hello", topN: 2.5 })).toThrow();
  });

  it("rejects non-positive chunk limits at the schema boundary", () => {
    expect(() =>
      Schema.decodeSync(ChunkBySentences.parametersSchema)({ maxChunkChars: 0, text: "One. Two." })
    ).toThrow();
  });

  it("rejects invalid BM25 ranges at the schema boundary", () => {
    expect(() =>
      Schema.decodeSync(CreateCorpus.parametersSchema)({
        bm25Config: {
          b: 2,
          k: 0,
          k1: -1,
        },
      })
    ).toThrow();
  });

  it("defaults Tversky parameters at the schema boundary", () => {
    expect(Schema.decodeSync(TverskySimilarity.parametersSchema)({ text1: "alpha", text2: "beta" })).toEqual({
      alpha: 0.5,
      beta: 0.5,
      text1: "alpha",
      text2: "beta",
    });
  });

  it("rejects out-of-range similarity scores in tool success schemas", () => {
    expect(() =>
      Schema.decodeSync(BowCosineSimilarity.successSchema)({
        method: "bow.cosine",
        score: 1.2,
      })
    ).toThrow();
    expect(() =>
      Schema.decodeSync(TextSimilarity.successSchema)({
        method: "vector.cosine",
        score: -0.1,
      })
    ).toThrow();
    expect(() =>
      Schema.decodeSync(TverskySimilarity.successSchema)({
        alpha: 0.5,
        beta: 0.5,
        method: "set.tversky",
        score: 2,
      })
    ).toThrow();
  });

  it("round-trips Tversky success payloads derived from the source schema", () => {
    assertRoundTrip(TverskySimilarity.successSchema);
  });

  it("round-trips wink schema models derived from the source schemas", () => {
    assertRoundTrip(EntityGroupName);
    assertRoundTrip(InstanceId);
    assertRoundTrip(CustomEntityExample);
    assertRoundTrip(WinkEngineCustomEntities);
    assertRoundTrip(WinkEngineState);
    assertRoundTrip(SentenceSpanFailure);
  });

  it("keeps absorbed wink schema invariants byte-stable at the wire boundary", () => {
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
    expect(Schema.encodeSync(EntityGroupName)(entityGroupName)).toBe("ProductName");
    expect(Schema.encodeSync(InstanceId)(instanceId)).toBe("wink-engine-example-4");
    expect(Schema.encodeSync(CustomEntityExample)(customEntityExample)).toEqual({
      name: "SKU",
      patterns: ["[PROPN]"],
    });
    expect(Schema.encodeSync(SentenceSpanFailure)(sentenceSpanFailure)).toEqual({
      _tag: "SentenceSpanFailure",
      reason: "Unable to derive a stable sentence token span.",
      sentenceIndex: 0,
      sentenceText: "Hello world.",
    });
    expect(Schema.encodeSync(CorpusManagerError)(corpusManagerError)).toEqual({
      _tag: "CorpusManagerError",
      corpusId: "support-docs",
      message: "Corpus does not exist",
    });
    expect(Schema.encodeSync(VectorizerError)(vectorizerError)).toEqual({
      _tag: "VectorizerError",
      message: "Document index is out of range",
      operation: "tf",
    });
  });

  it("rejects invalid custom-entity bracket patterns during engine learning", () =>
    Effect.runPromise(
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
    ));

  it("returns structured tool failures for expected toolkit errors", () =>
    Effect.runPromise(
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
    ));
});
