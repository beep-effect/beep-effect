/**
 * Office-action review loop implementation.
 *
 * **Details**
 *
 * The end-to-end loop for reviewing one office action: extract text through
 * `@beep/file-processing`, invoke `@beep/langextract` for provider-neutral
 * structured extraction, map the verified annotation handoff into law entities
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
import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { LangExtractRequest } from "@beep/langextract/Extraction";
import { ExtractionTarget, TargetAnnotation } from "@beep/langextract/Target";
import {
  SourceTextDigest,
  SourceTextExtractor,
  SourceTextIdentity,
  SourceTextLocator,
} from "@beep/text/SourceTextIdentity";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { spikeEntityInput } from "../internal/spikeEntity.ts";
import { OfficeActionExtractionLabel } from "./OfficeActionExtractionLabel.ts";
import { OfficeActionCandidateExtraction } from "./OfficeActionReview.ports.ts";
import type { ClaimGateShape } from "@beep/epistemic-use-cases/ClaimGate";
import type { ClaimTransitionShape } from "@beep/epistemic-use-cases/ClaimLifecycle";
import type { ExtractedProcessFileResult } from "@beep/file-processing/Extraction";
import type { FileProcessingServiceShape } from "@beep/file-processing/Service";
import type { LangExtractError, LangExtractResult } from "@beep/langextract/Extraction";
import type { IrToLawShape, LawEntities } from "../IrToLaw/index.ts";
import type { OfficeActionReviewInput, OfficeActionReviewShape } from "./OfficeActionReview.ports.ts";

const decodeCandidateClaim = S.decodeUnknownEffect(CandidateClaim);
const decodeEvidence = S.decodeUnknownEffect(Evidence);

/**
 * Structured extraction targets required by the office-action review workflow.
 *
 * **Example** (Check distinction target name)
 *
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
    description: O.some("The office-action document identifier or heading."),
    kind: "entity",
    name: OfficeActionExtractionLabel.Enum.office_action,
    annotates: TargetAnnotation.cases.Mention.make({ class: TermIri.make(iri("office-action:office_action")) }),
  }),
  ExtractionTarget.make({
    description: O.some("The rejected claim text."),
    kind: "entity",
    name: OfficeActionExtractionLabel.Enum.claim,
    annotates: TargetAnnotation.cases.Mention.make({ class: TermIri.make(iri("office-action:claim")) }),
  }),
  ExtractionTarget.make({
    description: O.some("The prior-art reference cited by the rejection."),
    kind: "entity",
    name: OfficeActionExtractionLabel.Enum.rejection_reference,
    annotates: TargetAnnotation.cases.Mention.make({ class: TermIri.make(iri("office-action:rejection_reference")) }),
  }),
  ExtractionTarget.make({
    description: O.some("Applicant distinction text copied from the office-action response material."),
    kind: "custom",
    name: OfficeActionExtractionLabel.Enum.distinction,
    annotates: TargetAnnotation.cases.Mention.make({ class: TermIri.make(iri("office-action:distinction")) }),
  }),
];

const candidateClaimOf = Effect.fnUntraced(function* (law: LawEntities, entitySeed: number) {
  return yield* decodeCandidateClaim({
    ...spikeEntityInput("EpistemicCandidateClaim", entitySeed * 10),
    fixtureKey: law.distinction.fixtureKey,
    lifecycle: "candidate",
    snapshot: {
      claimText: law.claim.text,
      distinction: law.distinction.anchor.quote,
    },
  }).pipe(Effect.orDie);
});

const evidenceOf = Effect.fnUntraced(function* (law: LawEntities, entitySeed: number) {
  return yield* decodeEvidence({
    ...spikeEntityInput("EpistemicEvidence", entitySeed * 10 + 1),
    artifactFixtureKey: law.officeAction.fixtureKey,
    span: {
      version: "evidence-position/v2",
      position: law.distinction.anchor,
      extractorConfidence: { _tag: "Absent", reason: "not-assessed" },
    },
    spanFixtureKey: law.distinction.fixtureKey,
  }).pipe(Effect.orDie);
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
): Effect.fn.Return<readonly [ExtractedProcessFileResult, string], FileProcessingOperationError> {
  return yield* ProcessFileResult.match(result, {
    "archive-exported": (archiveExported) =>
      failFileExtraction(
        archiveExported,
        `Office-action review requires extracted text, received ${archiveExported.resultKind}.`
      ),
    extracted: (extracted) =>
      O.match(O.fromUndefinedOr(extracted.extraction.text), {
        onNone: () => failFileExtraction(extracted, "Office-action review requires text extraction output."),
        onSome: (sourceText) => Effect.succeed([extracted, sourceText] as const),
      }),
    skipped: (skipped) =>
      failFileExtraction(skipped, `Office-action review requires extracted text, received ${skipped.resultKind}.`),
  });
});

const utf8 = new TextEncoder();
const extractionRequestFrom = Effect.fn("OfficeActionReview.extractionRequestFrom")(function* (
  input: OfficeActionReviewInput,
  sourceText: string,
  processed: ExtractedProcessFileResult
) {
  const version = yield* O.match(O.fromUndefinedOr(processed.extraction.engineVersion), {
    onNone: () => failFileExtraction(processed, "Office-action review requires a versioned extractor."),
    onSome: Effect.succeed,
  });
  const digest = yield* Digest.Digest;
  const textDigest = yield* digest.digestHex(Digest.sha256, utf8.encode(sourceText));
  const source = SourceTextIdentity.make({
    scopeRef: input.matterFixtureKey,
    sourceRef: input.sourceArtifact.id,
    locator: SourceTextLocator.make(input.sourceArtifact.relativePath),
    sourceDigest: SourceTextDigest.make(input.sourceArtifact.digest),
    textDigest: SourceTextDigest.make(`sha256:${textDigest}`),
    extractor: SourceTextExtractor.make({ name: processed.engine, version }),
    normalizationVersion: "raw/1",
  });
  return LangExtractRequest.make({ source, targets: officeActionExtractionTargets, text: sourceText });
});

/**
 * Dependencies the office-action review loop composes: file-processing source
 * extraction, the IR-to-law mapping, plus the epistemic claim gate and
 * lifecycle transition.
 *
 * **Example** (List dependency key names)
 *
 * ```ts
 * import type { OfficeActionReviewDeps } from "@beep/law-practice-use-cases/OfficeActionReview"
 * import * as Digest from "effect/crypto/Digest"
 *
 * type DependencyName = keyof OfficeActionReviewDeps
 * const requiredDeps: ReadonlyArray<DependencyName> = ["digest", "fileProcessing", "gate", "irToLaw", "langExtract", "transition"]
 *
 * console.log(requiredDeps.includes("irToLaw")) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface OfficeActionReviewDeps {
  readonly digest: Digest.Digest["Service"];
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
 * **Example** (Review fails without extract)
 *
 * ```ts
 * import { makeOfficeActionReview } from "@beep/law-practice-use-cases/OfficeActionReview"
 * import type { OfficeActionReviewDeps, OfficeActionReviewInput } from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * const reviewWith = (deps: OfficeActionReviewDeps, input: OfficeActionReviewInput) =>
 *   makeOfficeActionReview(deps).review(input)
 * console.log(typeof reviewWith)
 * ```
 *
 * @effects The returned `review` workflow invokes the injected file-processing
 * service, LangExtract service, IR-to-law mapper, claim gate, and lifecycle
 * transition in order.
 * @category constructors
 * @since 0.0.0
 */
