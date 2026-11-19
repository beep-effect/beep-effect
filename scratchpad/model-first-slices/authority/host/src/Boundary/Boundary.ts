import {
  Accountability,
  AccountabilityState
} from "@proto/authority-model/Accountability/Accountability.aggregate"
import {
  Delegation,
  DelegationState
} from "@proto/authority-model/Delegation/Delegation.aggregate"
import {
  RunDelegations
} from "@proto/authority-model/Delegation/RunDelegations.view"
import {
  Grant,
  GrantState
} from "@proto/authority-model/Grant/Grant.aggregate"
import { HolderGrants } from "@proto/authority-model/Grant/HolderGrants.view"
import {
  CapabilityGrant,
  type GrantTerms,
  inForce,
  ResourceScope,
  widens
} from "@proto/kernel/Capability"
import {
  CapabilityId,
  type DelegationId,
  GrantId,
  type OrgId,
  type PrincipalId,
  type RunId
} from "@proto/kernel/Ids"
import {
  byProcess,
  Cause,
  GrantRef,
  type Hop,
  Invocation,
  Provenance,
  Root
} from "@proto/kernel/Invocation"
import { ReadmissionRefused } from "@proto/kernel/ReadmissionRefused.rejection"
import { Unaccountable } from "@proto/kernel/Session.middleware"
import { $AuthorityHostId } from "@proto/kernel/Identity"
import * as A from "@beep/utils/Array"
import * as Context from "effect/Context"
import type * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as Layer from "effect/Layer"
import * as O from "@beep/utils/Option"
import { Credential } from "./FixtureCredential.ts"
import { thunkEffectSucceedNone, thunkTrue } from "@beep/utils/thunk"

const $I = $AuthorityHostId.create("Boundary/Boundary")

/**
 * The trusted boundary: the only code that builds an invocation. It admits a
 * credential at the edge, and re-admits provenance at every later hop, in
 * both cases from the grants the authority model holds in force at that moment.
 *
 * @category services
 * @since 0.0.0
 */
export class Boundary extends Context.Service<
  Boundary,
  {
    /**
     * The invocation a credential may act under now. A human or process gets
     * the human's grants in force; an agent run gets its delegations whose
     * every ancestor is still in force and covers them, and only while the
     * run has a live accountable human.
     */
    readonly admit: {
      (at: DateTime.Utc): (credential: Credential) => Effect.Effect<Invocation, Unaccountable>;
      (credential: Credential, at: DateTime.Utc): Effect.Effect<Invocation, Unaccountable>;
    };
    /**
     * The invocation for the next hop: the provenance's root, re-checked; of
     * the grants it names, those still in force; its chain plus the hop. It
     * never adds a grant the provenance did not name.
     */
    readonly readmit: {
      (hop: Hop, at: DateTime.Utc): (provenance: Provenance) => Effect.Effect<Invocation, ReadmissionRefused>;
      (provenance: Provenance, hop: Hop, at: DateTime.Utc): Effect.Effect<Invocation, ReadmissionRefused>;
    };
    /**
     * The provenance a run acts under once its delegation is open: an agent
     * root naming its accountable human, and the delegation as its only grant.
     * The two principals are named, so they cannot be swapped by position.
     */
    readonly runProvenance: {
      (authority: RunAuthority): (run: RunId) => Provenance;
      (run: RunId, authority: RunAuthority): Provenance;
    };
  }
>()($I`Boundary`) {
}

/** Who a run answers to, on whose behalf it acts, and the grant it acts under. */
type RunAuthority = {
  readonly accountable: PrincipalId;
  readonly onBehalfOf: PrincipalId;
  readonly grant: GrantRef;
};

const listed = <S, A>(state: O.Option<S>, items: (state: S) => ReadonlyArray<A>): ReadonlyArray<A> =>
  O.match(state, { onNone: A.emptyReadonly<A>, onSome: items })

/**
 * The boundary over the hosted authority model. The views are indexes; each
 * grant and delegation is confirmed against its aggregate, so a revocation
 * counts from the moment it commits.
 *
 * @category layers
 * @since 0.0.0
 */
