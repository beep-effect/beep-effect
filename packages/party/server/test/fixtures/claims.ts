import { BasisDigest, ValidTime } from "@beep/epistemics/Claim";
import { makeClaimArrows } from "@beep/epistemics/ClaimCore";
import { IRI } from "@beep/identity/Iri";
import { $PartyServerId } from "@beep/identity/packages";
import { ActivityPin, ActivityStart, mintActivityId } from "@beep/jsonc/ActivityStart";
import {
  ClaimAgent,
  ClaimCore,
  ClaimCreation,
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
import { PartyLedgerMemory } from "@beep/party-server/Ledger";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type { ClaimId } from "@beep/epistemics/ClaimCore.schema";
import type { Proposition } from "@beep/party-domain/Proposition";

export const at = DateTime.makeUnsafe;
export const LedgerLive = PartyLedgerMemory.pipe(Layer.provideMerge(Digest.layerWebCrypto));
export const PartyClaims = makeClaimArrows({ $I: $PartyServerId.create("test/fixtures/claims"), ClaimCore });
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
      reason: "Synthetic review",
    },
  });
export const activityStart = (start: { readonly operation: string; readonly started: number }) =>
  ActivityStart.make({
    operation: IRI.make(`https://example.test/party/ops/${encodeURIComponent(start.operation)}`),
    pin: ActivityPin.cases.Engine.make({ engine: "party-fixture", edition: "1" }),
    promptDigest: O.none(),
    used: HashSet.empty(),
    started: at(start.started),
  });
export const creation = (native: { readonly operation: string; readonly at: number }) =>
  ClaimCreation.make({
    activity: activityStart({ operation: native.operation, started: native.at }),
    generatedAt: at(native.at),
    knowledgeStart: at(native.at),
    scope: "synthetic",
    assertedBy: ClaimAgent.cases.Person.make({ principal: analyst }),
  });

export interface PartyClaim {
  readonly claim: ClaimId;
  readonly generation: ClaimGeneration;
  readonly ledger: ClaimLedger;
  readonly record: ClaimRecord;
}

export const partyClaim = Effect.fn("PartyServerFixture.claim")(function* (options: {
  readonly proposition: Proposition;
  readonly knowledgeStart: number;
  readonly supersedes?: ClaimId | undefined;
  readonly operation?: string;
  readonly review?: ReviewState;
}) {
  const started = options.knowledgeStart;
  const activity = activityStart({ operation: options.operation ?? "project", started });
  const generatedBy = yield* mintActivityId(activity);
  const core = ClaimCore.make({
    proposition: options.proposition,
    logicalKey: logicalKey(options.proposition),
    supportAtCreation: HashSet.empty(),
    derivedFrom: HashSet.empty(),
    supersedes: O.fromUndefinedOr(options.supersedes),
    generatedBy,
    assertedBy: ClaimAgent.cases.Person.make({ principal: analyst }),
    valid: ValidTime.cases.Interval.make({ validFrom: at(0), validTo: O.none() }),
    knowledgeStart: at(started),
    scope: "synthetic",
  });
  const claim = yield* PartyClaims.mint(core);
  const record = ClaimRecord.make({ claim, core });
  const generation = ClaimGeneration.make({ claim, activity, ended: at(started) });
  const ledger = ClaimLedger.make({
    claims: [record],
    generations: [generation],
    evidence: [
      ClaimEvidenceLinks.make({
        claim,
        at: at(started),
        supportedBy: [AssertionId.make("party-asrt:synthetic")],
        challengedBy: [],
      }),
    ],
    reviews: [ClaimReviewRecord.make({ claim, at: at(started), review: options.review ?? accepted(started) })],
    signals: [ClaimSignalRecord.make({ claim, at: at(started), signals })],
  });
  return { claim, record, generation, ledger } satisfies PartyClaim;
});

export const retraction = (target: { readonly claim: ClaimId; readonly at: number }) =>
  ClaimLedger.make({
    retractions: [
      ClaimRetraction.make({ claim: target.claim, actor: analyst, reason: "Synthetic correction", at: at(target.at) }),
    ],
  });
