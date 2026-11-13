import * as Domain from "@alchemy.run/domain";
import { AuthorityGrants } from "@proto/authority-contract/Authority.capabilities";
import { DelegateGrant, GrantDelegated, NotHolder } from "@proto/authority-contract/Grant/DelegateGrant.command";
import { ExpireGrant, GrantExpired } from "@proto/authority-contract/Grant/ExpireGrant.command";
import { GrantNotActive } from "@proto/authority-contract/Grant/GrantNotActive.rejection";
import { GrantAlreadyIssued, GrantIssued, IssueGrant } from "@proto/authority-contract/Grant/IssueGrant.command";
import { GrantNarrowed, NarrowGrant } from "@proto/authority-contract/Grant/NarrowGrant.command";
import { GrantRevoked, RevokeGrant } from "@proto/authority-contract/Grant/RevokeGrant.command";
import { TermsWiden } from "@proto/authority-contract/TermsWiden.rejection";
import { GrantTerms, inForce, ResourceScope, widens } from "@proto/kernel/Capability";
import { CurrentInvocation, requireGrant } from "@proto/kernel/CurrentInvocation.context";
import { GrantId, PrincipalId } from "@proto/kernel/Ids";
import { provenanceOf, Root } from "@proto/kernel/Invocation";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";

/**
 * A grant's lifecycle: issued and active with its current terms, then
 * revoked or expired. A grant never comes back.
 *
 * @category models
 * @since 0.0.0
 */
export const GrantState = S.TaggedUnion({
  Unissued: {},
  Active: { holder: PrincipalId, terms: GrantTerms },
  Revoked: { holder: PrincipalId },
  Expired: { holder: PrincipalId },
});
/**
 * @category models
 * @since 0.0.0
 */
export type GrantState = typeof GrantState.Type;
/**
 * @category models
 * @since 0.0.0
 */
export type ActiveGrant = typeof GrantState.cases.Active.Type;

const requireActive = (state: GrantState): Effect.Effect<ActiveGrant, GrantNotActive> =>
  Match.value(state).pipe(
    Match.tag("Active", (active) => Effect.succeed(active)),
    Match.orElse((other) => Effect.fail(new GrantNotActive({ status: other._tag }))),
  );

const orgOf = (terms: GrantTerms) => ResourceScope.cases.Org.make({ org: terms.resource.org });

const requireNarrower = (current: GrantTerms, next: GrantTerms): Effect.Effect<void, TermsWiden> =>
  O.match(widens(current, next), {
    onNone: () => Effect.void,
    onSome: (dimension) => Effect.fail(new TermsWiden({ dimension })),
  });

/**
 * One grant of one capability to one principal. Its terms only ever narrow,
 * and a delegation of it only narrows them further.
 *
 * @category aggregates
 * @since 0.0.0
 */
export class Grant extends Domain.Aggregate(
  "Grant",
  {
    id: GrantId,
    state: GrantState,
    initial: { _tag: "Unissued" },
    commands: [IssueGrant, NarrowGrant, RevokeGrant, ExpireGrant, DelegateGrant],
    decide: {
      IssueGrant: Effect.fn(function* (state, command, { now }) {
        // The org is the command's, so the grant is checked before existence is revealed.
        const invocation = yield* requireGrant(AuthorityGrants, command._tag, orgOf(command.terms), now);
        if (state._tag !== "Unissued") return yield* new GrantAlreadyIssued();
        return [new GrantIssued({ holder: command.holder, terms: command.terms, provenance: provenanceOf(invocation) })];
      }),

      NarrowGrant: Effect.fn(function* (state, command, { now }) {
        const active = yield* requireActive(state);
        const invocation = yield* requireGrant(AuthorityGrants, command._tag, orgOf(active.terms), now);
        yield* requireNarrower(active.terms, command.terms);
        return [new GrantNarrowed({ holder: active.holder, terms: command.terms, provenance: provenanceOf(invocation) })];
      }),

      RevokeGrant: Effect.fn(function* (state, command, { now }) {
        const active = yield* requireActive(state);
        const invocation = yield* requireGrant(AuthorityGrants, command._tag, orgOf(active.terms), now);
        return [new GrantRevoked({ holder: active.holder, provenance: provenanceOf(invocation) })];
      }),

      // A deadline: records nothing unless the grant is active and its expiry has passed.
      ExpireGrant: (state, command, { now }) =>
        GrantState.guards.Active(state) && !inForce(state.terms, now)
          ? [new GrantExpired({ holder: state.holder, provenance: command.provenance })]
          : [],

      DelegateGrant: Effect.fn(function* (state, command) {
        const active = yield* requireActive(state);
        const invocation = yield* CurrentInvocation;
        // Only the human holding the grant delegates it; an agent re-delegates its own delegation.
        const holds = Root.guards.Human(invocation.root) && invocation.root.principal === active.holder;
        if (!holds) return yield* new NotHolder();
        yield* requireNarrower(active.terms, command.terms);
        return [
          new GrantDelegated({
            holder: active.holder,
            delegation: command.delegation,
            to: command.to,
            terms: command.terms,
            provenance: provenanceOf(invocation),
          }),
        ];
      }),
    },
    evolve: {
      GrantIssued: (_, event) => GrantState.cases.Active.make({ holder: event.holder, terms: event.terms }),
      GrantNarrowed: (state, event) =>
        GrantState.matchOrElse(state, { Active: (active): GrantState => ({ ...active, terms: event.terms }) }, identity),
      GrantRevoked: (state, event) =>
        GrantState.matchOrElse(
          state,
          { Active: (): GrantState => GrantState.cases.Revoked.make({ holder: event.holder }) },
          identity,
        ),
      GrantExpired: (state, event) =>
        GrantState.matchOrElse(
          state,
          { Active: (): GrantState => GrantState.cases.Expired.make({ holder: event.holder }) },
          identity,
        ),
      // The delegation is its own aggregate; the parent's state does not change.
      GrantDelegated: identity,
    },
  },
  { description: "One grant of one capability to one principal, from issue to revocation or expiry." },
) {}