export const BoundaryLive = Layer.effect(
  Boundary,
  Effect.gen(function* () {
    const grants = yield* Grant
    const delegations = yield* Delegation
    const accountability = yield* Accountability
    const holderGrants = yield* HolderGrants
    const runDelegations = yield* RunDelegations

    /** A grant's terms, if it is active, held by `holder`, and in force. */
    const grantInForce = (grant: GrantId, holder: O.Option<PrincipalId>, at: DateTime.Utc) =>
      Effect.map(grants.get(grant), (state) =>
        GrantState.guards.Active(state) &&
        O.match(holder, {
          onNone: thunkTrue,
          onSome: (principal) => state.holder === principal
        }) &&
        inForce(state.terms, at)
          ? O.some(state.terms)
          : O.none<GrantTerms>()
      )

    /**
     * A delegation's terms, if it is active, (when given) held by `holder`, in
     * force, and covered by every ancestor up to its grant.
     */
    const delegationInForce: {
      (delegation: DelegationId, holder: O.Option<RunId>, at: DateTime.Utc): Effect.Effect<O.Option<{
        readonly grant: GrantId;
        readonly terms: GrantTerms;
      }>>,
      (holder: O.Option<RunId>, at: DateTime.Utc): (delegation: DelegationId) => Effect.Effect<O.Option<{
        readonly grant: GrantId;
        readonly terms: GrantTerms;
      }>>
    } = dual(3,
      Effect.fnUntraced(function* (
        delegation: DelegationId,
        holder: O.Option<RunId>,
        at: DateTime.Utc
      ): Effect.fn.Return<O.Option<{
        readonly grant: GrantId;
        readonly terms: GrantTerms
      }>> {
        const held = yield* delegations.get(delegation)
        const usable =
          DelegationState.guards.Active(held) &&
          O.match(holder, {
            onNone: thunkTrue,
            onSome: (run) => held.holder === run
          }) &&
          inForce(held.terms, at)
        if (!usable) return O.none()
        const parentTerms = yield* O.match(held.parentDelegation, {
          onNone: () => grantInForce(held.parent, O.none(), at),
          onSome: (parentDelegation) =>
            Effect.map(
              delegationInForce(parentDelegation, O.none(), at),
              O.map((parent) => parent.terms)
            )
        })
        return O.flatMap(parentTerms, (parent) =>
          O.isNone(widens(parent, held.terms)) ? O.some({
            grant: held.parent,
            terms: held.terms
          }) : O.none()
        )
      }))

    const confirm: {
      (ref: GrantRef, root: Root, at: DateTime.Utc): Effect.Effect<O.Option<CapabilityGrant>>,
      (root: Root, at: DateTime.Utc): (ref: GrantRef) => Effect.Effect<O.Option<CapabilityGrant>>
    } = dual(3, (ref: GrantRef, root: Root, at: DateTime.Utc): Effect.Effect<O.Option<CapabilityGrant>> =>
      Root.match(root, {
        // A human holds grants directly; an agent run only through a delegation.
        Human: ({ principal }) =>
          O.match(ref.delegation, {
            onNone: () =>
              Effect.map(grantInForce(ref.grant, O.some(principal), at), (terms) =>
                O.map(terms, (t) => CapabilityGrant.make({
                  grant: ref.grant,
                  delegation: O.none(), ...t
                }))
              ),
            onSome: thunkEffectSucceedNone
          }),
        Agent: ({ run }) =>
          O.match(ref.delegation, {
            onNone: thunkEffectSucceedNone,
            onSome: (delegation) =>
              // Of the grant the ref names: a delegation of another grant answers for nothing.
              Effect.map(delegationInForce(delegation, O.some(run), at), (found) =>
                O.map(O.filter(found, ({ grant }) => grant === ref.grant), ({
                                                                              grant,
                                                                              terms
                                                                            }) => CapabilityGrant.make({
                  grant,
                  delegation: O.some(delegation), ...terms
                }))
              )
          })
      }))

    /** The grants a human holds directly, each confirmed in force at `at`. */
    const heldBy: {
      (principal: PrincipalId, at: DateTime.Utc): Effect.Effect<ReadonlyArray<CapabilityGrant>>,
      (at: DateTime.Utc): (principal: PrincipalId) => Effect.Effect<ReadonlyArray<CapabilityGrant>>
    } = dual(2,
      Effect.fn("Boundary.heldBy")(function* (
        principal: PrincipalId,
        at: DateTime.Utc
      ): Effect.fn.Return<ReadonlyArray<CapabilityGrant>> {
        const view = yield* Effect.orDie(holderGrants.get(principal))
        const ids = listed(view, (held) => held.grants)
        const root = Root.cases.Human.make({ principal })
        const confirmed = yield* Effect.forEach(ids, (grant) => confirm(GrantRef.make({
          grant,
          delegation: O.none()
        }), root, at), { concurrency: 1 })
        return A.getSomes(confirmed)
      }))

    const answerFor = (run: RunId) =>
      Effect.map(accountability.get(run), O.liftPredicate(AccountabilityState.guards.Live))

    const delegatedTo = Effect.fn("Boundary.delegatedTo")(function* (
      run: RunId,
      accountable: PrincipalId,
      at: DateTime.Utc
    ) {
      const view = yield* Effect.orDie(runDelegations.get(run))
      const ids = listed(view, (held) => held.delegations)
      const root = Root.cases.Agent.make({ run, accountable })
      const confirmed = yield* Effect.forEach(ids, (delegation: DelegationId) =>
          Effect.flatMap(delegations.get(delegation), (held) =>
            DelegationState.guards.Active(held) ? confirm(GrantRef.make({
              grant: held.parent,
              delegation: O.some(delegation)
            }), root, at) : Effect.succeedNone
          ),
        { concurrency: 1 }
      )
      return A.getSomes(confirmed)
    })

    const humanRooted = (principal: PrincipalId, at: DateTime.Utc, chain: ReadonlyArray<Hop>) =>
      Effect.map(heldBy(principal, at), (held) =>
        Invocation.make({
          root: Root.cases.Human.make({ principal }),
          onBehalfOf: principal,
          grants: held,
          chain
        })
      )

    /** An agent run is admitted only while it has a live accountable human, with its delegations in force. */
    const admitAgent = Effect.fn("Boundary.admitAgent")(function* (run: RunId, at: DateTime.Utc) {
      const answerer = yield* answerFor(run)
      if (O.isNone(answerer)) return yield* Unaccountable.make({ run })
      const grants = yield* delegatedTo(run, answerer.value.accountable, at)
      return Invocation.make({
        root: Root.cases.Agent.make({
          run,
          accountable: answerer.value.accountable
        }),
        onBehalfOf: answerer.value.onBehalfOf,
        grants,
        chain: []
      })
    })

    return {
      admit: dual(
        2,
        Effect.fn("Boundary.admit")((credential: Credential, at: DateTime.Utc) =>
          Credential.match(credential, {
            Human: ({ principal }) => humanRooted(principal, at, []),
            // A process acts for a human, and its first hop says so; a process is never a root.
            Process: ({ process, principal }) =>
              humanRooted(principal, at, [byProcess(process, Cause.cases.Session.make({ scheme: "fixture" }))]),
            Agent: ({ run }) => admitAgent(run, at)
          })
        )
      ),

      readmit: dual(
        3,
        Effect.fn("Boundary.readmit")(function* (provenance: Provenance, hop: Hop, at: DateTime.Utc) {
          // The root is re-checked, not trusted: an agent root needs a live accountable human now.
          const onBehalfOf = yield* Root.match(provenance.root, {
            Human: ({ principal }) => Effect.succeed(principal),
            Agent: ({ run, accountable }) =>
              Effect.flatMap(answerFor(run), (answerer) =>
                O.isSome(answerer) && answerer.value.accountable === accountable
                  ? Effect.succeed(answerer.value.onBehalfOf)
                  : Effect.fail(ReadmissionRefused.make({ reason: "unaccountable" }))
              )
          })
          const confirmed = yield* Effect.forEach(provenance.grants, (ref) =>
              Effect.map(confirm(ref, provenance.root, at), (live) => ({
                ref,
                live
              })),
            { concurrency: 1 }
          )
          const live = A.getSomes(A.map(confirmed, ({ live }) => live))
          const lapsed = A.getSomes(A.map(confirmed, (
            {
              ref,
              live
            }) => (O.isNone(live) ? O.some(ref) : O.none())))
          if (A.isReadonlyArrayNonEmpty(provenance.grants) && A.isReadonlyArrayEmpty(live)) {
            return yield* ReadmissionRefused.make({ reason: "lapsed", lapsed })
          }
          return Invocation.make({
            root: provenance.root,
            onBehalfOf,
            grants: live,
            chain: A.append(provenance.chain, hop)
          })
        })
      ),

      runProvenance: dual(
        2,
        (run: RunId, {
          accountable,
          onBehalfOf,
          grant
        }: RunAuthority): Provenance =>
          Provenance.make({
            root: Root.cases.Agent.make({ run, accountable }),
            onBehalfOf,
            grants: [grant],
            chain: []
          })
      )
    }
  })
)

/**
 * The invocation that issues an org's first grant: its owner, holding
 * `authority.grants` on the org with no Grant behind it.
 *
 * **Gotchas**
 *
 * Break-glass. Every other invocation is admitted from grants the model
 * holds; this one is not. A real host runs it once, from an operator
 * ceremony, and records it.
 *
 * @category constructors
 * @since 0.0.0
 */
export const bootstrap: {
  (org: OrgId): (owner: PrincipalId) => Invocation;
  (owner: PrincipalId, org: OrgId): Invocation;
} = dual(2, (owner: PrincipalId, org: OrgId): Invocation =>
  Invocation.make({
    root: Root.cases.Human.make({ principal: owner }),
    onBehalfOf: owner,
    grants: [
      CapabilityGrant.make({
        grant: GrantId.make(`bootstrap:${org}`),
        delegation: O.none(),
        capability: CapabilityId.make("authority.grants"),
        operations: O.none(),
        resource: ResourceScope.cases.Org.make({ org }),
        expires: O.none()
      })
    ],
    chain: []
  })
)
