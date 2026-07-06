/**
 * Effect service layer for provider-neutral LangExtract extraction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LangExtractId } from "@beep/identity";
import { alignCandidates } from "@beep/langextract/Alignment";
import {
  AlignmentStatus,
  LangExtractDiagnostics,
  LangExtractError,
  LangExtractResult,
  parseModelOutput,
} from "@beep/langextract/Extraction";
import { toAnnotatedDocument } from "@beep/langextract/Handoff";
import { NonNegativeInt } from "@beep/schema";
import { Clock, Context, Duration, Effect, Layer } from "effect";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import type { LangExtractRequest } from "@beep/langextract/Extraction";

const $I = $LangExtractId.create("Service");
const GENERATED_BY = "@beep/langextract";
const GENERATE_TEXT_TIMEOUT = Duration.seconds(30);

interface LangExtractServiceShape {
  readonly extract: (request: LangExtractRequest) => Effect.Effect<LangExtractResult, LangExtractError>;
}

/**
 * Provider-neutral LangExtract service tag.
 *
 * @example
 * ```ts
 * import { LangExtractService } from "@beep/langextract/Service"
 * import { LangExtractDiagnostics, LangExtractRequest, LangExtractResult } from "@beep/langextract/Extraction"
 * import { ExtractionTarget } from "@beep/langextract/Target"
 * import { DocumentId } from "@beep/nlp/Core"
 * import { Contract } from "@beep/nlp/Handoff"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect, Layer } from "effect"
 *
 * const documentId = DocumentId.make("doc-1")
 * const provenance = Contract.Provenance.make({
 *   generatedBy: "@beep/langextract:test",
 *   source: documentId,
 *   timestamp: 0
 * })
 * const annotatedDocument = Contract.AnnotatedDocument.make({
 *   chunks: [],
 *   entities: [],
 *   provenance,
 *   relations: [],
 *   version: "nlp-ir/1.0"
 * })
 * const TestLangExtract = Layer.succeed(
 *   LangExtractService,
 *   LangExtractService.of({
 *     extract: (request) =>
 *       Effect.succeed(
 *         LangExtractResult.make({
 *           annotatedDocument,
 *           diagnostics: LangExtractDiagnostics.make({
 *             alignedCount: NonNegativeInt.make(0),
 *             candidateCount: NonNegativeInt.make(0),
 *             promptChars: NonNegativeInt.make(request.text.length),
 *             unalignedCount: NonNegativeInt.make(0)
 *           }),
 *           documentId: request.documentId,
 *           extractions: [],
 *           text: request.text
 *         })
 *       )
 *   })
 * )
 * const request = LangExtractRequest.make({
 *   documentId,
 *   targets: [ExtractionTarget.make({ kind: "entity", name: "person" })],
 *   text: "Ada Lovelace wrote notes."
 * })
 *
 * const program = Effect.gen(function* () {
 *   const service = yield* LangExtractService
 *   return yield* service.extract(request)
 * }).pipe(Effect.provide(TestLangExtract))
 *
 * Effect.runPromise(program).then((result) => console.log(result.documentId))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class LangExtractService extends Context.Service<LangExtractService, LangExtractServiceShape>()(
  $I`LangExtractService`
) {}

const renderTarget = (target: LangExtractRequest["targets"][number]): string => {
  const attributes =
    target.attributes === undefined || target.attributes.length === 0
      ? ""
      : ` attributes=${target.attributes.join(",")}`;
  const description = target.description === undefined ? "" : ` description=${target.description}`;
  return `- ${target.name} kind=${target.kind}${attributes}${description}`;
};

const renderExamples = (request: LangExtractRequest): string => {
  if (request.examples === undefined || request.examples.length === 0) {
    return "";
  }

  return `\nExamples:\n${request.examples
    .map((example) => `${example.text}\n${JSON.stringify({ extractions: example.extractions })}`)
    .join("\n\n")}`;
};

/**
 * Build the deterministic provider-neutral extraction prompt.
 *
 * @example
 * ```ts
 * import { LangExtractRequest } from "@beep/langextract/Extraction"
 * import { buildPrompt } from "@beep/langextract/Service"
 * import { ExtractionTarget } from "@beep/langextract/Target"
 * import { DocumentId } from "@beep/nlp/Core"
 *
 * const request = LangExtractRequest.make({
 *   documentId: DocumentId.make("doc-1"),
 *   targets: [ExtractionTarget.make({ kind: "entity", name: "person" })],
 *   text: "Ada Lovelace wrote notes."
 * })
 * console.log(buildPrompt(request))
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const buildPrompt = (
  request: LangExtractRequest
): string => `Extract structured information from the source text.
Return only JSON using this shape: {"extractions":[{"label":"target-name","text":"source text","attributes":{},"confidence":0.0}]}.
Use exact text copied from the source whenever possible. Do not invent offsets.

Targets:
${request.targets.map(renderTarget).join("\n")}${renderExamples(request)}

Source:
${request.text}`;

/**
 * Construct the service implementation from an injected language model.
 *
 * @example
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

  return LangExtractService.of({
    extract: Effect.fn("LangExtractService.extract")(function* (request) {
      const prompt = buildPrompt(request);
      const response = yield* languageModel.generateText({ prompt }).pipe(
        Effect.mapError(() =>
          LangExtractError.fromReason("model-generation-failed", {
            details: { cause: "language-model-generate-text-failed" },
            message: "Language model generation failed.",
          })
        ),
        Effect.timeoutOrElse({
          duration: GENERATE_TEXT_TIMEOUT,
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
      const extractions = alignCandidates(request.text, candidates, request.options);
      const timestamp = yield* Clock.currentTimeMillis;
      const annotatedDocument = toAnnotatedDocument({
        documentId: request.documentId,
        extractions,
        generatedBy: GENERATED_BY,
        text: request.text,
        timestamp,
      });
      const alignedCount = extractions.filter(
        (extraction) => !AlignmentStatus.is.unaligned(extraction.alignmentStatus)
      ).length;
      const unalignedCount = extractions.length - alignedCount;

      return LangExtractResult.make({
        annotatedDocument,
        diagnostics: LangExtractDiagnostics.make({
          alignedCount: NonNegativeInt.make(alignedCount),
          candidateCount: NonNegativeInt.make(candidates.length),
          promptChars: NonNegativeInt.make(prompt.length),
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
 * @example
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
 *           text: JSON.stringify({ extractions: [{ label: "person", text: "Ada Lovelace" }] })
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
