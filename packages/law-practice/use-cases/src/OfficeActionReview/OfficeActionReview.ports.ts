/**
 * Office-action review port: the typed contract for the loop orchestrator that
 * reviews a single office action end to end. Given the office action's fixture
 * identity and its source artifact, the review extracts text and spans, maps
 * them into law-practice entities, proposes the distinction claim in its
 * capture scope and assesses it against the office-action gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CandidateClaim, Evidence } from "@beep/epistemic-domain";
import { OperationId, SourceArtifact } from "@beep/file-processing/Artifact";
import { FileProcessingOperationError } from "@beep/file-processing/Operation";
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { ActivityRecord } from "@beep/jsonc/ActivityRecord";
import { LangExtractError } from "@beep/langextract/Extraction";
import { LawProposedClaimRecord, OfficeActionAssessments } from "@beep/law-practice-domain/values/LawClaim";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ClaimProposalRefused } from "../ClaimProposal/index.ts";
import { LawClaimStoreError } from "../ClaimStore/index.ts";
import { IrToLawExtractionError, LawEntities } from "../IrToLaw/index.ts";
import { PosInt } from "../internal/PosInt.ts";

const $I = $LawPracticeUseCasesId.create("OfficeActionReview/OfficeActionReview.ports");

const officeActionReviewInputEntitySeedDefault = PosInt.make(1);
/**
 * Input to one office-action review: the fixture identity of the office action
 * under review, the matter it prosecutes, and the source artifact the loop
 * extracts character-anchored text from.
 *
 * **Example** (Construct review input fixture)
 *
 * ```ts
 * import { ArtifactId, ArtifactLocator, ContentDigest, OperationId, SourceArtifact } from "@beep/file-processing/Artifact"
 * import { OfficeActionReviewInput } from "@beep/law-practice-use-cases/OfficeActionReview"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import * as Effect from "effect/Effect";
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
 *       sizeBytes: S.Natural.make(21),
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
export class OfficeActionReviewInput extends S.Opaque<OfficeActionReviewInput, { readonly brand: unique symbol }>()(
  S.Struct({
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
    entitySeed: PosInt.pipe(
      S.withConstructorDefault(Effect.succeed(officeActionReviewInputEntitySeedDefault)),
      S.annotateKey({
        description: "Deterministic positive seed used to mint distinct batch entity identities.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(officeActionReviewInputEntitySeedDefault))
    ),
  }).pipe(
    $I.annoteSchema("OfficeActionReviewInput", {
      description: "Schema-backed input for reviewing one office-action source artifact.",
    })
  )
) {}

/**
 * Candidate claim and evidence produced by the grounded extraction phase.
 *
 * **Example** (Read candidate lifecycle field)
 *
 * ```ts
 * import type { OfficeActionCandidateExtraction } from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * const lifecycle = (value: OfficeActionCandidateExtraction) => value.candidate.lifecycle
 * console.log(typeof lifecycle) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OfficeActionCandidateExtraction extends S.Opaque<
  OfficeActionCandidateExtraction,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    candidate: CandidateClaim,
    evidence: Evidence,
  }).pipe(
    $I.annoteSchema("OfficeActionCandidateExtraction", {
      description: "Grounded epistemic candidate and evidence emitted before claim admission.",
    })
  )
) {}

/**
 * What one office-action review produced: the law entities, the proposed
 * claim record appended to its scope's partition, the office-action
 * assessments and the activity log of the Extract, MapToLaw and ProposeClaim
 * runs.
 *
 * **Example** (Name a review result field)
 *
 * ```ts
 * import { OfficeActionReviewResult } from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * console.log(Object.keys(OfficeActionReviewResult.fields)) // ["law", "proposed", "assessments", "activities"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OfficeActionReviewResult extends S.Opaque<OfficeActionReviewResult, { readonly brand: unique symbol }>()(
  S.Struct({
    law: LawEntities,
    proposed: LawProposedClaimRecord,
    assessments: OfficeActionAssessments,
    activities: S.HashSet(ActivityRecord),
  }).pipe(
    $I.annoteSchema("OfficeActionReviewResult", {
      description: "Law entities, proposed claim record, assessments and activity log of one office-action review.",
    })
  )
) {}

/**
 * Failure raised by the office-action review loop while extracting source text,
 * extracting grounded law labels, or mapping those labels into law entities.
 *
 * **Example** (Detect review error type)
 *
 * ```ts
 * import { IrToLawExtractionError } from "@beep/law-practice-use-cases/IrToLaw"
 * import { OfficeActionReviewError } from "@beep/law-practice-use-cases/OfficeActionReview"
 * import * as S from "effect/Schema"
 *
 * const error = IrToLawExtractionError.fromReason("required-extraction-unaligned", {
 *   alignmentStatus: "unaligned",
 *   label: "distinction",
 *   message: "The distinction could not be grounded."
 * })
 *
 * console.log(S.is(OfficeActionReviewError)(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OfficeActionReviewError = S.Union([
  FileProcessingOperationError,
  LangExtractError,
  IrToLawExtractionError,
  ClaimProposalRefused,
  LawClaimStoreError,
]).pipe(
  $I.annoteSchema("OfficeActionReviewError", {
    description: "Failure union for the law-practice office-action review loop.",
  })
);

/**
 * **Example** (Assign typed review error)
 *
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
 * {@link OfficeActionReviewResult}: the proposed claim, its assessments and
 * the activity log.
 *
 * **Details**
 *
 * The server Layer satisfying this contract composes `@beep/file-processing`,
 * `@beep/langextract`, the {@link IrToLaw} mapper, the matter wall and the
 * law claim store. The shape stays driver-neutral so tests can
 * inject deterministic fake extraction output without live provider credentials.
 *
 * **Example** (Stub failing review shape)
 *
 * ```ts
 * import { IrToLawExtractionError } from "@beep/law-practice-use-cases/IrToLaw"
 * import type { OfficeActionReviewShape } from "@beep/law-practice-use-cases/OfficeActionReview"
 * import * as Effect from "effect/Effect";
 * const review: OfficeActionReviewShape["review"] = () =>
 *   Effect.fail(
 *     IrToLawExtractionError.fromReason("required-extraction-missing", {
 *       label: "office_action",
 *       message: "Missing office action extraction."
 *     })
 *   )
 *
 * const shape: OfficeActionReviewShape = { extractCandidate: () => Effect.never, review }
 * console.log(typeof shape.review) // "function"
 * ```
 *
 * @effects The `review` method runs the configured file-processing,
 * LangExtract and IR-to-law services, appends the proposed claim to its
 * scope partition and returns the result or a typed workflow error.
 * @category services
 * @since 0.0.0
 */
export interface OfficeActionReviewShape {
  readonly extractCandidate: (
    input: OfficeActionReviewInput
  ) => Effect.Effect<OfficeActionCandidateExtraction, OfficeActionReviewError>;
  readonly review: (input: OfficeActionReviewInput) => Effect.Effect<OfficeActionReviewResult, OfficeActionReviewError>;
}

/**
 * Office-action review loop service tag.
 *
 * **Example** (Provide tagged review service)
 *
 * ```ts
 * import { IrToLawExtractionError } from "@beep/law-practice-use-cases/IrToLaw"
 * import { OfficeActionReview } from "@beep/law-practice-use-cases/OfficeActionReview"
 * import type { OfficeActionReviewShape } from "@beep/law-practice-use-cases/OfficeActionReview"
 * import * as Effect from "effect/Effect";
 * const shape: OfficeActionReviewShape = {
 *   extractCandidate: () => Effect.never,
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
