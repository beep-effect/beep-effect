/**
 * Compatibility boundary between the local review page and graduated review models.
 * @packageDocumentation
 * @since 0.0.0
 */
import { ValidInterval } from "@beep/epistemics/ValidInterval";
import { $ScratchpadId } from "@beep/identity";
import { EmailAddress, ExchangeDn } from "@beep/party-domain/Identifier";
import { ActivityId, Digest, PrincipalId } from "@beep/party-domain/Ids";
import { partyKeyOf } from "@beep/party-domain/PartyKey";
import { EvidenceAnchor } from "@beep/party-domain/Provenance";
import { IngestIdentifier } from "@beep/party-server/ContactEvidence";
import { CollisionOutcome } from "@beep/party-server/IdentityEvidence";
import { NameShape, OrgLead } from "@beep/party-server/OrgEvidence";
import { CollisionCase, CollisionDecision, ReviewVerdict } from "@beep/party-server/ReviewLoop";
import { PartyId } from "@beep/shared-domain/identity/Party";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("party/scripts/ReviewPageAdapter");
const PageMailbox = S.Struct({
  party: PartyId,
  identifiers: S.Array(S.String),
  domains: S.Array(S.String),
  firstSeen: S.OptionFromNullOr(S.DateTimeUtcFromString),
  lastSeen: S.OptionFromNullOr(S.DateTimeUtcFromString),
}).pipe(
  $I.annoteSchema("PageMailbox", { description: "Presentation-only mailbox with readable addresses and ISO dates." })
);
const PageCase = S.Struct({
  name: S.String,
  shape: NameShape,
  outcome: CollisionOutcome,
  orgLead: OrgLead,
  mailboxes: S.Array(PageMailbox),
  basis: Digest,
}).pipe(
  $I.annoteSchema("PageCase", { description: "Existing review-page JSON shape bound to a graduated evidence basis." })
);

/**
 * Current cases and canonical identifier values needed for readable rendering.
 * **Example** (Decode ReviewPageInput)
 * ```ts
 * import { ReviewPageInput } from "./ReviewPageAdapter.ts"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ReviewPageInput)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ReviewPageInput extends S.Opaque<ReviewPageInput, { readonly brand: unique symbol }>()(
  S.Struct({ cases: S.Array(CollisionCase), identifiers: S.Array(IngestIdentifier) }).pipe(
    $I.annoteSchema("ReviewPageInput", { description: "Cases and validated display-identifier evidence." })
  )
) {}

/**
 * A rejected presentation binding that would mislabel a canonical identifier.
 * **Example** (Report a missing display value)
 * ```ts
 * import { ReviewPageBindingError } from "./ReviewPageAdapter.ts"
 * ReviewPageBindingError.make({ reason: "missing-identifier" })
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ReviewPageBindingError extends S.TaggedError<ReviewPageBindingError, { readonly brand: unique symbol }>(
  $I`ReviewPageBindingError`
)(
  "ReviewPageBindingError",
  { reason: S.Literals(["missing-identifier", "mismatched-identifier"]) },
  $I.annoteError<ReviewPageBindingError>("ReviewPageBindingError", {
    description: "Readable identifier does not match the sealed canonical reference.",
  })
) {}

/**
 * Encode the unchanged page shape after verifying readable identifier bindings.
 * **Example** (Use the page adapter)
 * ```ts
 * import { encodeReviewPageCases } from "./ReviewPageAdapter.ts"
 * const encode = encodeReviewPageCases
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const encodeReviewPageCases = Effect.fn("ReviewPageAdapter.encode")(function* (input: ReviewPageInput) {
  let labels = HashMap.empty<string, string>();
  yield* Effect.forEach(
    input.identifiers,
    Effect.fn("ReviewPageAdapter.identifier")(function* (row) {
      const key = yield* partyKeyOf(row.value);
      if (key !== row.key || row.id !== `party-ident:${key}`)
        return yield* ReviewPageBindingError.make({ reason: "mismatched-identifier" });
      const label = S.is(EmailAddress)(row.value)
        ? `ident:email:${encodeURIComponent(row.value.normalized)}`
        : S.is(ExchangeDn)(row.value)
          ? `ident:x500:${encodeURIComponent(row.value.normalized)}`
          : encodeURIComponent(row.id);
      labels = HashMap.set(labels, row.id, label);
    })
  );
  const cases = yield* Effect.forEach(
    input.cases,
    Effect.fn("ReviewPageAdapter.case")(function* (current) {
      const mailboxes = yield* Effect.forEach(
        current.evidence.mailboxes,
        Effect.fn("ReviewPageAdapter.mailbox")(function* (mailbox) {
          const identifiers = yield* Effect.forEach(mailbox.identifiers, (id) =>
            Effect.fromOption(HashMap.get(labels, id)).pipe(
              Effect.mapError(() => ReviewPageBindingError.make({ reason: "missing-identifier" }))
            )
          );
          return PageMailbox.make({
            party: mailbox.party,
            identifiers,
            domains: mailbox.domains,
            firstSeen: O.map(mailbox.span, (span) => span.first),
            lastSeen: O.map(mailbox.span, (span) => span.last),
          });
        })
      );
      return PageCase.make({ ...current.evidence, mailboxes, basis: current.basis });
    })
  );
  return yield* S.encodeEffect(PageCase.pipe(S.Array, S.fromJsonString))(cases);
});

/**
 * Existing page-exported decision with integer parties and an ISO review time.
 * **Example** (Decode a page export)
 * ```ts
 * import { PageDecision } from "./ReviewPageAdapter.ts"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(S.fromJsonString(PageDecision))
 * ```
 * @category models
 * @since 0.0.0
 */
export class PageDecision extends S.Opaque<PageDecision, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString,
    verdict: ReviewVerdict,
    basis: Digest,
    reviewer: S.NonEmptyString,
    reviewedAt: S.DateTimeUtcFromString,
    note: S.String,
  }).pipe(
    $I.annoteSchema("PageDecision", {
      description: "Page decision before explicit validity and provenance enrichment.",
    })
  )
) {}

/**
 * Explicit operator-supplied validity and source provenance for a page decision.
 * **Example** (Decode PageDecisionInput)
 * ```ts
 * import { PageDecisionInput } from "./ReviewPageAdapter.ts"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(PageDecisionInput)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PageDecisionInput extends S.Opaque<PageDecisionInput, { readonly brand: unique symbol }>()(
  S.Struct({ decision: PageDecision, validity: ValidInterval, producedBy: ActivityId, anchor: EvidenceAnchor }).pipe(
    $I.annoteSchema("PageDecisionInput", { description: "Page export plus explicit temporal and source context." })
  )
) {}

/**
 * Adapt a page decision without assuming a temporal interval or accepting it.
 * **Example** (Use decision enrichment)
 * ```ts
 * import { adaptPageDecision } from "./ReviewPageAdapter.ts"
 * const adapt = adaptPageDecision
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const adaptPageDecision = (input: PageDecisionInput): CollisionDecision =>
  CollisionDecision.make({
    ...input.decision,
    validity: input.validity,
    producedBy: input.producedBy,
    anchor: input.anchor,
    reviewer: PrincipalId.make(`party-user:${encodeURIComponent(input.decision.reviewer)}`),
  });
