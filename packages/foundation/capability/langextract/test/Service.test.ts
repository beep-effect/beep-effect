import { LangExtractError, LangExtractOptions, LangExtractRequest } from "@beep/langextract/Extraction";
import {
  allowRemoteExtractionPolicy,
  allowRemoteExtractionPolicyLayer,
  buildPrompt,
  ensureRemoteExtractionAllowed,
  layer as LangExtractLayer,
  LangExtractService,
} from "@beep/langextract/Service";
import { ExtractionExample, ExtractionExampleItem, ExtractionTarget } from "@beep/langextract/Target";
import { DocumentId } from "@beep/nlp/Core";
import { NonNegativeInt } from "@beep/schema";
import * as O from "@beep/utils/Option";
import { describe, expect, it, layer } from "@effect/vitest";
import { Duration, Effect, Fiber, Layer, Stream } from "effect";
import * as Str from "effect/String";
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

describe("buildPrompt", () => {
  it.effect(
    "renders schema-defaulted targets and few-shot examples without throwing",
    Effect.fnUntraced(function* () {
      const prompt = yield* buildPrompt(
        LangExtractRequest.make({
          documentId: DocumentId.make("doc-1"),
          examples: [
            ExtractionExample.make({
              extractions: [ExtractionExampleItem.make({ label: "person", text: "Ada Lovelace" })],
              text: "Ada Lovelace wrote notes.",
            }),
          ],
          targets: [
            ExtractionTarget.make({
              attributes: ["birth_year"],
              description: O.some("Named people"),
              kind: "entity",
              name: "person",
            }),
          ],
          text: "Grace Hopper wrote compilers.",
        })
      );

      expect(Str.includes("attributes=birth_year")(prompt)).toBe(true);
      expect(Str.includes("description=Named people")(prompt)).toBe(true);
      expect(Str.includes('"text":"Ada Lovelace"')(prompt)).toBe(true);
    })
  );
});

describe("ensureRemoteExtractionAllowed", () => {
  it.effect(
    "supports the data-last policy form",
    Effect.fnUntraced(function* () {
      const request = LangExtractRequest.make({
        documentId: DocumentId.make("doc-1"),
        targets: [ExtractionTarget.make({ kind: "entity", name: "person" })],
        text: "Ada Lovelace wrote notes.",
      });

      yield* ensureRemoteExtractionAllowed(request)(O.some(allowRemoteExtractionPolicy));
    })
  );
});

describe("LangExtractService", () => {
  layer(
    LangExtractLayer.pipe(
      Layer.provide(
        Layer.mergeAll(
          allowRemoteExtractionPolicyLayer,
          makeLanguageModelLayer(
            `{"extractions":[{"label":"person","text":"Alice"},{"label":"organization","text":"Acme"}]}`
          )
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
        expect(result.annotatedDocument.mentions).toHaveLength(2);
        expect(result.annotatedDocument.chunks[0]?.span.end).toBe(Str.length("Alice founded Acme."));
      })
    );

    it.effect(
      "reports diagnostics for capped extraction results",
      Effect.fnUntraced(function* () {
        const request = LangExtractRequest.make({
          documentId: DocumentId.make("doc-1"),
          options: LangExtractOptions.make({ maxExtractions: O.some(NonNegativeInt.make(1)) }),
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

  layer(
    LangExtractLayer.pipe(
      Layer.provide(Layer.mergeAll(allowRemoteExtractionPolicyLayer, makeLanguageModelLayerFromEffect(Effect.never)))
    )
  )("with a stalled fake language model", (it) => {
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
        expect(O.getOrUndefined(error.details)?.cause).toBe("language-model-generate-text-timeout");
      })
    );
  });

  layer(LangExtractLayer.pipe(Layer.provide(makeLanguageModelLayer(`{"extractions":[]}`))))(
    "without an explicit remote policy",
    (it) => {
      it.effect(
        "denies model generation before request text reaches the provider",
        Effect.fnUntraced(function* () {
          const request = LangExtractRequest.make({
            documentId: DocumentId.make("doc-1"),
            targets: [ExtractionTarget.make({ kind: "entity", name: "person" })],
            text: "Alice founded Acme.",
          });

          const service = yield* LangExtractService;
          const error = yield* service.extract(request).pipe(Effect.flip);

          expect(error).toBeInstanceOf(LangExtractError);
          expect(error.reason).toBe("remote-policy-denied");
        })
      );
    }
  );
});
