/**
 * Live LangExtract service implementation and layer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { AlignmentSource, alignCandidates } from "@beep/langextract/Alignment";
import {
  GroundedExtraction,
  LangExtractDiagnostics,
  LangExtractError,
  LangExtractResult,
  parseModelOutput,
} from "@beep/langextract/Extraction";
import { handoff, startExtraction } from "@beep/langextract/Handoff";
import { VerifySourceTextIdentityInput, verifySourceTextIdentity } from "@beep/text/VerifiedTextAnchor";
import * as A from "@beep/utils/Array";
import * as LanguageModel from "effect/ai/LanguageModel";
import * as Model from "effect/ai/Model";
import * as Clock from "effect/Clock";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ensureRemoteExtractionAllowed } from "./Service.policy.ts";
import { buildPrompt } from "./Service.prompt.ts";
import { LangExtractGenerationTimeout, LangExtractRemotePolicy, LangExtractService } from "./Service.service.ts";

const GENERATE_TEXT_TIMEOUT = Duration.seconds(30);

/**
 * Construct the service implementation from an injected language model.
 *
 * **Example** (Construct service from model)
 *
 * ```ts
 * import { make } from "@beep/langextract/Service"
 *
 * console.log(make())
 * ```
 *
 * @effects Reads the injected LanguageModel service from the Effect context.
 * @category constructors
 * @since 0.0.0
 */
export const make = Effect.fn("LangExtractService.make")(function* () {
  const languageModel = yield* LanguageModel.LanguageModel;
  const digest = yield* Digest.Digest;
  const providerName = yield* Model.ProviderName;
  const modelName = yield* Model.ModelName;
  const remotePolicy = yield* Effect.serviceOption(LangExtractRemotePolicy);
  const generationTimeout = (yield* Effect.serviceOption(LangExtractGenerationTimeout)).pipe(
    O.getOrElse(() => GENERATE_TEXT_TIMEOUT)
  );

  return LangExtractService.of({
    extract: Effect.fn("LangExtractService.extract")(function* (request) {
      yield* ensureRemoteExtractionAllowed(remotePolicy, request);
      const verified = yield* verifySourceTextIdentity(
        VerifySourceTextIdentityInput.make({
          expectedSource: request.source,
          source: request.source,
          sourceText: request.text,
        })
      ).pipe(
        Effect.provideService(Digest.Digest, digest),
        Effect.mapError(() =>
          LangExtractError.fromReason("source-text-mismatch", { message: "Text does not match the source capture." })
        )
      );
      const started = yield* Clock.currentTimeMillis;
      const prompt = yield* buildPrompt(request);
      const activity = yield* startExtraction({ prompt, source: request.source, started }).pipe(
        Effect.provideService(Digest.Digest, digest),
        Effect.provideService(Model.ProviderName, providerName),
        Effect.provideService(Model.ModelName, modelName),
        Effect.orDie
      );
      const response = yield* languageModel.generateText({ prompt }).pipe(
        Effect.tapCause(() =>
          Effect.logWarning("LangExtract language-model generation failed.").pipe(
            Effect.annotateLogs({
              "langextract.capture_id": activity.start.used,
              "langextract.operation": "generate_text",
            })
          )
        ),
        Effect.mapError(() =>
          LangExtractError.fromReason("model-generation-failed", {
            details: { cause: "language-model-generate-text-failed" },
            message: "Language model generation failed.",
          })
        ),
        Effect.timeoutOrElse({
          duration: generationTimeout,
          orElse: () =>
            Effect.fail(
              LangExtractError.fromReason("model-generation-timeout", {
                details: { cause: "language-model-generate-text-timeout" },
                message: "Language model generation timed out.",
              })
            ),
        })
      );
      const candidates = yield* parseModelOutput(response.text);
      const extractions = alignCandidates(candidates, AlignmentSource.fromRequest(request));
      const timestamp = yield* Clock.currentTimeMillis;
      const extractionHandoff = yield* handoff({
        targets: request.targets,
        verified,
        candidates: extractions,
        overCap: A.drop(candidates, extractions.length),
        activity,
        at: DateTime.makeUnsafe(timestamp),
      }).pipe(Effect.provideService(Digest.Digest, digest));
      const alignedCount = pipe(
        extractions,
        A.filter(GroundedExtraction.isAnyOf(["match_exact", "match_lesser", "match_minimal_fold", "match_fuzzy"])),
        A.length
      );
      const unalignedCount = Num.subtract(A.length(extractions), alignedCount);

      return LangExtractResult.make({
        handoff: extractionHandoff,
        diagnostics: LangExtractDiagnostics.make({
          alignedCount: S.Natural.make(alignedCount),
          candidateCount: S.Natural.make(A.length(candidates)),
          promptChars: S.Natural.make(Str.length(prompt)),
          unalignedCount: S.Natural.make(unalignedCount),
        }),
      });
    }),
  });
});

/**
 * Layer that provides {@link LangExtractService} from an injected language model.
 *
 * **Example** (Provide service with test model)
 *
 * ```ts
 * import { layer } from "@beep/langextract/Service"
 * import type * as LanguageModel from "effect/ai/LanguageModel"
 * import type * as Model from "effect/ai/Model"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Layer from "effect/Layer"
 *
 * const withModel = (model: Layer.Layer<LanguageModel.LanguageModel | Model.ProviderName | Model.ModelName>) =>
 *   layer.pipe(Layer.provide(Layer.merge(model, Digest.layerWebCrypto)))
 * console.log(typeof withModel)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer: Layer.Layer<
  LangExtractService,
  never,
  LanguageModel.LanguageModel | Model.ProviderName | Model.ModelName | Digest.Digest
> = Layer.effect(LangExtractService, make());
