// @vitest-environment jsdom

import { ContradictionDisposition } from "@beep/epistemic-domain/entities/Contradiction";
import { ContradictionTriageView } from "@beep/epistemic-ui";
import { ContradictionTriage } from "@beep/epistemic-use-cases/public";
import * as Cause from "effect/Cause";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as RpcClientError from "effect/unstable/rpc/RpcClientError";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContradictionTriageViewProps } from "@beep/epistemic-ui";
import type { Root } from "react-dom/client";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const digest = "a".repeat(64);
const otherDigest = "b".repeat(64);
const proposalId = "c".repeat(64);
const proposalDigest = "d".repeat(64);
const sourceDigest = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const systemPrincipal = { component: "Runtime", kind: "System" } as const;

const baseEntity = (entityType: string, id: number) => ({
  createdAt: 1_000 + id,
  createdByPrincipal: systemPrincipal,
  entityType,
  id,
  orgId: 1,
  publicId: `${entityType.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()}_a${id}`,
  rowVersion: 1,
  schemaVersion: "0.0.0",
  source: "System",
  updatedAt: 2_000 + id,
  updatedByPrincipal: systemPrincipal,
});

const sourceIdentity = {
  extractor: { name: "utf8", version: "1" },
  locator: "documents/signed-amendment.txt",
  normalizationVersion: "1",
  scopeRef: "workspace:1",
  sourceDigest,
  sourceRef: "signed-amendment",
  textDigest: sourceDigest,
};

const verifiedAnchorInput = {
  anchor: { endChar: 20, quote: "signed amendment", startChar: 4 },
  source: sourceIdentity,
};

const leftEvidenceInput = {
  ...baseEntity("EpistemicEvidence", 3),
  artifactFixtureKey: "artifact:signed-amendment",
  span: {
    confidence: 0.98,
    endChar: 20,
    quote: "signed amendment",
    startChar: 4,
  },
  spanFixtureKey: "span:signed-amendment:4-20",
};

const rightEvidenceInput = {
  ...baseEntity("EpistemicEvidence", 4),
  artifactFixtureKey: "artifact:unsigned-draft",
  span: {
    confidence: 0.72,
    endChar: 24,
    quote: "unsigned working draft",
    startChar: 2,
  },
  spanFixtureKey: "span:unsigned-draft:2-24",
};

const edgeInput = (id: number, logicalKey: string, amount: string, evidenceId: number, recordedAt: number) => ({
  ...baseEntity("EpistemicEdgeVersion", id),
  evidenceScope: null,
  expiredAt: null,
  fact: { amount, currency: "USD" },
  logicalKey,
  matterScope: null,
  qualifiers: { instrument: "agreement" },
  recordedAt,
  relation: "supports",
  sourceClaimId: 7,
  sourceEntityRef: null,
  sourceEvidenceId: null,
  sourceKind: "claim",
  sourceObservationRef: null,
  supersedesId: null,
  targetClaimId: null,
  targetEntityRef: null,
  targetEvidenceId: evidenceId,
  targetKind: "evidence",
  targetObservationRef: null,
  validFrom: 1_000,
  validTo: null,
  version: 1,
});

const proposalInput = {
  fact: { amount: "125", currency: "USD" },
  losingBelief: {
    edgeVersionId: 1,
    logicalKey: digest,
    version: 1,
  },
  proposalDigest,
  proposalId,
  rationale: "The signed amendment controls over the earlier draft.",
  validFrom: 1_000,
  validTo: null,
};

const candidateInput = {
  ...baseEntity("EpistemicContradictionCandidate", 20),
  assessment: {
    confidence: 0.94,
    proposals: [proposalInput],
  },
  candidateDigest: otherDigest,
  candidateKey: digest,
  matchBasis: {
    detector: "contract-amount-check",
    detectorVersion: "0.0.0",
    evidenceDigest: digest,
    kind: "independent-evidence",
    leftEvidenceIds: [3],
    rightEvidenceIds: [4],
  },
  pair: {
    left: { edgeVersionId: 1, logicalKey: digest, version: 1 },
    right: { edgeVersionId: 2, logicalKey: otherDigest, version: 1 },
  },
  recordedAt: 1_200,
  validFrom: 1_000,
  validTo: null,
};

const detail = Result.getOrThrow(
  S.decodeUnknownResult(ContradictionTriage.ContradictionCandidateDetailView)({
    candidate: candidateInput,
    disposition: null,
    left: {
      belief: edgeInput(1, digest, "100", 3, 1_100),
      evidence: [{ evidence: leftEvidenceInput, verifiedAnchor: verifiedAnchorInput }],
    },
    right: {
      belief: edgeInput(2, otherDigest, "150", 4, 1_150),
      evidence: [{ evidence: rightEvidenceInput, verifiedAnchor: null }],
    },
  })
);

