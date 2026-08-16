/**
 * Controlled presentation for human contradiction triage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { CONTRADICTION_REVIEW_REASON_MAX_LENGTH } from "@beep/epistemic-domain/values/Contradiction";
import { ContradictionTriage } from "@beep/epistemic-use-cases/public";
import { $EpistemicUiId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@beep/ui/components/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@beep/ui/components/alert-dialog";
import { Badge } from "@beep/ui/components/badge";
import { Button } from "@beep/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@beep/ui/components/card";
import { EffectDateTimePicker } from "@beep/ui/components/effect-date-time-picker";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@beep/ui/components/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@beep/ui/components/field";
import { Skeleton } from "@beep/ui/components/skeleton";
import { Textarea } from "@beep/ui/components/textarea";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { ArrowsLeftRightIcon } from "@phosphor-icons/react/ArrowsLeftRight";
import { BookOpenTextIcon } from "@phosphor-icons/react/BookOpenText";
import { CheckCircleIcon } from "@phosphor-icons/react/CheckCircle";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/ClockCounterClockwise";
import { FileMagnifyingGlassIcon as FileSearchIcon } from "@phosphor-icons/react/FileMagnifyingGlass";
import { ScalesIcon } from "@phosphor-icons/react/Scales";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import { XCircleIcon } from "@phosphor-icons/react/XCircle";
import { DateTime, Match, Number as N, Result } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { EvidenceSourcePanel } from "./EvidenceSourcePanel.tsx";
import type { ContradictionDisposition } from "@beep/epistemic-domain/entities/Contradiction";
import type { ContradictionResolutionProposal } from "@beep/epistemic-domain/values/Contradiction";
import type { ContradictionCandidateId } from "@beep/shared-domain/identity/Epistemic";
import type { RpcClientError } from "effect/unstable/rpc";
import type { JSX } from "react";

const $I = $EpistemicUiId.create("ContradictionTriage/ContradictionTriageView");
const ContradictionTriageTabBase = LiteralKit(["queue", "comparison", "source"]);

/**
 * Narrow-layout panes available in the contradiction-triage workspace.
 *
 * **Example** (Log comparison enum member)
 *
 * ```ts
 * import { ContradictionTriageTab } from "@beep/epistemic-ui"
 *
 * console.log(ContradictionTriageTab.Enum.comparison)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContradictionTriageTab = ContradictionTriageTabBase.pipe(
  $I.annoteSchema("ContradictionTriageTab", {
    description: "Controlled narrow-layout pane selected in the contradiction-triage workspace.",
  }),
  SchemaUtils.withLiteralKitStatics(ContradictionTriageTabBase)
);

/**
 * Narrow-layout pane selected by the contradiction-triage host.
 *
 * **Example** (Assign comparison tab literal)
 *
 * ```ts
 * import type { ContradictionTriageTab } from "@beep/epistemic-ui"
 *
 * const tab: ContradictionTriageTab = "comparison"
 * console.log(tab)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ContradictionTriageTab = typeof ContradictionTriageTab.Type;

type ContradictionTriageError = ContradictionTriage.ContradictionActionError | RpcClientError.RpcClientError;

/**
 * Props for the controlled contradiction-triage presentation.
 *
 * **Details**
 *
 * Every mutable value is supplied by the host so an Atom-connected wrapper can
 * own filters, selections, dialog draft state, RPC results, and mutations
 * without introducing component-local React state.
 *
 * **Example** (Render view with props)
 *
 * ```tsx
 * import {
 *   ContradictionTriageView,
 *   type ContradictionTriageViewProps,
 * } from "@beep/epistemic-ui"
 *
 * const renderTriage = (props: ContradictionTriageViewProps) => (
 *   <ContradictionTriageView {...props} />
 * )
 *
 * console.log(renderTriage)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export interface ContradictionTriageViewProps {
  readonly activeTab: ContradictionTriageTab;
  readonly detailResult: AsyncResult.AsyncResult<
    ContradictionTriage.ContradictionCandidateDetailView,
    ContradictionTriageError
  >;
  readonly onActiveTabChange: (tab: ContradictionTriageTab) => void;
  readonly onCandidateSelect: (candidateId: ContradictionCandidateId) => void;
  readonly onDetailRetry: () => void;
  readonly onDispositionChange: (disposition: ContradictionTriage.ContradictionDispositionFilter) => void;
  readonly onEvidenceSelect: (evidence: ContradictionTriage.ContradictionEvidenceView) => void;
  readonly onKnownAtChange: (knownAt: DateTime.DateTime | null) => void;
  readonly onNextQueuePage: () => void;
  readonly onPreviousQueuePage: () => void;
  readonly onQueueRetry: () => void;
  readonly onRejectRequested: () => void;
  readonly onResetNow: () => void;
  readonly onReviewConfirm: () => void;
  readonly onReviewDialogOpenChange: (open: boolean) => void;
  readonly onReviewReasonChange: (reason: string) => void;
  readonly onSourcePageChange: (pageIndex: number) => void;
  readonly onSourceRetry: () => void;
  readonly onSupersedeRequested: (proposal: ContradictionResolutionProposal) => void;
  readonly onValidAtChange: (validAt: DateTime.DateTime | null) => void;
  readonly query: ContradictionTriage.ContradictionListPayload;
  readonly queueResult: AsyncResult.AsyncResult<
    ContradictionTriage.ContradictionCandidatePage,
    ContradictionTriageError
  >;
  readonly reviewDialogOpen: boolean;
  readonly reviewReason: string;
  readonly reviewResult: AsyncResult.AsyncResult<ContradictionDisposition, ContradictionTriageError>;
  readonly selectedCandidateId: O.Option<ContradictionCandidateId>;
  readonly selectedProposal: O.Option<ContradictionResolutionProposal>;
  readonly selectedSource: O.Option<ContradictionTriage.EvidenceSourcePagePayload>;
  readonly sourceResult: AsyncResult.AsyncResult<ContradictionTriage.EvidenceSourcePage, ContradictionTriageError>;
}

interface ActionErrorCopy {
  readonly description: string;
  readonly title: string;
}

interface QueuePaneProps {
  readonly onCandidateSelect: ContradictionTriageViewProps["onCandidateSelect"];
  readonly onNextQueuePage: ContradictionTriageViewProps["onNextQueuePage"];
  readonly onPreviousQueuePage: ContradictionTriageViewProps["onPreviousQueuePage"];
  readonly onQueueRetry: ContradictionTriageViewProps["onQueueRetry"];
  readonly query: ContradictionTriageViewProps["query"];
  readonly queueResult: ContradictionTriageViewProps["queueResult"];
  readonly selectedCandidateId: ContradictionTriageViewProps["selectedCandidateId"];
}

interface ComparisonPaneProps {
  readonly detailResult: ContradictionTriageViewProps["detailResult"];
  readonly knownAt: ContradictionTriageViewProps["query"]["knownAt"];
  readonly onDetailRetry: ContradictionTriageViewProps["onDetailRetry"];
  readonly onEvidenceSelect: ContradictionTriageViewProps["onEvidenceSelect"];
  readonly onRejectRequested: ContradictionTriageViewProps["onRejectRequested"];
  readonly onSupersedeRequested: ContradictionTriageViewProps["onSupersedeRequested"];
  readonly reviewResult: ContradictionTriageViewProps["reviewResult"];
  readonly selectedCandidateId: ContradictionTriageViewProps["selectedCandidateId"];
  readonly selectedProposal: ContradictionTriageViewProps["selectedProposal"];
  readonly selectedSource: ContradictionTriageViewProps["selectedSource"];
}

interface SourcePaneProps {
  readonly onSourcePageChange: ContradictionTriageViewProps["onSourcePageChange"];
  readonly onSourceRetry: ContradictionTriageViewProps["onSourceRetry"];
  readonly selectedSource: ContradictionTriageViewProps["selectedSource"];
  readonly sourceResult: ContradictionTriageViewProps["sourceResult"];
}

interface BeliefCardProps {
  readonly beliefView: ContradictionTriage.ContradictionBeliefView;
  readonly label: "Left belief" | "Right belief";
  readonly onEvidenceSelect: ContradictionTriageViewProps["onEvidenceSelect"];
  readonly selectedSource: ContradictionTriageViewProps["selectedSource"];
  readonly side: "left" | "right";
}

const encodeFact = S.encodeUnknownResult(S.fromJsonString(S.Unknown));

const shortDigest = (digest: string): string => `${Str.takeLeft(12)(digest)}…`;

const proposalTargetLabel = (proposal: ContradictionResolutionProposal): string =>
  `Lineage ${shortDigest(proposal.losingBelief.logicalKey)} · edge ${proposal.losingBelief.edgeVersionId} · version ${proposal.losingBelief.version}`;

const formatDateTime = (value: DateTime.DateTime): string =>
  DateTime.format(value, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const formatOptionalDateTime = (value: O.Option<DateTime.DateTime>): string =>
  O.match(value, {
    onNone: () => "Open",
    onSome: formatDateTime,
  });

const formatFact = (fact: Readonly<Record<string, unknown>>): string =>
  Result.match(encodeFact(fact), {
    onFailure: () => "The persisted fact could not be displayed.",
    onSuccess: (encoded) => encoded,
  });

const confidencePercent = (confidence: number): string => `${N.round(N.multiply(confidence, 100), 0)}%`;

const dispositionLabel = (disposition: O.Option<ContradictionDisposition>): string =>
  O.match(disposition, {
    onNone: () => "Open",
    onSome: ({ decision }) =>
      Match.value(decision.status).pipe(
        Match.when("rejected", () => "Rejected"),
        Match.when("superseded", () => "Superseded"),
        Match.exhaustive
      ),
  });

const reviewDisposition = (
  result: ComparisonPaneProps["reviewResult"],
  candidateId: ContradictionCandidateId,
  knownAt: ComparisonPaneProps["knownAt"]
): O.Option<ContradictionDisposition> =>
  AsyncResult.match(result, {
    onInitial: O.none,
    onFailure: O.none,
    onSuccess: ({ value }) =>
      Eq.equals(value.candidateId, candidateId) && DateTime.isLessThanOrEqualTo(value.resolvedAt, knownAt)
        ? O.some(value)
        : O.none(),
  });

const actionErrorCopy = (reason: ContradictionTriage.ContradictionActionErrorReason): ActionErrorCopy =>
  Match.value(reason).pipe(
    Match.when("candidate-not-found", () => ({
      title: "Candidate unavailable",
      description: "This contradiction is no longer available. Refresh the queue and choose another candidate.",
    })),
    Match.when("evidence-not-in-candidate", () => ({
      title: "Evidence changed",
      description: "The selected evidence is not part of this candidate. Refresh the candidate before continuing.",
    })),
    Match.when("source-access-denied", () => ({
      title: "Source access denied",
      description: "You do not have access to the canonical source for this evidence.",
    })),
    Match.when("source-unavailable", () => ({
      title: "Source unavailable",
      description: "The canonical source cannot be loaded right now. Try again later.",
    })),
    Match.when("source-stale", () => ({
      title: "Source verification is stale",
      description: "The canonical text has changed since this evidence was verified. Refresh before relying on it.",
    })),
    Match.when("page-out-of-range", () => ({
      title: "Source page unavailable",
      description: "That source page is outside the verified canonical text.",
    })),
    Match.when("candidate-already-resolved", () => ({
      title: "Candidate already resolved",
      description: "Another review resolved this contradiction. Refresh to see the recorded disposition.",
    })),
    Match.when("stale-candidate", () => ({
      title: "Candidate changed",
      description: "Your review used an older candidate version. Refresh and review the persisted state again.",
    })),
    Match.when("belief-mismatch", () => ({
      title: "Belief lineage changed",
      description: "A belief no longer matches the version reviewed here. Refresh before making a decision.",
    })),
    Match.when("proposal-not-found", () => ({
      title: "Proposal unavailable",
      description: "The selected persisted proposal is no longer available. Refresh the candidate.",
    })),
    Match.when("proposal-digest-mismatch", () => ({
      title: "Proposal changed",
      description: "The persisted proposal no longer matches the reviewed digest. Refresh and inspect it again.",
    })),
    Match.when("unavailable", () => ({
      title: "Triage unavailable",
      description: "The contradiction service cannot complete this request right now. Try again.",
    })),
    Match.exhaustive
  );

function ActionErrorAlert({
  error,
  onRetry,
  testId,
}: {
  readonly error: ContradictionTriage.ContradictionActionError;
  readonly onRetry?: (() => void) | undefined;
  readonly testId: string;
}): JSX.Element {
  const copy = actionErrorCopy(error.reason);

  return (
    <Alert data-testid={testId} variant="destructive">
      <WarningCircleIcon aria-hidden="true" />
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertDescription>{copy.description}</AlertDescription>
      {onRetry === undefined ? null : (
        <AlertAction>
          <Button onClick={onRetry} size="sm" type="button" variant="outline">
            <ArrowClockwiseIcon aria-hidden="true" data-icon="inline-start" />
            Retry
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}

function TriageErrorAlert({
  error,
  onRetry,
  testId,
}: {
  readonly error: ContradictionTriageError;
  readonly onRetry?: (() => void) | undefined;
  readonly testId: string;
}): JSX.Element {
  if (ContradictionTriage.ContradictionActionError.is(error)) {
    return <ActionErrorAlert error={error} onRetry={onRetry} testId={testId} />;
  }

  return (
    <Alert data-testid={testId} variant="destructive">
      <WarningCircleIcon aria-hidden="true" />
      <AlertTitle>Triage connection unavailable</AlertTitle>
      <AlertDescription>
        The triage service could not be reached. Check the connection and retry; no decision was recorded.
      </AlertDescription>
      {onRetry === undefined ? null : (
        <AlertAction>
          <Button onClick={onRetry} size="sm" type="button" variant="outline">
            <ArrowClockwiseIcon aria-hidden="true" data-icon="inline-start" />
            Retry
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}

function DefectAlert({
  onRetry,
  testId,
}: {
  readonly onRetry?: (() => void) | undefined;
  readonly testId: string;
}): JSX.Element {
  return (
    <Alert data-testid={testId} variant="destructive">
      <WarningCircleIcon aria-hidden="true" />
      <AlertTitle>Unexpected triage failure</AlertTitle>
      <AlertDescription>
        This view could not safely interpret the response. Retry, or reopen the workspace if the problem continues.
      </AlertDescription>
      {onRetry === undefined ? null : (
        <AlertAction>
          <Button onClick={onRetry} size="sm" type="button" variant="outline">
            <ArrowClockwiseIcon aria-hidden="true" data-icon="inline-start" />
            Retry
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}

function PaneLoading({ label, testId }: { readonly label: string; readonly testId: string }): JSX.Element {
  return (
    <div aria-busy="true" aria-label={label} className="grid gap-3 p-4" data-testid={testId} role="status">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function QueueRow({
  item,
  onCandidateSelect,
  selected,
}: {
  readonly item: ContradictionTriage.ContradictionCandidateView;
  readonly onCandidateSelect: QueuePaneProps["onCandidateSelect"];
  readonly selected: boolean;
}): JSX.Element {
  const { candidate } = item;

  return (
    <Button
      aria-pressed={selected}
      className="h-auto w-full justify-start whitespace-normal px-3 py-3 text-left"
      data-testid="contradiction-candidate-row"
      onClick={() => onCandidateSelect(candidate.id)}
      type="button"
      variant={selected ? "secondary" : "ghost"}
    >
      <span className="grid min-w-0 flex-1 gap-1.5">
        <span className="flex min-w-0 items-start justify-between gap-2">
          <span
            className="line-clamp-2 min-w-0 text-sm font-medium"
            data-testid="contradiction-candidate-summary"
            title={candidate.summary}
          >
            {candidate.summary}
          </span>
          <Badge variant={O.isNone(item.disposition) ? "outline" : "secondary"}>
            {dispositionLabel(item.disposition)}
          </Badge>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{candidate.kind}</span>
          <span aria-hidden="true">·</span>
          <span>{confidencePercent(candidate.confidence)} confidence</span>
          <span aria-hidden="true">·</span>
          <span>row v{candidate.rowVersion}</span>
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground/80">
          <span className="min-w-0 truncate font-mono" title={candidate.candidateKey}>
            {shortDigest(candidate.candidateKey)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="min-w-0 truncate" title={`${candidate.detector}@${candidate.detectorVersion}`}>
            {candidate.detector}@{candidate.detectorVersion}
          </span>
        </span>
      </span>
    </Button>
  );
}

const queuePageLabel = (
  page: ContradictionTriage.ContradictionCandidatePage,
  offset: ContradictionTriage.ContradictionListPayload["offset"]
): string =>
  A.match(page.items, {
    onEmpty: () => `${page.total} total`,
    onNonEmpty: (items) => `${offset + 1}–${N.min(offset + items.length, page.total)} of ${page.total}`,
  });

function QueueSuccess({
  onCandidateSelect,
  onNextQueuePage,
  onPreviousQueuePage,
  page,
  query,
  selectedCandidateId,
  waiting,
}: Pick<
  QueuePaneProps,
  "onCandidateSelect" | "onNextQueuePage" | "onPreviousQueuePage" | "query" | "selectedCandidateId"
> & {
  readonly page: ContradictionTriage.ContradictionCandidatePage;
  readonly waiting: boolean;
}): JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="contradiction-queue-success">
      {waiting ? (
        <div className="px-3 pt-3">
          <Badge variant="secondary">
            <ArrowClockwiseIcon aria-hidden="true" data-icon="inline-start" />
            Refreshing queue
          </Badge>
        </div>
      ) : null}
      {A.match(page.items, {
        onEmpty: () => (
          <Empty className="border-0" data-testid="contradiction-queue-empty">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CheckCircleIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No matching contradictions</EmptyTitle>
              <EmptyDescription>
                No candidates match this disposition and bitemporal view. Adjust the filters or reset to now.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ),
        onNonEmpty: (items) => (
          <div className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto p-2">
            {A.map(items, (item) => (
              <QueueRow
                item={item}
                key={item.candidate.id}
                onCandidateSelect={onCandidateSelect}
                selected={O.exists(selectedCandidateId, (id) => Eq.equals(id, item.candidate.id))}
              />
            ))}
          </div>
        ),
      })}
      <div className="flex items-center justify-between gap-2 border-t p-3">
        <Button
          disabled={query.offset === 0 || waiting}
          onClick={onPreviousQueuePage}
          size="sm"
          type="button"
          variant="outline"
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {queuePageLabel(page, query.offset)}
        </span>
        <Button
          disabled={query.offset + page.items.length >= page.total || waiting}
          onClick={onNextQueuePage}
          size="sm"
          type="button"
          variant="outline"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function QueuePane({
  onCandidateSelect,
  onNextQueuePage,
  onPreviousQueuePage,
  onQueueRetry,
  query,
  queueResult,
  selectedCandidateId,
}: QueuePaneProps): JSX.Element {
  const body = AsyncResult.matchWithError(queueResult, {
    onInitial: () => <PaneLoading label="Loading contradiction queue" testId="contradiction-queue-loading" />,
    onError: (error) => (
      <div className="p-3">
        <TriageErrorAlert error={error} onRetry={onQueueRetry} testId="contradiction-queue-error" />
      </div>
    ),
    onDefect: () => (
      <div className="p-3">
        <DefectAlert onRetry={onQueueRetry} testId="contradiction-queue-error" />
      </div>
    ),
    onSuccess: ({ value, waiting }) => (
      <QueueSuccess
        onCandidateSelect={onCandidateSelect}
        onNextQueuePage={onNextQueuePage}
        onPreviousQueuePage={onPreviousQueuePage}
        page={value}
        query={query}
        selectedCandidateId={selectedCandidateId}
        waiting={waiting}
      />
    ),
  });

  return (
    <Card className="h-full min-h-0" data-testid="contradiction-queue-pane">
      <CardHeader className="border-b">
        <CardTitle>Candidate queue</CardTitle>
        <CardDescription>Persisted candidates ordered for human review.</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">{body}</CardContent>
    </Card>
  );
}

function EvidenceList({
  evidence,
  onEvidenceSelect,
  selectedSource,
}: {
  readonly evidence: ReadonlyArray<ContradictionTriage.ContradictionEvidenceView>;
  readonly onEvidenceSelect: BeliefCardProps["onEvidenceSelect"];
  readonly selectedSource: BeliefCardProps["selectedSource"];
}): JSX.Element {
  return A.match(evidence, {
    onEmpty: () => <p className="text-sm text-muted-foreground">No evidence was assigned to this belief.</p>,
    onNonEmpty: (items) => (
      <div className="grid gap-2">
        {A.map(items, (item) => {
          const hasVerifiedAnchor = O.isSome(item.verifiedAnchor);
          const selected = O.exists(selectedSource, ({ evidenceId }) => Eq.equals(evidenceId, item.evidence.id));

          return (
            <div className="grid gap-2 rounded-lg border bg-muted/20 p-3" key={item.evidence.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">Evidence {item.evidence.id}</span>
                <Badge variant={hasVerifiedAnchor ? "secondary" : "outline"}>
                  {hasVerifiedAnchor ? "Verified source" : "Source unavailable"}
                </Badge>
              </div>
              <blockquote className="border-l-2 pl-3 text-sm leading-relaxed">{item.evidence.span.quote}</blockquote>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {confidencePercent(item.evidence.span.confidence)} span confidence
                </span>
                <Button
                  aria-pressed={selected}
                  data-testid="contradiction-evidence-source"
                  disabled={!hasVerifiedAnchor}
                  onClick={() => onEvidenceSelect(item)}
                  size="sm"
                  type="button"
                  variant={selected ? "secondary" : "outline"}
                >
                  <BookOpenTextIcon aria-hidden="true" data-icon="inline-start" />
                  {selected ? "Source selected" : "Inspect source"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    ),
  });
}

function BeliefCard({ beliefView, label, onEvidenceSelect, selectedSource, side }: BeliefCardProps): JSX.Element {
  const { belief } = beliefView;

  return (
    <Card className="min-w-0" data-testid={`contradiction-belief-${side}`} size="sm">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{label}</CardTitle>
          <Badge variant="outline">No preferred side</Badge>
        </div>
        <CardDescription>
          {belief.relation} · logical version {belief.version}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <section className="grid gap-2" aria-label={`${label} persisted fact`}>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Persisted fact</h3>
          <pre
            className="whitespace-pre-wrap wrap-anywhere rounded-lg bg-muted p-3 text-xs leading-relaxed"
            data-testid="contradiction-belief-fact"
          >
            {formatFact(belief.fact)}
          </pre>
        </section>
        <dl className="grid gap-x-3 gap-y-2 text-xs sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-muted-foreground">Logical key</dt>
            <dd className="truncate font-mono" title={belief.logicalKey}>
              {shortDigest(belief.logicalKey)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Row version</dt>
            <dd>{belief.rowVersion}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Valid from</dt>
            <dd>{formatDateTime(belief.validFrom)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Valid to</dt>
            <dd>{formatOptionalDateTime(belief.validTo)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Known from</dt>
            <dd>{formatDateTime(belief.recordedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Known to</dt>
            <dd>{formatOptionalDateTime(belief.expiredAt)}</dd>
          </div>
        </dl>
        <section className="grid gap-2" aria-label={`${label} evidence`}>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence</h3>
          <EvidenceList
            evidence={beliefView.evidence}
            onEvidenceSelect={onEvidenceSelect}
            selectedSource={selectedSource}
          />
        </section>
      </CardContent>
    </Card>
  );
}

function ProposalCard({
  disabled,
  onSupersedeRequested,
  proposal,
  resolution,
  selected,
}: {
  readonly disabled: boolean;
  readonly onSupersedeRequested: ComparisonPaneProps["onSupersedeRequested"];
  readonly proposal: ContradictionResolutionProposal;
  readonly resolution: O.Option<ContradictionDisposition>;
  readonly selected: boolean;
}): JSX.Element {
  const applied = O.exists(resolution, (disposition) =>
    Match.value(disposition.decision).pipe(
      Match.when({ status: "rejected" }, () => false),
      Match.when({ status: "superseded" }, (decision) => Eq.equals(decision.proposalId, proposal.proposalId)),
      Match.exhaustive
    )
  );

  return (
    <Card data-applied={applied} data-testid="contradiction-proposal" size="sm">
      <CardHeader className="border-b">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <CardTitle>Persisted replacement</CardTitle>
          <Badge
            data-testid={applied ? "contradiction-proposal-applied" : undefined}
            variant={applied ? "default" : "outline"}
          >
            {applied ? "Applied proposal" : "Explicit proposal"}
          </Badge>
        </div>
        <CardDescription>{proposal.rationale}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <pre
          className="whitespace-pre-wrap wrap-anywhere rounded-lg bg-muted p-3 text-xs leading-relaxed"
          data-testid="contradiction-proposal-fact"
        >
          {formatFact(proposal.fact)}
        </pre>
        <dl className="grid gap-x-3 gap-y-2 text-xs sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-muted-foreground">Proposal id</dt>
            <dd className="truncate font-mono" title={proposal.proposalId}>
              {shortDigest(proposal.proposalId)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Replaces belief</dt>
            <dd
              className="truncate"
              data-testid="contradiction-proposal-target"
              title={proposal.losingBelief.logicalKey}
            >
              {proposalTargetLabel(proposal)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Valid from</dt>
            <dd>{formatDateTime(proposal.validFrom)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Valid to</dt>
            <dd>{formatOptionalDateTime(proposal.validTo)}</dd>
          </div>
        </dl>
        {O.match(resolution, {
          onNone: () => (
            <Button
              aria-pressed={selected}
              data-testid="contradiction-supersede-request"
              disabled={disabled}
              onClick={() => onSupersedeRequested(proposal)}
              type="button"
              variant={selected ? "secondary" : "default"}
            >
              <ScalesIcon aria-hidden="true" data-icon="inline-start" />
              Review this proposal
            </Button>
          ),
          onSome: (disposition) => (
            <p
              className="flex items-center gap-2 text-xs text-muted-foreground"
              data-testid="contradiction-proposal-resolved"
            >
              <CheckCircleIcon aria-hidden="true" className="shrink-0" />
              Candidate {disposition.decision.status} — review actions are closed for this candidate.
            </p>
          ),
        })}
      </CardContent>
    </Card>
  );
}

function DispositionAlert({ disposition }: { readonly disposition: ContradictionDisposition }): JSX.Element {
  const content = Match.value(disposition.decision).pipe(
    Match.when({ status: "rejected" }, (decision) => ({
      title: "Candidate rejected",
      description: decision.reason,
    })),
    Match.when({ status: "superseded" }, (decision) => ({
      title: "Supersession recorded",
      description: decision.reason,
    })),
    Match.exhaustive
  );

  return (
    <Alert data-testid="contradiction-resolved">
      <CheckCircleIcon aria-hidden="true" />
      <AlertTitle>{content.title}</AlertTitle>
      <AlertDescription>
        {content.description} Resolved {formatDateTime(disposition.resolvedAt)}.
      </AlertDescription>
    </Alert>
  );
}

function ReviewStatus({ result }: { readonly result: ComparisonPaneProps["reviewResult"] }): JSX.Element | null {
  return AsyncResult.matchWithError(result, {
    onInitial: ({ waiting }) =>
      waiting ? (
        <Alert aria-live="polite" data-testid="contradiction-review-pending">
          <ArrowClockwiseIcon aria-hidden="true" />
          <AlertTitle>Recording decision</AlertTitle>
          <AlertDescription>The persisted candidate and proposal are being verified.</AlertDescription>
        </Alert>
      ) : null,
    onError: (error) => (
      <TriageErrorAlert
        error={error}
        testId={
          ContradictionTriage.ContradictionActionError.is(error) &&
          (error.reason === "stale-candidate" || error.reason === "candidate-already-resolved")
            ? "contradiction-review-stale"
            : "contradiction-review-error"
        }
      />
    ),
    onDefect: () => <DefectAlert testId="contradiction-review-error" />,
    onSuccess: ({ value, waiting }) => (
      <Alert aria-live="polite" data-testid="contradiction-review-success">
        <CheckCircleIcon aria-hidden="true" />
        <AlertTitle>Decision recorded</AlertTitle>
        <AlertDescription>
          The candidate is {value.decision.status}. {waiting ? "Refreshing persisted state…" : ""}
        </AlertDescription>
      </Alert>
    ),
  });
}

function CandidateComparison({
  detail,
  knownAt,
  onEvidenceSelect,
  onRejectRequested,
  onSupersedeRequested,
  reviewResult,
  selectedProposal,
  selectedSource,
  waiting,
}: {
  readonly detail: ContradictionTriage.ContradictionCandidateDetailView;
  readonly knownAt: ComparisonPaneProps["knownAt"];
  readonly onEvidenceSelect: ComparisonPaneProps["onEvidenceSelect"];
  readonly onRejectRequested: ComparisonPaneProps["onRejectRequested"];
  readonly onSupersedeRequested: ComparisonPaneProps["onSupersedeRequested"];
  readonly reviewResult: ComparisonPaneProps["reviewResult"];
  readonly selectedProposal: ComparisonPaneProps["selectedProposal"];
  readonly selectedSource: ComparisonPaneProps["selectedSource"];
  readonly waiting: boolean;
}): JSX.Element {
  const settledDisposition = O.orElse(detail.disposition, () =>
    reviewDisposition(reviewResult, detail.candidate.id, knownAt)
  );
  const resolved = O.isSome(settledDisposition);
  const reviewBusy = AsyncResult.isWaiting(reviewResult);
  const actionsDisabled = resolved || reviewBusy || waiting;

  return (
    <div className="grid gap-4 p-4" data-testid="contradiction-detail-success">
      {waiting ? (
        <Badge variant="secondary">
          <ArrowClockwiseIcon aria-hidden="true" data-icon="inline-start" />
          Refreshing candidate
        </Badge>
      ) : null}
      <ReviewStatus result={reviewResult} />
      {O.match(detail.disposition, {
        onNone: () => null,
        onSome: (disposition) => <DispositionAlert disposition={disposition} />,
      })}
      <section className="grid gap-3" aria-labelledby="contradiction-comparison-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold" id="contradiction-comparison-heading">
              Exact belief comparison
            </h2>
            <p className="text-sm text-muted-foreground">
              Canonical left and right ordering is shown symmetrically; review the evidence for each exact version.
            </p>
          </div>
          <Badge variant="outline">
            {confidencePercent(detail.candidate.assessment.confidence)} detector confidence
          </Badge>
        </div>
        <div className="grid gap-3 @3xl/compare:grid-cols-2">
          <BeliefCard
            beliefView={detail.left}
            label="Left belief"
            onEvidenceSelect={onEvidenceSelect}
            selectedSource={selectedSource}
            side="left"
          />
          <BeliefCard
            beliefView={detail.right}
            label="Right belief"
            onEvidenceSelect={onEvidenceSelect}
            selectedSource={selectedSource}
            side="right"
          />
        </div>
      </section>
      <section className="grid gap-3" aria-labelledby="contradiction-proposals-heading">
        <div>
          <h2 className="text-lg font-semibold" id="contradiction-proposals-heading">
            Persisted resolution proposals
          </h2>
          <p className="text-sm text-muted-foreground">
            Approval applies the selected persisted fact and validity exactly as shown. Facts cannot be edited here.
          </p>
        </div>
        <div className="grid gap-3">
          {A.map(detail.candidate.assessment.proposals, (proposal) => (
            <ProposalCard
              disabled={actionsDisabled}
              key={proposal.proposalId}
              onSupersedeRequested={onSupersedeRequested}
              proposal={proposal}
              resolution={settledDisposition}
              selected={O.exists(selectedProposal, (selected) => Eq.equals(selected.proposalId, proposal.proposalId))}
            />
          ))}
        </div>
      </section>
      <div className="flex justify-end border-t pt-4 data-[resolved=true]:justify-start" data-resolved={resolved}>
        {O.match(settledDisposition, {
          onNone: () => (
            <Button
              data-testid="contradiction-reject-request"
              disabled={actionsDisabled}
              onClick={onRejectRequested}
              type="button"
              variant="destructive"
            >
              <XCircleIcon aria-hidden="true" data-icon="inline-start" />
              Reject candidate
            </Button>
          ),
          onSome: (disposition) => (
            <p className="flex min-w-0 items-center gap-2 text-sm" data-testid="contradiction-actions-resolved">
              <CheckCircleIcon aria-hidden="true" className="shrink-0" />
              <span className="min-w-0">
                <span className="font-medium">{dispositionLabel(O.some(disposition))}</span>
                <span className="text-muted-foreground"> — {disposition.decision.reason}</span>
              </span>
            </p>
          ),
        })}
      </div>
    </div>
  );
}

function ComparisonPane({
  detailResult,
  knownAt,
  onDetailRetry,
  onEvidenceSelect,
  onRejectRequested,
  onSupersedeRequested,
  reviewResult,
  selectedCandidateId,
  selectedProposal,
  selectedSource,
}: ComparisonPaneProps): JSX.Element {
  const body = O.isNone(selectedCandidateId) ? (
    <Empty className="border-0" data-testid="contradiction-detail-empty">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ArrowsLeftRightIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Select a candidate</EmptyTitle>
        <EmptyDescription>
          Choose a queue item to compare both exact belief versions, their evidence, and persisted proposals.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  ) : (
    AsyncResult.matchWithError(detailResult, {
      onInitial: () => <PaneLoading label="Loading candidate comparison" testId="contradiction-detail-loading" />,
      onError: (error) => (
        <div className="p-4">
          <TriageErrorAlert error={error} onRetry={onDetailRetry} testId="contradiction-detail-error" />
        </div>
      ),
      onDefect: () => (
        <div className="p-4">
          <DefectAlert onRetry={onDetailRetry} testId="contradiction-detail-error" />
        </div>
      ),
      onSuccess: ({ value, waiting }) => (
        <CandidateComparison
          detail={value}
          knownAt={knownAt}
          onEvidenceSelect={onEvidenceSelect}
          onRejectRequested={onRejectRequested}
          onSupersedeRequested={onSupersedeRequested}
          reviewResult={reviewResult}
          selectedProposal={selectedProposal}
          selectedSource={selectedSource}
          waiting={waiting}
        />
      ),
    })
  );

  return (
    <Card className="h-full min-h-0" data-testid="contradiction-comparison-pane">
      <CardContent className="min-h-0 flex-1 overflow-y-auto p-0">{body}</CardContent>
    </Card>
  );
}

function SourcePane({ onSourcePageChange, onSourceRetry, selectedSource, sourceResult }: SourcePaneProps): JSX.Element {
  const body = O.isNone(selectedSource) ? (
    <Card className="h-full min-h-0">
      <CardContent className="flex min-h-0 flex-1 flex-col justify-center p-0">
        <Empty className="border-0" data-testid="contradiction-source-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileSearchIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Select verified evidence</EmptyTitle>
            <EmptyDescription>
              Use an evidence action beside either belief to inspect its exact canonical source span.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  ) : (
    AsyncResult.matchWithError(sourceResult, {
      onInitial: () => <PaneLoading label="Loading verified source" testId="contradiction-source-loading" />,
      onError: (error) => (
        <div className="p-3">
          <TriageErrorAlert error={error} onRetry={onSourceRetry} testId="contradiction-source-error" />
        </div>
      ),
      onDefect: () => (
        <div className="p-3">
          <DefectAlert onRetry={onSourceRetry} testId="contradiction-source-error" />
        </div>
      ),
      onSuccess: ({ value, waiting }) => (
        <EvidenceSourcePanel
          highlight={value.highlight}
          loading={waiting}
          onPageChange={onSourcePageChange}
          page={value.page}
        />
      ),
    })
  );

  return (
    <div className="h-full min-h-0" data-testid="contradiction-source-pane">
      {body}
    </div>
  );
}

function ReviewDialog({
  onReviewConfirm,
  onReviewDialogOpenChange,
  onReviewReasonChange,
  open,
  reason,
  reviewResult,
  selectedProposal,
}: {
  readonly onReviewConfirm: ContradictionTriageViewProps["onReviewConfirm"];
  readonly onReviewDialogOpenChange: ContradictionTriageViewProps["onReviewDialogOpenChange"];
  readonly onReviewReasonChange: ContradictionTriageViewProps["onReviewReasonChange"];
  readonly open: ContradictionTriageViewProps["reviewDialogOpen"];
  readonly reason: ContradictionTriageViewProps["reviewReason"];
  readonly reviewResult: ContradictionTriageViewProps["reviewResult"];
  readonly selectedProposal: ContradictionTriageViewProps["selectedProposal"];
}): JSX.Element {
  const supersession = O.isSome(selectedProposal);
  const normalizedReason = Str.trim(reason);
  const reasonMissing = Str.isEmpty(normalizedReason);
  const reasonTooLong = Str.length(normalizedReason) > CONTRADICTION_REVIEW_REASON_MAX_LENGTH;
  const reasonInvalid = reasonMissing || reasonTooLong;
  const confirmDisabled = reasonInvalid || AsyncResult.isWaiting(reviewResult);
  const reviewCopy = Bool.match(supersession, {
    onFalse: () => ({
      action: "Confirm rejection",
      description: "The candidate will be resolved as rejected without changing either belief.",
      title: "Reject this contradiction candidate?",
      variant: "destructive" as const,
    }),
    onTrue: () => ({
      action: "Approve supersession",
      description: "The selected persisted replacement will supersede its recorded belief lineage exactly as shown.",
      title: "Approve this persisted supersession?",
      variant: "default" as const,
    }),
  });
  const reasonDescription = Bool.match(reasonTooLong, {
    onFalse: () => "This reason is persisted with the human disposition. The proposed fact is read-only.",
    onTrue: () => `Review reasons must contain at most ${CONTRADICTION_REVIEW_REASON_MAX_LENGTH} characters.`,
  });

  return (
    <AlertDialog onOpenChange={onReviewDialogOpenChange} open={open}>
      <AlertDialogContent data-testid="contradiction-review-dialog" size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{reviewCopy.title}</AlertDialogTitle>
          <AlertDialogDescription>{reviewCopy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {O.match(selectedProposal, {
          onNone: () => null,
          onSome: (proposal) => (
            <div className="grid gap-1 rounded-lg border bg-muted/30 p-3 text-xs">
              <span className="text-muted-foreground">Selected proposal</span>
              <span className="truncate font-mono" title={proposal.proposalId}>
                {shortDigest(proposal.proposalId)}
              </span>
              <span data-testid="contradiction-review-proposal-target" title={proposal.losingBelief.logicalKey}>
                {proposalTargetLabel(proposal)}
              </span>
            </div>
          ),
        })}
        <FieldGroup>
          <Field data-invalid={reasonInvalid}>
            <FieldLabel htmlFor="contradiction-review-reason">Required review reason</FieldLabel>
            <Textarea
              aria-invalid={reasonInvalid}
              data-testid="contradiction-review-reason"
              id="contradiction-review-reason"
              maxLength={CONTRADICTION_REVIEW_REASON_MAX_LENGTH}
              onChange={(event) => onReviewReasonChange(event.currentTarget.value)}
              placeholder="Explain the evidence and reasoning behind this decision."
              required
              value={reason}
            />
            <FieldDescription>{reasonDescription}</FieldDescription>
          </Field>
        </FieldGroup>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            data-testid="contradiction-review-confirm"
            disabled={confirmDisabled}
            onClick={onReviewConfirm}
            variant={reviewCopy.variant}
          >
            {reviewCopy.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface TriageToolbarProps {
  readonly onDispositionChange: ContradictionTriageViewProps["onDispositionChange"];
  readonly onKnownAtChange: ContradictionTriageViewProps["onKnownAtChange"];
  readonly onResetNow: ContradictionTriageViewProps["onResetNow"];
  readonly onValidAtChange: ContradictionTriageViewProps["onValidAtChange"];
  readonly query: ContradictionTriageViewProps["query"];
}

function TriageToolbar({
  onDispositionChange,
  onKnownAtChange,
  onResetNow,
  onValidAtChange,
  query,
}: TriageToolbarProps): JSX.Element {
  return (
    <Card size="sm">
      <CardContent className="flex flex-wrap items-end gap-3">
        <Field className="min-w-64 flex-1" orientation="vertical">
          <FieldLabel id="contradiction-disposition-filter-label">Disposition</FieldLabel>
          <div
            aria-labelledby="contradiction-disposition-filter-label"
            className="flex flex-wrap gap-1"
            data-testid="contradiction-disposition-filter"
            role="group"
          >
            <Button
              aria-pressed={query.disposition === "all"}
              onClick={() => onDispositionChange("all")}
              size="sm"
              type="button"
              variant={query.disposition === "all" ? "secondary" : "outline"}
            >
              All
            </Button>
            <Button
              aria-pressed={query.disposition === "open"}
              onClick={() => onDispositionChange("open")}
              size="sm"
              type="button"
              variant={query.disposition === "open" ? "secondary" : "outline"}
            >
              Open
            </Button>
            <Button
              aria-pressed={query.disposition === "rejected"}
              onClick={() => onDispositionChange("rejected")}
              size="sm"
              type="button"
              variant={query.disposition === "rejected" ? "secondary" : "outline"}
            >
              Rejected
            </Button>
            <Button
              aria-pressed={query.disposition === "superseded"}
              onClick={() => onDispositionChange("superseded")}
              size="sm"
              type="button"
              variant={query.disposition === "superseded" ? "secondary" : "outline"}
            >
              Superseded
            </Button>
          </div>
        </Field>
        <div className="min-w-56 flex-1" data-testid="contradiction-valid-at">
          <EffectDateTimePicker label="Valid at" onValueChange={onValidAtChange} value={query.validAt} />
        </div>
        <div className="min-w-56 flex-1" data-testid="contradiction-known-at">
          <EffectDateTimePicker label="Known at" onValueChange={onKnownAtChange} value={query.knownAt} />
        </div>
        <Button data-testid="contradiction-reset-now" onClick={onResetNow} type="button" variant="outline">
          <ClockCounterClockwiseIcon aria-hidden="true" data-icon="inline-start" />
          Reset now
        </Button>
      </CardContent>
    </Card>
  );
}

interface NarrowTriageTabsProps {
  readonly activeTab: ContradictionTriageViewProps["activeTab"];
  readonly onActiveTabChange: ContradictionTriageViewProps["onActiveTabChange"];
}

function NarrowTriageTabs({ activeTab, onActiveTabChange }: NarrowTriageTabsProps): JSX.Element {
  return (
    <div
      aria-label="Contradiction triage panes"
      className="grid w-full grid-cols-3 gap-1 rounded-lg bg-muted p-[3px] @6xl/triage:hidden"
      data-testid="contradiction-narrow-layout"
      role="group"
    >
      <Button
        aria-pressed={activeTab === "queue"}
        className="aria-pressed:bg-background aria-pressed:shadow-sm"
        data-testid="contradiction-tab-queue"
        onClick={() => onActiveTabChange("queue")}
        size="sm"
        type="button"
        variant="ghost"
      >
        <FileSearchIcon aria-hidden="true" />
        Queue
      </Button>
      <Button
        aria-pressed={activeTab === "comparison"}
        className="aria-pressed:bg-background aria-pressed:shadow-sm"
        data-testid="contradiction-tab-comparison"
        onClick={() => onActiveTabChange("comparison")}
        size="sm"
        type="button"
        variant="ghost"
      >
        <ArrowsLeftRightIcon aria-hidden="true" />
        Compare
      </Button>
      <Button
        aria-pressed={activeTab === "source"}
        className="aria-pressed:bg-background aria-pressed:shadow-sm"
        data-testid="contradiction-tab-source"
        onClick={() => onActiveTabChange("source")}
        size="sm"
        type="button"
        variant="ghost"
      >
        <BookOpenTextIcon aria-hidden="true" />
        Source
      </Button>
    </div>
  );
}

interface TriagePanesProps {
  readonly activeTab: ContradictionTriageViewProps["activeTab"];
  readonly comparisonPane: JSX.Element;
  readonly queuePane: JSX.Element;
  readonly sourcePane: JSX.Element;
}

function TriagePanes({ activeTab, comparisonPane, queuePane, sourcePane }: TriagePanesProps): JSX.Element {
  return (
    <div
      className="min-h-0 flex-1 @6xl/triage:grid @6xl/triage:grid-cols-[minmax(15rem,0.8fr)_minmax(34rem,2fr)_minmax(19rem,1fr)] @6xl/triage:gap-3"
      data-testid="contradiction-wide-layout"
    >
      <div
        aria-label="Candidate queue"
        className="h-full min-h-0 @max-6xl/triage:data-[active=false]:hidden"
        data-active={activeTab === "queue"}
        role="region"
      >
        {queuePane}
      </div>
      <div
        aria-label="Belief comparison"
        className="@container/compare h-full min-h-0 @max-6xl/triage:data-[active=false]:hidden"
        data-active={activeTab === "comparison"}
        role="region"
      >
        {comparisonPane}
      </div>
      <div
        aria-label="Verified source"
        className="h-full min-h-0 @max-6xl/triage:data-[active=false]:hidden"
        data-active={activeTab === "source"}
        role="region"
      >
        {sourcePane}
      </div>
    </div>
  );
}

/**
 * Render a controlled three-pane contradiction-triage workspace.
 *
 * **Details**
 *
 * Layout follows the triage panel's container width, not the viewport: wide
 * panels show queue, symmetric belief comparison, and verified source side by
 * side, while narrow panels expose the same panes through controlled tabs.
 * All domain and mutation state remains host-owned and directly compatible
 * with the epistemic client atoms.
 *
 * **Example** (Wrap controlled triage view)
 *
 * ```tsx
 * import {
 *   ContradictionTriageView,
 *   type ContradictionTriageViewProps,
 * } from "@beep/epistemic-ui"
 *
 * export function ControlledTriage(props: ContradictionTriageViewProps) {
 *   return <ContradictionTriageView {...props} />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ContradictionTriageView(props: ContradictionTriageViewProps): JSX.Element {
  const queuePane = (
    <QueuePane
      onCandidateSelect={props.onCandidateSelect}
      onNextQueuePage={props.onNextQueuePage}
      onPreviousQueuePage={props.onPreviousQueuePage}
      onQueueRetry={props.onQueueRetry}
      query={props.query}
      queueResult={props.queueResult}
      selectedCandidateId={props.selectedCandidateId}
    />
  );
  const comparisonPane = (
    <ComparisonPane
      detailResult={props.detailResult}
      knownAt={props.query.knownAt}
      onDetailRetry={props.onDetailRetry}
      onEvidenceSelect={props.onEvidenceSelect}
      onRejectRequested={props.onRejectRequested}
      onSupersedeRequested={props.onSupersedeRequested}
      reviewResult={props.reviewResult}
      selectedCandidateId={props.selectedCandidateId}
      selectedProposal={props.selectedProposal}
      selectedSource={props.selectedSource}
    />
  );
  const sourcePane = (
    <SourcePane
      onSourcePageChange={props.onSourcePageChange}
      onSourceRetry={props.onSourceRetry}
      selectedSource={props.selectedSource}
      sourceResult={props.sourceResult}
    />
  );

  return (
    <section
      aria-label="Contradiction triage"
      className="@container/triage flex h-full min-h-0 flex-col gap-3 bg-muted/20 p-3"
      data-testid="contradiction-triage-view"
    >
      <TriageToolbar
        onDispositionChange={props.onDispositionChange}
        onKnownAtChange={props.onKnownAtChange}
        onResetNow={props.onResetNow}
        onValidAtChange={props.onValidAtChange}
        query={props.query}
      />
      <NarrowTriageTabs activeTab={props.activeTab} onActiveTabChange={props.onActiveTabChange} />
      <TriagePanes
        activeTab={props.activeTab}
        comparisonPane={comparisonPane}
        queuePane={queuePane}
        sourcePane={sourcePane}
      />

      <ReviewDialog
        onReviewConfirm={props.onReviewConfirm}
        onReviewDialogOpenChange={props.onReviewDialogOpenChange}
        onReviewReasonChange={props.onReviewReasonChange}
        open={props.reviewDialogOpen}
        reason={props.reviewReason}
        reviewResult={props.reviewResult}
        selectedProposal={props.selectedProposal}
      />
    </section>
  );
}
