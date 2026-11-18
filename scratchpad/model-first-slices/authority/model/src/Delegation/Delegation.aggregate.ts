import * as Domain from "@alchemy.run/domain";
import {
  DelegateFurther,
  DelegationExtended,
  NotDelegationHolder,
} from "@proto/authority-contract/Delegation/DelegateFurther.command";
import { DelegationNotActive } from "@proto/authority-contract/Delegation/DelegationNotActive.rejection";
import { DelegationNarrowed, NarrowDelegation } from "@proto/authority-contract/Delegation/NarrowDelegation.command";
import { NotDelegator } from "@proto/authority-contract/Delegation/NotDelegator.rejection";
import {
  DelegationAlreadyOpen,
  DelegationOpened,
  OpenDelegation,
} from "@proto/authority-contract/Delegation/OpenDelegation.command";
import { DelegationRevoked, RevokeDelegation } from "@proto/authority-contract/Delegation/RevokeDelegation.command";
import { TermsWiden } from "@proto/authority-contract/TermsWiden.rejection";
import { GrantTerms, widens } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { DelegationId, GrantId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { type Invocation, provenanceOf, Root } from "@proto/kernel/Invocation";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { thunkEffectVoid } from "@beep/utils"

/**
 * A delegation's lifecycle: opened for one agent run from a grant (directly,
 * or through a parent delegation), narrowed, then revoked.
 *
 * @category models
 * @since 0.0.0
 */
export const DelegationState = S.TaggedUnion({
  Unopened: {},
  Active: {
    parent: GrantId,
    parentDelegation: S.OptionFromNullOr(DelegationId),
    holder: RunId,
    delegator: PrincipalId,
    terms: GrantTerms,
  },
  Revoked: { holder: RunId },
});
/**
 * @category models
 * @since 0.0.0
 */
export type DelegationState = typeof DelegationState.Type;
/**
 * @category models
 * @since 0.0.0
 */
export type ActiveDelegation = typeof DelegationState.cases.Active.Type;

const requireActive = (state: DelegationState): Effect.Effect<ActiveDelegation, DelegationNotActive> =>
  Match.value(state).pipe(
    Match.tag("Active", (active) => Effect.succeed(active)),
    Match.orElse((other) => Effect.fail(DelegationNotActive.make({ status: other._tag }))),
  );

/** Only the human the delegation acts for changes it. */
const requireDelegator = (active: ActiveDelegation, invocation: Invocation): Effect.Effect<void, NotDelegator> =>
  Root.guards.Human(invocation.root) && invocation.root.principal === active.delegator
    ? Effect.void
    : Effect.fail(NotDelegator.make({}));

const requireNarrower = (current: GrantTerms, next: GrantTerms): Effect.Effect<void, TermsWiden> =>
  O.match(widens(current, next), {
    onNone: thunkEffectVoid,
    onSome: (dimension) => Effect.fail(TermsWiden.make({ dimension })),
  });

/**
 * A grant derived for one agent run. Its parent (a grant, or the delegation
 * of the run that started this one) checked the terms; this aggregate only
 * narrows them, and the boundary and re-admission count it only while every
 * ancestor is in force and still covers it.
 *
 * @category aggregates
 * @since 0.0.0
 */
export class Delegation extends Domain.Aggregate(
  "Delegation",
  {
    id: DelegationId,
    state: DelegationState,
    initial: { _tag: "Unopened" },
    commands: [OpenDelegation, NarrowDelegation, RevokeDelegation, DelegateFurther],
    decide: {
      OpenDelegation: (state, command) =>
        !DelegationState.guards.Unopened(state)
          ? DelegationAlreadyOpen.make({})
          : [
              DelegationOpened.make({
                parent: command.parent,
                parentDelegation: command.parentDelegation,
                holder: command.holder,
                delegator: command.delegator,
                terms: command.terms,
                provenance: command.provenance,
              }),
            ],

      NarrowDelegation: Effect.fn(function* (state, command) {
        const active = yield* requireActive(state);
        const invocation = yield* CurrentInvocation;
        yield* requireDelegator(active, invocation);
        yield* requireNarrower(active.terms, command.terms);
        return [
          DelegationNarrowed.make({ holder: active.holder, terms: command.terms, provenance: provenanceOf(invocation) }),
        ];
      }),

      RevokeDelegation: Effect.fn(function* (state) {
        const active = yield* requireActive(state);
        const invocation = yield* CurrentInvocation;
        yield* requireDelegator(active, invocation);
        return [DelegationRevoked.make({ holder: active.holder, provenance: provenanceOf(invocation) })];
      }),

      DelegateFurther: Effect.fn(function* (state, command) {
        const active = yield* requireActive(state);
        const invocation = yield* CurrentInvocation;
        // Only the run holding the delegation, at the root of the invocation, passes it on.
        const holds = Root.guards.Agent(invocation.root) && invocation.root.run === active.holder;
        if (!holds) return yield* NotDelegationHolder.make({});
        yield* requireNarrower(active.terms, command.terms);
        return [
          DelegationExtended.make({
            holder: active.holder,
            grant: active.parent,
            child: command.child,
            to: command.to,
            terms: command.terms,
            provenance: provenanceOf(invocation),
          }),
        ];
      }),
    },
    evolve: {
      DelegationOpened: (_, event) =>
        DelegationState.cases.Active.make({
          parent: event.parent,
          parentDelegation: event.parentDelegation,
          holder: event.holder,
          delegator: event.delegator,
          terms: event.terms,
        }),
      DelegationNarrowed: (state, event) =>
        DelegationState.matchOrElse(
          state,
          { Active: (active): DelegationState => ({ ...active, terms: event.terms }) },
          identity,
        ),
      DelegationRevoked: (state, event) =>
        DelegationState.matchOrElse(
          state,
          { Active: (): DelegationState => DelegationState.cases.Revoked.make({ holder: event.holder }) },
          identity,
        ),
      // The child is its own delegation; this one does not change.
      DelegationExtended: identity,
    },
  },
  { description: "Part of a grant, delegated to one agent run, that only ever narrows." },
) {}
