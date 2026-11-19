import { GrantTerms } from "@proto/kernel/Capability";
import { RunId } from "@proto/kernel/Ids";
import { GrantRef, Hop, Provenance } from "@proto/kernel/Invocation";
import { $RunsContractId } from "@proto/kernel/Identity";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import { Count, IdText, Text } from "@proto/kernel/Measure";
import { HistoryBound } from "./Run/HistoryBound.ts";
import { ReservationId } from "./Run/Reservation.id.ts";
import { RunStatus } from "./Run/RunStatus.ts";
import { RunVersions } from "./Run/RunVersions.ts";
import { SessionId } from "./Run/Session.id.ts";

const $I = $RunsContractId.create("Runs.gateway");

/**
 * What a product context reports to a run, as the run: budget, steps and
 * how it ended. A step name is an id: two equal steps under one hop are
 * one retried command. An outcome and a refusal's reason are text the
 * product context wrote.
 *
 * @category models
 * @since 0.0.0
 */
export const RunReport = S.TaggedUnion({
  Reserve: { reservation: ReservationId, units: Count },
  Settle: { reservation: ReservationId, units: Count },
  Release: { reservation: ReservationId },
  Step: { step: IdText },
  AwaitApproval: {},
  Complete: { outcome: Text },
  Exhausted: {},
  Refused: { reason: Text },
});
/**
 * @category models
 * @since 0.0.0
 */
export type RunReport = typeof RunReport.Type;

/**
 * What requesting a run asks for, on the requester's provenance.
 *
 * @category models
 * @since 0.0.0
 */
export const RunRequest = S.Struct({
  provenance: Provenance,
  hop: Hop,
  run: RunId,
  session: SessionId,
  purpose: Text,
  versions: RunVersions,
  allowance: Count,
  historyBound: HistoryBound,
  source: GrantRef,
  terms: GrantTerms,
});
/**
 * @category models
 * @since 0.0.0
 */
export type RunRequest = typeof RunRequest.Type;

/**
 * The live run of a lineage and the provenance it acts under.
 *
 * @category models
 * @since 0.0.0
 */
export const CurrentRun = S.Struct({ run: RunId, provenance: Provenance });
/**
 * @category models
 * @since 0.0.0
 */
export type CurrentRun = typeof CurrentRun.Type;

/**
 * The run could not be started, and why: the tag of the rejection that refused
 * the request, the tag of the state it reached instead of running, or the
 * reason the run was rejected with, which can be prose, so it is text.
 *
 * @category errors
 * @since 0.0.0
 */
export class RunRequestRefused extends S.TaggedError<RunRequestRefused, { readonly brand: unique symbol }>()("RunRequestRefused", {
  reason: Text,
}) {}

/**
 * A report was refused, and why: a refusal code, never prose. It is the
 * tag of the run's rejection, `readmission:` and the re-admission's reason,
 * `continuation:` and the state of a continuation that could not be
 * followed, or `unknown-run`.
 *
 * @category errors
 * @since 0.0.0
 */
export class RunReportRefused extends S.TaggedError<RunReportRefused, { readonly brand: unique symbol }>()("RunReportRefused", {
  reason: IdText,
}) {}

/**
 * A reservation was refused because the run's remaining allowance cannot
 * cover it; `remaining` is what is left.
 *
 * @category errors
 * @since 0.0.0
 */
export class RunBudgetExceeded extends S.TaggedError<RunBudgetExceeded, { readonly brand: unique symbol }>()(
  "RunBudgetExceeded",
  { remaining: Count },
) {}

/**
 * The run has ended (completed, cancelled, exhausted or rejected), so it
 * takes no more reports. An executor that meets it stops cleanly: the run
 * was concluded elsewhere, for example by a fact that decided its subject.
 *
 * @category errors
 * @since 0.0.0
 */
export class RunEnded extends S.TaggedError<RunEnded, { readonly brand: unique symbol }>()("RunEnded", { status: RunStatus }) {}

/**
 * Why a report to a run was refused: refused outright, a reservation the
 * remaining allowance cannot cover, or a run that has ended.
 *
 * **Example** (Telling an ended run apart)
 * ```ts
 * import { RunEnded, RunReportRefusal } from "@proto/runs-contract/Runs.gateway";
 *
 * const ended = RunReportRefusal.guards.RunEnded(RunEnded.make({ status: "completed" }));
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const RunReportRefusal = S.Union([RunReportRefused, RunBudgetExceeded, RunEnded]).pipe(
  $I.annoteSchema("RunReportRefusal", { description: "Why a report to a run was refused." }),
  S.toTaggedUnion("_tag"),
);
/**
 * @category errors
 * @since 0.0.0
 */
export type RunReportRefusal = typeof RunReportRefusal.Type;

/**
 * The statuses in which a run has ended.
 *
 * @category models
 * @since 0.0.0
 */
export const EndedStatus = LiteralKit(["completed", "cancelled", "exhausted", "rejected"]);

/**
 * The runs context's synchronous contract for other contexts' hosts: start a
 * run on a requester's provenance, and report to it as the run. A product
 * context declares its own port in its own words and adapts it to this.
 *
 * @category contracts
 * @since 0.0.0
 */
export class RunsGateway extends Context.Service<
  RunsGateway,
  {
    /** Request the run, wait until it is granted and running, and return the provenance it acts under. */
    readonly request: (request: RunRequest) => Effect.Effect<{ readonly provenance: Provenance }, RunRequestRefused>;
    /**
     * Report to the run, re-admitted as the run for this hop. A run that has
     * continued as a new run is followed: the report goes to the live run of
     * its lineage, which is returned so the caller reports to it next.
     */
    readonly report: (report: {
      readonly provenance: Provenance;
      readonly hop: Hop;
      readonly run: RunId;
      readonly report: RunReport;
    }) => Effect.Effect<CurrentRun, RunReportRefusal>;
  }
>()($I`RunsGateway`) {}
