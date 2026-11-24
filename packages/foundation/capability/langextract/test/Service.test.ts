import { LangExtractError, LangExtractOptions } from "@beep/langextract/Extraction";
import {
  allowRemoteExtractionPolicy,
  allowRemoteExtractionPolicyLayer,
  layer as BaseLangExtractLayer,
  buildPrompt,
  ensureRemoteExtractionAllowed,
  LangExtractGenerationTimeout,
  LangExtractService,
} from "@beep/langextract/Service";
import { ExtractionExample, ExtractionExampleItem } from "@beep/langextract/Target";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { it } from "@beep/test-runner";
import * as O from "@beep/utils/Option";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as AiError from "effect/ai/AiError";
import * as LanguageModel from "effect/ai/LanguageModel";
import * as Model from "effect/ai/Model";
import * as Response from "effect/ai/Response";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { makeRequest, makeTarget } from "./support/handoff.ts";

const LangExtractLayer = BaseLangExtractLayer.pipe(
  Layer.provide(
    Layer.mergeAll(
      Layer.succeed(Model.ProviderName, "test"),
      Layer.succeed(Model.ModelName, "stub-model"),
      Digest.layerWebCrypto
    )
  )
);

const generationFailure = AiError.AiError.make({
  module: "stub",
  method: "generateText",
  reason: AiError.UnknownError.make({ description: "synthetic failure" }),
});

const TestUsage = Response.Usage.make({
  inputTokens: { cacheRead: undefined, cacheWrite: undefined, total: 0, uncached: 0 },
  outputTokens: { reasoning: undefined, text: 0, total: 0 },
});

const makeLanguageModelLayerFromEffect = (
  effect: Effect.Effect<{ readonly text: string }, AiError.AiError>
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

class GenerationCalls extends Context.Service<GenerationCalls, Ref.Ref<number>>()(
  "@beep/langextract/test/Service.test/GenerationCalls"
) {}

const RecordedLanguageModelTest = Layer.unwrap(
  Effect.map(GenerationCalls, (calls) =>
    makeLanguageModelLayerFromEffect(Ref.update(calls, Num.increment).pipe(Effect.as({ text: `{"extractions":[]}` })))
  )
).pipe(Layer.provideMerge(Layer.effect(GenerationCalls, Ref.make(0))));

class GenerationStarted extends Context.Service<GenerationStarted, Deferred.Deferred<void>>()(
  "@beep/langextract/test/Service.test/GenerationStarted"
) {}
const stalledLanguageModel = Layer.unwrap(
  Effect.map(GenerationStarted, (started) =>
    makeLanguageModelLayerFromEffect(Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never)))
  )
).pipe(Layer.provideMerge(Layer.effect(GenerationStarted, Deferred.make<void>())));

