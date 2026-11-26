/**
 * Office-action review loop implementation.
 *
 * **Details**
 *
 * The end-to-end loop for reviewing one office action: extract text through
 * `@beep/file-processing`, invoke `@beep/langextract` for provider-neutral
 * structured extraction, map the verified annotation handoff into law entities
 * through {@link IrToLaw}, then propose the distinction claim in its capture
 * scope and assess it against the office-action gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CandidateClaim, Evidence } from "@beep/epistemic-domain";
import { GenerationFact } from "@beep/epistemics/Admission";
import { ProcessFileResult } from "@beep/file-processing/Extraction";
import { FileProcessingOperationError, ProcessFileOperation } from "@beep/file-processing/Operation";
import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { ActivityRecord } from "@beep/jsonc/ActivityRecord";
import { ActivityPin } from "@beep/jsonc/ActivityStart";
import { LangExtractRequest } from "@beep/langextract/Extraction";
import { ExtractionTarget, TargetAnnotation } from "@beep/langextract/Target";
import {
  DistinctionProposition,
  LawClaimArrows,
  LawClaimCore,
  LawProposedClaimRecord,
  logicalKey,
  mintDistinctionId,
  OfficeActionAssessmentArrows,
  OfficeActionDistinctionGate,
} from "@beep/law-practice-domain/values/LawClaim";
import {
  ActivityFacts,
  ActivityFloor,
  CurrentActivity,
  composeLogged,
  withActivity,
} from "@beep/nlp-processing/Activity";
import {
  SourceTextDigest,
  SourceTextExtractor,
  SourceTextIdentity,
  SourceTextLocator,
} from "@beep/text/SourceTextIdentity";
import { VerifyTextAnchorInput, verifyTextAnchor } from "@beep/text/VerifiedTextAnchor";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { authorizeClaimProposal, ClaimProposalRefused } from "../ClaimProposal/index.ts";
import { ProposedClaimEntry } from "../ClaimStore/index.ts";
import { requiredExtraction } from "../IrToLaw/index.ts";
import { spikeEntityInput } from "../internal/spikeEntity.ts";
import { OfficeActionExtractionLabel } from "./OfficeActionExtractionLabel.ts";
import { OfficeActionCandidateExtraction, OfficeActionReviewResult } from "./OfficeActionReview.ports.ts";
import type { ClaimCoreInvalid } from "@beep/epistemics/ClaimCore";
import type { FileProcessingServiceShape } from "@beep/file-processing/Service";
import type { PreimageMintError } from "@beep/jsonc/Mint";
import type { AlignmentStatus, LangExtractError, LangExtractResult } from "@beep/langextract/Extraction";
import type { ExtractionHandoff } from "@beep/langextract/Handoff";
import type {
  AlignmentAssessment,
  DistinctionId,
  OfficeActionAssessments,
} from "@beep/law-practice-domain/values/LawClaim";
import type { Logged, LoggedFailure } from "@beep/nlp-processing/Activity";
import type { Operation } from "@beep/nlp-processing/Operation";
import type { ContentHash } from "@beep/schema/ContentHash";
import type * as Shared from "@beep/shared-domain/identity/Shared";
import type { LawClaimProposalsShape } from "../ClaimStore/index.ts";
import type { IrToLawExtractionError, IrToLawShape, LawEntities } from "../IrToLaw/index.ts";
import type { MatterAuthorityShape } from "../MatterWall/index.ts";
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

const extractedSourceFrom = Effect.fn("OfficeActionReview.extractedSourceFrom")(function* (
  result: ProcessFileResult
): Effect.fn.Return<
  { readonly extractor: SourceTextExtractor; readonly sourceText: string },
  FileProcessingOperationError
> {
  return yield* ProcessFileResult.match(result, {
    "archive-exported": (archiveExported) =>
      failFileExtraction(
        archiveExported,
        `Office-action review requires extracted text, received ${archiveExported.resultKind}.`
      ),
    extracted: (extracted) =>
      O.match(O.fromUndefinedOr(extracted.extraction.text), {
        onNone: () => failFileExtraction(extracted, "Office-action review requires text extraction output."),
        onSome: (sourceText) =>
          O.match(O.fromUndefinedOr(extracted.extraction.engineVersion), {
            onNone: () => failFileExtraction(extracted, "Office-action review requires a versioned extractor."),
            onSome: (version) =>
              Effect.succeed({
                extractor: SourceTextExtractor.make({ name: extracted.engine, version }),
                sourceText,
              }),
          }),
      }),
    skipped: (skipped) =>
      failFileExtraction(skipped, `Office-action review requires extracted text, received ${skipped.resultKind}.`),
  });
});

const utf8 = new TextEncoder();
const extractionRequestFrom = Effect.fn("OfficeActionReview.extractionRequestFrom")(function* (
  input: OfficeActionReviewInput,
  extracted: { readonly extractor: SourceTextExtractor; readonly sourceText: string }
) {
  const digest = yield* Digest.Digest;
  const textDigest = yield* digest.digestHex(Digest.sha256, utf8.encode(extracted.sourceText));
  const source = SourceTextIdentity.make({
    scopeRef: input.matterFixtureKey,
    sourceRef: input.sourceArtifact.id,
    locator: SourceTextLocator.make(input.sourceArtifact.relativePath),
    sourceDigest: SourceTextDigest.make(input.sourceArtifact.digest),
    textDigest: SourceTextDigest.make(`sha256:${textDigest}`),
    extractor: extracted.extractor,
    normalizationVersion: "raw/1",
  });
  return LangExtractRequest.make({ source, targets: officeActionExtractionTargets, text: extracted.sourceText });
});

const reviewPin = ActivityPin.cases.Engine.make({ engine: "law-practice-office-action-review", edition: "1" });
const ExtractTerm = TermIri.make(iri("operation:Extract"));
const MapToLawTerm = TermIri.make(iri("operation:MapToLaw"));
const ProposeClaimTerm = TermIri.make(iri("operation:ProposeClaim"));

const alignmentOf: Readonly<Record<AlignmentStatus, AlignmentAssessment>> = {
  match_exact: "exact",
  match_lesser: "lesser",
  match_minimal_fold: "fuzzy",
  match_fuzzy: "fuzzy",
  unaligned: "fuzzy",
};

const isMintFailure = (error: { readonly _tag: string }): error is PreimageMintError =>
  error._tag === "SchemaError" || error._tag === "JsoncCanonicalizeError";

type ReviewStepError = LangExtractError | IrToLawExtractionError | ClaimProposalRefused | PreimageMintError;

interface Extracted {
  readonly handoff: ExtractionHandoff;
  readonly sourceText: string;
}

interface Mapped extends Extracted {
  readonly distinction: DistinctionId;
  readonly law: LawEntities;
  readonly proposition: DistinctionProposition;
  readonly support: Effect.Success<ReturnType<typeof requiredExtraction>>;
}

interface Proposed extends Mapped {
  readonly generation: GenerationFact;
  readonly record: LawProposedClaimRecord;
}

const unverified = (reason: ClaimCoreInvalid["reason"]): ClaimProposalRefused =>
  ClaimProposalRefused.cases.SupportUnverified.make({ reason });

/**
 * The distinction proposition a mapped office action states: every field is
 * read from the law entities, so the proposition is the same across runs.
 *
 * **Example** (Read the proposition authority)
 *
 * ```ts
 * import { distinctionPropositionOf } from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * console.log(typeof distinctionPropositionOf) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const distinctionPropositionOf = (law: LawEntities): DistinctionProposition =>
  DistinctionProposition.make({
    authority: "office-action",
    applicationNumber: law.officeAction.applicationNumber,
    claimNumber: law.claim.claimNumber,
    ground: law.rejection.ground.statute,
    referenceDocument: law.priorArtReference.documentNumber,
    detail: law.distinction.detail,
  });

const flooredBy =
  (floor: O.Option<DateTime.Utc>) =>
  <A, B, E, R>(operation: Operation<A, B, E, R>): Operation<A, B, E, R> => ({
    name: operation.name,
    run: Effect.fnUntraced(function* (input: A) {
      const current = yield* ActivityFloor;
      const combined = O.match(O.all([floor, current]), {
        onNone: () => O.orElse(floor, () => current),
        onSome: ([partition, upstream]) => O.some(DateTime.max(partition, upstream)),
      });
      return yield* Effect.provideService(operation.run(input), ActivityFloor, combined);
    }),
  });

/**
 * Collaborators of the office-action review.
 *
 * **Example** (Name a review collaborator)
 *
 * ```ts
 * import type { OfficeActionReviewDeps } from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * const field: keyof OfficeActionReviewDeps = "proposals"
 * console.log(field) // "proposals"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface OfficeActionReviewDeps {
  readonly authority: MatterAuthorityShape;
  readonly digest: Digest.Digest["Service"];
  readonly fileProcessing: FileProcessingServiceShape;
  readonly irToLaw: IrToLawShape;
  readonly langExtract: {
    readonly extract: (request: LangExtractRequest) => Effect.Effect<LangExtractResult, LangExtractError>;
  };
  readonly principal: Shared.UserId;
  readonly proposals: LawClaimProposalsShape;
}

/**
 * Build the office-action review.
 *
 * **Details**
 *
 * `review` runs four steps: Extract (the extraction service, recorded with its
 * own activity), MapToLaw and ProposeClaim (each attributed by `withActivity`)
 * and Assess (a pure update through the office-action gate). The proposal is
 * appended in the capture scope's partition, after the matter wall grants
 * `claim-proposal` on that scope. `extractCandidate` keeps the candidate and
 * evidence rows the Practice KG claims batch stores.
 *
 * **Example** (Reference the review constructor)
 *
 * ```ts
 * import { makeOfficeActionReview } from "@beep/law-practice-use-cases/OfficeActionReview"
 *
 * console.log(typeof makeOfficeActionReview) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeOfficeActionReview = (deps: OfficeActionReviewDeps): OfficeActionReviewShape => {
  const prepare = Effect.fn("OfficeActionReview.prepare")(function* (input: OfficeActionReviewInput) {
    const processed = yield* deps.fileProcessing.process(
      ProcessFileOperation.make({
        exportChildren: false,
        operationId: input.operationId,
        operationKind: "process",
        preference: { engine: "auto" },
        source: input.sourceArtifact,
      })
    );
    const extracted = yield* extractedSourceFrom(processed);
    return yield* extractionRequestFrom(input, extracted).pipe(Effect.provideService(Digest.Digest, deps.digest));
  });
  const extractCandidate = Effect.fn("OfficeActionReview.extractCandidate")(function* (input: OfficeActionReviewInput) {
    const request = yield* prepare(input);
    const extractionResult = yield* deps.langExtract.extract(request);
    const law = yield* deps.irToLaw.toLaw(extractionResult.handoff);
    const candidate = yield* candidateClaimOf(law, input.entitySeed);
    const evidence = yield* evidenceOf(law, input.entitySeed);
    return OfficeActionCandidateExtraction.make({ candidate, evidence });
  });
  const recordedExtract: Operation<LangExtractRequest, Logged<Extracted>, LoggedFailure<ReviewStepError>> = {
    name: ExtractTerm,
    run: Effect.fn("OfficeActionReview.recordExtract")(function* (request: LangExtractRequest) {
      const result = yield* deps.langExtract
        .extract(request)
        .pipe(
          Effect.mapError(
            (error): LoggedFailure<ReviewStepError> => ({ _tag: "LoggedFailure", error, activities: HashSet.empty() })
          )
        );
      const { handoff } = result;
      const now = yield* DateTime.now;
      const generationTimes = handoff.document.attribution.pipe(
        HashMap.values,
        A.fromIterable,
        A.flatMap((generations) =>
          generations.pipe(
            A.fromIterable,
            A.map((generation) => generation.at),
            A.getSomes
          )
        )
      );
      const ended = A.reduce(
        generationTimes,
        DateTime.max(now, handoff.activity.start.started),
        (latest: DateTime.Utc, at: DateTime.Utc) => DateTime.max(latest, at)
      );
      const generated = HashSet.union(
        HashSet.fromIterable<ContentHash>(handoff.document.annotations.pipe(HashMap.keys)),
        HashSet.fromIterable<ContentHash>(handoff.document.anchors.pipe(HashMap.keys))
      );
      const record = ActivityRecord.make({
        id: handoff.activity.id,
        start: handoff.activity.start,
        generated,
        ended,
        outcome: "completed",
      });
      return { value: { handoff, sourceText: request.text }, activities: HashSet.make(record) };
    }),
  };
  const mapToLaw = withActivity<Extracted, Mapped>({
    facts: (extracted) =>
      Effect.succeed(
        ActivityFacts.make({
          pin: reviewPin,
          promptDigest: O.none(),
          used: HashSet.fromIterable<ContentHash>(extracted.handoff.document.annotations.pipe(HashMap.keys)),
        })
      ),
    generated: (mapped) => [mapped.distinction],
  })<ReviewStepError, Digest.Digest>({
    name: MapToLawTerm,
    run: Effect.fn("OfficeActionReview.mapToLaw")(function* (extracted: Extracted) {
      const law = yield* deps.irToLaw.toLaw(extracted.handoff);
      const proposition = distinctionPropositionOf(law);
      const distinction = yield* mintDistinctionId(proposition);
      const support = yield* requiredExtraction(extracted.handoff, OfficeActionExtractionLabel.Enum.distinction);
      return { ...extracted, law, proposition, distinction, support };
    }),
  });
  const proposeClaim = withActivity<Mapped, Proposed>({
    facts: (mapped) =>
      Effect.succeed(
        ActivityFacts.make({
          pin: reviewPin,
          promptDigest: O.none(),
          used: HashSet.make<ReadonlyArray<ContentHash>>(
            mapped.distinction,
            mapped.support.id,
            mapped.support.occurrence
          ),
        })
      ),
    generated: (proposed) => [proposed.record.claim],
  })<ReviewStepError, Digest.Digest | CurrentActivity>({
    name: ProposeClaimTerm,
    run: Effect.fn("OfficeActionReview.proposeClaim")(function* (mapped: Mapped) {
      const activity = yield* CurrentActivity;
      const at = yield* activity.stamp;
      const receipt = HashMap.getUnsafe(mapped.handoff.document.anchors, mapped.support.occurrence).receipt;
      const verified = yield* verifyTextAnchor(
        VerifyTextAnchorInput.make({
          expectedSource: receipt.source,
          source: mapped.handoff.document.text,
          sourceText: mapped.sourceText,
          anchor: receipt.anchor,
        })
      ).pipe(Effect.mapError(() => unverified("invalid-creation-support")));
      const core = LawClaimCore.make({
        proposition: mapped.proposition,
        logicalKey: logicalKey(mapped.proposition),
        supportAtCreation: HashSet.make(mapped.support.occurrence),
        derivedFrom: HashSet.empty(),
        supersedes: O.none(),
        generatedBy: activity.id,
        assertedBy: { _tag: "SoftwareAgent", name: "OfficeActionReview", pin: reviewPin },
        valid: { _tag: "Unknown" },
        knowledgeStart: at,
        scope: mapped.handoff.document.text.scopeRef,
      });
      const generation = GenerationFact.make({ activity: activity.id, at });
      const promoted = yield* LawClaimArrows.promote({
        core,
        document: mapped.handoff.document,
        candidates: HashSet.make(mapped.support.id),
        verified: [verified],
        generation,
      }).pipe(Effect.catchTag("ClaimCoreInvalid", (error) => Effect.fail(unverified(error.reason))));
      return { ...mapped, record: LawProposedClaimRecord.make(promoted), generation };
    }),
  });
  const assess = Effect.fn("OfficeActionReview.assess")(function* (proposed: Proposed) {
    const partial: OfficeActionAssessments = {
      support: { _tag: "Unassessed", reason: "not-assessed" },
      alignment: { _tag: "Assessed", value: alignmentOf[proposed.support.alignment] },
      reference: { _tag: "Assessed", value: "identified" },
    };
    const updated = yield* OfficeActionAssessmentArrows.updateAssessment({
      record: partial,
      coordinate: "support",
      input: "verified",
      gate: OfficeActionDistinctionGate,
    });
    return updated.record;
  });
  const failReview = (failure: LoggedFailure<ReviewStepError>) =>
    Effect.fail(failure.error).pipe(Effect.catchIf(isMintFailure, Effect.die));
  return {
    extractCandidate,
    review: Effect.fn("OfficeActionReview.review")(function* (input) {
      const request = yield* prepare(input);
      const scope = request.source.scopeRef;
      yield* authorizeClaimProposal(deps.authority, deps.principal, scope);
      const logged = yield* deps.proposals
        .withPartition(scope, (last) => {
          const pipeline = composeLogged(
            composeLogged(recordedExtract, mapToLaw, MapToLawTerm),
            flooredBy(last)(proposeClaim),
            ProposeClaimTerm
          );
          return pipeline.run(request).pipe(
            Effect.catch(failReview),
            Effect.tap((result) =>
              deps.proposals.appendProposed(
                ProposedClaimEntry.make({
                  record: result.value.record,
                  generation: result.value.generation,
                  activities: result.activities,
                  captures: HashSet.make(request.source),
                })
              )
            )
          );
        })
        .pipe(Effect.provideService(Digest.Digest, deps.digest));
      const assessments = yield* assess(logged.value);
      return OfficeActionReviewResult.make({
        law: logged.value.law,
        proposed: logged.value.record,
        assessments,
        activities: logged.activities,
      });
    }),
  };
};
