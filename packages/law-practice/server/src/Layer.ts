/**
 * Law-practice server layer.
 *
 * **Details**
 *
 * Composes the slice's live service surface: the `IrToLaw` mapping (pure, no
 * dependencies), the file-processing capability backed by the P1 Tika engine,
 * the provider-neutral LangExtract service, the in-memory law claim store and
 * the `OfficeActionReview` loop, which proposes each distinction claim in its
 * capture scope behind the matter wall.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { FileProcessingService, makeFileProcessingServiceLayer } from "@beep/file-processing/Service";
import {
  layer as LangExtractLayer,
  LangExtractService,
  remoteExtractionPolicyFromConfig,
} from "@beep/langextract/Service";
import { LawClaimProposals } from "@beep/law-practice-use-cases/ClaimStore";
import { IrToLaw, makeIrToLaw } from "@beep/law-practice-use-cases/IrToLaw";
import { LawPrincipal, MatterAuthority } from "@beep/law-practice-use-cases/MatterWall";
import { makeOfficeActionReview, OfficeActionReview } from "@beep/law-practice-use-cases/OfficeActionReview";
import { TikaFileProcessingEngine } from "@beep/tika";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { LawClaimStoreMemory } from "./ClaimStore/index.ts";
import { ProvenanceTraversalLive } from "./ProvenanceTraversal/index.ts";
import type { LawClaimAdmissions } from "@beep/law-practice-use-cases/ClaimStore";
import type { ProvenanceTraversal } from "@beep/law-practice-use-cases/ProvenanceTraversal";
import type * as LanguageModel from "effect/ai/LanguageModel";
import type * as Model from "effect/ai/Model";
import type * as Config from "effect/Config";

const IrToLawLayer = Layer.succeed(IrToLaw, IrToLaw.of(makeIrToLaw()));
const FileProcessingLayer = makeFileProcessingServiceLayer([TikaFileProcessingEngine]);
const GuardedLangExtractLayer = LangExtractLayer.pipe(Layer.provide(remoteExtractionPolicyFromConfig));

const OfficeActionReviewLayer = Layer.effect(
  OfficeActionReview,
  Effect.gen(function* () {
    const fileProcessing = yield* FileProcessingService;
    const irToLaw = yield* IrToLaw;
    const digest = yield* Digest.Digest;
    const langExtract = yield* LangExtractService;
    const authority = yield* MatterAuthority;
    const { principal } = yield* LawPrincipal;
    const proposals = yield* LawClaimProposals;
    return OfficeActionReview.of(
      makeOfficeActionReview({ authority, digest, fileProcessing, irToLaw, langExtract, principal, proposals })
    );
  })
);

// decision: provide-merge-keeps-ir-to-law-without-racing
const reviewLoopWithIrToLaw = OfficeActionReviewLayer.pipe(Layer.provideMerge(IrToLawLayer));

/**
 * Live law-practice server layer providing the IR-to-law mapping, the
 * in-memory law claim store, the office-action review loop over
 * provider-neutral extraction and the walled claim provenance traversal.
 *
 * **Details**
 *
 * Hosts must merge in a `LanguageModel.LanguageModel` provider, a
 * `Digest.Digest` provider (e.g. `BunCrypto.layer`), the `MatterAuthority`
 * and the `LawPrincipal` the review runs as; this layer keeps model selection,
 * the runtime crypto primitive and the matter wall outside law-practice while
 * LangExtract consumes the model provider for structured extraction only when
 * `BEEP_LANGEXTRACT_ALLOW_REMOTE=true`. Admission is not part of this layer:
 * no host admits in P6 (decision `p6-law-admission-stays-out-of-the-host-layer`).
 *
 * **Example** (Log the live layer)
 *
 * ```ts
 * import { LawPracticeServerLive } from "@beep/law-practice-server/layer"
 *
 * console.log(LawPracticeServerLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const LawPracticeServerLive: Layer.Layer<
  OfficeActionReview | ProvenanceTraversal | IrToLaw | LawClaimProposals | LawClaimAdmissions,
  Config.ConfigError,
  LanguageModel.LanguageModel | Model.ProviderName | Model.ModelName | Digest.Digest | MatterAuthority | LawPrincipal
> = Layer.merge(reviewLoopWithIrToLaw, ProvenanceTraversalLive).pipe(
  Layer.provideMerge(LawClaimStoreMemory),
  Layer.provide(FileProcessingLayer),
  Layer.provide(GuardedLangExtractLayer)
);

/** Explicit citation engine configuration and captured live operation Layer.
 * **Example** (Inspect the citation Layer factory)
 * ```ts
 * import { CitationEngineLive } from "@beep/law-practice-server/layer"
 * console.log(typeof CitationEngineLive) // "function"
 * ```
 * @category layers
 * @since 0.0.0
 */
export {
  CitationEngineConfiguration,
  CitationEngineDefaultConfiguration,
  CitationEngineDefaultLive,
  CitationEngineLive,
} from "./CitationEngine/CitationEngine.layer.ts";
/** Six-form plain-text extraction with verified original source and local links.
 * **Example** (Inspect the bounded extraction Layer)
 * ```ts
 * import { CitationExtractorLive } from "@beep/law-practice-server/layer"
 * console.log(typeof CitationExtractorLive) // "function"
 * ```
 * @category layers
 * @since 0.0.0
 */
export { CitationExtractorConfiguration, CitationExtractorLive } from "./CitationExtractor/CitationExtractor.layer.ts";
