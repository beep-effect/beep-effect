import { AuthorityGateway } from "@proto/authority-contract/Authority.gateway";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { extend, type Hop, type Provenance } from "@proto/kernel/Invocation";
import { requestKey } from "@proto/kernel/RequestKey";
import { AwaitApproval } from "@proto/runs-contract/Run/AwaitApproval.command";
import { CompleteRun } from "@proto/runs-contract/Run/CompleteRun.command";
import { ExhaustRun } from "@proto/runs-contract/Run/ExhaustRun.command";
import { RecordStep } from "@proto/runs-contract/Run/RecordStep.command";
import { RejectRun } from "@proto/runs-contract/Run/RejectRun.command";
import { ReleaseReservation } from "@proto/runs-contract/Run/ReleaseReservation.command";
import { RequestRun } from "@proto/runs-contract/Run/RequestRun.command";
import { ReserveBudget } from "@proto/runs-contract/Run/ReserveBudget.command";
import { SettleUsage } from "@proto/runs-contract/Run/SettleUsage.command";
import {
  type CurrentRun,
  RunReport,
  RunReportRefused,
  RunRequestRefused,
  RunsGateway,
} from "@proto/runs-contract/Runs.gateway";
import { AgentRun, recordOf, sessionOf } from "@proto/runs-model/Run/AgentRun.aggregate";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { liveRun, settling } from "./Lineage.ts";


/**
 * The runs context's side of its gateway. Every call is re-admitted by the
 * authority context first and sent under the invocation it returns; a
 * refusal at re-admission is recorded on the run, never dropped.
 *
 * **Details**
 *
 * A report to a run that continued at its history bound goes to the live run
 * of its lineage, re-admitted under that run's provenance (its own
 * delegation), and the live run is returned for the caller's next report.
 * Every send carries a command id derived from the caller, the operation
 * and the request (`requestKey`), so a retried report is the same command.
 *
 * **Gotchas**
 *
 * `request` waits until the run is granted (the runs model's own policy does
 * that after the request commits), so a caller can act as the run as soon
 * as it returns. Following a continuation waits the same way for the policy
 * that opens it.
 *
 * @category adapters
 * @since 0.0.0
 */
export const RunsGatewayLive = Layer.effect(
  RunsGateway,
  Effect.gen(function* () {
    const authority = yield* AuthorityGateway;
    const runs = yield* AgentRun;
    const digest = yield* Digest.Digest;
    const commandIdOf = (request: Parameters<typeof requestKey>[0]) =>
      requestKey(request).pipe(
        Effect.provideService(Digest.Digest, digest),
        Effect.map((commandId) => ({ commandId })),
      );

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

    /** The live run of the caller's lineage, with the provenance it acts under now. */
    const follow = (current: CurrentRun): Effect.Effect<CurrentRun, RunReportRefused> =>
      Effect.flatMap(liveRun(runs, current.run), (live) =>
        live.run === current.run
          ? Effect.succeed(current)
          : O.match(
              O.flatMapNullishOr(recordOf(live.state), (record) => record.provenance),
              {
                onNone: () =>
                  Effect.fail(new RunReportRefused({ reason: `continuation:${live.state._tag}`, remaining: null })),
                onSome: (provenance) => Effect.succeed({ run: live.run, provenance }),
              },
            ),
      );

    return {
      request: (request) =>
        commandIdOf({
          tenant: request.provenance.onBehalfOf,
          operation: "RequestRun",
          payload: { run: request.run, session: request.session, hop: request.hop },
        }).pipe(
          Effect.flatMap((options) =>
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
                options,
              ),
            ),
          ),
          Effect.mapError((refused) => new RunRequestRefused({ reason: refused._tag })),
          Effect.andThen(
            runs.get(request.run).pipe(
              Effect.repeat({ ...settling, until: (state) => state._tag !== "Requested" && state._tag !== "Unrequested" }),
            ),
          ),
          Effect.flatMap((state) =>
            state._tag === "Running" && state.run.provenance !== null
              ? Effect.succeed({ provenance: state.run.provenance })
              : Effect.fail(new RunRequestRefused({ reason: state._tag === "Rejected" ? state.reason : state._tag })),
          ),
        ),

      report: ({ provenance, hop, run, report }) =>
        Effect.gen(function* () {
          const current = yield* follow({ run, provenance });
          const options = yield* commandIdOf({
            tenant: current.provenance.onBehalfOf,
            operation: report._tag,
            payload: { run: current.run, report, hop },
          });
          const send = <A, E extends { readonly _tag: string }>(command: Effect.Effect<A, E, CurrentInvocation>) =>
            readmitted(current.provenance, hop, command).pipe(Effect.as(current), Effect.mapError(refusal));
          return yield* RunReport.match(report, {
            // A refusal mid-run has, by definition, no invocation to act under: record it as such.
            Refused: ({ reason }) =>
              Effect.flatMap(runs.get(current.run), (state) =>
                O.match(sessionOf(state), {
                  onNone: () => Effect.fail(new RunReportRefused({ reason: "unknown-run", remaining: null })),
                  onSome: (session) =>
                    runs
                      .send(current.run, new RejectRun({ session, reason, provenance: extend(current.provenance, hop) }), options)
                      .pipe(Effect.as(current)),
                }),
              ),
            Reserve: ({ reservation, units }) => send(runs.send(current.run, new ReserveBudget({ reservation, units }), options)),
            Settle: ({ reservation, units }) => send(runs.send(current.run, new SettleUsage({ reservation, units }), options)),
            Release: ({ reservation }) => send(runs.send(current.run, new ReleaseReservation({ reservation }), options)),
            Step: ({ step }) => send(runs.send(current.run, new RecordStep({ step }), options)),
            AwaitApproval: () => send(runs.send(current.run, new AwaitApproval(), options)),
            Complete: ({ outcome }) => send(runs.send(current.run, new CompleteRun({ outcome }), options)),
            Exhausted: () => send(runs.send(current.run, new ExhaustRun(), options)),
          });
        }),
    };
  }),
).pipe(Layer.provide(Digest.layerWebCrypto));
