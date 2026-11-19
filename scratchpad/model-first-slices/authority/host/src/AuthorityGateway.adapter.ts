import { AuthorityGateway, RunGrant, RunGrantRefused } from "@proto/authority-contract/Authority.gateway";
import { AssignAccountability } from "@proto/authority-contract/Accountability/AssignAccountability.command";
import { DelegateFurther } from "@proto/authority-contract/Delegation/DelegateFurther.command";
import { DelegateGrant } from "@proto/authority-contract/Grant/DelegateGrant.command";
import { Accountability, AccountabilityState } from "@proto/authority-model/Accountability/Accountability.aggregate";
import { Delegation, DelegationState } from "@proto/authority-model/Delegation/Delegation.aggregate";
import { Grant } from "@proto/authority-model/Grant/Grant.aggregate";
import { GrantTerms } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { GrantRef } from "@proto/kernel/Invocation";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
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
 * A delegation id names one delegation: a request under an id already
 * opened, or one the policy did not open as asked, is refused rather than
 * granted under another run's delegation.
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
    const sameTerms = S.toEquivalence(GrantTerms);

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
          /** Whether a delegation is the one this request asks for: the run's, from the source, on the asked terms. */
          const isAsked = (state: DelegationState) =>
            DelegationState.guards.Active(state) &&
            state.holder === run &&
            state.parent === source.grant &&
            Eq.equals(state.parentDelegation, source.delegation) &&
            sameTerms(state.terms, terms);
          // A delegation id names one delegation: one already opened for anything else is never
          // pointed at this run. The same request again (a redelivered trigger) is granted again.
          const existing = yield* delegations.get(delegation);
          if (!DelegationState.guards.Unopened(existing) && !isAsked(existing)) {
            return yield* RunGrantRefused.make({ reason: "DelegationAlreadyOpen" });
          }
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
          const opened = yield* delegations.get(delegation).pipe(
            Effect.repeat({ schedule: Schedule.spaced("10 millis"), until: P.not(DelegationState.guards.Unopened), times: 200 }),
          );
          // Only the delegation this request opened is granted.
          if (DelegationState.guards.Unopened(opened)) return yield* RunGrantRefused.make({ reason: "DelegationNotOpened" });
          if (!isAsked(opened)) return yield* RunGrantRefused.make({ reason: "DelegationAlreadyOpen" });
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
