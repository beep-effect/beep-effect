import { CapabilityId, GrantId, OrgId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { Count, IdText, Name, Sequence } from "@proto/kernel/Measure";
import { HistoryBound } from "@proto/runs-contract/Run/HistoryBound";
import { ReservationId } from "@proto/runs-contract/Run/Reservation.id";
import { RunVersions } from "@proto/runs-contract/Run/RunVersions";
import { SessionId } from "@proto/runs-contract/Run/Session.id";
import * as A from "@beep/utils/Array";
import * as S from "effect/Schema";

// The runs stories' cast, declared once. Every story is a property over a generated cast: the
// narrative stays, and every id, name, reason and amount it uses is a member of the cast or
// derived from one.

/** An amount a story moves: a count small enough that a sum of a few stays an exact integer. */
export const Units = Count.check(S.isLessThanOrEqualTo(1_000_000));

/** How far a request goes over what remains: at least one unit. */
const Over = Sequence.check(S.isLessThanOrEqualTo(1_000_000));

const distinct = <X>(values: ReadonlyArray<X>) => A.length(A.dedupe(values)) === A.length(values);

/** The run a lineage continues as at its first history bound, as the aggregate names it. */
export const nextOf = (run: RunId): RunId => RunId.make(`${run}~1`);

/**
 * Who and what the runs stories are about: an org, the person who requests runs, a stranger who
 * holds nothing on them and the org's owner; the grant the requester holds, its capability and
 * two of its operations; a session; the run, a child it delegates to, a run that is neither and a
 * peer run of the same requester; five reservations; what a run is for and made with; how its
 * budget splits; and the words a story's people and processes use.
 *
 * **Details**
 *
 * - `ledger`: what one call uses, what its reservation held and it did not use, what stays free
 *   beside it, and how far a refused request goes over what remains.
 * - `steps`: a run at its history bound records one step for each; the bound is their number.
 * - `fact`: the integration fact that decides a run's subject, and the process that relays it.
 */
export const Cast = S.Struct({
  org: OrgId,
  principals: S.Struct({ requester: PrincipalId, stranger: PrincipalId, owner: PrincipalId }),
  grant: GrantId,
  capability: CapabilityId,
  operations: S.Struct({ kept: Name, dropped: Name }),
  session: SessionId,
  runs: S.Struct({ run: RunId, child: RunId, stray: RunId, peer: RunId }),
  reservations: S.Tuple([ReservationId, ReservationId, ReservationId, ReservationId, ReservationId]),
  versions: RunVersions,
  purposes: S.Struct({ run: S.String, child: S.String }),
  bound: HistoryBound.check(S.isLessThanOrEqualTo(1_000)),
  steps: S.NonEmptyArray(S.String).check(S.isMaxLength(6)),
  ledger: S.Struct({ used: Units, unused: Units, free: Units, over: Over }),
  words: S.Struct({
    outcome: S.String,
    denial: S.String,
    refusal: S.String,
    reasons: S.Tuple([S.String, S.String, S.String]),
  }),
  commandId: IdText,
  fact: S.Struct({ process: Name, producer: Name, contract: Name, version: Sequence, fact: IdText }),
}).check(
  S.makeFilter(
    ({ principals, runs, reservations, operations }) =>
      distinct([principals.requester, principals.stranger, principals.owner]) &&
      distinct([runs.run, runs.child, runs.stray, runs.peer, nextOf(runs.run), nextOf(runs.peer)]) &&
      distinct(reservations) &&
      distinct([operations.kept, operations.dropped]),
    {
      identifier: "RunsCastCheck",
      title: "Runs cast",
      description:
        "Members of one kind are distinct, and no run is the continuation of the run or of its peer.",
      message: "Expected distinct members of each kind, and no run named as another's continuation",
    },
  ),
);
/** A generated runs cast. */
export type Cast = typeof Cast.Type;