const queuePage = Result.getOrThrow(
  S.decodeUnknownResult(ContradictionTriage.ContradictionCandidatePage)({
    items: [{ candidate: candidateInput, disposition: null }],
    total: 1,
  })
);

const emptyQueuePage = Result.getOrThrow(
  S.decodeUnknownResult(ContradictionTriage.ContradictionCandidatePage)({
    items: [],
    total: 0,
  })
);
const staleEmptyQueuePage = Result.getOrThrow(
  S.decodeUnknownResult(ContradictionTriage.ContradictionCandidatePage)({
    items: [],
    total: 1,
  })
);

const query = Result.getOrThrow(
  S.decodeUnknownResult(ContradictionTriage.ContradictionListPayload)({
    disposition: "open",
    knownAt: 2_000,
    limit: 50,
    offset: 0,
    validAt: 1_500,
  })
);

const queryAfterReview = ContradictionTriage.ContradictionListPayload.make({
  ...query,
  knownAt: Result.getOrThrow(S.decodeUnknownResult(ContradictionTriage.ContradictionListPayload.fields.knownAt)(3_000)),
});
const queryAfterEmptyPage = ContradictionTriage.ContradictionListPayload.make({
  ...query,
  offset: ContradictionTriage.ContradictionListPayload.fields.offset.make(50),
});

const sourceRequest = Result.getOrThrow(
  S.decodeUnknownResult(ContradictionTriage.EvidenceSourcePagePayload)({
    candidateId: 20,
    evidenceId: 3,
    knownAt: 2_000,
    selector: ContradictionTriage.EvidenceSourcePageSelector.cases.anchor.make({}),
    validAt: 1_500,
  })
);

const sourcePage = Result.getOrThrow(
  S.decodeUnknownResult(ContradictionTriage.EvidenceSourcePage)({
    evidenceId: 3,
    highlight: {
      endChar: verifiedAnchorInput.anchor.endChar,
      source: verifiedAnchorInput.source,
      startChar: verifiedAnchorInput.anchor.startChar,
    },
    page: {
      endOffset: 52,
      hasNextPage: false,
      hasPreviousPage: false,
      identity: sourceIdentity,
      pageCount: 1,
      pageIndex: 0,
      pageSizeCodeUnits: 65_536,
      startOffset: 0,
      text: "The signed amendment sets the amount to 125 dollars.",
      totalCodeUnits: 52,
    },
  })
);

const resolvedDisposition = Result.getOrThrow(
  S.decodeUnknownResult(ContradictionDisposition)({
    ...baseEntity("EpistemicContradictionDisposition", 30),
    candidateId: 20,
    decision: {
      reason: "The instruments concern different obligations.",
      status: "rejected",
    },
    resolvedAt: 2_500,
    resolvedBy: systemPrincipal,
  })
);

const resolvedDetail = ContradictionTriage.ContradictionCandidateDetailView.make({
  ...detail,
  disposition: O.some(resolvedDisposition),
});

const supersededDisposition = Result.getOrThrow(
  S.decodeUnknownResult(ContradictionDisposition)({
    ...baseEntity("EpistemicContradictionDisposition", 31),
    candidateId: 20,
    decision: {
      formerEdgeVersionId: 2,
      proposalDigest,
      proposalId,
      reason: "The signed amendment is authoritative.",
      replacementEdgeVersionId: 33,
      status: "superseded",
    },
    resolvedAt: 2_600,
    resolvedBy: systemPrincipal,
  })
);

const foreignDisposition = Result.getOrThrow(
  S.decodeUnknownResult(ContradictionDisposition)({
    ...baseEntity("EpistemicContradictionDisposition", 32),
    candidateId: 21,
    decision: {
      formerEdgeVersionId: 2,
      proposalDigest,
      proposalId,
      reason: "A different candidate was superseded.",
      replacementEdgeVersionId: 34,
      status: "superseded",
    },
    resolvedAt: 2_700,
    resolvedBy: systemPrincipal,
  })
);

const transportError = RpcClientError.RpcClientError.make({
  reason: RpcClientError.RpcClientDefect.make({
    cause: "private transport diagnostic",
    message: "private endpoint path",
  }),
});

const noOp = () => undefined;

