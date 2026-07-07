/**
 * Office-action review port: the typed contract for the loop orchestrator that
 * reviews a single office action end to end. Given the office action's fixture
 * identity and its source artifact, the review extracts text and spans, maps
 * them into law-practice entities, gates the resulting claims through the
 * epistemic admission lifecycle, and folds the authority into a deterministic
 * projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { OperationId, SourceArtifact } from "@beep/file-processing/Artifact";
import { FileProcessingOperationError } from "@beep/file-processing/Operation";
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LangExtractError } from "@beep/langextract/Extraction";
import { SchemaUtils } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import { IrToLawExtractionError } from "../IrToLaw/index.ts";
import type { ClaimProjectionView } from "@beep/epistemic-domain/values";
import type { Effect } from "effect";

const $I = $LawPracticeUseCasesId.create("OfficeActionReview/OfficeActionReview.ports");

/**
 * Input to one office-action review: the fixture identity of the office action
 * under review, the matter it prosecutes, and the source artifact the loop
 * extracts character-anchored text from.
 *
 * @example
 * ```ts
 * import { ArtifactId, ArtifactLocator, ContentDigest, OperationId, SourceArtifact } from "@beep/file-processing/Artifact"
 * import { OfficeActionReviewInput } from "@beep/law-practice-use-cases/OfficeActionReview"
 * import { NonNegativeInt } from "@beep/schema"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const digestHex = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * const program = Effect.gen(function* () {
 *   const relativePath = yield* S.decodeUnknownEffect(PosixPath)("fixtures/office-action.txt")
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)(`artifact:${digestHex}`)
 *   const digest = yield* S.decodeUnknownEffect(ContentDigest)(`sha256:${digestHex}`)
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)(`operation:${digestHex}`)
 *
 *   return OfficeActionReviewInput.make({
 *     matterFixtureKey: "matter.spike",
 *     officeActionFixtureKey: "office-action.spike",
 *     operationId,
 *     sourceArtifact: SourceArtifact.make({
 *       digest,
 *       extension: "txt",
 *       id: artifactId,
 *       locator: ArtifactLocator.make({ kind: "synthetic", value: relativePath }),
 *       name: "office-action.txt",
 *       relativePath,
 *       sizeBytes: NonNegativeInt.make(21),
 *       text: "Claim 1 rejected."
 *     })
 *   })
 * })
 *
 * Effect.runPromise(program).then((input) => console.log(input.officeActionFixtureKey)) // "office-action.spike"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OfficeActionReviewInput extends S.Class<OfficeActionReviewInput>($I`OfficeActionReviewInput`)(
  {
    matterFixtureKey: S.NonEmptyString.annotateKey({
      description: "Stable fixture key for the prosecuted matter.",
    }),
    officeActionFixtureKey: S.NonEmptyString.annotateKey({
      description: "Stable fixture key for the office action under review.",
    }),
    operationId: OperationId.annotateKey({
      description: "File-processing operation id used to process the source artifact.",
    }),
    sourceArtifact: SourceArtifact.annotateKey({
      description: "Source artifact whose text is extracted for review.",
    }),
  },
  $I.annote("OfficeActionReviewInput", {
    description: "Schema-backed input for reviewing one office-action source artifact.",
  })
) {}

/**
 * Failure raised by the office-action review loop while extracting source text,
 * extracting grounded law labels, or mapping those labels into law entities.
 *
 * @example
 * ```ts
 * import { IrToLawExtractionError } from "@beep/law-practice-use-cases/IrToLaw"
 * import { OfficeActionReviewError } from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * const error = IrToLawExtractionError.fromReason("required-extraction-unaligned", {
 *   alignmentStatus: "unaligned",
 *   label: "distinction",
 *   message: "The distinction could not be grounded."
 * })
 *
 * console.log(OfficeActionReviewError.is(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OfficeActionReviewError = S.Union([
  FileProcessingOperationError,
  LangExtractError,
  IrToLawExtractionError,
]).pipe(
  $I.annoteSchema("OfficeActionReviewError", {
    description: "Failure union for the law-practice office-action review loop.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link OfficeActionReviewError}.
 *
 * @example
 * ```ts
 * import { IrToLawExtractionError } from "@beep/law-practice-use-cases/IrToLaw"
 * import type { OfficeActionReviewError } from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * const error: OfficeActionReviewError = IrToLawExtractionError.fromReason("required-extraction-missing", {
 *   label: "claim",
 *   message: "Missing claim extraction."
 * })
 *
 * console.log(error._tag) // "IrToLawExtractionError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type OfficeActionReviewError = typeof OfficeActionReviewError.Type;

/**
 * Service shape for the office-action review loop: take an
 * {@link OfficeActionReviewInput} and return the epistemic
 * {@link ClaimProjectionView} folded from the reviewed claims.
 *
 * The server Layer satisfying this contract composes `@beep/file-processing`,
 * `@beep/langextract`, the {@link IrToLaw} mapper, and the epistemic `ClaimGate`
 * / `ClaimLifecycle` services. The shape stays driver-neutral so tests can
 * inject deterministic fake extraction output without live provider credentials.
 *
 * @example
 * ```ts
 * import { IrToLawExtractionError } from "@beep/law-practice-use-cases/IrToLaw"
 * import type { OfficeActionReviewShape } from "@beep/law-practice-use-cases/OfficeActionReview"
 * import { Effect } from "effect"
 *
 * const review: OfficeActionReviewShape["review"] = () =>
 *   Effect.fail(
 *     IrToLawExtractionError.fromReason("required-extraction-missing", {
 *       label: "office_action",
 *       message: "Missing office action extraction."
 *     })
 *   )
 *
 * const shape: OfficeActionReviewShape = { review }
 * console.log(typeof shape.review) // "function"
 * ```
 *
 * @effects The `review` method runs the configured file-processing,
 * LangExtract, IR-to-law, claim-gate, and lifecycle services before returning a
 * projection or a typed workflow error.
 * @category services
 * @since 0.0.0
 */
export interface OfficeActionReviewShape {
  readonly review: (input: OfficeActionReviewInput) => Effect.Effect<ClaimProjectionView, OfficeActionReviewError>;
}

/**
 * Office-action review loop service tag.
 *
 * @example
 * ```ts
 * import { IrToLawExtractionError } from "@beep/law-practice-use-cases/IrToLaw"
 * import { OfficeActionReview } from "@beep/law-practice-use-cases/OfficeActionReview"
 * import type { OfficeActionReviewShape } from "@beep/law-practice-use-cases/OfficeActionReview"
 * import { Effect } from "effect"
 *
 * const shape: OfficeActionReviewShape = {
 *   review: () =>
 *     Effect.fail(
 *       IrToLawExtractionError.fromReason("required-extraction-missing", {
 *         label: "claim",
 *         message: "Missing claim extraction."
 *       })
 *     )
 * }
 *
 * const program = Effect.gen(function* () {
 *   const service = yield* OfficeActionReview
 *   return typeof service.review
 * }).pipe(Effect.provideService(OfficeActionReview, shape))
 *
 * Effect.runPromise(program).then(console.log) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OfficeActionReview extends Context.Service<OfficeActionReview, OfficeActionReviewShape>()(
  $I`OfficeActionReview`
) {}
