import { AuthorityGateway, RunGrant, RunGrantRefused } from "@proto/authority-contract/Authority.gateway";
import { AssignAccountability } from "@proto/authority-contract/Accountability/AssignAccountability.command";
import { DelegateFurther } from "@proto/authority-contract/Delegation/DelegateFurther.command";
import { DelegateGrant } from "@proto/authority-contract/Grant/DelegateGrant.command";
import { Accountability, AccountabilityState } from "@proto/authority-model/Accountability/Accountability.aggregate";
import { Delegation, DelegationState } from "@proto/authority-model/Delegation/Delegation.aggregate";
import { Grant } from "@proto/authority-model/Grant/Grant.aggregate";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { GrantRef } from "@proto/kernel/Invocation";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Schedule from "effect/Schedule";
import { Boundary, BoundaryLive } from "./Boundary/Boundary.ts";
import { thunkEffectVoid } from "@beep/utils"

/**
 * The authority context's side of its gateway: re-admission through the
 * boundary, and run grants decided by the authority model's own aggregates
 * under the re-admitted requester. Requires the hosted authority model.
 *
 * **Gotchas**
 *
 * `grantRun` waits until the delegation is open, which the model's own
 * policy does after the parent records it, so a run can act as soon as the
 * call returns. The suffix is the same open question as the Session's half.
 *
 * @category adapters
 * @since 0.0.0
 */
export const AuthorityGatewayLive = Layer.effect(
  AuthorityGateway,
  Effect.gen(function* () {
    const boundary = yield* Boundary;
    const grants = yield* Grant;
    const delegations = yield* Delegation;
    const accountability = yield* Accountability;

    const refused = (cause: { readonly _tag: string }) => RunGrantRefused.make({ reason: cause._tag });

    type Gateway = AuthorityGateway["Service"];
    return {
      readmit: Effect.fn("AuthorityGateway.readmit")(function* ({ provenance, hop }: Parameters<Gateway["readmit"]>[0]) {
        const now = yield* DateTime.now;
        return yield* boundary.readmit(provenance, hop, now);
      }),

      grantRun: Effect.fn("AuthorityGateway.grantRun")(function* ({
        provenance,
        hop,
        source,
        delegation,
        run,
        terms,
      }: Parameters<Gateway["grantRun"]>[0]) {
          const now = yield* DateTime.now;
          const invocation = yield* boundary.readmit(provenance, hop, now);
          const asRequester = Effect.provideService(CurrentInvocation, invocation);
          // From a grant the requester holds, or from the delegation the requesting run holds.
          yield* O.match(source.delegation, {
            onNone: () =>
              grants
                .send(source.grant, DelegateGrant.make({ delegation, to: run, terms }))
                .pipe(asRequester, Effect.asVoid, Effect.mapError(refused)),
            onSome: (held) =>
              delegations
                .send(held, DelegateFurther.make({ child: delegation, to: run, terms }))
                .pipe(asRequester, Effect.asVoid, Effect.mapError(refused)),
          });
          yield* accountability
            .send(run, AssignAccountability.make({}))
            .pipe(asRequester, Effect.catchTag("AccountabilityAlreadyAssigned", thunkEffectVoid));
          const answerer = yield* accountability.get(run);
          if (!AccountabilityState.guards.Live(answerer)) return yield* RunGrantRefused.make({ reason: "NotAccountable" });
          // The model's own policy opens the delegation; wait until it is.
          yield* delegations.get(delegation).pipe(
            Effect.repeat({ schedule: Schedule.spaced("10 millis"), until: P.not(DelegationState.guards.Unopened), times: 200 }),
          );
          return RunGrant.make({
            delegation,
            accountable: answerer.accountable,
            provenance: boundary.runProvenance(run, {
              accountable: answerer.accountable,
              onBehalfOf: answerer.onBehalfOf,
              grant: GrantRef.make({ grant: source.grant, delegation: O.some(delegation) }),
            }),
          });
      }),
    };
  }),
).pipe(Layer.provide(BoundaryLive));
