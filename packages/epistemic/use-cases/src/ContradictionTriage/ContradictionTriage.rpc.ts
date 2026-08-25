/**
 * Client-safe contradiction-triage RPC and read-model contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ContradictionCandidate, ContradictionDisposition } from "@beep/epistemic-domain/entities/Contradiction";
import { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import { Evidence } from "@beep/epistemic-domain/entities/Evidence";
import { SourceTextPage } from "@beep/file-processing/SourceText";
import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { NonNegativeInt } from "@beep/schema/Int";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import * as SharedEpistemic from "@beep/shared-domain/identity/Epistemic";
import { identity, Number as N } from "effect";
import * as S from "effect/Schema";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import {
  ContradictionCandidatePageLimit,
  ContradictionDispositionFilter,
  GetContradictionCandidate,
  ReviewContradictionCandidate,
} from "./ContradictionTriage.commands.ts";
import { ContradictionCandidatePage } from "./ContradictionTriage.ports.ts";

const $I = $EpistemicUseCasesId.create("ContradictionTriage/ContradictionTriage.rpc");

/**
 * Client-owned filters and pagination for the contradiction queue.
 *
 * **Details**
 *
 * Organization scope is deliberately absent. The authenticated server derives
 * it instead of trusting a renderer-supplied tenant identity.
 *
 * **Example** (Check disposition field presence)
 *
 * ```ts
 * import { ContradictionListPayload } from "@beep/epistemic-use-cases/public"
 *
 * console.log(ContradictionListPayload.fields.disposition !== undefined)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class ContradictionListPayload extends S.Class<ContradictionListPayload>($I`ContradictionListPayload`)(
  {
    disposition: ContradictionDispositionFilter.annotateKey({
      description: "Disposition state included in the queue.",
    }),
    knownAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Transaction-time instant at which candidate state is requested.",
    }),
    limit: ContradictionCandidatePageLimit.annotateKey({
      description: "Maximum number of ordered candidate rows returned.",
    }),
    offset: NonNegativeInt.annotateKey({
      description: "Number of ordered candidate rows skipped.",
    }),
    validAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Valid-time instant at which contradiction applicability is requested.",
    }),
  },
  $I.annote("ContradictionListPayload", {
    description: "Client-safe contradiction queue filters without renderer-controlled organization scope.",
  })
) {}

const EvidenceSourcePageSelectorBase = LiteralKit(["anchor", "page"]).toTaggedUnion("kind")({
  anchor: {},
  page: {
    pageIndex: NonNegativeInt.annotateKey({
      description: "Zero-based canonical source-text page index.",
    }),
  },
});

/**
 * Selects the source page containing the persisted anchor start, or one
 * explicit page returned by a prior source-page response.
 *
 * **Details**
 *
 * The anchor selector keeps surrogate-safe page-boundary calculation inside
 * the server, which owns the complete canonical text. A renderer therefore
 * never guesses an initial page from a nominal page size.
 *
 * **Example** (Make anchor selector case)
 *
 * ```ts
 * import { EvidenceSourcePageSelector } from "@beep/epistemic-use-cases/public"
 *
 * const selector = EvidenceSourcePageSelector.cases.anchor.make({})
 * console.log(selector.kind) // "anchor"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const EvidenceSourcePageSelector = EvidenceSourcePageSelectorBase.pipe(
  $I.annoteSchema("EvidenceSourcePageSelector", {
    description: "Server-resolved anchor page or explicit canonical source-text page selection.",
  })
);

/**
 * Runtime type for {@link EvidenceSourcePageSelector}.
 *
 * **Example** (Type anchor selector value)
 *
 * ```ts
 * import type { EvidenceSourcePageSelector } from "@beep/epistemic-use-cases/public"
 *
 * const selector: EvidenceSourcePageSelector = { kind: "anchor" }
 * console.log(selector.kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EvidenceSourcePageSelector = typeof EvidenceSourcePageSelector.Type;

/**
 * Renderer request for one bounded page of verified canonical source text.
 *
 * **Details**
 *
 * The server derives organization scope and the exact source identity from the
 * persisted candidate and evidence verification. The renderer can select only
 * an evidence row already bound to the candidate and either its exact anchor
 * page or one explicit page returned by prior navigation.
 *
 * **Example** (Check selector field presence)
 *
 * ```ts
 * import { EvidenceSourcePagePayload } from "@beep/epistemic-use-cases/public"
 *
 * console.log(EvidenceSourcePagePayload.fields.selector !== undefined)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class EvidenceSourcePagePayload extends S.Class<EvidenceSourcePagePayload>($I`EvidenceSourcePagePayload`)(
  {
    candidateId: Epistemic.ContradictionCandidateId.annotateKey({
      description: "Candidate establishing the authorized evidence set.",
    }),
    evidenceId: SharedEpistemic.EvidenceId.annotateKey({
      description: "Candidate-bound evidence whose verified source is requested.",
    }),
    knownAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Transaction-time instant at which candidate state is requested.",
    }),
    selector: EvidenceSourcePageSelector.annotateKey({
      description: "Anchor-containing initial page or explicit page requested during navigation.",
    }),
    validAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Valid-time instant at which contradiction applicability is requested.",
    }),
  },
  $I.annote("EvidenceSourcePagePayload", {
    description: "Narrow source-page payload containing candidate, evidence, temporal view, and page selection.",
  })
) {}

/**
 * Evidence shown beneath one exact belief version.
 *
 * **Details**
 *
 * A missing persisted verification receipt is explicit and keeps the source
 * action disabled; it never falls back to an unverified quote.
 *
 * **Example** (Check verifiedAnchor field)
 *
 * ```ts
 * import { ContradictionEvidenceView } from "@beep/epistemic-use-cases/public"
 *
 * console.log(ContradictionEvidenceView.fields.verifiedAnchor !== undefined)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class ContradictionEvidenceView extends S.Class<ContradictionEvidenceView>($I`ContradictionEvidenceView`)(
  {
    evidence: Evidence.annotateKey({
      description: "Persisted evidence row grounding this side of the contradiction.",
    }),
    verifiedAnchor: TextAnchorVerificationReceipt.pipe(S.OptionFromNullOr).annotateKey({
      description: "Persisted exact-anchor verification receipt when one is available for this evidence.",
    }),
  },
  $I.annote("ContradictionEvidenceView", {
    description: "One evidence row paired with its optional persisted exact-anchor verification receipt.",
  })
) {}

/**
 * One exact immutable belief and the evidence assigned to its side.
 *
 * **Example** (Check belief field presence)
 *
 * ```ts
 * import { ContradictionBeliefView } from "@beep/epistemic-use-cases/public"
 *
 * console.log(ContradictionBeliefView.fields.belief !== undefined)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class ContradictionBeliefView extends S.Class<ContradictionBeliefView>($I`ContradictionBeliefView`)(
  {
    belief: EdgeVersion.annotateKey({
      description: "Exact immutable edge version observed by the contradiction detector.",
    }),
    evidence: S.Array(ContradictionEvidenceView).annotateKey({
      description: "Evidence rows bound to this canonical side of the contradiction.",
    }),
  },
  $I.annote("ContradictionBeliefView", {
    description: "Exact immutable belief version with its side-bound evidence and verified anchors.",
  })
) {}

/**
 * Expanded candidate view used by the human triage workspace.
 *
 * **Details**
 *
 * `left` and `right` preserve the candidate's canonical ordering. Neither side
 * is marked preferred or authoritative by this read model.
 *
 * **Example** (Check left field presence)
 *
 * ```ts
 * import { ContradictionCandidateDetailView } from "@beep/epistemic-use-cases/public"
 *
 * console.log(ContradictionCandidateDetailView.fields.left !== undefined)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class ContradictionCandidateDetailView extends S.Class<ContradictionCandidateDetailView>(
  $I`ContradictionCandidateDetailView`
)(
  {
    candidate: ContradictionCandidate.annotateKey({
      description: "Immutable candidate applicable at validAt and recorded no later than knownAt.",
    }),
    disposition: ContradictionDisposition.pipe(S.OptionFromNullOr).annotateKey({
      description: "Recorded human disposition only when its resolvedAt instant is no later than knownAt.",
    }),
    left: ContradictionBeliefView.annotateKey({
      description: "First exact belief and evidence in canonical candidate order.",
    }),
    right: ContradictionBeliefView.annotateKey({
      description: "Second exact belief and evidence in canonical candidate order.",
    }),
  },
  $I.annote("ContradictionCandidateDetailView", {
    description:
      "Two-axis-visible candidate, optional disposition, and exact belief-and-evidence views without ranking.",
  })
) {}

class EvidenceSourceHighlightStruct extends S.Class<EvidenceSourceHighlightStruct>($I`EvidenceSourceHighlightStruct`)(
  {
    endChar: NonNegativeInt.annotateKey({
      description: "Exclusive absolute UTF-16 code-unit offset of the verified anchor.",
    }),
    source: SourceTextIdentity.annotateKey({
      description: "Exact source manifestation against which the offsets were verified.",
    }),
    startChar: NonNegativeInt.annotateKey({
      description: "Inclusive absolute UTF-16 code-unit offset of the verified anchor.",
    }),
  },
  $I.annote("EvidenceSourceHighlightStruct", {
    description: "Structural base for a quote-free source highlight before its half-open range is checked.",
  })
) {}

const EvidenceSourceHighlightSchema = EvidenceSourceHighlightStruct.mapFields(identity)
  .check(
    S.makeFilter(({ endChar, startChar }) => N.isLessThan(startChar, endChar), {
      identifier: $I`EvidenceSourceHighlightOrderCheck`,
      title: "Evidence Source Highlight Order",
      description: "Checks that the quote-free highlight is a non-empty forward half-open UTF-16 range.",
      message: "Expected startChar to be less than endChar.",
    })
  )
  .annotate({
    toArbitrary: () => (fc) =>
      fc
        .tuple(fc.nat(10_000), fc.integer({ min: 1, max: 10_000 }), S.toArbitrary(SourceTextIdentity)(fc))
        .map(([startChar, width, source]) =>
          EvidenceSourceHighlightStruct.make({
            endChar: NonNegativeInt.make(startChar + width),
            source,
            startChar: NonNegativeInt.make(startChar),
          })
        ),
  });

/**
 * Quote-free projection of a freshly verified source anchor.
 *
 * **Details**
 *
 * The projection retains the absolute UTF-16 offsets and exact source
 * identity needed for highlighting while deliberately omitting the
 * potentially unbounded anchor quote.
 *
 * **Example** (Check highlight offset fields)
 *
 * ```ts
 * import { EvidenceSourceHighlight } from "@beep/epistemic-use-cases/public"
 *
 * console.log(EvidenceSourceHighlight.fields.startChar !== undefined)
 * console.log(EvidenceSourceHighlight.fields.source !== undefined)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class EvidenceSourceHighlight extends S.Class<EvidenceSourceHighlight>($I`EvidenceSourceHighlight`)(
  EvidenceSourceHighlightSchema,
  $I.annote("EvidenceSourceHighlight", {
    description: "Quote-free verified non-empty half-open highlight offsets bound to one exact source manifestation.",
  })
) {}

class EvidenceSourcePageStruct extends S.Class<EvidenceSourcePageStruct>($I`EvidenceSourcePageStruct`)(
  {
    evidenceId: SharedEpistemic.EvidenceId.annotateKey({
      description: "Candidate-bound evidence represented by this source page.",
    }),
    highlight: EvidenceSourceHighlight.annotateKey({
      description: "Bounded quote-free projection of the freshly re-verified anchor.",
    }),
    page: SourceTextPage.annotateKey({
      description: "Bounded page of exact canonical extracted source text.",
    }),
  },
  $I.annote("EvidenceSourcePageStruct", {
    description: "Structural base for an evidence source page before its shared source identity is checked.",
  })
) {}

const sourceTextIdentityEquivalence = S.toEquivalence(SourceTextIdentity);
const EvidenceSourcePageIdentityCheck = S.makeFilter(
  ({ highlight, page }: EvidenceSourcePageStruct) => sourceTextIdentityEquivalence(page.identity, highlight.source),
  {
    identifier: $I`EvidenceSourcePageIdentityCheck`,
    title: "Evidence Source Page Identity",
    description: "Checks that the bounded page and freshly verified anchor name the exact same source manifestation.",
    message: "Expected page.identity to equal highlight.source.",
  }
);
const EvidenceSourcePageHighlightBoundsCheck = S.makeFilter(
  ({ highlight, page }: EvidenceSourcePageStruct) => N.isLessThanOrEqualTo(highlight.endChar, page.totalCodeUnits),
  {
    identifier: $I`EvidenceSourcePageHighlightBoundsCheck`,
    title: "Evidence Source Page Highlight Bounds",
    description: "Checks that the verified highlight ends within the complete canonical source width.",
    message: "Expected highlight.endChar to be less than or equal to page.totalCodeUnits.",
  }
);
const evidenceIdArbitrary = S.toArbitrary(SharedEpistemic.EvidenceId);
const evidenceSourceHighlightArbitrary = S.toArbitrary(EvidenceSourceHighlight);
const sourceTextPageArbitrary = S.toArbitrary(SourceTextPage);

const EvidenceSourcePageSchema = EvidenceSourcePageStruct.mapFields(identity)
  .check(EvidenceSourcePageIdentityCheck, EvidenceSourcePageHighlightBoundsCheck)
  .annotate({
    toArbitrary: () => (fc) =>
      fc
        .tuple(evidenceIdArbitrary(fc), evidenceSourceHighlightArbitrary(fc), sourceTextPageArbitrary(fc))
        .map(([evidenceId, highlight, page]) =>
          EvidenceSourcePageStruct.make({
            evidenceId,
            highlight,
            page: SourceTextPage.make({
              ...page,
              identity: highlight.source,
              totalCodeUnits: NonNegativeInt.make(N.max(page.totalCodeUnits, highlight.endChar)),
            }),
          })
        ),
  });

/**
 * Bounded canonical source page and quote-free verified highlight projection.
 *
 * **Example** (Check highlight field presence)
 *
 * ```ts
 * import { EvidenceSourcePage } from "@beep/epistemic-use-cases/public"
 *
 * console.log(EvidenceSourcePage.fields.highlight !== undefined)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class EvidenceSourcePage extends S.Class<EvidenceSourcePage>($I`EvidenceSourcePage`)(
  EvidenceSourcePageSchema,
  $I.annote("EvidenceSourcePage", {
    description: "Candidate-authorized canonical source page paired with quote-free verified highlight offsets.",
  })
) {}

const ContradictionActionErrorReasonBase = LiteralKit([
  "candidate-not-found",
  "evidence-not-in-candidate",
  "source-access-denied",
  "source-unavailable",
  "source-stale",
  "page-out-of-range",
  "candidate-already-resolved",
  "stale-candidate",
  "belief-mismatch",
  "proposal-not-found",
  "proposal-digest-mismatch",
  "unavailable",
]);

/**
 * Sanitized, actionable reasons a contradiction RPC can fail.
 *
 * **Details**
 *
 * These values distinguish stale review state and source availability without
 * exposing repository diagnostics, filesystem paths, organization identity,
 * or authorization internals.
 *
 * **Example** (Access stale-candidate enum)
 *
 * ```ts
 * import { ContradictionActionErrorReason } from "@beep/epistemic-use-cases/public"
 *
 * console.log(ContradictionActionErrorReason.Enum["stale-candidate"])
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ContradictionActionErrorReason = ContradictionActionErrorReasonBase.pipe(
  $I.annoteSchema("ContradictionActionErrorReason", {
    description: "Closed client-safe failure reasons for contradiction queue, review, and source actions.",
  }),
  SchemaUtils.withLiteralKitStatics(ContradictionActionErrorReasonBase)
);

/**
 * Runtime type for {@link ContradictionActionErrorReason}.
 *
 * **Example** (Type source-access-denied reason)
 *
 * ```ts
 * import type { ContradictionActionErrorReason } from "@beep/epistemic-use-cases/public"
 *
 * const reason: ContradictionActionErrorReason = "source-access-denied"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionActionErrorReason = typeof ContradictionActionErrorReason.Type;

/**
 * Client-safe contradiction action failure carried by every triage RPC.
 *
 * **Example** (Make candidate-not-found error)
 *
 * ```ts
 * import { ContradictionActionError } from "@beep/epistemic-use-cases/public"
 *
 * const error = ContradictionActionError.make({ reason: "candidate-not-found" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ContradictionActionError extends S.TaggedError<ContradictionActionError>($I`ContradictionActionError`)(
  "ContradictionActionError",
  {
    reason: ContradictionActionErrorReason.annotateKey({
      description: "Sanitized reason the requested contradiction action could not complete.",
    }),
  },
  $I.annoteError<ContradictionActionError>("ContradictionActionError", {
    description: "Sanitized failure for client-visible contradiction triage actions.",
  })
) {
  static readonly is = S.is(ContradictionActionError);
}

/**
 * Lists the authenticated organization’s contradiction candidates.
 *
 * **Example** (Lookup list candidates RPC)
 *
 * ```ts
 * import { ContradictionRpcs, ListContradictionCandidatesRpc } from "@beep/epistemic-use-cases/public"
 *
 * console.log(ContradictionRpcs.requests.get("ListContradictionCandidates") === ListContradictionCandidatesRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ListContradictionCandidatesRpc = Rpc.make("ListContradictionCandidates", {
  payload: ContradictionListPayload,
  success: ContradictionCandidatePage,
  error: ContradictionActionError,
});

/**
 * Reads one candidate with both exact beliefs and their evidence.
 *
 * **Example** (Lookup get candidate RPC)
 *
 * ```ts
 * import { ContradictionRpcs, GetContradictionCandidateRpc } from "@beep/epistemic-use-cases/public"
 *
 * console.log(ContradictionRpcs.requests.get("GetContradictionCandidate") === GetContradictionCandidateRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const GetContradictionCandidateRpc = Rpc.make("GetContradictionCandidate", {
  payload: GetContradictionCandidate,
  success: ContradictionCandidateDetailView,
  error: ContradictionActionError,
});

/**
 * Applies a human rejection or one persisted supersession proposal.
 *
 * **Example** (Lookup review candidate RPC)
 *
 * ```ts
 * import { ContradictionRpcs, ReviewContradictionCandidateRpc } from "@beep/epistemic-use-cases/public"
 *
 * console.log(ContradictionRpcs.requests.get("ReviewContradictionCandidate") === ReviewContradictionCandidateRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ReviewContradictionCandidateRpc = Rpc.make("ReviewContradictionCandidate", {
  payload: ReviewContradictionCandidate,
  success: ContradictionDisposition,
  error: ContradictionActionError,
});

/**
 * Reads one bounded source-text page for candidate-bound verified evidence.
 *
 * **Example** (Lookup source page RPC)
 *
 * ```ts
 * import { ContradictionRpcs, GetEvidenceSourcePageRpc } from "@beep/epistemic-use-cases/public"
 *
 * console.log(ContradictionRpcs.requests.get("GetEvidenceSourcePage") === GetEvidenceSourcePageRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const GetEvidenceSourcePageRpc = Rpc.make("GetEvidenceSourcePage", {
  payload: EvidenceSourcePagePayload,
  success: EvidenceSourcePage,
  error: ContradictionActionError,
});

/**
 * Authenticated desktop RPC group for contradiction triage.
 *
 * **Example** (Check source page request)
 *
 * ```ts
 * import { ContradictionRpcs } from "@beep/epistemic-use-cases/public"
 *
 * console.log(ContradictionRpcs.requests.has("GetEvidenceSourcePage"))
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ContradictionRpcs = RpcGroup.make(
  ListContradictionCandidatesRpc,
  GetContradictionCandidateRpc,
  ReviewContradictionCandidateRpc,
  GetEvidenceSourcePageRpc
);
