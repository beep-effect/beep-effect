import * as A from "@beep/utils/Array";
import * as Str from "@beep/utils/Str";
import type { Capability } from "@proto/kernel/Capability";
import { GrantId, OrgId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { Name } from "@proto/kernel/Measure";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ProposalView } from "@proto/party-contract/Claim/ClaimReview.read";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import { reviewRun } from "@proto/party-model/Review/ReviewPlan";
import * as S from "effect/Schema";
import { GrantToIssue } from "./World.ts";

// Everyone and everything a Party host story names, generated as one value. A story takes a cast
// and derives the rest from it (grant ids, review runs, delegation ids, streams, search text), so
// no id or name in a story is typed by hand.

const distinct = <T>(values: ReadonlyArray<T>) => A.length(A.dedupe(values)) === A.length(values);

/**
 * The cast of a Party host story: the org the story happens in and another one; the orgs' owner,
 * the intake clerk, the reviewer, and an outsider whose grants are on the other org only; a party
 * and its duplicate, whose names share a surname; two claims; a run nobody is accountable for;
 * an identifier, two signals from different sources, and an agent's rationale.
 */
export const Cast = S.Struct({
  org: OrgId,
  otherOrg: OrgId,
  owner: PrincipalId,
  intake: PrincipalId,
  reviewer: PrincipalId,
  outsider: PrincipalId,
  party: PartyId,
  duplicate: PartyId,
  surname: Name,
  partyGiven: Name,
  duplicateGiven: Name,
  claim: ClaimId,
  otherClaim: ClaimId,
  orphanRun: RunId,
  scheme: Proposition.cases.HasIdentifier.fields.scheme,
  value: Proposition.cases.HasIdentifier.fields.value,
  signals: S.Tuple([EvidenceSignal, EvidenceSignal]),
  rationale: ProposalView.fields.rationale,
}).check(
  S.makeFilter(
    (cast) =>
      distinct([cast.org, cast.otherOrg]) &&
      distinct([cast.owner, cast.intake, cast.reviewer, cast.outsider]) &&
      distinct([cast.party, cast.duplicate]) &&
      distinct([cast.partyGiven, cast.duplicateGiven]) &&
      distinct([cast.claim, cast.otherClaim]) &&
      distinct(A.map(cast.signals, (signal) => signal.source)) &&
      !A.contains([reviewRun(cast.claim, 1), reviewRun(cast.otherClaim, 1)], cast.orphanRun),
    {
      identifier: "CastCheck",
      title: "Distinct cast",
      description:
        "Two orgs, four principals, two parties, two given names, two claims and two signal sources, each distinct, and an orphan run that is no claim's review run.",
      message: "Expected a cast whose members are distinct",
    },
  ),
);
/** A generated cast. */
export type Cast = typeof Cast.Type;

/** A party's full name: its given name and the cast's surname. */
export const nameOf = (cast: Cast, given: string) => `${given} ${cast.surname}`;

/** What a directory search types to find both of the cast's parties: their surname, in lower case. */
export const searchText = (cast: Cast) => Str.toLowerCase(cast.surname);

/** The cast's party and its duplicate, ordered by party id as the directory lists them. */
export const partiesInOrder = (cast: Cast) => A.sort([cast.party, cast.duplicate], Str.Order);

/** The id of the grant a holder gets for a capability: derived from both, so each grant in a story has its own. */
export const grantIdOf = (holder: PrincipalId, capability: Capability) => GrantId.make(`${holder}~${capability.id}`);

/** A grant for a holder on an org, issued by the cast's owner. */
export const grantOf = (cast: Cast, holder: PrincipalId, capability: Capability, org: OrgId) =>
  GrantToIssue.make({ id: grantIdOf(holder, capability), holder, capability, org, owner: cast.owner });

/** The claim the cast's identifier makes about its party. */
export const hasIdentifier = (cast: Cast) =>
  Proposition.cases.HasIdentifier.make({ party: cast.party, scheme: cast.scheme, value: cast.value });

/** The claim that the duplicate is the party. */
export const sameParty = (cast: Cast) => Proposition.cases.SameParty.make({ survivor: cast.party, absorbed: cast.duplicate });

/** The stream a claim's commands write. */
export const claimStream = (claim: ClaimId) => `Claim/${claim}`;
