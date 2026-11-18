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
  EndedStatus,
  RunEnded,
  RunBudgetExceeded,
  RunReportRefused,
  RunRequestRefused,
  RunsGateway,
} from "@proto/runs-contract/Runs.gateway";
import { AgentRun, recordOf, requestOf, sessionOf } from "@proto/runs-model/Run/AgentRun.aggregate";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
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
 * Every send carries a command id derived from the org, the operation and
 * the request (`requestKey`, D36), so a retried report is the same command.
 * A report to a run that has ended fails with `RunEnded`.
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
      Effect.provideServiceEffect(send, CurrentInvocation, authority.readmit({ provenance, hop }));

    const isEnded = S.is(EndedStatus);
    const refusal = (cause: {
      readonly _tag: string;
      readonly reason?: unknown;
      readonly remaining?: unknown;
      readonly status?: unknown;
    }): RunReportRefused | RunBudgetExceeded | RunEnded =>
      cause._tag === "RunNotRunning" && isEnded(cause.status)
        ? RunEnded.make({ status: cause.status })
        : cause._tag === "BudgetExceeded" && P.isNumber(cause.remaining)
          ? RunBudgetExceeded.make({ remaining: cause.remaining })
          : RunReportRefused.make({
              reason: cause._tag === "ReadmissionRefused" ? `readmission:${String(cause.reason)}` : cause._tag,
            });

    /**
     * The live run of the caller's lineage, with the provenance it acts under
     * now, and the org its grant is scoped to: the tenant of its command ids (D36).
     */
    const follow = (
      current: CurrentRun,
    ): Effect.Effect<{ readonly current: CurrentRun; readonly org: string }, RunReportRefused> =>
      Effect.flatMap(liveRun(runs, current.run), (live) => {
        const org = O.getOrElse(
          O.map(requestOf(live.state), (run): string => run.terms.resource.org),
          () => "unscoped",
        );
        return live.run === current.run
          ? Effect.succeed({ current, org })
          : O.match(
              O.map(recordOf(live.state), (run) => run.provenance),
              {
                onNone: () => Effect.fail(RunReportRefused.make({ reason: `continuation:${live.state._tag}` })),
                onSome: (provenance) => Effect.succeed({ current: { run: live.run, provenance }, org }),
              },
            );
      });

    type Gateway = RunsGateway["Service"];
    return {
      request: Effect.fn("RunsGateway.request")((request: Parameters<Gateway["request"]>[0]) =>
        commandIdOf({
          tenant: request.terms.resource.org,
          operation: "RequestRun",
          payload: { run: request.run, session: request.session, hop: request.hop },
        }).pipe(
          Effect.flatMap((options) =>
            readmitted(
              request.provenance,
              request.hop,
              runs.send(
                request.run,
                RequestRun.make({
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
          Effect.mapError((refused) => RunRequestRefused.make({ reason: refused._tag })),
          Effect.andThen(
            runs.get(request.run).pipe(
              Effect.repeat({ ...settling, until: (state) => state._tag !== "Requested" && state._tag !== "Unrequested" }),
            ),
          ),
          Effect.flatMap((state) =>
            state._tag === "Running"
              ? Effect.succeed({ provenance: state.run.provenance })
              : Effect.fail(RunRequestRefused.make({ reason: state._tag === "Rejected" ? state.reason : state._tag })),
          ),
        ),
      ),

      report: Effect.fn("RunsGateway.report")(function* ({ provenance, hop, run, report }: Parameters<Gateway["report"]>[0]) {
          const { current, org } = yield* follow({ run, provenance });
          const options = yield* commandIdOf({
            tenant: org,
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
                  onNone: () => Effect.fail(RunReportRefused.make({ reason: "unknown-run" })),
                  onSome: (session) =>
                    runs
                      .send(current.run, RejectRun.make({ session, reason, provenance: extend(current.provenance, hop) }), options)
                      .pipe(Effect.as(current)),
                }),
              ),
            Reserve: ({ reservation, units }) => send(runs.send(current.run, ReserveBudget.make({ reservation, units }), options)),
            Settle: ({ reservation, units }) => send(runs.send(current.run, SettleUsage.make({ reservation, units }), options)),
            Release: ({ reservation }) => send(runs.send(current.run, ReleaseReservation.make({ reservation }), options)),
            Step: ({ step }) => send(runs.send(current.run, RecordStep.make({ step }), options)),
            AwaitApproval: () => send(runs.send(current.run, AwaitApproval.make({}), options)),
            Complete: ({ outcome }) => send(runs.send(current.run, CompleteRun.make({ outcome }), options)),
            Exhausted: () => send(runs.send(current.run, ExhaustRun.make({}), options)),
          });
      }),
    };
  }),
).pipe(Layer.provide(Digest.layerWebCrypto));
