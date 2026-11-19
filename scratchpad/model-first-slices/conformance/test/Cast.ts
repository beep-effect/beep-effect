import { OrgId, PrincipalId } from "@proto/kernel/Ids";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { Proposition } from "@proto/party-contract/Proposition";
import * as A from "@beep/utils/Array";
import * as S from "effect/Schema";

// The cast of the in-process conformance stories over Party: everyone and everything a story
// names, generated. Members that must differ are generated together, as a tuple with unique items,
// so a generated cast is distinct by construction rather than by discarding.

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

/**
 * The cast of a story over Party's claims.
 *
 * - `org`: the org the story happens in.
 * - `people`: who asserts the claim, and who reviews it.
 * - `claims`: the claim the story decides, and one the deploy's first call reads.
 * - `identifier`: what the claim asserts of a party.
 * - `signals`: two signals from two sources.
 */
export const Cast = S.Struct({
  org: OrgId,
  people: S.Tuple([PrincipalId, PrincipalId]).check(S.isUnique()),
  claims: S.Tuple([ClaimId, ClaimId]).check(S.isUnique()),
  identifier: Proposition.cases.HasIdentifier,
  signals: S.Tuple([EvidenceSignal, EvidenceSignal]).check(fromDistinctSources),
});
export type Cast = typeof Cast.Type;
