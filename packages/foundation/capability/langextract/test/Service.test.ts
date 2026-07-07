import { LangExtractError, LangExtractOptions, LangExtractRequest } from "@beep/langextract/Extraction";
import { layer as LangExtractLayer, LangExtractService } from "@beep/langextract/Service";
import { ExtractionTarget } from "@beep/langextract/Target";
import { DocumentId } from "@beep/nlp/Core";
import { NonNegativeInt } from "@beep/schema";
import { describe, expect, layer } from "@effect/vitest";
import { Duration, Effect, Fiber, Layer, Stream } from "effect";
import { TestClock } from "effect/testing";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as Response from "effect/unstable/ai/Response";

const TestUsage = Response.Usage.make({
  inputTokens: { cacheRead: undefined, cacheWrite: undefined, total: 0, uncached: 0 },
  outputTokens: { reasoning: undefined, text: 0, total: 0 },
});

const makeLanguageModelLayerFromEffect = (
  effect: Effect.Effect<{ readonly text: string }, never>
): Layer.Layer<LanguageModel.LanguageModel> =>
  Layer.effect(
    LanguageModel.LanguageModel,
    LanguageModel.make({
      generateText: () =>
        Effect.map(effect, ({ text }) => [
          Response.makePart("text", { text }),
          Response.makePart("finish", { reason: "stop", response: undefined, usage: TestUsage }),
        ]),
      streamText: () => Stream.empty,
    })
  );

const makeLanguageModelLayer = (text: string): Layer.Layer<LanguageModel.LanguageModel> =>
  makeLanguageModelLayerFromEffect(Effect.succeed({ text }));

describe("LangExtractService", () => {
  layer(
    LangExtractLayer.pipe(
      Layer.provide(
        makeLanguageModelLayer(
          `{"extractions":[{"label":"person","text":"Alice"},{"label":"organization","text":"Acme"}]}`
        )
      )
    )
  )("with a deterministic fake language model", (it) => {
    it.effect(
      "extracts and emits NLP handoff output",
      Effect.fnUntraced(function* () {
        const request = LangExtractRequest.make({
          documentId: DocumentId.make("doc-1"),
          targets: [ExtractionTarget.make({ kind: "entity", name: "person" })],
          text: "Alice founded Acme.",
        });

        const service = yield* LangExtractService;
        const result = yield* service.extract(request);

        expect(result.extractions).toHaveLength(2);
        expect(result.diagnostics.alignedCount).toBe(2);
        expect(result.annotatedDocument.entities).toHaveLength(2);
        expect(result.annotatedDocument.chunks[0]?.span.end).toBe("Alice founded Acme.".length);
      })
    );

    it.effect(
      "reports diagnostics for capped extraction results",
      Effect.fnUntraced(function* () {
        const request = LangExtractRequest.make({
          documentId: DocumentId.make("doc-1"),
          options: LangExtractOptions.make({ maxExtractions: NonNegativeInt.make(1) }),
          targets: [ExtractionTarget.make({ kind: "entity", name: "person" })],
          text: "Alice founded Acme.",
        });

        const service = yield* LangExtractService;
        const result = yield* service.extract(request);

        expect(result.extractions).toHaveLength(1);
        expect(result.diagnostics.candidateCount).toBe(2);
        expect(result.diagnostics.alignedCount + result.diagnostics.unalignedCount).toBe(1);
      })
    );
  });

  layer(LangExtractLayer.pipe(Layer.provide(makeLanguageModelLayerFromEffect(Effect.never))))(
    "with a stalled fake language model",
    (it) => {
      it.effect(
        "times out model generation",
        Effect.fnUntraced(function* () {
          const request = LangExtractRequest.make({
            documentId: DocumentId.make("doc-1"),
            targets: [ExtractionTarget.make({ kind: "entity", name: "person" })],
            text: "Alice founded Acme.",
          });

          const service = yield* LangExtractService;
          const fiber = yield* service.extract(request).pipe(Effect.flip, Effect.forkChild);

          yield* TestClock.adjust(Duration.seconds(30));

          const error = yield* Fiber.join(fiber);

          expect(error).toBeInstanceOf(LangExtractError);
          expect(error.reason).toBe("model-generation-timeout");
          expect(error.details?.cause).toBe("language-model-generate-text-timeout");
        })
      );
    }
  );
});
