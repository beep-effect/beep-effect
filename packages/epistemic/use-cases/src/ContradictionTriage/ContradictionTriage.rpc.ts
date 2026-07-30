/**
 * Client-safe contradiction-triage RPC and read-model contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ContradictionCandidate, ContradictionDisposition } from "@beep/epistemic-domain/entities/Contradiction";
import { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import { Evidence } from "@beep/epistemic-domain/entities/Evidence";
import * as Epistemic from "@beep/epistemic-domain/identity/Epistemic";
import { SourceTextPage } from "@beep/file-processing/SourceText";
import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { NonNegativeInt } from "@beep/schema/Int";
import * as SharedEpistemic from "@beep/shared-domain/identity/Epistemic";
import { identity } from "effect";
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
 * Organization scope is deliberately absent. The authenticated server derives
 * it instead of trusting a renderer-supplied tenant identity.
 *
 * @example
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
    knownAt: EntitySchema.DateTimeFromMillis.annotateKey({
      description: "Transaction-time instant at which candidate state is requested.",
    }),
    limit: ContradictionCandidatePageLimit.annotateKey({
      description: "Maximum number of ordered candidate rows returned.",
    }),
    offset: NonNegativeInt.annotateKey({
      description: "Number of ordered candidate rows skipped.",
    }),
    validAt: EntitySchema.DateTimeFromMillis.annotateKey({
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
 * The anchor selector keeps surrogate-safe page-boundary calculation inside
 * the server, which owns the complete canonical text. A renderer therefore
 * never guesses an initial page from a nominal page size.
 *
 * @example
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
 * @example
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
 * The server derives organization scope and the exact source identity from the
 * persisted candidate and evidence verification. The renderer can select only
 * an evidence row already bound to the candidate and either its exact anchor
 * page or one explicit page returned by prior navigation.
 *
 * @example
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
    selector: EvidenceSourcePageSelector.annotateKey({
      description: "Anchor-containing initial page or explicit page requested during navigation.",
    }),
  },
  $I.annote("EvidenceSourcePagePayload", {
    description: "Narrow source-page payload containing only candidate, evidence, and page selection.",
  })
) {}

/**
 * Evidence shown beneath one exact belief version.
 *
 * A missing persisted verification receipt is explicit and keeps the source
 * action disabled; it never falls back to an unverified quote.
 *
 * @example
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
 * @example
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
 * `left` and `right` preserve the candidate's canonical ordering. Neither side
 * is marked preferred or authoritative by this read model.
 *
 * @example
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
      description: "Immutable contradiction candidate and persisted correction proposals.",
    }),
    disposition: ContradictionDisposition.pipe(S.OptionFromNullOr).annotateKey({
      description: "Recorded human disposition when the candidate has been resolved.",
    }),
    left: ContradictionBeliefView.annotateKey({
      description: "First exact belief and evidence in canonical candidate order.",
    }),
    right: ContradictionBeliefView.annotateKey({
      description: "Second exact belief and evidence in canonical candidate order.",
    }),
  },
  $I.annote("ContradictionCandidateDetailView", {
    description: "Candidate, optional disposition, and both exact belief-and-evidence views without ranking.",
  })
) {}

class EvidenceSourcePageStruct extends S.Class<EvidenceSourcePageStruct>($I`EvidenceSourcePageStruct`)(
  {
    evidenceId: SharedEpistemic.EvidenceId.annotateKey({
      description: "Candidate-bound evidence represented by this source page.",
    }),
    page: SourceTextPage.annotateKey({
      description: "Bounded page of exact canonical extracted source text.",
    }),
    verifiedAnchor: TextAnchorVerificationReceipt.annotateKey({
      description: "Receipt emitted after live re-verification of the exact half-open UTF-16 anchor.",
    }),
  },
  $I.annote("EvidenceSourcePageStruct", {
    description: "Structural base for an evidence source page before its shared source identity is checked.",
  })
) {}

const sourceTextIdentityEquivalence = S.toEquivalence(SourceTextIdentity);
const EvidenceSourcePageIdentityCheck = S.makeFilter(
  ({ page, verifiedAnchor }: EvidenceSourcePageStruct) =>
    sourceTextIdentityEquivalence(page.identity, verifiedAnchor.source),
  {
    identifier: $I`EvidenceSourcePageIdentityCheck`,
    title: "Evidence Source Page Identity",
    description: "Checks that the bounded page and freshly verified anchor name the exact same source manifestation.",
    message: "Expected page.identity to equal verifiedAnchor.source.",
  }
);
const evidenceIdArbitrary = S.toArbitraryLazy(SharedEpistemic.EvidenceId);
const sourceTextPageArbitrary = S.toArbitraryLazy(SourceTextPage);
const verifiedAnchorArbitrary = S.toArbitraryLazy(TextAnchorVerificationReceipt);

const EvidenceSourcePageSchema = EvidenceSourcePageStruct.mapFields(identity)
  .check(EvidenceSourcePageIdentityCheck)
  .annotate({
    toArbitrary: () => (fc) =>
      fc
        .tuple(evidenceIdArbitrary(fc), sourceTextPageArbitrary(fc), verifiedAnchorArbitrary(fc))
        .map(([evidenceId, page, verifiedAnchor]) =>
          EvidenceSourcePageStruct.make({
            evidenceId,
            page: SourceTextPage.make({
              ...page,
              identity: verifiedAnchor.source,
            }),
            verifiedAnchor,
          })
        ),
  });

/**
 * Bounded canonical source page and the freshly re-verified anchor it must
 * highlight.
 *
 * @example
 * ```ts
 * import { EvidenceSourcePage } from "@beep/epistemic-use-cases/public"
 *
 * console.log(EvidenceSourcePage.fields.verifiedAnchor !== undefined)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class EvidenceSourcePage extends S.Class<EvidenceSourcePage>($I`EvidenceSourcePage`)(
  EvidenceSourcePageSchema,
  $I.annote("EvidenceSourcePage", {
    description: "Candidate-authorized canonical source page paired with a freshly re-verified anchor receipt.",
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
 * These values distinguish stale review state and source availability without
 * exposing repository diagnostics, filesystem paths, organization identity,
 * or authorization internals.
 *
 * @example
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
 * @example
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
 * @example
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
export class ContradictionActionError extends TaggedErrorClass<ContradictionActionError>($I`ContradictionActionError`)(
  "ContradictionActionError",
  {
    reason: ContradictionActionErrorReason.annotateKey({
      description: "Sanitized reason the requested contradiction action could not complete.",
    }),
  },
  $I.annote("ContradictionActionError", {
    description: "Sanitized failure for client-visible contradiction triage actions.",
  })
) {
  static readonly is = S.is(ContradictionActionError);
}

/**
 * Lists the authenticated organization’s contradiction candidates.
 *
 * @example
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
 * @example
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
 * @example
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
 * @example
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
 * @example
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
