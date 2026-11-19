import { AuthorityGrants } from "@proto/authority-contract/Authority.capabilities";
import { CapabilityId, DelegationId, GrantId, OrgId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { IdText, Name } from "@proto/kernel/Measure";
import * as A from "@beep/utils/Array";
import * as DateTime from "effect/DateTime";
import * as S from "effect/Schema";

// The authority stories' cast, declared once. Every story is a property over a generated cast:
// the narrative stays, and every id, name and time it uses is a member of the cast or derived
// from one.

/** An instant, in epoch milliseconds, from the Unix epoch to about the year 6400. */
const Moment = S.Int.check(S.isBetween({ minimum: 0, maximum: 2 ** 47 }));

/** A positive stretch of time, in milliseconds, of up to about seventy years. */
const Span = S.Int.check(S.isBetween({ minimum: 1, maximum: 2 ** 41 }));

const distinct = <A>(values: ReadonlyArray<A>) => A.length(A.dedupe(values)) === A.length(values);

/**
 * Who and what the authority stories are about: two orgs, an admin who holds `authority.grants`
 * on the home org, a reviewer who holds grants and a stranger who holds none, the runs the
 * reviewer answers for, the grants and delegations they meet, a capability and the one a
 * widening delegation would swap in, two of its operations, a record in the home org, and a
 * timeline: the story's start and three later moments, each strictly after the one before.
 */
export const Cast = S.Struct({
  orgs: S.Struct({ home: OrgId, other: OrgId }),
  principals: S.Struct({ admin: PrincipalId, reviewer: PrincipalId, stranger: PrincipalId }),
  runs: S.Struct({ run: RunId, child: RunId, stray: RunId }),
  grants: S.Struct({ admin: GrantId, held: GrantId, unissued: GrantId }),
  delegations: S.Struct({ held: DelegationId, child: DelegationId, stray: DelegationId, unopened: DelegationId }),
  capabilities: S.Struct({ granted: CapabilityId, swapped: CapabilityId }),
  operations: S.Struct({ kept: Name, dropped: Name }),
  record: S.Struct({ aggregate: Name, id: IdText }),
  timeline: S.Struct({ start: Moment, toEarly: Span, toDeadline: Span, toBeyond: Span }),
}).check(
  S.makeFilter(
    ({ orgs, principals, runs, grants, delegations, capabilities, operations }) =>
      distinct([orgs.home, orgs.other]) &&
      distinct([principals.admin, principals.reviewer, principals.stranger]) &&
      distinct([runs.run, runs.child, runs.stray]) &&
      distinct([grants.admin, grants.held, grants.unissued]) &&
      distinct([delegations.held, delegations.child, delegations.stray, delegations.unopened]) &&
      distinct([capabilities.granted, capabilities.swapped, AuthorityGrants.id]) &&
      distinct([operations.kept, operations.dropped]),
    {
      identifier: "AuthorityCastCheck",
      title: "Authority cast",
      description:
        "Members of one kind are distinct, and neither story capability is the authority context's own `authority.grants`.",
      message: "Expected distinct members of each kind, and story capabilities other than authority.grants",
    },
  ),
);
/** A generated authority cast. */
export type Cast = typeof Cast.Type;

/**
 * The cast's timeline as instants: the story starts at `start`; `early` comes before the
 * `deadline` a grant runs to, and `beyond` after it.
 */
export const instants = ({ timeline }: Cast) => {
  const start = timeline.start;
  const early = start + timeline.toEarly;
  const deadline = early + timeline.toDeadline;
  const beyond = deadline + timeline.toBeyond;
  return {
    start: DateTime.makeUnsafe(start),
    early: DateTime.makeUnsafe(early),
    deadline: DateTime.makeUnsafe(deadline),
    beyond: DateTime.makeUnsafe(beyond),
  };
};

/** The record the cast's narrowed grants reach, named as its stream: `Aggregate/id`. */
export const recordOf = ({ record }: Cast) => `${record.aggregate}/${record.id}`;

/** The stream an aggregate instance writes, as a hop's cause names it. */
export const streamOf = (ref: { readonly aggregate: string; readonly id: string }) => `${ref.aggregate}/${ref.id}`;
