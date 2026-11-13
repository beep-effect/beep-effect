import { AuthorityGateway } from "@proto/authority-contract/Authority.gateway";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { extend, type Hop, type Provenance } from "@proto/kernel/Invocation";
import { AwaitApproval } from "@proto/runs-contract/Run/AwaitApproval.command";
import { CompleteRun } from "@proto/runs-contract/Run/CompleteRun.command";
import { ExhaustRun } from "@proto/runs-contract/Run/ExhaustRun.command";
import { RecordStep } from "@proto/runs-contract/Run/RecordStep.command";
import { RejectRun } from "@proto/runs-contract/Run/RejectRun.command";
import { ReleaseReservation } from "@proto/runs-contract/Run/ReleaseReservation.command";
import { RequestRun } from "@proto/runs-contract/Run/RequestRun.command";
import { ReserveBudget } from "@proto/runs-contract/Run/ReserveBudget.command";
import { SettleUsage } from "@proto/runs-contract/Run/SettleUsage.command";
import { RunReport, RunReportRefused, RunRequestRefused, RunsGateway } from "@proto/runs-contract/Runs.gateway";
import { AgentRun, sessionOf } from "@proto/runs-model/Run/AgentRun.aggregate";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";

/**
 * The runs context's side of its gateway. Every call is re-admitted by the
 * authority context first and sent under the invocation it returns; a
 * refusal at re-admission is recorded on the run, never dropped.
 *
 * **Gotchas**
 *
 * `request` waits until the run is granted (the runs model's own policy does
 * that after the request commits), so a caller can act as the run as soon
 * as it returns.
 *
 * @category adapters
 * @since 0.0.0
 */
export const RunsGatewayLive = Layer.effect(
  RunsGateway,
  Effect.gen(function* () {
    const authority = yield* AuthorityGateway;
    const runs = yield* AgentRun;

    /** Send under the provenance re-admitted for this hop. */
    const readmitted = <A, E>(provenance: Provenance, hop: Hop, send: Effect.Effect<A, E, CurrentInvocation>) =>
      Effect.flatMap(authority.readmit({ provenance, hop }), (invocation) =>
        Effect.provideService(send, CurrentInvocation, invocation),
      );

    const refusal = (cause: { readonly _tag: string; readonly reason?: unknown; readonly remaining?: unknown }) =>
      new RunReportRefused({
        reason:
          cause._tag === "BudgetExceeded"
            ? "budget"
            : cause._tag === "ReadmissionRefused"
              ? `readmission:${String(cause.reason)}`
              : cause._tag,
        remaining: typeof cause.remaining === "number" ? cause.remaining : null,
      });

    return {
      request: (request) =>
        readmitted(
          request.provenance,
          request.hop,
          runs.send(
            request.run,
            new RequestRun({
              session: request.session,
              purpose: request.purpose,
              versions: request.versions,
              allowance: request.allowance,
              historyBound: request.historyBound,
              source: request.source,
              terms: request.terms,
            }),
          ),
        ).pipe(
          Effect.mapError((refused) => new RunRequestRefused({ reason: refused._tag })),
          Effect.andThen(
            runs.get(request.run).pipe(
              Effect.repeat({
                schedule: Schedule.spaced("10 millis"),
                until: (state) => state._tag !== "Requested" && state._tag !== "Unrequested",
                times: 300,
              }),
            ),
          ),
          Effect.flatMap((state) =>
            state._tag === "Running" && state.run.provenance !== null
              ? Effect.succeed({ provenance: state.run.provenance })
              : Effect.fail(new RunRequestRefused({ reason: state._tag === "Rejected" ? state.reason : state._tag })),
          ),
        ),

      report: ({ provenance, hop, run, report }) =>
        RunReport.match(report, {
          // A refusal mid-run has, by definition, no invocation to act under: record it as such.
          Refused: ({ reason }) =>
            Effect.flatMap(runs.get(run), (state) =>
              O.match(sessionOf(state), {
                onNone: () => Effect.fail(new RunReportRefused({ reason: "unknown-run", remaining: null })),
                onSome: (session) =>
                  runs.send(run, new RejectRun({ session, reason, provenance: extend(provenance, hop) })).pipe(Effect.asVoid),
              }),
            ),
          Reserve: ({ reservation, units }) =>
            readmitted(provenance, hop, runs.send(run, new ReserveBudget({ reservation, units }))).pipe(
              Effect.asVoid,
              Effect.mapError(refusal),
            ),
          Settle: ({ reservation, units }) =>
            readmitted(provenance, hop, runs.send(run, new SettleUsage({ reservation, units }))).pipe(
              Effect.asVoid,
              Effect.mapError(refusal),
            ),
          Release: ({ reservation }) =>
            readmitted(provenance, hop, runs.send(run, new ReleaseReservation({ reservation }))).pipe(
              Effect.asVoid,
              Effect.mapError(refusal),
            ),
          Step: ({ step }) =>
            readmitted(provenance, hop, runs.send(run, new RecordStep({ step }))).pipe(
              Effect.asVoid,
              Effect.mapError(refusal),
            ),
          AwaitApproval: () =>
            readmitted(provenance, hop, runs.send(run, new AwaitApproval())).pipe(Effect.asVoid, Effect.mapError(refusal)),
          Complete: ({ outcome }) =>
            readmitted(provenance, hop, runs.send(run, new CompleteRun({ outcome }))).pipe(
              Effect.asVoid,
              Effect.mapError(refusal),
            ),
          Exhausted: () =>
            readmitted(provenance, hop, runs.send(run, new ExhaustRun())).pipe(Effect.asVoid, Effect.mapError(refusal)),
        }),
    };
  }),
);
