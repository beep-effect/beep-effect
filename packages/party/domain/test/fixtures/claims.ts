import { BasisDigest, ValidTime } from "@beep/epistemics/Claim";
import { makeClaimArrows } from "@beep/epistemics/ClaimCore";
import { IRI } from "@beep/identity/Iri";
import { $PartyDomainId } from "@beep/identity/packages";
import { ActivityPin, ActivityStart, mintActivityId } from "@beep/jsonc/ActivityStart";
import {
  ClaimAgent,
  ClaimCore,
  ClaimEvidenceLinks,
  ClaimGeneration,
  ClaimLedger,
  ClaimRecord,
  ClaimRetraction,
  ClaimReviewRecord,
  ClaimSignalRecord,
  EvidenceSignals,
  ReviewState,
} from "@beep/party-domain/Claim";
import { AssertionId, PrincipalId } from "@beep/party-domain/Ids";
import { logicalKey } from "@beep/party-domain/Proposition";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import type { ClaimId } from "@beep/epistemics/ClaimCore.schema";
import type { Proposition } from "@beep/party-domain/Proposition";

export const at = DateTime.makeUnsafe;
export const PartyClaims = makeClaimArrows({ $I: $PartyDomainId.create("test/fixtures/claims"), ClaimCore });
export const analyst = PrincipalId.make("party-user:analyst");
export const signals = EvidenceSignals.make({
  sourceTrust: { _tag: "Absent", reason: "not-assessed" },
  sourceAssertedConfidence: { _tag: "Absent", reason: "not-assessed" },
  extractorConfidence: { _tag: "Absent", reason: "not-assessed" },
  validator: { _tag: "Absent", reason: "not-assessed" },
  reviewer: { _tag: "Absent", reason: "not-assessed" },
});
export const accepted = (reviewedAt: number) =>
  ReviewState.cases.Accepted.make({
    disposition: {
      disposition: "accepted",
      reviewer: analyst,
      basis: BasisDigest.make("1234567812345678123456781234567812345678123456781234567812345678"),
      reviewedAt: at(reviewedAt),
      reason: "Synthetic reviewed evidence",
    },
  });
export const interval = (bounds: { readonly from: number; readonly to: O.Option<DateTime.Utc> }) =>
  ValidTime.cases.Interval.make({ validFrom: at(bounds.from), validTo: bounds.to });
export const activityStart = (start: { readonly operation: string; readonly started: number }) =>
  ActivityStart.make({
    operation: IRI.make(`https://example.test/party/ops/${encodeURIComponent(start.operation)}`),
    pin: ActivityPin.cases.Engine.make({ engine: "party-fixture", edition: "1" }),
    promptDigest: O.none(),
    used: HashSet.empty(),
    started: at(start.started),
  });

export interface PartyClaim {
  readonly claim: ClaimId;
  readonly ledger: ClaimLedger;
  readonly record: ClaimRecord;
}

export const partyClaim = Effect.fn("PartyFixture.claim")(function* (options: {
  readonly proposition: Proposition;
  readonly knowledgeStart: number;
  readonly validTime?: ValidTime;
  readonly supersedes?: ClaimId | undefined;
  readonly derivedFrom?: ReadonlyArray<ClaimId>;
  readonly scope?: string;
  readonly review?: O.Option<ReviewState>;
  readonly supportedBy?: ReadonlyArray<AssertionId>;
  readonly challengedBy?: ReadonlyArray<AssertionId>;
  readonly operation?: string;
}) {
  const started = options.knowledgeStart;
  const activity = activityStart({ operation: options.operation ?? "project", started });
  const generatedBy = yield* mintActivityId(activity);
  const core = ClaimCore.make({
    proposition: options.proposition,
    logicalKey: logicalKey(options.proposition),
    supportAtCreation: HashSet.empty(),
    derivedFrom: HashSet.fromIterable(options.derivedFrom ?? []),
    supersedes: O.fromUndefinedOr(options.supersedes),
    generatedBy,
    assertedBy: ClaimAgent.cases.Person.make({ principal: analyst }),
    valid: options.validTime ?? interval({ from: 0, to: O.none() }),
    knowledgeStart: at(started),
    scope: options.scope ?? "synthetic",
  });
  const claim = yield* PartyClaims.mint(core);
  const record = ClaimRecord.make({ claim, core });
  const review = options.review ?? O.some(accepted(started));
  const ledger = ClaimLedger.make({
    claims: [record],
    generations: [ClaimGeneration.make({ claim, activity, ended: at(started) })],
    evidence: [
      ClaimEvidenceLinks.make({
        claim,
        at: at(started),
        supportedBy: options.supportedBy ?? [AssertionId.make("party-asrt:synthetic")],
        challengedBy: options.challengedBy ?? [],
      }),
    ],
    reviews: A.map(O.toArray(review), (state) => ClaimReviewRecord.make({ claim, at: at(started), review: state })),
    signals: [ClaimSignalRecord.make({ claim, at: at(started), signals })],
  });
  return { claim, record, ledger } satisfies PartyClaim;
});

export const retraction = (target: { readonly claim: ClaimId; readonly at: number }) =>
  ClaimLedger.make({
    retractions: [
      ClaimRetraction.make({ claim: target.claim, actor: analyst, reason: "Synthetic correction", at: at(target.at) }),
    ],
  });