describe("buildPrompt", () => {
  it.effect(
    "renders schema-defaulted targets and few-shot examples without throwing",
    Effect.fnUntraced(function* () {
      const prompt = yield* buildPrompt(
        makeRequest({
          examples: [
            ExtractionExample.make({
              extractions: [ExtractionExampleItem.make({ label: "person", text: "Ada Lovelace" })],
              text: "Ada Lovelace wrote notes.",
            }),
          ],
          targets: [
            makeTarget({
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
      const request = makeRequest({
        targets: [makeTarget({ kind: "entity", name: "person" })],
        text: "Ada Lovelace wrote notes.",
      });

      yield* ensureRemoteExtractionAllowed(request)(O.some(allowRemoteExtractionPolicy));
    })
  );
});

describe("LangExtractService", () => {
  it.layer(
    LangExtractLayer.pipe(
      Layer.provide(
        Layer.mergeAll(
          allowRemoteExtractionPolicyLayer,
          makeLanguageModelLayer(
            `{"extractions":[{"label":"person","text":"Alice"},{"label":"organization","text":"Acme","attributes":{"kind":"company"},"confidence":0.8}]}`
          )
        )
      )
    ),
    { timeout: "10 seconds" }
  )("with a deterministic fake language model", (it) => {
    it.effect(
      "extracts and emits NLP handoff output",
      Effect.fnUntraced(function* () {
        const request = makeRequest({
          targets: [makeTarget({ kind: "entity", name: "person" })],
          text: "Alice founded Acme.",
        });

        const service = yield* LangExtractService;
        const result = yield* service.extract(request);

        expect(result.handoff.candidateCount).toBe(2);
        expect(result.diagnostics.alignedCount).toBe(2);
        expect(HashMap.size(result.handoff.document.annotations)).toBe(1);
        expect(result.handoff.residual).toHaveLength(1);
        expect(HashMap.size(result.handoff.document.anchors)).toBe(1);
      })
    );

    it.effect(
      "reports diagnostics for capped extraction results",
      Effect.fnUntraced(function* () {
        const request = makeRequest({
          options: LangExtractOptions.make({ maxExtractions: S.Natural.makeOption(1) }),
          targets: [makeTarget({ kind: "entity", name: "person" })],
          text: "Alice founded Acme.",
        });

        const service = yield* LangExtractService;
        const result = yield* service.extract(request);

        expect(result.handoff.candidateCount).toBe(2);
        expect(result.handoff.candidateCount).toBe(result.diagnostics.candidateCount);
        expect(result.handoff.residual).toHaveLength(1);
        expect(result.handoff.residual[0]?.reason).toBe("over-extraction-cap");
        expect(result.handoff.residual[0]?.text).toBe("Acme");
        const skipped = O.getOrThrow(A.head(result.handoff.residual));
        assertSome(skipped.attributes, { kind: "company" });
        assertSome(skipped.confidence, UnitInterval.make(0.8));
        assertNone(skipped.anchor);
        expect(result.diagnostics.candidateCount).toBe(2);
        expect(result.diagnostics.alignedCount + result.diagnostics.unalignedCount).toBe(1);
      })
    );
  });

  it.layer(
    LangExtractLayer.pipe(Layer.provideMerge(Layer.mergeAll(allowRemoteExtractionPolicyLayer, stalledLanguageModel))),
    { timeout: "10 seconds" }
  )("with a stalled fake language model", (it) => {
    it.effect(
      "times out model generation",
      Effect.fnUntraced(function* () {
        const request = makeRequest({
          targets: [makeTarget({ kind: "entity", name: "person" })],
          text: "Alice founded Acme.",
        });

        const service = yield* LangExtractService;
        const started = yield* GenerationStarted;
        const fiber = yield* service.extract(request).pipe(Effect.flip, Effect.forkChild);
        yield* Deferred.await(started);

        yield* TestClock.adjust(Duration.seconds(30));

        const error = yield* Fiber.join(fiber);

        expect(error).toBeInstanceOf(LangExtractError);
        expect(error.reason).toBe("model-generation-timeout");
        expect(O.getOrUndefined(error.details)?.cause).toBe("language-model-generate-text-timeout");
      })
    );
  });

  it.layer(
    LangExtractLayer.pipe(
      Layer.provideMerge(
        Layer.mergeAll(
          allowRemoteExtractionPolicyLayer,
          stalledLanguageModel,
          Layer.succeed(LangExtractGenerationTimeout, Duration.minutes(10))
        )
      )
    ),
    { timeout: "10 seconds" }
  )("with a stalled fake language model and a provided generation timeout", (it) => {
    it.effect(
      "outlives the default deadline and times out at the provided one",
      Effect.fnUntraced(function* () {
        const request = makeRequest({
          targets: [makeTarget({ kind: "entity", name: "person" })],
          text: "Alice founded Acme.",
        });

        const service = yield* LangExtractService;
        const started = yield* GenerationStarted;
        const fiber = yield* service.extract(request).pipe(Effect.flip, Effect.forkChild);
        yield* Deferred.await(started);

        yield* TestClock.adjust(Duration.seconds(30));
        expect(fiber.pollUnsafe()).toBeUndefined();

        yield* TestClock.adjust(Duration.minutes(10));

        const error = yield* Fiber.join(fiber);

        expect(error).toBeInstanceOf(LangExtractError);
        expect(error.reason).toBe("model-generation-timeout");
      })
    );
  });

  it.layer(LangExtractLayer.pipe(Layer.provideMerge(RecordedLanguageModelTest)), { timeout: "10 seconds" })(
    "without an explicit remote policy",
    (it) => {
      it.effect(
        "denies model generation before request text reaches the provider",
        Effect.fnUntraced(function* () {
          const request = makeRequest({
            targets: [makeTarget({ kind: "entity", name: "person" })],
            text: "Alice founded Acme.",
          });

          const service = yield* LangExtractService;
          const error = yield* service.extract(request).pipe(Effect.flip);

          expect(error).toBeInstanceOf(LangExtractError);
          expect(error.reason).toBe("remote-policy-denied");
          const GenerationCalls3 = yield* GenerationCalls;
          const got = yield* Ref.get(GenerationCalls3);
          expect(got).toBe(0);
        })
      );
    }
  );
  it.layer(
    LangExtractLayer.pipe(
      Layer.provide(Layer.merge(allowRemoteExtractionPolicyLayer, makeLanguageModelLayerFromEffect(generationFailure)))
    ),
    { timeout: "10 seconds" }
  )("with a failing model", (it) => {
    it.effect(
      "maps model generation failure to a sanitized boundary error",
      Effect.fnUntraced(function* () {
        const service = yield* LangExtractService;
        const request = makeRequest({
          targets: [makeTarget({ kind: "entity", name: "person" })],
          text: "Alice founded Acme.",
        });
        const error = yield* service.extract(request).pipe(Effect.flip);
        expect(error.reason).toBe("model-generation-failed");
        expect(O.getOrUndefined(error.details)?.cause).toBe("language-model-generate-text-failed");
      })
    );
  });
});

it.layer(
  LangExtractLayer.pipe(
    Layer.provideMerge(Layer.mergeAll(allowRemoteExtractionPolicyLayer, RecordedLanguageModelTest))
  ),
  { timeout: "10 seconds" }
)("with an allowed recorded provider", (it) => {
  it.effect(
    "records model generation when remote policy permits the request",
    Effect.fnUntraced(function* () {
      const calls = yield* GenerationCalls;
      const got1 = yield* Ref.get(calls);
      expect(got1).toBe(0);
      const service = yield* LangExtractService;
      const result = yield* service.extract(
        makeRequest({
          targets: [makeTarget({ kind: "entity", name: "person" })],
          text: "Alice founded Acme.",
        })
      );
      expect(result.handoff.candidateCount).toBe(0);
      const got2 = yield* Ref.get(calls);
      expect(got2).toBe(1);
    })
  );
});