const makeProps = (overrides: Partial<ContradictionTriageViewProps> = {}): ContradictionTriageViewProps => ({
  activeTab: "comparison",
  detailResult: AsyncResult.success(detail),
  onActiveTabChange: noOp,
  onCandidateSelect: noOp,
  onDetailRetry: noOp,
  onDispositionChange: noOp,
  onEvidenceSelect: noOp,
  onKnownAtChange: noOp,
  onNextQueuePage: noOp,
  onPreviousQueuePage: noOp,
  onQueueRetry: noOp,
  onRejectRequested: noOp,
  onResetNow: noOp,
  onReviewConfirm: noOp,
  onReviewDialogOpenChange: noOp,
  onReviewReasonChange: noOp,
  onSourcePageChange: noOp,
  onSourceRetry: noOp,
  onSupersedeRequested: noOp,
  onValidAtChange: noOp,
  query,
  queueResult: AsyncResult.success(queuePage),
  reviewDialogOpen: false,
  reviewReason: "",
  reviewResult: AsyncResult.initial(),
  selectedCandidateId: O.some(detail.candidate.id),
  selectedProposal: O.none(),
  selectedSource: O.some(sourceRequest),
  sourceResult: AsyncResult.success(sourcePage),
  ...overrides,
});

const flushMicrotaskUpdates = (): Promise<void> => Promise.resolve(act(() => Promise.resolve()));

const renderView = (root: Root, props: ContradictionTriageViewProps = makeProps()): Promise<void> => {
  act(() => root.render(<ContradictionTriageView {...props} />));
  return flushMicrotaskUpdates();
};

const requireButton = (container: ParentNode, label: string): HTMLButtonElement => {
  for (const button of container.querySelectorAll("button")) {
    if (button.textContent?.includes(label) === true) {
      return button;
    }
  }
  throw new Error(`Expected button containing "${label}".`);
};

const requireElement = <ElementType extends Element>(
  container: ParentNode,
  selector: string,
  constructor: { new (): ElementType }
): ElementType => {
  const element = container.querySelector(selector);
  if (element instanceof constructor) {
    return element;
  }
  throw new Error(`Expected ${selector}.`);
};

