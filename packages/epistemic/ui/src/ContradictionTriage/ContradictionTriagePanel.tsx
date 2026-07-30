/**
 * Atom-connected contradiction-triage workspace.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import {
  CONTRADICTION_QUEUE_LIMIT,
  contradictionDispositionFilterAtom,
  contradictionEvidenceSourcePageAtom,
  contradictionKnownAtAtom,
  contradictionQueueAtom,
  contradictionQueueOffsetAtom,
  contradictionReviewCandidateIdAtom,
  contradictionValidAtAtom,
  refreshContradictionEvidenceSourceAtom,
  refreshContradictionTriageAtom,
  resetContradictionTemporalViewAtom,
  reviewContradictionCandidateAtom,
  selectContradictionCandidateAtom,
  selectContradictionEvidenceSourceAtom,
  selectedContradictionCandidateAtom,
  selectedContradictionCandidateIdAtom,
  selectedContradictionEvidenceSourceAtom,
} from "@beep/epistemic-client";
import { ContradictionTriage } from "@beep/epistemic-use-cases/public";
import { NonNegativeInt } from "@beep/schema/Int";
import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { DateTime, Number as N } from "effect";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { Atom } from "effect/unstable/reactivity";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { ContradictionTriageView } from "./ContradictionTriageView.tsx";
import type { ContradictionDisposition } from "@beep/epistemic-domain/entities/Contradiction";
import type { ContradictionCandidateId } from "@beep/epistemic-domain/identity/Epistemic";
import type { ContradictionResolutionProposal } from "@beep/epistemic-domain/values/Contradiction";
import type { JSX } from "react";
import type { ContradictionTriageTab, ContradictionTriageViewProps } from "./ContradictionTriageView.tsx";

const activeTabAtom = Atom.make<ContradictionTriageTab>("queue").pipe(Atom.keepAlive);

interface ReviewDialogState {
  readonly open: boolean;
  readonly reason: string;
  readonly selectedProposal: O.Option<ContradictionResolutionProposal>;
}

const reviewDialogAtom = Atom.make<ReviewDialogState>({
  open: false,
  reason: "",
  selectedProposal: O.none(),
}).pipe(Atom.keepAlive);
const noVisibleReview = AsyncResult.initial<ContradictionDisposition, ContradictionTriage.ContradictionActionError>();
const panelReadStateAtom = Atom.readable((get) => ({
  queueResult: get(contradictionQueueAtom),
  reviewCandidateId: get(contradictionReviewCandidateIdAtom),
  reviewResult: get(reviewContradictionCandidateAtom),
  selectedCandidate: get(selectedContradictionCandidateAtom),
  selectedCandidateId: get(selectedContradictionCandidateIdAtom),
  selectedSource: get(selectedContradictionEvidenceSourceAtom),
  sourceResult: get(contradictionEvidenceSourcePageAtom),
}));

const useContradictionTriagePanelState = () => {
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const [disposition, setDisposition] = useAtom(contradictionDispositionFilterAtom);
  const [knownAt, setKnownAt] = useAtom(contradictionKnownAtAtom);
  const [offset, setOffset] = useAtom(contradictionQueueOffsetAtom);
  const [reviewDialog, setReviewDialog] = useAtom(reviewDialogAtom);
  const [validAt, setValidAt] = useAtom(contradictionValidAtAtom);
  const panelReadState = useAtomValue(panelReadStateAtom);

  return {
    activeTab,
    disposition,
    knownAt,
    offset,
    reviewDialog,
    setActiveTab,
    setDisposition,
    setKnownAt,
    setOffset,
    setReviewDialog,
    setValidAt,
    validAt,
    ...panelReadState,
  };
};

const useContradictionTriagePanelActions = () => {
  const refreshSource = useAtomSet(refreshContradictionEvidenceSourceAtom);
  const refreshTriage = useAtomSet(refreshContradictionTriageAtom);
  const resetTemporalView = useAtomSet(resetContradictionTemporalViewAtom);
  const reviewCandidate = useAtomSet(reviewContradictionCandidateAtom);
  const selectCandidate = useAtomSet(selectContradictionCandidateAtom);
  const selectSource = useAtomSet(selectContradictionEvidenceSourceAtom);
  const setReviewCandidateId = useAtomSet(contradictionReviewCandidateIdAtom);
  const setSelectedSource = useAtomSet(selectedContradictionEvidenceSourceAtom);

  return {
    refreshSource,
    refreshTriage,
    resetTemporalView,
    reviewCandidate,
    selectCandidate,
    selectSource,
    setReviewCandidateId,
    setSelectedSource,
  };
};

const currentReviewResult = (
  selectedCandidateId: Atom.Type<typeof selectedContradictionCandidateIdAtom>,
  reviewCandidateId: Atom.Type<typeof contradictionReviewCandidateIdAtom>,
  reviewResult: Atom.Type<typeof reviewContradictionCandidateAtom>
): Atom.Type<typeof reviewContradictionCandidateAtom> =>
  Eq.equals(selectedCandidateId, reviewCandidateId) ? reviewResult : noVisibleReview;

const reviewDecision = (
  proposal: O.Option<ContradictionResolutionProposal>,
  reason: string
): ContradictionTriage.ContradictionReviewDecision =>
  O.match(proposal, {
    onNone: () => ContradictionTriage.ContradictionReviewDecision.cases.reject.make({ reason }),
    onSome: ({ proposalDigest, proposalId }) =>
      ContradictionTriage.ContradictionReviewDecision.cases.supersedeProposal.make({
        proposalDigest,
        proposalId,
        reason,
      }),
  });

interface TemporalTriagePanelProps {
  readonly disposition: ContradictionTriage.ContradictionDispositionFilter;
  readonly knownAt: Atom.Type<typeof contradictionKnownAtAtom>;
  readonly offset: NonNegativeInt;
  readonly validAt: Atom.Type<typeof contradictionValidAtAtom>;
  readonly viewProps: Omit<ContradictionTriageViewProps, "query">;
}

function TemporalTriagePanel({
  disposition,
  knownAt,
  offset,
  validAt,
  viewProps,
}: TemporalTriagePanelProps): JSX.Element {
  return AsyncResult.match(
    AsyncResult.all({
      knownAt,
      validAt,
    }),
    {
      onFailure: () => (
        <div aria-live="assertive" data-testid="contradiction-temporal-failure" role="alert">
          Unable to initialize the contradiction timeline. Reload the workspace and try again.
        </div>
      ),
      onInitial: () => (
        <div aria-live="polite" role="status">
          Initializing contradiction timeline…
        </div>
      ),
      onSuccess: ({ value: { knownAt: initializedKnownAt, validAt: initializedValidAt } }) => (
        <ContradictionTriageView
          {...viewProps}
          query={ContradictionTriage.ContradictionListPayload.make({
            disposition,
            knownAt: initializedKnownAt,
            limit: CONTRADICTION_QUEUE_LIMIT,
            offset,
            validAt: initializedValidAt,
          })}
        />
      ),
    }
  );
}

/**
 * Connect the controlled contradiction workspace to the shared Effect Atom
 * runtime and authenticated RPC client.
 *
 * @example
 * ```tsx
 * import { ContradictionTriagePanel } from "@beep/epistemic-ui"
 *
 * export function ReviewWorkspace() {
 *   return <ContradictionTriagePanel />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ContradictionTriagePanel(): JSX.Element {
  const {
    activeTab,
    disposition,
    knownAt,
    offset,
    queueResult,
    reviewCandidateId,
    reviewDialog,
    reviewResult,
    selectedCandidate,
    selectedCandidateId,
    selectedSource,
    setActiveTab,
    setDisposition,
    setKnownAt,
    setOffset,
    setReviewDialog,
    setValidAt,
    sourceResult,
    validAt,
  } = useContradictionTriagePanelState();
  const { open: reviewDialogOpen, reason: reviewReason, selectedProposal } = reviewDialog;

  const {
    refreshSource,
    refreshTriage,
    resetTemporalView,
    reviewCandidate,
    selectCandidate,
    selectSource,
    setReviewCandidateId,
    setSelectedSource,
  } = useContradictionTriagePanelActions();

  const visibleReviewResult = currentReviewResult(selectedCandidateId, reviewCandidateId, reviewResult);

  const selectCandidateAndCompare = (candidateId: ContradictionCandidateId): void => {
    selectCandidate(candidateId);
    setActiveTab("comparison");
  };
  const selectEvidenceSource = (evidence: ContradictionTriage.ContradictionEvidenceView): void => {
    O.zipWith(
      O.all({
        candidateId: selectedCandidateId,
        knownAt: AsyncResult.value(knownAt),
        validAt: AsyncResult.value(validAt),
      }),
      evidence.verifiedAnchor,
      ({ candidateId, knownAt: selectedKnownAt, validAt: selectedValidAt }) => {
        selectSource(
          ContradictionTriage.EvidenceSourcePagePayload.make({
            candidateId,
            evidenceId: evidence.evidence.id,
            knownAt: selectedKnownAt,
            selector: ContradictionTriage.EvidenceSourcePageSelector.cases.anchor.make({}),
            validAt: selectedValidAt,
          })
        );
        setActiveTab("source");
      }
    );
  };
  const changeSourcePage = (pageIndex: number): void => {
    O.map(selectedSource, (request) =>
      selectSource(
        ContradictionTriage.EvidenceSourcePagePayload.make({
          candidateId: request.candidateId,
          evidenceId: request.evidenceId,
          knownAt: request.knownAt,
          selector: ContradictionTriage.EvidenceSourcePageSelector.cases.page.make({
            pageIndex: NonNegativeInt.make(pageIndex),
          }),
          validAt: request.validAt,
        })
      )
    );
  };
  const openRejectReview = (): void => {
    setReviewDialog({
      open: true,
      reason: "",
      selectedProposal: O.none(),
    });
  };
  const openSupersessionReview = (proposal: ContradictionResolutionProposal): void => {
    setReviewDialog({
      open: true,
      reason: "",
      selectedProposal: O.some(proposal),
    });
  };
  const confirmReview = (): void => {
    O.zipWith(selectedCandidateId, AsyncResult.value(selectedCandidate), (candidateId, detail) => {
      const reason = Str.trim(reviewReason);
      reviewCandidate(
        ContradictionTriage.ReviewContradictionCandidate.make({
          candidateId,
          decision: reviewDecision(selectedProposal, reason),
          expectedCandidateVersion: detail.candidate.rowVersion,
        })
      );
    });
  };
  const changeValidAt = (value: DateTime.DateTime | null): void => {
    O.map(O.fromNullishOr(value), (dateTime) => {
      setValidAt(dateTime.pipe(DateTime.toUtc));
      setOffset(NonNegativeInt.make(0));
      setSelectedSource(O.none());
      setReviewCandidateId(O.none());
    });
  };
  const changeKnownAt = (value: DateTime.DateTime | null): void => {
    O.map(O.fromNullishOr(value), (dateTime) => {
      setKnownAt(dateTime.pipe(DateTime.toUtc));
      setOffset(NonNegativeInt.make(0));
      setSelectedSource(O.none());
      setReviewCandidateId(O.none());
    });
  };

  return (
    <TemporalTriagePanel
      disposition={disposition}
      knownAt={knownAt}
      offset={offset}
      validAt={validAt}
      viewProps={{
        activeTab,
        detailResult: selectedCandidate,
        onActiveTabChange: setActiveTab,
        onCandidateSelect: selectCandidateAndCompare,
        onDetailRetry: refreshTriage,
        onDispositionChange: (nextDisposition) => {
          setDisposition(nextDisposition);
          setOffset(NonNegativeInt.make(0));
        },
        onEvidenceSelect: selectEvidenceSource,
        onKnownAtChange: changeKnownAt,
        onNextQueuePage: () => setOffset(NonNegativeInt.make(N.sum(offset, CONTRADICTION_QUEUE_LIMIT))),
        onPreviousQueuePage: () =>
          setOffset(NonNegativeInt.make(N.max(0, N.subtract(offset, CONTRADICTION_QUEUE_LIMIT)))),
        onQueueRetry: refreshTriage,
        onRejectRequested: openRejectReview,
        onResetNow: resetTemporalView,
        onReviewConfirm: confirmReview,
        onReviewDialogOpenChange: (open) => setReviewDialog((current) => ({ ...current, open })),
        onReviewReasonChange: (reason) => setReviewDialog((current) => ({ ...current, reason })),
        onSourcePageChange: changeSourcePage,
        onSourceRetry: refreshSource,
        onSupersedeRequested: openSupersessionReview,
        onValidAtChange: changeValidAt,
        queueResult,
        reviewDialogOpen,
        reviewReason,
        reviewResult: visibleReviewResult,
        selectedCandidateId,
        selectedProposal,
        selectedSource,
        sourceResult,
      }}
    />
  );
}
