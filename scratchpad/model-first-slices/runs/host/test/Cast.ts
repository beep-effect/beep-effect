import { CapabilityId, GrantId, OrgId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { Count, IdText, Name } from "@proto/kernel/Measure";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ClaimDecidedV2, Decision } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { StepRecorded } from "@proto/runs-contract/Run/RecordStep.command";
import { ReservationId } from "@proto/runs-contract/Run/Reservation.id";
import { RunRequested } from "@proto/runs-contract/Run/RequestRun.command";
import { RunVersions } from "@proto/runs-contract/Run/RunVersions";
import { SessionId } from "@proto/runs-contract/Run/Session.id";
import * as A from "@beep/utils/Array";
import * as S from "effect/Schema";

// The runs host stories' cast, declared once. Every story is a property over a generated cast:
// the narrative stays, and every id, name, amount and fact it uses is a member of the cast or
// derived from one.

/** An amount a story moves: a count small enough that a sum of a few stays an exact integer. */
const Units = Count.check(S.isLessThanOrEqualTo(1_000_000));

const distinct = <X>(values: ReadonlyArray<X>) => A.length(A.dedupe(values)) === A.length(values);

/** The run a lineage continues as at its first history bound, as the runs model names it. */
export const nextOf = (run: RunId): RunId => RunId.make(`${run}~1`);

/**
 * Who and what the runs host stories are about: an org and its owner, the person who requests
 * runs, the grant the owner issues them and its capability and operation; a session; two runs of
 * the requester; two reservations; what a run is for and made with; how its budget splits; the
 * steps a run records before it continues; two claims and how Party decided them; and the test
 * process that relays every hop.
 *
 * **Details**
 *
 * - `ledger`: what one call uses, what its reservation held and it did not use, and what stays
 *   free beside it. A run's allowance is all three.
 * - `steps`: a run at its history bound records one step for each; the bound is their number.
 * - `decided`: Party's version 2 fact as generated; a story names its claim, org and runs, and
 *   version 1 carries the same decision.
 */
export const Cast = S.Struct({
  org: OrgId,
  principals: S.Struct({ requester: PrincipalId, owner: PrincipalId }),
  grant: GrantId,
  capability: CapabilityId,
  operation: Name,
  session: SessionId,
  runs: S.Struct({ run: RunId, peer: RunId }),
  reservations: S.Tuple([ReservationId, ReservationId]),
  versions: RunVersions,
  purpose: RunRequested.fields.purpose,
  ledger: S.Struct({ used: Units, unused: Units, free: Units }),
  steps: S.NonEmptyArray(StepRecorded.fields.step).check(S.isMaxLength(4)),
  claims: S.Tuple([ClaimId, ClaimId]),
  outcome: Decision,
  decided: ClaimDecidedV2,
  relay: S.Struct({ process: Name, saga: Name, key: IdText }),
}).check(
  S.makeFilter(
    ({ principals, runs, reservations, claims }) =>
      distinct([principals.requester, principals.owner]) &&
      distinct([runs.run, runs.peer, nextOf(runs.run), nextOf(runs.peer)]) &&
      distinct(reservations) &&
      distinct(claims),
    {
      identifier: "RunsHostCastCheck",
      title: "Runs host cast",
      description: "Members of one kind are distinct, and neither run is the other's continuation.",
      message: "Expected distinct members of each kind, and no run named as another's continuation",
    },
  ),
);
/** A generated runs host cast. */
export type Cast = typeof Cast.Type;
