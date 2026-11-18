import type { Hop, Provenance } from "@proto/kernel/Invocation";
import type { RunId } from "@proto/kernel/Ids";
import { BudgetRefused, ReviewRuns, RunEnded, RunEndedStatus, RunRefused } from "@proto/party-model/Review/ReviewRuns.external";
import { ReservationId } from "@proto/runs-contract/Run/Reservation.id";
import { SessionId } from "@proto/runs-contract/Run/Session.id";
import { RunReport, RunReportRefusal, RunsGateway } from "@proto/runs-contract/Runs.gateway";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const isEndedStatus = S.is(RunEndedStatus);

/**
 * A run that ended is Party's `RunEnded`; any other refusal, a budget one
 * outside a reservation included, is `RunRefused`. The runs contract types
 * an ended run's status as any run status; one that is not an ended status
 * is no ended run, so it is `RunRefused`, with the status as its reason.
 */
const refusedAs: (refused: RunReportRefusal) => RunRefused | RunEnded = RunReportRefusal.match({
  RunEnded: ({ status }) => (isEndedStatus(status) ? RunEnded.make({ status }) : RunRefused.make({ reason: status })),
  RunBudgetExceeded: () => RunRefused.make({ reason: "budget" }),
  RunReportRefused: ({ reason }) => RunRefused.make({ reason }),
});

/**
 * Party's review-run port over the runs context's gateway: Party's words
 * (open, reserve, settle, ...) translated to the runs contract's request and
 * reports. A budget refusal comes back as Party's `BudgetRefused`, and a
 * report to a run that has ended as `RunEnded`.
 *
 * @category adapters
 * @since 0.0.0
 */
export const PartyReviewRuns = ReviewRuns.toLayer(
  Effect.map(Effect.service(RunsGateway), (gateway) => {
    const report = (
      call: { readonly provenance: Provenance; readonly hop: Hop; readonly run: RunId },
      what: RunReport,
    ) =>
      gateway
        .report({ provenance: call.provenance, hop: call.hop, run: call.run, report: what })
        .pipe(Effect.mapError(refusedAs));
    return {
      open: ({ session, ...request }) =>
        gateway
          .request({ ...request, session: SessionId.make(session) })
          .pipe(Effect.mapError((refused) => RunRefused.make({ reason: refused.reason }))),
      reserve: ({ reservation, units, ...call }) =>
        gateway
          .report({
            ...call,
            report: RunReport.cases.Reserve.make({ reservation: ReservationId.make(reservation), units }),
          })
          .pipe(
            Effect.mapError(
              RunReportRefusal.matchOrElse({ RunBudgetExceeded: ({ remaining }) => BudgetRefused.make({ remaining }) }, refusedAs),
            ),
          ),
      settle: ({ reservation, units, ...call }) =>
        report(call, RunReport.cases.Settle.make({ reservation: ReservationId.make(reservation), units })),
      release: ({ reservation, ...call }) =>
        report(call, RunReport.cases.Release.make({ reservation: ReservationId.make(reservation) })),
      step: ({ step, ...call }) => report(call, RunReport.cases.Step.make({ step })),
      awaitApproval: (call) => report(call, RunReport.cases.AwaitApproval.make({})),
      exhaust: (call) => report(call, RunReport.cases.Exhausted.make({})),
      refuse: ({ reason, ...call }) => report(call, RunReport.cases.Refused.make({ reason })),
    };
  }),
);
