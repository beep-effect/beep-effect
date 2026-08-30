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
import { toAnnotatedDocument } from "@beep/langextract/Handoff";
import { NonNegativeInt } from "@beep/schema/Int";
import * as A from "@beep/utils/Array";
import { Clock, Duration, Effect, Layer, Number as Num } from "effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import { ensureRemoteExtractionAllowed } from "./Service.policy.ts";
import { buildPrompt } from "./Service.prompt.ts";
import { LangExtractGenerationTimeout, LangExtractRemotePolicy, LangExtractService } from "./Service.service.ts";

const GENERATED_BY = "@beep/langextract";
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
  const remotePolicy = yield* Effect.serviceOption(LangExtractRemotePolicy);
  const generationTimeout = (yield* Effect.serviceOption(LangExtractGenerationTimeout)).pipe(
    O.getOrElse(() => GENERATE_TEXT_TIMEOUT)
  );

  return LangExtractService.of({
    extract: Effect.fn("LangExtractService.extract")(function* (request) {
      yield* ensureRemoteExtractionAllowed(remotePolicy, request);
      const prompt = yield* buildPrompt(request);
      const response = yield* languageModel.generateText({ prompt }).pipe(
        Effect.tapCause(() =>
          Effect.logWarning("LangExtract language-model generation failed.").pipe(
            Effect.annotateLogs({
              "langextract.document_id": request.documentId,
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
      const annotatedDocument = toAnnotatedDocument({
        documentId: request.documentId,
        extractions,
        generatedBy: GENERATED_BY,
        text: request.text,
        timestamp,
      });
      const alignedCount = pipe(
        extractions,
        A.filter(GroundedExtraction.isAnyOf(["match_exact", "match_lesser", "match_minimal_fold", "match_fuzzy"])),
        A.length
      );
      const unalignedCount = Num.subtract(A.length(extractions), alignedCount);

      return LangExtractResult.make({
        annotatedDocument,
        diagnostics: LangExtractDiagnostics.make({
          alignedCount: NonNegativeInt.make(alignedCount),
          candidateCount: NonNegativeInt.make(A.length(candidates)),
          promptChars: NonNegativeInt.make(Str.length(prompt)),
          unalignedCount: NonNegativeInt.make(unalignedCount),
        }),
        documentId: request.documentId,
        extractions,
        text: request.text,
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
 * import { LangExtractService, layer } from "@beep/langextract/Service"
 * import { ExtractionTarget } from "@beep/langextract/Target"
 * import { LangExtractRequest } from "@beep/langextract/Extraction"
 * import { DocumentId } from "@beep/nlp/Core"
 * import { Effect, Layer, Stream } from "effect"
 * import { LanguageModel, Response } from "effect/unstable/ai"
 *
 * const usage = Response.Usage.make({
 *   inputTokens: { cacheRead: undefined, cacheWrite: undefined, total: 10, uncached: 10 },
 *   outputTokens: { reasoning: undefined, text: 8, total: 8 }
 * })
 * const TestLanguageModel = Layer.effect(
 *   LanguageModel.LanguageModel,
 *   LanguageModel.make({
 *     generateText: () =>
 *       Effect.succeed([
 *         Response.makePart("text", {
 *           text: '{"extractions":[{"label":"person","text":"Ada Lovelace"}]}'
 *         }),
 *         Response.makePart("finish", { reason: "stop", response: undefined, usage })
 *       ]),
 *     streamText: () => Stream.empty
 *   })
 * )
 * const request = LangExtractRequest.make({
 *   documentId: DocumentId.make("doc-1"),
 *   targets: [ExtractionTarget.make({ kind: "entity", name: "person" })],
 *   text: "Ada Lovelace wrote notes."
 * })
 *
 * const program = Effect.gen(function* () {
 *   const service = yield* LangExtractService
 *   const result = yield* service.extract(request)
 *   return result.diagnostics.alignedCount
 * }).pipe(Effect.provide(layer), Effect.provide(TestLanguageModel))
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer: Layer.Layer<LangExtractService, never, LanguageModel.LanguageModel> = Layer.effect(
  LangExtractService,
  make()
);
