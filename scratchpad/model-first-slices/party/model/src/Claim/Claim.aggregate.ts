import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import { Actor } from "@proto/kernel/Actor";
import { CurrentActor } from "@proto/kernel/CurrentActor.context";
import { OrgId } from "@proto/kernel/Ids";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as S from "effect/Schema";
import { Disposition } from "../Disposition.ts";
import { EvidenceSignal } from "../Evidence.ts";
import { Proposition } from "../Proposition.ts";
import { AcceptClaim, ClaimAccepted } from "./AcceptClaim.command.ts";
import { AssertClaim, ClaimAlreadyAsserted, ClaimAsserted } from "./AssertClaim.command.ts";
import { ClaimId } from "./Claim.id.ts";
import { requireAdmission, requireMember, requirePending } from "./Claim.rules.ts";
import { DispositionProposed, NotAnAgent, ProposeDisposition } from "./ProposeDisposition.command.ts";
import { ClaimRetracted, RetractClaim } from "./RetractClaim.command.ts";

/**
 * An agent's proposal on a pending claim, kept until a reviewer decides.
 *
 * @category models
 * @since 0.0.0
 */
export const Proposal = S.Struct({ disposition: Disposition, rationale: S.String, by: Actor });

/**
 * A claim's lifecycle. The union is the state machine: `decide` guards each
 * transition and `evolve` takes it.
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimState = S.TaggedUnion({
  Unasserted: {},
  Pending: {
    org: OrgId,
    proposition: Proposition,
    signals: S.Array(EvidenceSignal),
    proposal: S.NullOr(Proposal),
  },
  Accepted: { org: OrgId, proposition: Proposition, by: Actor },
  Retracted: { org: OrgId, reason: S.String },
});
/**
 * @category models
 * @since 0.0.0
 */
export type ClaimState = typeof ClaimState.Type;
/**
 * @category models
 * @since 0.0.0
 */
export type Pending = typeof ClaimState.cases.Pending.Type;

/**
 * A claim about parties, from assertion to acceptance or retraction. Each
 * command lives in its own file with its events and its own rejections; this
 * file holds the state and how commands and events change it.
 *
 * @category aggregates
 * @since 0.0.0
 */
export class Claim extends Domain.Aggregate(
  "Claim",
  {
    id: ClaimId,
    state: ClaimState,
    initial: { _tag: "Unasserted" },
    commands: [AssertClaim, ProposeDisposition, AcceptClaim, RetractClaim],
    decide: {
      AssertClaim: Effect.fn(function* (state, command) {
        if (state._tag !== "Unasserted") return yield* new ClaimAlreadyAsserted();
        const by = yield* CurrentActor;
        return [new ClaimAsserted({ proposition: command.proposition, signals: command.signals, by })];
      }),

      ProposeDisposition: Effect.fn(function* (state, command) {
        const by = yield* Effect.service(CurrentActor).pipe(
          Effect.filterOrFail(Actor.guards.Agent, () => new NotAnAgent()),
        );
        yield* requirePending(state).pipe(Effect.flatMap(requireMember(by)));
        return [
          new DispositionProposed({ disposition: command.disposition, rationale: command.rationale, by }),
        ];
      }),

      AcceptClaim: Effect.fn(function* (state) {
        const by = yield* CurrentActor;
        const pending = yield* requirePending(state).pipe(Effect.flatMap(requireMember(by)));
        const gate = yield* requireAdmission(pending);
        return [new ClaimAccepted({ proposition: pending.proposition, by, corroboration: gate.have })];
      }),

      RetractClaim: Effect.fn(function* (state, command) {
        const by = yield* CurrentActor;
        yield* requirePending(state).pipe(Effect.flatMap(requireMember(by)));
        return [new ClaimRetracted({ reason: command.reason, by })];
      }),
    },
    // Total: decide already refused what cannot happen, so a handler keeps any
    // state its event cannot follow.
    evolve: {
      ClaimAsserted: (_, event) =>
        ClaimState.cases.Pending.make({
          org: event.by.org,
          proposition: event.proposition,
          signals: event.signals,
          proposal: null,
        }),
      DispositionProposed: (state, event) =>
        ClaimState.matchOrElse(
          state,
          {
            Pending: (pending): ClaimState => ({
              ...pending,
              proposal: { disposition: event.disposition, rationale: event.rationale, by: event.by },
            }),
          },
          identity,
        ),
      ClaimAccepted: (state, event) =>
        ClaimState.matchOrElse(
          state,
          {
            Pending: (pending): ClaimState =>
              ClaimState.cases.Accepted.make({ org: pending.org, proposition: pending.proposition, by: event.by }),
          },
          identity,
        ),
      ClaimRetracted: (state, event) =>
        ClaimState.matchOrElse(
          state,
          {
            Pending: (pending): ClaimState =>
              ClaimState.cases.Retracted.make({ org: pending.org, reason: event.reason }),
          },
          identity,
        ),
    },
  },
  { description: "A proposition about parties, from assertion through review to acceptance or retraction." },
) {}
