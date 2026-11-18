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
// Members that must differ are generated together, as a tuple with unique items, so a generated
// cast is distinct by construction rather than by discarding.

/** A party's name, as `RegisterParty` takes it. */
const PartyName = PartyRegistered.fields.name;

/** Signals from as many sources as there are signals. */
const fromDistinctSources = S.makeFilter(
  (signals: ReadonlyArray<EvidenceSignal>) => A.dedupe(A.map(signals, (signal) => signal.source)).length === signals.length,
  {
    identifier: "DistinctSourcesCheck",
    title: "Distinct sources",
    description: "No two signals come from the same source.",
    message: "Expected every signal to come from a source of its own",
    arbitraryConstraint: { uniqueBy: (signal: EvidenceSignal) => signal.source },
  },
);

/** The review runs a story derives from its claims: the first two of each. */
const reviewRunsOf = (claims: ReadonlyArray<ClaimId>) =>
  A.flatMap(claims, (claim) => [reviewRun(claim, 1), reviewRun(claim, 2)]);

/**
 * The cast of a Party story.
 *
 * - `orgs`: the org the story happens in, and another one.
 * - `holders`: who asserts claims, who reviews them, someone from the other org, an agent run that
 *   is no review run, and the run a review continues as at its history bound. A grant's id is
 *   derived from its holder, so people and runs are distinct together.
 * - `parties`: a survivor and the duplicate it absorbs, and a party of the other org.
 * - `claims`: the claim the story is about, and a second one.
 * - `names`: each party's name, and a family name the search story gives all three.
 * - `signals`: two signals from two sources.
 * - `identifier`: an identifier a claim can assert of a party.
 * - `approval`: the id of the command that approves a proposal.
 */
export const Cast = S.Struct({
  orgs: S.Tuple([OrgId, OrgId]).check(S.isUnique()),
  holders: S.Tuple([PrincipalId, PrincipalId, PrincipalId, RunId, RunId]).check(S.isUnique()),
  parties: S.Tuple([PartyId, PartyId, PartyId]).check(S.isUnique()),
  claims: S.Tuple([ClaimId, ClaimId]).check(S.isUnique()),
  names: S.Struct({ survivor: PartyName, absorbed: PartyName, elsewhere: PartyName, family: PartyName }),
  signals: S.Tuple([EvidenceSignal, EvidenceSignal]).check(fromDistinctSources),
  identifier: Proposition.cases.HasIdentifier,
  approval: ApprovalId,
}).check(
  S.makeFilter(({ holders, claims }) => !A.some(reviewRunsOf(claims), (run) => A.contains(holders, run)), {
    identifier: "NoHolderIsAReviewRunCheck",
    title: "No holder is a review run",
    description: "A review run's id is derived from its claim; no other holder of the cast has it.",
    message: "Expected no person or run of the cast to have a review run's id",
  }),
);
export type Cast = typeof Cast.Type;

/** The cast, by role. */
export const rolesOf = (cast: Cast) => {
  const [home, other] = cast.orgs;
  const [intake, reviewer, outsider, agent, continued] = cast.holders;
  const [survivor, absorbed, elsewhere] = cast.parties;
  const [claim, otherClaim] = cast.claims;
  return { home, other, intake, reviewer, outsider, agent, continued, survivor, absorbed, elsewhere, claim, otherClaim };
};