const enterTextareaValue = (element: HTMLTextAreaElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (setter === undefined) {
    throw new Error("Expected the native textarea value setter.");
  }
  setter.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("ContradictionTriageView", { concurrent: false }, () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders symmetric exact beliefs, persisted proposals, and verified source text", () =>
    renderView(root).then(() => {
      const left = requireElement(container, '[data-testid="contradiction-belief-left"]', HTMLElement);
      const right = requireElement(container, '[data-testid="contradiction-belief-right"]', HTMLElement);

      expect(left.textContent).toContain("Left belief");
      expect(left.textContent).toContain('"amount":"100"');
      expect(left.textContent).toContain("No preferred side");
      expect(right.textContent).toContain("Right belief");
      expect(right.textContent).toContain('"amount":"150"');
      expect(right.textContent).toContain("No preferred side");
      expect(container.textContent).toContain("The signed amendment controls over the earlier draft.");
      expect(container.textContent).toContain("Facts cannot be edited here.");
      expect(container.innerHTML).toContain(">signed amendment</mark>");
      expect(container.querySelectorAll('[data-testid="contradiction-candidate-row"]')).toHaveLength(1);
      expect(container.querySelectorAll('[data-slot="verified-source-anchor"]')).toHaveLength(1);
      expect(container.textContent?.toLowerCase()).not.toContain("winner");
    }));

  it("forwards controlled filters, selections, tabs, review draft, and confirmation", () => {
    const onActiveTabChange = vi.fn();
    const onCandidateSelect = vi.fn();
    const onDispositionChange = vi.fn();
    const onEvidenceSelect = vi.fn();
    const onRejectRequested = vi.fn();
    const onResetNow = vi.fn();
    const onReviewConfirm = vi.fn();
    const onReviewReasonChange = vi.fn();
    const onSupersedeRequested = vi.fn();

    return renderView(
      root,
      makeProps({
        onActiveTabChange,
        onCandidateSelect,
        onDispositionChange,
        onEvidenceSelect,
        onRejectRequested,
        onResetNow,
        onSupersedeRequested,
      })
    ).then(() => {
      act(() => requireButton(container, "Rejected").click());
      act(() => requireButton(container, "Reset now").click());
      act(() => {
        const sourceTab = requireElement(container, '[data-testid="contradiction-tab-source"]', HTMLButtonElement);
        sourceTab.focus();
        sourceTab.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      act(() => requireButton(container, "aaaaaaaaaaaa…").click());
      act(() => requireButton(container, "Source selected").click());
      act(() => requireButton(container, "Review this proposal").click());
      act(() => requireButton(container, "Reject candidate").click());

      expect({
        candidate: onCandidateSelect.mock.calls.length,
        disposition: onDispositionChange.mock.calls.length,
        evidence: onEvidenceSelect.mock.calls.length,
        proposal: onSupersedeRequested.mock.calls.length,
        reject: onRejectRequested.mock.calls.length,
        reset: onResetNow.mock.calls.length,
        tab: onActiveTabChange.mock.calls.length,
      }).toStrictEqual({
        candidate: 1,
        disposition: 1,
        evidence: 1,
        proposal: 1,
        reject: 1,
        reset: 1,
        tab: 1,
      });
      expect({
        candidate: onCandidateSelect.mock.calls[0]?.[0],
        disposition: onDispositionChange.mock.calls[0]?.[0],
        evidence: onEvidenceSelect.mock.calls[0]?.[0],
        proposal: onSupersedeRequested.mock.calls[0]?.[0],
        tab: onActiveTabChange.mock.calls[0]?.[0],
      }).toStrictEqual({
        candidate: detail.candidate.id,
        disposition: "rejected",
        evidence: detail.left.evidence[0],
        proposal: detail.candidate.assessment.proposals[0],
        tab: "source",
      });

      act(() =>
        root.render(
          <ContradictionTriageView
            {...makeProps({
              onReviewConfirm,
              onReviewReasonChange,
              reviewDialogOpen: true,
              reviewReason: "The signed amendment is controlling.",
              selectedProposal: O.some(detail.candidate.assessment.proposals[0]),
            })}
          />
        )
      );

      const reason = requireElement(document, '[data-testid="contradiction-review-reason"]', HTMLTextAreaElement);
      act(() => enterTextareaValue(reason, "The executed amendment is controlling."));
      act(() => requireButton(document, "Approve supersession").click());

      expect(onReviewReasonChange).toHaveBeenCalledWith("The executed amendment is controlling.");
      expect(onReviewConfirm).toHaveBeenCalledOnce();
    });
  });

  it("makes loading, empty, stale, failure, and resolved states explicit", () =>
    renderView(
      root,
      makeProps({
        detailResult: AsyncResult.initial(true),
        queueResult: AsyncResult.initial(true),
        reviewResult: AsyncResult.initial(true),
        sourceResult: AsyncResult.initial(true),
      })
    ).then(() => {
      expect(container.querySelector('[data-testid="contradiction-queue-loading"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="contradiction-detail-loading"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="contradiction-source-loading"]')).not.toBeNull();

      act(() =>
        root.render(
          <ContradictionTriageView
            {...makeProps({
              queueResult: AsyncResult.failure(transportError.pipe(Cause.fail)),
            })}
          />
        )
      );

      expect(container.textContent).toContain("Triage connection unavailable");
      expect(container.textContent).not.toContain("private endpoint path");
      expect(container.textContent).not.toContain("private transport diagnostic");

      act(() =>
        root.render(
          <ContradictionTriageView
            {...makeProps({
              queueResult: AsyncResult.success(emptyQueuePage),
              reviewResult: AsyncResult.failure(
                ContradictionTriage.ContradictionActionError.make({ reason: "stale-candidate" }).pipe(Cause.fail)
              ),
              sourceResult: AsyncResult.failure(
                ContradictionTriage.ContradictionActionError.make({ reason: "source-stale" }).pipe(Cause.fail)
              ),
            })}
          />
        )
      );

      expect(container.textContent).toContain("No matching contradictions");
      expect(container.textContent).toContain("Candidate changed");
      expect(container.textContent).toContain("Source verification is stale");

      act(() =>
        root.render(
          <ContradictionTriageView
            {...makeProps({
              detailResult: AsyncResult.success(resolvedDetail),
            })}
          />
        )
      );

      expect(container.textContent).toContain("Candidate rejected");
      expect(container.querySelector('[data-testid="contradiction-reject-request"]')).toBeNull();
      expect(container.querySelector('[data-testid="contradiction-supersede-request"]')).toBeNull();
      const resolvedActions = requireElement(container, '[data-testid="contradiction-actions-resolved"]', HTMLElement);
      expect(resolvedActions.textContent).toContain("Rejected");
      expect(resolvedActions.textContent).toContain("The instruments concern different obligations.");
      expect(container.querySelector('[data-testid="contradiction-proposal-resolved"]')).not.toBeNull();
      return flushMicrotaskUpdates();
    }));

  it("keeps backward navigation available on an empty noninitial page", () => {
    const onPreviousQueuePage = vi.fn();

    return renderView(
      root,
      makeProps({
        onPreviousQueuePage,
        query: queryAfterEmptyPage,
        queueResult: AsyncResult.success(staleEmptyQueuePage),
      })
    ).then(() => {
      const previous = requireButton(container, "Previous");
      expect(previous.disabled).toBe(false);

      act(() => previous.click());
      expect(onPreviousQueuePage).toHaveBeenCalledOnce();
      expect(container.textContent).toContain("1 total");
    });
  });

  it("treats a successful review as authoritative at or after its resolution time", () =>
    renderView(
      root,
      makeProps({
        query: queryAfterReview,
        reviewResult: AsyncResult.success(supersededDisposition),
      })
    ).then(() => {
      expect(container.querySelector('[data-testid="contradiction-review-success"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="contradiction-reject-request"]')).toBeNull();
      expect(container.querySelector('[data-testid="contradiction-supersede-request"]')).toBeNull();
      const resolvedActions = requireElement(container, '[data-testid="contradiction-actions-resolved"]', HTMLElement);
      expect(resolvedActions.textContent).toContain("Superseded");
      expect(resolvedActions.textContent).toContain("The signed amendment is authoritative.");
      const proposalResolved = requireElement(
        container,
        '[data-testid="contradiction-proposal-resolved"]',
        HTMLElement
      );
      expect(proposalResolved.textContent).toContain("superseded");

      act(() =>
        root.render(
          <ContradictionTriageView
            {...makeProps({
              reviewResult: AsyncResult.success(foreignDisposition),
            })}
          />
        )
      );

      expect(container.querySelector('[data-testid="contradiction-actions-resolved"]')).toBeNull();
      expect(requireButton(container, "Reject candidate").disabled).toBe(false);
      expect(requireButton(container, "Review this proposal").disabled).toBe(false);
    }));

  it("keeps a historical detail open when a successful review resolved after knownAt", () =>
    renderView(
      root,
      makeProps({
        reviewResult: AsyncResult.success(supersededDisposition),
      })
    ).then(() => {
      expect(container.querySelector('[data-testid="contradiction-review-success"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="contradiction-actions-resolved"]')).toBeNull();
      expect(container.querySelector('[data-testid="contradiction-proposal-resolved"]')).toBeNull();
      expect(requireButton(container, "Reject candidate").disabled).toBe(false);
      expect(requireButton(container, "Review this proposal").disabled).toBe(false);
    }));

  it("labels queue rows with persisted proposal rationale and demotes hash metadata", () =>
    renderView(root).then(() => {
      const summary = requireElement(container, '[data-testid="contradiction-candidate-summary"]', HTMLElement);
      expect(summary.textContent).toBe("The signed amendment controls over the earlier draft.");

      const row = requireElement(container, '[data-testid="contradiction-candidate-row"]', HTMLElement);
      expect(row.textContent).toContain("aaaaaaaaaaaa…");
      expect(row.textContent).toContain("contract-amount-check@0.0.0");
    }));

  it("wraps exact persisted JSON and drives the pane layout from the triage container", () =>
    renderView(root).then(() => {
      const view = requireElement(container, '[data-testid="contradiction-triage-view"]', HTMLElement);
      expect(view.className).toContain("@container/triage");

      const tabs = requireElement(container, '[data-testid="contradiction-narrow-layout"]', HTMLElement);
      expect(tabs.className).toContain("@6xl/triage:hidden");

      const wide = requireElement(container, '[data-testid="contradiction-wide-layout"]', HTMLElement);
      expect(wide.className).toContain("@6xl/triage:grid");
      expect(container.querySelectorAll('[data-testid="contradiction-queue-pane"]')).toHaveLength(1);
      expect(container.querySelectorAll('[data-testid="contradiction-comparison-pane"]')).toHaveLength(1);
      expect(container.querySelectorAll('[data-testid="contradiction-source-pane"]')).toHaveLength(1);

      const factBlocks = container.querySelectorAll('[data-testid="contradiction-belief-fact"]');
      expect(factBlocks).toHaveLength(2);
      for (const block of factBlocks) {
        expect(block.className).toContain("whitespace-pre-wrap");
        expect(block.className).toContain("wrap-anywhere");
        expect(block.className).not.toContain("overflow-auto");
        expect(block.className).not.toContain("max-h-");
      }

      const proposalFact = requireElement(container, '[data-testid="contradiction-proposal-fact"]', HTMLElement);
      expect(proposalFact.className).toContain("whitespace-pre-wrap");
      expect(proposalFact.className).toContain("wrap-anywhere");
    }));
});
