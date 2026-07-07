/**
 * Office-action review loop implementation.
 *
 * The end-to-end loop for reviewing one office action: extract text through
 * `@beep/file-processing`, invoke `@beep/langextract` for provider-neutral
 * structured extraction, map the resulting grounded extractions into law entities
 * through {@link IrToLaw}, then run the distinction's claim through the
 * epistemic admission lifecycle (gate to transition) and fold the result into a
 * {@link ClaimProjectionView}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CandidateClaim, Evidence } from "@beep/epistemic-domain";
import { projectClaims } from "@beep/epistemic-use-cases/ClaimProjection";
import { ProcessFileResult } from "@beep/file-processing/Extraction";
import { FileProcessingOperationError, ProcessFileOperation } from "@beep/file-processing/Operation";
import { LangExtractRequest } from "@beep/langextract/Extraction";
import { ExtractionTarget } from "@beep/langextract/Target";
import { DocumentId } from "@beep/nlp/Core";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { spikeEntityInput } from "../internal/spikeEntity.ts";
import { OfficeActionExtractionLabel } from "./OfficeActionExtractionLabel.js";
import type { ClaimGateShape } from "@beep/epistemic-use-cases/ClaimGate";
import type { ClaimTransitionShape } from "@beep/epistemic-use-cases/ClaimLifecycle";
import type { FileProcessingServiceShape } from "@beep/file-processing/Service";
import type { LangExtractError, LangExtractResult } from "@beep/langextract/Extraction";
import type { IrToLawShape, LawEntities } from "../IrToLaw/index.ts";
import type { OfficeActionReviewInput, OfficeActionReviewShape } from "./OfficeActionReview.ports.ts";

const decodeCandidateClaim = S.decodeUnknownSync(CandidateClaim);
const decodeEvidence = S.decodeUnknownSync(Evidence);

/**
 * Structured extraction targets required by the office-action review workflow.
 *
 * @example
 * ```ts
 * import { officeActionExtractionTargets } from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * const targetNames = officeActionExtractionTargets.map((target) => target.name)
 * console.log(targetNames.includes("distinction")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const officeActionExtractionTargets: LangExtractRequest["targets"] = [
  ExtractionTarget.make({
    description: "The office-action document identifier or heading.",
    kind: "entity",
    name: OfficeActionExtractionLabel.Enum.office_action,
  }),
  ExtractionTarget.make({
    description: "The rejected claim text.",
    kind: "entity",
    name: OfficeActionExtractionLabel.Enum.claim,
  }),
  ExtractionTarget.make({
    description: "The prior-art reference cited by the rejection.",
    kind: "entity",
    name: OfficeActionExtractionLabel.Enum.rejection_reference,
  }),
  ExtractionTarget.make({
    description: "Applicant distinction text copied from the office-action response material.",
    kind: "custom",
    name: OfficeActionExtractionLabel.Enum.distinction,
  }),
];

const candidateClaimOf = (law: LawEntities): CandidateClaim =>
  decodeCandidateClaim({
    ...spikeEntityInput("EpistemicCandidateClaim", 1),
    fixtureKey: law.distinction.fixtureKey,
    lifecycle: "candidate",
    snapshot: {},
  });

const evidenceOf = (law: LawEntities): Evidence =>
  decodeEvidence({
    ...spikeEntityInput("EpistemicEvidence", 2),
    artifactFixtureKey: law.officeAction.fixtureKey,
    span: {
      confidence: 0.9,
      endChar: law.distinction.anchor.endChar,
      quote: law.distinction.anchor.quote,
      startChar: law.distinction.anchor.startChar,
    },
    spanFixtureKey: law.distinction.fixtureKey,
  });

const failFileExtraction = (
  result: ProcessFileResult,
  message: string
): Effect.Effect<never, FileProcessingOperationError> =>
  Effect.fail(
    FileProcessingOperationError.fromReason("file-extraction-failed", {
      artifactId: result.sourceArtifactId,
      engine: result.engine,
      format: result.format,
      message,
      operationId: result.operationId,
    })
  );

const sourceTextFrom = Effect.fn("law_practice.office_action.source_text_from")(function* (
  result: ProcessFileResult
): Effect.fn.Return<string, FileProcessingOperationError> {
  return yield* ProcessFileResult.match(result, {
    "archive-exported": (archiveExported) =>
      failFileExtraction(
        archiveExported,
        `Office-action review requires extracted text, received ${archiveExported.resultKind}.`
      ),
    extracted: (extracted) =>
      O.match(O.fromUndefinedOr(extracted.extraction.text), {
        onNone: () => failFileExtraction(extracted, "Office-action review requires text extraction output."),
        onSome: Effect.succeed,
      }),
    skipped: (skipped) =>
      failFileExtraction(skipped, `Office-action review requires extracted text, received ${skipped.resultKind}.`),
  });
});

const extractionRequestFrom = (input: OfficeActionReviewInput, sourceText: string): LangExtractRequest =>
  LangExtractRequest.make({
    documentId: DocumentId.make(input.operationId),
    targets: officeActionExtractionTargets,
    text: sourceText,
  });

/**
 * Dependencies the office-action review loop composes: file-processing source
 * extraction, the IR-to-law mapping, plus the epistemic claim gate and
 * lifecycle transition.
 *
 * @example
 * ```ts
 * import type { OfficeActionReviewDeps } from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * type DependencyName = keyof OfficeActionReviewDeps
 * const requiredDeps: ReadonlyArray<DependencyName> = ["fileProcessing", "gate", "irToLaw", "langExtract", "transition"]
 *
 * console.log(requiredDeps.includes("irToLaw")) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface OfficeActionReviewDeps {
  readonly fileProcessing: FileProcessingServiceShape;
  readonly gate: ClaimGateShape;
  readonly irToLaw: IrToLawShape;
  readonly langExtract: {
    readonly extract: (request: LangExtractRequest) => Effect.Effect<LangExtractResult, LangExtractError>;
  };
  readonly transition: ClaimTransitionShape;
}

/**
 * Build the office-action review loop shape from its injected dependencies.
 *
 * @example
 * ```ts
 * import { ArtifactId, ArtifactLocator, ContentDigest, OperationId, SourceArtifact } from "@beep/file-processing/Artifact"
 * import { FileProcessingOperationError } from "@beep/file-processing/Operation"
 * import type { FileProcessingServiceShape } from "@beep/file-processing/Service"
 * import { IrToLawShape } from "@beep/law-practice-use-cases/IrToLaw"
 * import { makeOfficeActionReview } from "@beep/law-practice-use-cases/OfficeActionReview"
 * import { OfficeActionReviewInput } from "@beep/law-practice-use-cases/OfficeActionReview"
 * import type { OfficeActionReviewDeps } from "@beep/law-practice-use-cases/OfficeActionReview"
 * import { NonNegativeInt } from "@beep/schema"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { Effect, Exit } from "effect"
 * import * as S from "effect/Schema"
 *
 * const fileProcessing: FileProcessingServiceShape = {
 *   detect: () => Effect.never,
 *   exportArchive: () => Effect.never,
 *   extract: () => Effect.never,
 *   process: () =>
 *     Effect.fail(
 *       FileProcessingOperationError.fromReason("file-extraction-failed", {
 *         message: "Fixture text unavailable."
 *       })
 *     )
 * }
 *
 * const deps: OfficeActionReviewDeps = {
 *   fileProcessing,
 *   gate: { evaluate: () => Effect.never },
 *   irToLaw: IrToLawShape.make({ toLaw: () => Effect.never }),
 *   langExtract: { extract: () => Effect.never },
 *   transition: { advance: () => Effect.never }
 * }
 *
 * const digestHex = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * const program = Effect.gen(function* () {
 *   const relativePath = yield* S.decodeUnknownEffect(PosixPath)("fixtures/office-action.txt")
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)(`artifact:${digestHex}`)
 *   const digest = yield* S.decodeUnknownEffect(ContentDigest)(`sha256:${digestHex}`)
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)(`operation:${digestHex}`)
 *   const input = OfficeActionReviewInput.make({
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
 *
 *   const exit = yield* Effect.exit(makeOfficeActionReview(deps).review(input))
 *   return Exit.isFailure(exit)
 * })
 *
 * Effect.runPromise(program).then(console.log) // true
 * ```
 *
 * @effects The returned `review` workflow invokes the injected file-processing
 * service, LangExtract service, IR-to-law mapper, claim gate, and lifecycle
 * transition in order.
 * @category constructors
 * @since 0.0.0
 */
