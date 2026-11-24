/**
 * Context.Service contracts for provider-neutral LangExtract extraction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import * as Context from "effect/Context";
import type { LangExtractError, LangExtractRequest, LangExtractResult } from "@beep/langextract/Extraction";
import type * as Duration from "effect/Duration";
import type * as Effect from "effect/Effect";

const $I = $LangExtractId.create("Service");

/**
 * Contract implemented by the provider-neutral LangExtract service.
 *
 * **Example** (Type a service implementation)
 *
 * ```ts
 * import { LangExtractService } from "@beep/langextract/Service"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const unavailable = Layer.succeed(LangExtractService, LangExtractService.of({
 *   extract: (request) => Effect.die(`No model configured for ${request.source.sourceRef}`)
 * }))
 * console.log(Layer.isLayer(unavailable))
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
 * import * as Effect from "effect/Effect";
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
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const unavailable = Layer.succeed(LangExtractService, LangExtractService.of({
 *   extract: (request) => Effect.die(`No model configured for ${request.source.sourceRef}`)
 * }))
 * console.log(Layer.isLayer(unavailable))
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
 * import * as Layer from "effect/Layer";
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

/**
 * Optional deadline for one language-model generation inside
 * {@link LangExtractService}.
 *
 * **Details**
 *
 * Absence of this service keeps the package default of thirty seconds, which
 * suits short passages. Callers extracting from full documents provide a
 * longer deadline; the timeout still fails typed as
 * `model-generation-timeout`.
 *
 * **Example** (Provide a document-scale generation deadline)
 *
 * ```ts
 * import { LangExtractGenerationTimeout } from "@beep/langextract/Service"
 * import * as Duration from "effect/Duration";
 * import * as Layer from "effect/Layer";
 * const TimeoutLayer = Layer.succeed(LangExtractGenerationTimeout, Duration.minutes(15))
 * console.log(Layer.isLayer(TimeoutLayer)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class LangExtractGenerationTimeout extends Context.Service<LangExtractGenerationTimeout, Duration.Duration>()(
  $I`LangExtractGenerationTimeout`
) {}
