import * as Domain from "@alchemy.run/domain";
import {
  AccountabilityAlreadyAssigned,
  AccountabilityAssigned,
  AssignAccountability,
} from "@proto/authority-contract/Accountability/AssignAccountability.command";
import {
  AccountabilityReleased,
  NotAccountable,
  ReleaseAccountability,
} from "@proto/authority-contract/Accountability/ReleaseAccountability.command";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { PrincipalId, RunId } from "@proto/kernel/Ids";
import { provenanceOf, Root } from "@proto/kernel/Invocation";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as S from "effect/Schema";

/**
 * Who answers for an agent run: nobody yet, a live accountable human (and on
 * whose behalf the run acts), or a human who has released it.
 *
 * @category models
 * @since 0.0.0
 */
export const AccountabilityState = S.TaggedUnion({
  Unassigned: {},
  Live: { accountable: PrincipalId, onBehalfOf: PrincipalId },
  Released: { accountable: PrincipalId },
});
/**
 * @category models
 * @since 0.0.0
 */
export type AccountabilityState = typeof AccountabilityState.Type;

/**
 * The Accountability relation, one instance per agent run: every
 * agent-rooted action names a live accountable human, and the boundary and
 * re-admission admit an agent only while this instance is `Live`.
 *
 * @category aggregates
 * @since 0.0.0
 */
export class Accountability extends Domain.Aggregate(
  "Accountability",
  {
    id: RunId,
    state: AccountabilityState,
    initial: { _tag: "Unassigned" },
    commands: [AssignAccountability, ReleaseAccountability],
    decide: {
      AssignAccountability: Effect.fn(function* (state, _command, { id }) {
        if (state._tag !== "Unassigned") return yield* AccountabilityAlreadyAssigned.make({});
        const invocation = yield* CurrentInvocation;
        // A human answers for the run; an agent root names its own accountable human.
        const accountable = Root.match(invocation.root, {
          Human: ({ principal }) => principal,
          Agent: (agent) => agent.accountable,
        });
        return [
          AccountabilityAssigned.make({
            run: id,
            accountable,
            onBehalfOf: invocation.onBehalfOf,
            provenance: provenanceOf(invocation),
          }),
        ];
      }),

      ReleaseAccountability: Effect.fn(function* (state, _command, { id }) {
        const invocation = yield* CurrentInvocation;
        const answers =
          AccountabilityState.guards.Live(state) &&
          Root.guards.Human(invocation.root) &&
          invocation.root.principal === state.accountable;
        if (!answers) return yield* NotAccountable.make({});
        return [AccountabilityReleased.make({ run: id, accountable: state.accountable, provenance: provenanceOf(invocation) })];
      }),
    },
    evolve: {
      AccountabilityAssigned: (_, event) =>
        AccountabilityState.cases.Live.make({ accountable: event.accountable, onBehalfOf: event.onBehalfOf }),
      AccountabilityReleased: (state, event) =>
        AccountabilityState.matchOrElse(
          state,
          { Live: (): AccountabilityState => AccountabilityState.cases.Released.make({ accountable: event.accountable }) },
          identity,
        ),
    },
  },
  { description: "Who answers for an agent run, and on whose behalf it acts." },
) {}
