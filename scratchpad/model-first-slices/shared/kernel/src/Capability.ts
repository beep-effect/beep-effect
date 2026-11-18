import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "@beep/utils/Array";
import * as DateTime from "effect/DateTime";
import { dual } from "effect/Function";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import { CapabilityId, DelegationId, GrantId, OrgId } from "./Ids.ts";
import { thunkFalse, thunkTrue } from "@beep/utils"

/**
 * What a grant reaches: a whole org, or one record in it (a stream such as
 * `Claim/claim_1`). The same union names what an operation touches.
 *
 * **Example** (One claim in one org)
 * ```ts
 * import { ResourceScope } from "@proto/kernel/Capability";
 * import { OrgId } from "@proto/kernel/Ids";
 *
 * const claim = ResourceScope.cases.Record.make({ org: OrgId.make("org_acme"), record: "Claim/claim_1" });
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResourceScope = S.TaggedUnion({
  Org: { org: OrgId },
  Record: { org: OrgId, record: S.String },
});
/**
 * @category models
 * @since 0.0.0
 */
export type ResourceScope = typeof ResourceScope.Type;

/**
 * Whether `granted` reaches `wanted`: an org covers itself and every record
 * in it; a record covers only itself.
 *
 * **Example** (An org grant covers a record in it)
 * ```ts
 * import { covers, ResourceScope } from "@proto/kernel/Capability";
 * import { OrgId } from "@proto/kernel/Ids";
 * import { pipe } from "effect/Function";
 *
 * const acme = OrgId.make("org_acme");
 * const org = ResourceScope.cases.Org.make({ org: acme });
 * const record = ResourceScope.cases.Record.make({ org: acme, record: "Claim/c1" });
 * const ok = covers(org, record);
 * const alsoOk = pipe(org, covers(record));
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const covers: {
  (wanted: ResourceScope): (granted: ResourceScope) => boolean;
  (granted: ResourceScope, wanted: ResourceScope): boolean;
} = dual(
  2,
  (granted: ResourceScope, wanted: ResourceScope): boolean =>
    granted.org === wanted.org &&
    ResourceScope.match(granted, {
      Org: thunkTrue,
      Record: ({ record }) => ResourceScope.guards.Record(wanted) && wanted.record === record,
    }),
);

/**
 * The terms of a grant: which capability, which of its operations (none for
 * every operation the capability declares), which resource, and until when
 * (none for no expiry). Stored and sent, an absent value is `null`.
 *
 * @category models
 * @since 0.0.0
 */
export const GrantTerms = S.Struct({
  capability: CapabilityId,
  operations: S.String.pipe(S.Array, S.OptionFromNullOr),
  resource: ResourceScope,
  expires: S.OptionFromNullOr(S.DateTimeUtc),
});
/**
 * @category models
 * @since 0.0.0
 */
export type GrantTerms = typeof GrantTerms.Type;

/**
 * A grant as an invocation carries it: its id, the delegation it reached the
 * caller through (none when held directly), and its terms, as the trusted
 * boundary read them when it built the invocation.
 *
 * @category models
 * @since 0.0.0
 */
export const CapabilityGrant = S.Struct({ grant: GrantId, delegation: S.OptionFromNullOr(DelegationId), ...GrantTerms.fields });
/**
 * @category models
 * @since 0.0.0
 */
export type CapabilityGrant = typeof CapabilityGrant.Type;

/**
 * A capability a context declares: an id the authority context grants by,
 * and the operations (command tags, view and query names) it covers.
 *
 * **Example** (Declare a capability)
 * ```ts
 * import { Capability } from "@proto/kernel/Capability";
 * import { CapabilityId } from "@proto/kernel/Ids";
 *
 * const Review = Capability.make({
 *   id: CapabilityId.make("party.review"),
 *   operations: ["AcceptClaim", "RetractClaim"],
 *   description: "Decide pending claims.",
 * });
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Capability = S.Struct({
  id: CapabilityId,
  operations: S.Array(S.String),
  description: S.String,
});
/**
 * @category models
 * @since 0.0.0
 */
