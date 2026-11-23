/**
 * Native party projections over source assertions whose identifiers remain evidence links.
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeClaimArrows } from "@beep/epistemics/ClaimCore";
import { $PartyServerId } from "@beep/identity/packages";
import { mintActivityId } from "@beep/jsonc/ActivityStart";
import {
  ClaimCore,
  ClaimEvidenceLinks,
  ClaimGeneration,
  ClaimLedger,
  ClaimRecord,
  ClaimReviewRecord,
  ClaimSignalRecord,
  ClaimStance,
} from "@beep/party-domain/Claim";
import { logicalKey } from "@beep/party-domain/Proposition";
import { EvidenceAnchor } from "@beep/party-domain/Provenance";
import { mintOccurrenceId } from "@beep/text/Occurrence";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import type { ValidTime } from "@beep/epistemics/Claim";
import type { ClaimId } from "@beep/epistemics/ClaimCore.schema";
import type { ClaimCreation, EvidenceSignals, ReviewState, SourceAssertion } from "@beep/party-domain/Claim";
import type { Proposition } from "@beep/party-domain/Proposition";
import type * as O from "effect/Option";

const arrows = makeClaimArrows({ $I: $PartyServerId.create("internal/claimFromAssertion"), ClaimCore });

/**
 * Mint a new interpretation from explicit native creation facts and retain its source lineage separately.
 *
 * **Example** (Require creation facts at a projection boundary)
 *
 * ```ts
 * import type { ClaimCreation } from "@beep/party-domain/Claim"
 * const scopeOf = (creation: ClaimCreation) => creation.scope
 * console.log(typeof scopeOf)
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const projectPartyClaim = Effect.fn("PartyClaims.project")(function* (options: {
  readonly proposition: Proposition;
  readonly assertions: ReadonlyArray<SourceAssertion>;
  readonly validTime: ValidTime;
  readonly review: ReviewState;
  readonly signals: EvidenceSignals;
  readonly creation: ClaimCreation;
  readonly supersedes: O.Option<ClaimId>;
  readonly derivedFrom: HashSet.HashSet<ClaimId>;
}) {
  const { creation } = options;
  const generatedBy = yield* mintActivityId(creation.activity);
  const anchored = A.flatMap(options.assertions, (assertion) =>
    A.flatMap(assertion.anchors, (anchor) => (EvidenceAnchor.guards.TextOccurrence(anchor) ? [anchor.anchored] : []))
  );
  const occurrences = yield* Effect.forEach(anchored, mintOccurrenceId, { concurrency: 1 });
  const core = ClaimCore.make({
    proposition: options.proposition,
    logicalKey: logicalKey(options.proposition),
    supportAtCreation: HashSet.fromIterable(occurrences),
    derivedFrom: options.derivedFrom,
    supersedes: options.supersedes,
    generatedBy,
    assertedBy: creation.assertedBy,
    valid: options.validTime,
    knowledgeStart: creation.knowledgeStart,
    scope: creation.scope,
  });
  const claim = yield* arrows.mint(core);
  return ClaimLedger.make({
    claims: [ClaimRecord.make({ claim, core })],
    generations: [ClaimGeneration.make({ claim, activity: creation.activity, ended: creation.generatedAt })],
    evidence: [
      ClaimEvidenceLinks.make({
        claim,
        at: creation.knowledgeStart,
        supportedBy: A.map(options.assertions, (assertion) => assertion.id),
        challengedBy: [],
      }),
    ],
    reviews: [ClaimReviewRecord.make({ claim, at: creation.knowledgeStart, review: options.review })],
    signals: [ClaimSignalRecord.make({ claim, at: creation.knowledgeStart, signals: options.signals })],
    stances: [ClaimStance.cases.Proposed.make({ claim, generatedBy, at: creation.knowledgeStart })],
  });
});
