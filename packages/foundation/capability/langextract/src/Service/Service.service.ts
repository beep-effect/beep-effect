/**
 * Context.Service contracts for provider-neutral LangExtract extraction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import * as Context from "effect/Context";
import type { LangExtractError, LangExtractRequest, LangExtractResult } from "@beep/langextract/Extraction";
import type * as Effect from "effect/Effect";

const $I = $LangExtractId.create("Service");

/**
 * Contract implemented by the provider-neutral LangExtract service.
 *
 * **Example** (Type a service implementation)
 *
 * ```ts
 * import { LangExtractService } from "@beep/langextract/Service"
 * import type { LangExtractServiceShape } from "@beep/langextract/Service"
 * import { Effect } from "effect"
 *
 * const shape: LangExtractServiceShape = {
 *   extract: (request) => Effect.die(`unimplemented: ${request.documentId}`),
 * }
 * console.log(LangExtractService.of(shape))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface LangExtractServiceShape {
  readonly extract: (request: LangExtractRequest) => Effect.Effect<LangExtractResult, LangExtractError>;
}

/**
 * Contract consulted before source text is sent to a remote language model.
 *
 * **Example** (Type a policy implementation)
 *
 * ```ts
 * import { LangExtractRemotePolicy } from "@beep/langextract/Service"
 * import type { LangExtractRemotePolicyShape } from "@beep/langextract/Service"
 * import { Effect } from "effect"
 *
 * const shape: LangExtractRemotePolicyShape = {
 *   allowRemoteExtraction: () => Effect.succeed(false),
 * }
 * console.log(LangExtractRemotePolicy.of(shape))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface LangExtractRemotePolicyShape {
  readonly allowRemoteExtraction: (request: LangExtractRequest) => Effect.Effect<boolean>;
}

/**
 * Provider-neutral LangExtract service tag.
 *
 * **Example** (Mock service extract layer)
 *
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

/**
 * Policy service consulted before source text is sent to the injected language
 * model. Absence of this service denies remote extraction by default.
 *
 * **Example** (Allow remote policy layer)
 *
 * ```ts
 * import { LangExtractRemotePolicy, allowRemoteExtractionPolicy } from "@beep/langextract/Service"
 * import { Layer } from "effect"
 *
 * const PolicyLayer = Layer.succeed(LangExtractRemotePolicy, allowRemoteExtractionPolicy)
 * console.log(PolicyLayer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class LangExtractRemotePolicy extends Context.Service<LangExtractRemotePolicy, LangExtractRemotePolicyShape>()(
  $I`LangExtractRemotePolicy`
) {}