export const makeOfficeActionReview = (deps: OfficeActionReviewDeps): OfficeActionReviewShape => ({
  review: Effect.fn("law_practice.office_action.review")(function* (input) {
    const processed = yield* deps.fileProcessing.process(
      ProcessFileOperation.make({
        exportChildren: false,
        operationId: input.operationId,
        operationKind: "process",
        preference: { engine: "auto" },
        source: input.sourceArtifact,
      })
    );
    const sourceText = yield* sourceTextFrom(processed);
    const extractionResult = yield* deps.langExtract.extract(extractionRequestFrom(input, sourceText));

    // Map the grounded extractions into law entities.
    const law = yield* deps.irToLaw.toLaw(extractionResult.extractions);

    // Build the epistemic candidate claim + evidence from the distinction.
    const candidate = candidateClaimOf(law);
    const evidence = evidenceOf(law);

    // Gate the claim: a well-formed span admits it.
    const verdict = yield* deps.gate.evaluate(candidate, [evidence]);

    // Advance the lifecycle. candidate -> shape_valid is always legal, so the
    // impossible ClaimInvalidTransition is a defect (orDie) and E stays never.
    const advanced = yield* deps.transition.advance(candidate, verdict).pipe(Effect.orDie);

    // Fold the single-claim authority into the deterministic projection.
    return projectClaims([advanced]);
  }),
});
