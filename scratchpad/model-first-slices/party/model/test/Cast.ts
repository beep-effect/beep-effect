import * as A from "@beep/utils/Array";
import { OrgId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { ApprovalId } from "@proto/party-contract/Claim/Approval.id";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { PartyRegistered } from "@proto/party-contract/Party/RegisterParty.command";
import { Proposition } from "@proto/party-contract/Proposition";
import { reviewRun } from "@proto/party-model/Review/ReviewPlan";
import * as S from "effect/Schema";

// The Party slice's cast: everyone and everything a story names, generated. Each story is a
// property over a cast; every id, name and signal it uses comes from here or is derived from it.

/** A party's name, as `RegisterParty` takes it. */
const PartyName = PartyRegistered.fields.name;

const distinct = (values: ReadonlyArray<string>) => A.dedupe(values).length === values.length;

/** Every id a story derives a run from: the review runs of both claims, the first two of each. */
const reviewRunsOf = (claims: { readonly claim: ClaimId; readonly other: ClaimId }) =>
  A.flatMap([claims.claim, claims.other], (claim) => [reviewRun(claim, 1), reviewRun(claim, 2)]);

/**
 * The cast of a Party story.
 *
 * - `orgs`: the org the story happens in, and another one.
 * - `people`: who asserts claims, who reviews them, and someone from the other org.
 * - `parties`: a survivor and the duplicate it absorbs, both in the home org, and a party of the other org.
 * - `claims`: the claim the story is about, and a second one.
 * - `runs`: an agent run that is no review run, and the run a review continues as at its history bound.
 * - `names`: each party's name, and a family name the search story gives all three.
 * - `signals`: two signals from two sources.
 * - `identifier`: an identifier a claim can assert of a party.
 * - `approval`: the id of the command that approves a proposal.
 */
export const Cast = S.Struct({
  orgs: S.Struct({ home: OrgId, other: OrgId }),
  people: S.Struct({ intake: PrincipalId, reviewer: PrincipalId, outsider: PrincipalId }),
  parties: S.Struct({ survivor: PartyId, absorbed: PartyId, elsewhere: PartyId }),
  claims: S.Struct({ claim: ClaimId, other: ClaimId }),
  runs: S.Struct({ agent: RunId, continued: RunId }),
  names: S.Struct({ survivor: PartyName, absorbed: PartyName, elsewhere: PartyName, family: PartyName }),
  signals: S.Tuple([EvidenceSignal, EvidenceSignal]),
  identifier: Proposition.cases.HasIdentifier,
  approval: ApprovalId,
}).check(
  S.makeFilter(
    ({ orgs, people, parties, claims, runs, signals }) =>
      distinct([orgs.home, orgs.other]) &&
      distinct([parties.survivor, parties.absorbed, parties.elsewhere]) &&
      distinct([claims.claim, claims.other]) &&
      // A grant's id is derived from its holder, a person or a run, so no two holders share an id.
      distinct([people.intake, people.reviewer, people.outsider, runs.agent, runs.continued, ...reviewRunsOf(claims)]) &&
      distinct(A.map(signals, (signal) => signal.source)),
    {
      identifier: "DistinctCastCheck",
      title: "Distinct cast",
      description: "No two orgs, people, parties, claims, runs or signal sources of a cast share an id.",
      message: "Expected every org, person, party, claim, run and signal source of the cast to be distinct",
    },
  ),
);
export type Cast = typeof Cast.Type;