export type Capability = typeof Capability.Type;

/**
 * What one operation needs from a grant: the capability that declares it,
 * the operation, the resource it touches, and the time it is decided at.
 *
 * @category models
 * @since 0.0.0
 */
export interface Need {
  readonly capability: Capability;
  readonly operation: string;
  readonly resource: ResourceScope;
  readonly at: DateTime.Utc;
}

/**
 * Whether one grant allows a need: same capability, the operation declared
 * by the capability and not narrowed away, the resource covered, and not
 * expired at the time of the need.
 *
 * @category predicates
 * @since 0.0.0
 */
export const allows =
  (need: Need) =>
  (grant: CapabilityGrant): boolean =>
    grant.capability === need.capability.id &&
    A.contains(need.capability.operations, need.operation) &&
    O.match(grant.operations, { onNone: thunkTrue, onSome: A.contains(need.operation) }) &&
    covers(grant.resource, need.resource) &&
    O.match(grant.expires, { onNone: thunkTrue, onSome: (expires) => DateTime.isGreaterThan(expires, need.at) });

/**
 * Which term of a grant a change would widen.
 *
 * @category models
 * @since 0.0.0
 */
export const TermDimension = LiteralKit(["capability", "operations", "resource", "expires"]);
/**
 * @category models
 * @since 0.0.0
 */
export type TermDimension = typeof TermDimension.Type;

const within: ReadonlyArray<readonly [TermDimension, (parent: GrantTerms, child: GrantTerms) => boolean]> = [
  ["capability", (parent, child) => child.capability === parent.capability],
  [
    "operations",
    (parent, child) =>
      O.match(parent.operations, {
        onNone: thunkTrue,
        onSome: (granted) =>
          O.match(child.operations, { onNone: thunkFalse, onSome: A.every((operation) => A.contains(granted, operation)) }),
      }),
  ],
  ["resource", (parent, child) => covers(parent.resource, child.resource)],
  [
    "expires",
    (parent, child) =>
      O.match(parent.expires, {
        onNone: thunkTrue,
        onSome: (until) => O.match(child.expires, { onNone: thunkFalse, onSome: DateTime.isLessThanOrEqualTo(until) }),
      }),
  ],
];

/**
 * The first dimension in which `child` reaches further than `parent`, or
 * none when it only narrows: the same capability, a subset of its
 * operations, a resource it covers, and an expiry no later than its own.
 * Narrowing a grant, delegating it, and delegating a run's delegation to a
 * child all obey it.
 *
 * **Example** (A delegation that outlives its parent widens)
 * ```ts
 * import { type GrantTerms, widens } from "@proto/kernel/Capability";
 * import { pipe } from "effect/Function";
 *
 * declare const parent: GrantTerms;
 * declare const child: GrantTerms;
 * const dimension = widens(parent, child);
 * const same = pipe(parent, widens(child));
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const widens: {
  (child: GrantTerms): (parent: GrantTerms) => O.Option<TermDimension>;
  (parent: GrantTerms, child: GrantTerms): O.Option<TermDimension>;
} = dual(
  2,
  (parent: GrantTerms, child: GrantTerms): O.Option<TermDimension> =>
    A.findFirst(within, ([dimension, holds]) => (holds(parent, child) ? O.none() : O.some(dimension))),
);

/**
 * Whether terms are still in force at a time: no expiry, or an expiry after it.
 *
 * @category predicates
 * @since 0.0.0
 */
export const inForce: {
  (at: DateTime.Utc): (terms: GrantTerms) => boolean;
  (terms: GrantTerms, at: DateTime.Utc): boolean;
} = dual(
  2,
  (terms: GrantTerms, at: DateTime.Utc): boolean =>
    O.match(terms.expires, { onNone: thunkTrue, onSome: (expires) => DateTime.isGreaterThan(expires, at) }),
);
