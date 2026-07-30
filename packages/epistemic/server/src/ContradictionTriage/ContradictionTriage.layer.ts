/**
 * Contradiction-triage repository and application-service Layers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ContradictionActionError,
  ContradictionActionErrorReason,
  ContradictionBeliefView,
  ContradictionCandidateDetailView,
  ContradictionEvidenceView,
  EvidenceSourcePage,
  EvidenceSourcePageSelector,
} from "@beep/epistemic-use-cases/public";
import {
  ContradictionCandidatePage,
  ContradictionRepositoryUnavailable,
  ContradictionReviewConflict,
  ContradictionReviewConflictReason,
  ContradictionReviewer,
  ContradictionReviewScope,
  ContradictionTriageRepository,
  ContradictionTriageService,
  GetExpandedContradictionCandidate,
  ListContradictionCandidates,
} from "@beep/epistemic-use-cases/server";
import {
  pageSourceText,
  pageSourceTextContainingOffset,
  ResolveSourceTextRequest,
  SourceTextResolver,
  SourceTextResolverErrorReason,
} from "@beep/file-processing/SourceText";
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability";
import {
  toTextAnchorVerificationReceipt,
  VerifyTextAnchorInput,
  verifyTextAnchor,
} from "@beep/provenance/VerifiedTextAnchor";
import { NonNegativeInt } from "@beep/schema/Int";
import { Cause, Crypto, Effect, Layer, Match, pipe } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import { makeDrizzleContradictionTriageRepository } from "./ContradictionTriage.repo.ts";
import type {
  ContradictionActionErrorReason as ContradictionActionErrorReasonType,
  GetContradictionCandidate,
} from "@beep/epistemic-use-cases/public";
import type {
  ContradictionCandidateExpandedDetail,
  ContradictionEvidenceDetail,
} from "@beep/epistemic-use-cases/server";
import type { SourceTextResolverError } from "@beep/file-processing/SourceText";

const failAction = (reason: ContradictionActionErrorReasonType) =>
  Effect.fail(ContradictionActionError.make({ reason }));

const dropInternalFailure = (context: string, reason: ContradictionActionErrorReasonType) =>
  Effect.fnUntraced(function* (error: { readonly _tag: string }) {
    yield* logRedactedCause(
      Cause.fail(error),
      LogRedactedCauseOptions.make({
        message: "contradiction action dropped internal failure",
        level: "Warn",
        attributes: {
          "epistemic.contradiction.context": context,
          "epistemic.subsystem": "contradiction",
        },
      })
    );
    return yield* failAction(reason);
  });

const reviewActionReason = (reason: ContradictionReviewConflictReason): ContradictionActionErrorReasonType =>
  ContradictionReviewConflictReason.$match(reason, {
    "already-resolved": () => ContradictionActionErrorReason.Enum["candidate-already-resolved"],
    "belief-mismatch": () => ContradictionActionErrorReason.Enum["belief-mismatch"],
    "not-found": () => ContradictionActionErrorReason.Enum["candidate-not-found"],
    "proposal-digest-mismatch": () => ContradictionActionErrorReason.Enum["proposal-digest-mismatch"],
    "proposal-not-found": () => ContradictionActionErrorReason.Enum["proposal-not-found"],
    "stale-candidate": () => ContradictionActionErrorReason.Enum["stale-candidate"],
  });

const sourceActionReason = (error: SourceTextResolverError): ContradictionActionErrorReasonType =>
  SourceTextResolverErrorReason.$match(error.reason, {
    "extraction-failed": () => ContradictionActionErrorReason.Enum["source-unavailable"],
    "extractor-unavailable": () => ContradictionActionErrorReason.Enum["source-stale"],
    "locator-invalid": () => ContradictionActionErrorReason.Enum["source-access-denied"],
    "page-out-of-range": () => ContradictionActionErrorReason.Enum["page-out-of-range"],
    "scope-unavailable": () => ContradictionActionErrorReason.Enum["source-access-denied"],
    "source-digest-mismatch": () => ContradictionActionErrorReason.Enum["source-stale"],
    "source-unavailable": () => ContradictionActionErrorReason.Enum["source-unavailable"],
    "text-digest-mismatch": () => ContradictionActionErrorReason.Enum["source-stale"],
    "text-unavailable": () => ContradictionActionErrorReason.Enum["source-unavailable"],
  });

const anchorSourceActionReason = (error: SourceTextResolverError): ContradictionActionErrorReasonType =>
  Match.value(error.reason).pipe(
    Match.when("page-out-of-range", () => ContradictionActionErrorReason.Enum["source-stale"]),
    Match.orElse(() => sourceActionReason(error))
  );

const toEvidenceView = (detail: ContradictionEvidenceDetail): ContradictionEvidenceView =>
  ContradictionEvidenceView.make({
    evidence: detail.evidence,
    verifiedAnchor: O.map(detail.latestVerification, (verification) => verification.verifiedAnchor),
  });

const toCandidateDetailView = (expanded: ContradictionCandidateExpandedDetail): ContradictionCandidateDetailView =>
  ContradictionCandidateDetailView.make({
    candidate: expanded.detail.candidate,
    disposition: expanded.detail.disposition,
    left: ContradictionBeliefView.make({
      belief: expanded.left.belief,
      evidence: A.map(expanded.left.evidence, toEvidenceView),
    }),
    right: ContradictionBeliefView.make({
      belief: expanded.right.belief,
      evidence: A.map(expanded.right.evidence, toEvidenceView),
    }),
  });

const loadExpandedCandidate = Effect.fnUntraced(function* (
  repository: ContradictionTriageRepository["Service"],
  candidateId: GetContradictionCandidate["candidateId"],
  orgId: ContradictionReviewScope["Service"]["orgId"],
  context: string
) {
  const expanded = yield* repository
    .getExpanded(
      GetExpandedContradictionCandidate.make({
        candidateId,
        orgId,
      })
    )
    .pipe(
      Effect.withSpan("epistemic.contradiction.get_expanded"),
      Effect.catchTag(
        "ContradictionRepositoryUnavailable",
        dropInternalFailure(`${context}.repository`, ContradictionActionErrorReason.Enum.unavailable)
      )
    );
  return yield* pipe(
    expanded,
    O.match({
      onNone: () => failAction(ContradictionActionErrorReason.Enum["candidate-not-found"]),
      onSome: Effect.succeed,
    })
  );
});

const findCandidateEvidence = (
  expanded: ContradictionCandidateExpandedDetail,
  evidenceId: ContradictionEvidenceDetail["evidence"]["id"]
): O.Option<ContradictionEvidenceDetail> =>
  pipe(
    expanded.left.evidence,
    A.appendAll(expanded.right.evidence),
    A.findFirst((detail) => Eq.equals(detail.evidence.id, evidenceId))
  );

const makeContradictionTriageService = Effect.fnUntraced(function* () {
  const repository = yield* ContradictionTriageRepository;
  const crypto = yield* Crypto.Crypto;
  const reviewer = yield* ContradictionReviewer;
  const scope = yield* ContradictionReviewScope;
  const sourceTextResolver = yield* SourceTextResolver;

  return ContradictionTriageService.of({
    listCandidates: Effect.fnUntraced(function* (payload) {
      return yield* repository
        .list(
          ListContradictionCandidates.make({
            disposition: payload.disposition,
            knownAt: payload.knownAt,
            limit: payload.limit,
            offset: payload.offset,
            orgId: scope.orgId,
            validAt: payload.validAt,
          })
        )
        .pipe(
          Effect.withSpan("epistemic.contradiction.list"),
          Effect.catchTag(
            "ContradictionRepositoryUnavailable",
            dropInternalFailure(
              "ListContradictionCandidates.repository",
              ContradictionActionErrorReason.Enum.unavailable
            )
          ),
          Effect.tap(() => Effect.annotateCurrentSpan("epistemic.contradiction.outcome", "listed")),
          Effect.tapError((error) =>
            Effect.annotateCurrentSpan({
              "epistemic.contradiction.failure_reason": error.reason,
              "epistemic.contradiction.outcome": "failed",
            })
          ),
          Effect.withSpan("epistemic.contradiction.list_candidates", {
            attributes: {
              "epistemic.contradiction.disposition": payload.disposition,
            },
          })
        );
    }),

    getCandidate: Effect.fnUntraced(function* ({ candidateId }) {
      return yield* loadExpandedCandidate(repository, candidateId, scope.orgId, "GetContradictionCandidate").pipe(
        Effect.map(toCandidateDetailView),
        Effect.tap(() => Effect.annotateCurrentSpan("epistemic.contradiction.outcome", "found")),
        Effect.tapError((error) =>
          Effect.annotateCurrentSpan({
            "epistemic.contradiction.failure_reason": error.reason,
            "epistemic.contradiction.outcome": "failed",
          })
        ),
        Effect.withSpan("epistemic.contradiction.get_candidate")
      );
    }),

    reviewCandidate: Effect.fnUntraced(function* (command) {
      return yield* repository.review(command, reviewer, scope).pipe(
        Effect.withSpan("epistemic.contradiction.review"),
        Effect.catchTags({
          ContradictionRepositoryUnavailable: dropInternalFailure(
            "ReviewContradictionCandidate.repository",
            ContradictionActionErrorReason.Enum.unavailable
          ),
          ContradictionReviewConflict: (error) => failAction(reviewActionReason(error.reason)),
          EdgeConstraintViolation: () => failAction(ContradictionActionErrorReason.Enum["belief-mismatch"]),
          EdgeRepositoryUnavailable: dropInternalFailure(
            "ReviewContradictionCandidate.edge",
            ContradictionActionErrorReason.Enum.unavailable
          ),
          SupersessionConflict: () => failAction(ContradictionActionErrorReason.Enum["stale-candidate"]),
        }),
        Effect.tap((disposition) =>
          Effect.annotateCurrentSpan("epistemic.contradiction.outcome", disposition.decision.status)
        ),
        Effect.tapError((error) =>
          Effect.annotateCurrentSpan({
            "epistemic.contradiction.failure_reason": error.reason,
            "epistemic.contradiction.outcome": "failed",
          })
        ),
        Effect.withSpan("epistemic.contradiction.review_candidate", {
          attributes: {
            "epistemic.contradiction.decision": command.decision.decision,
          },
        })
      );
    }),

    getEvidenceSourcePage: Effect.fnUntraced(function* ({ candidateId, evidenceId, selector }) {
      return yield* Effect.gen(function* () {
        const expanded = yield* loadExpandedCandidate(repository, candidateId, scope.orgId, "GetEvidenceSourcePage");
        const evidence = yield* pipe(
          findCandidateEvidence(expanded, evidenceId),
          O.match({
            onNone: () => failAction(ContradictionActionErrorReason.Enum["evidence-not-in-candidate"]),
            onSome: Effect.succeed,
          })
        );
        const verification = yield* pipe(
          evidence.latestVerification,
          O.match({
            onNone: () => failAction(ContradictionActionErrorReason.Enum["source-unavailable"]),
            onSome: Effect.succeed,
          })
        );
        if (!Eq.equals(verification.verifiedAnchor.source.scopeRef, scope.sourceScopeRef)) {
          return yield* failAction(ContradictionActionErrorReason.Enum["source-access-denied"]);
        }
        const source = yield* sourceTextResolver
          .resolve(ResolveSourceTextRequest.make({ identity: verification.verifiedAnchor.source }))
          .pipe(
            Effect.withSpan("epistemic.contradiction.resolve_source_text"),
            Effect.catchTag("SourceTextResolverError", (error) =>
              dropInternalFailure("GetEvidenceSourcePage.resolve", sourceActionReason(error))(error)
            )
          );
        const verifiedAnchor = yield* verifyTextAnchor(
          VerifyTextAnchorInput.make({
            anchor: verification.verifiedAnchor.anchor,
            expectedSource: verification.verifiedAnchor.source,
            source: source.identity,
            sourceText: source.text,
          })
        ).pipe(
          Effect.provideService(Crypto.Crypto, crypto),
          Effect.catchTag(
            "VerifiedTextAnchorError",
            dropInternalFailure(
              "GetEvidenceSourcePage.verifyAnchor",
              ContradictionActionErrorReason.Enum["source-stale"]
            )
          )
        );
        const page = yield* EvidenceSourcePageSelector.match(selector, {
          anchor: () =>
            pageSourceTextContainingOffset(source, verifiedAnchor.anchor.startChar).pipe(
              Effect.catchTag("SourceTextResolverError", (error) =>
                dropInternalFailure("GetEvidenceSourcePage.anchorPage", anchorSourceActionReason(error))(error)
              )
            ),
          page: ({ pageIndex }) =>
            pageSourceText(source, pageIndex).pipe(
              Effect.catchTag("SourceTextResolverError", (error) =>
                dropInternalFailure("GetEvidenceSourcePage.page", sourceActionReason(error))(error)
              )
            ),
        });
        return EvidenceSourcePage.make({
          evidenceId,
          page,
          verifiedAnchor: toTextAnchorVerificationReceipt(verifiedAnchor),
        });
      }).pipe(
        Effect.tap(() => Effect.annotateCurrentSpan("epistemic.contradiction.outcome", "resolved")),
        Effect.tapError((error) =>
          Effect.annotateCurrentSpan({
            "epistemic.contradiction.failure_reason": error.reason,
            "epistemic.contradiction.outcome": "failed",
          })
        ),
        Effect.withSpan("epistemic.contradiction.get_evidence_source_page", {
          attributes: {
            "epistemic.contradiction.selector": selector.kind,
          },
        })
      );
    }),
  });
});

/**
 * Drizzle-backed contradiction-triage repository layer.
 *
 * @example
 * ```ts
 * import { ContradictionTriageRepositoryDrizzle } from "@beep/epistemic-server/layer"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(ContradictionTriageRepositoryDrizzle)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ContradictionTriageRepositoryDrizzle = Layer.effect(
  ContradictionTriageRepository,
  makeDrizzleContradictionTriageRepository()
);

/**
 * Live contradiction-triage application service.
 *
 * @example
 * ```ts
 * import { ContradictionTriageServiceLive } from "@beep/epistemic-server/layer"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(ContradictionTriageServiceLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ContradictionTriageServiceLive = Layer.effect(
  ContradictionTriageService,
  makeContradictionTriageService()
);

/**
 * Empty contradiction repository used by dependency-free fixture runtimes.
 *
 * @example
 * ```ts
 * import { ContradictionTriageRepositoryFixture } from "@beep/epistemic-server/layer"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(ContradictionTriageRepositoryFixture)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ContradictionTriageRepositoryFixture = Layer.succeed(
  ContradictionTriageRepository,
  ContradictionTriageRepository.of({
    get: Effect.fnUntraced(function* () {
      return O.none();
    }),
    getExpanded: Effect.fnUntraced(function* () {
      return O.none();
    }),
    list: Effect.fnUntraced(function* () {
      return ContradictionCandidatePage.make({
        items: [],
        total: NonNegativeInt.make(0),
      });
    }),
    review: Effect.fnUntraced(function* (command) {
      return yield* ContradictionReviewConflict.make({
        candidateId: command.candidateId,
        reason: "not-found",
      });
    }),
    submit: Effect.fnUntraced(function* () {
      return yield* ContradictionRepositoryUnavailable.during(
        "submit",
        "The fixture contradiction repository does not accept submissions."
      );
    }),
  })
);