export const makeOfficeActionReview = (deps: OfficeActionReviewDeps): OfficeActionReviewShape => {
  const extractCandidate = Effect.fn("law_practice.office_action.extract_candidate")(function* (
    input: OfficeActionReviewInput
  ) {
    const processed = yield* deps.fileProcessing.process(
      ProcessFileOperation.make({
        exportChildren: false,
        operationId: input.operationId,
        operationKind: "process",
        preference: { engine: "auto" },
        source: input.sourceArtifact,
      })
    );
    const [extracted, sourceText] = yield* sourceTextFrom(processed);
    const request = yield* extractionRequestFrom(input, sourceText, extracted).pipe(
      Effect.provideService(Digest.Digest, deps.digest)
    );
    const extractionResult = yield* deps.langExtract.extract(request);
    const law = yield* deps.irToLaw.toLaw(extractionResult.handoff);

    return OfficeActionCandidateExtraction.make({
      candidate: yield* candidateClaimOf(law, input.entitySeed),
      evidence: yield* evidenceOf(law, input.entitySeed),
    });
  });

  return {
    extractCandidate,
    review: Effect.fn("law_practice.office_action.review")(function* (input) {
      const { candidate, evidence } = yield* extractCandidate(input);

      // Gate the claim: a well-formed span admits it.
      const verdict = yield* deps.gate.evaluate(candidate, [evidence]);

      // Advance the lifecycle. candidate -> shape_valid is always legal, so the
      // impossible ClaimInvalidTransition is a defect (orDie) and E stays never.
      const advanced = yield* deps.transition.advance(candidate, verdict).pipe(Effect.orDie);

      // Fold the single-claim authority into the deterministic projection.
      return projectClaims([advanced]);
    }),
  };
};
