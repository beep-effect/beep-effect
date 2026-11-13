import { GrantTerms } from "@proto/kernel/Capability";
import { RunId } from "@proto/kernel/Ids";
import { GrantRef, Hop, Provenance } from "@proto/kernel/Invocation";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ReservationId } from "./Run/Reservation.id.ts";
import { RunVersions } from "./Run/RunVersions.ts";
import { SessionId } from "./Run/Session.id.ts";

/**
 * What a product context reports to a run, as the run: budget, steps and
 * how it ended.
 *
 * @category models
 * @since 0.0.0
 */
export const RunReport = S.TaggedUnion({
  Reserve: { reservation: ReservationId, units: S.Int },
  Settle: { reservation: ReservationId, units: S.Int },
  Release: { reservation: ReservationId },
  Step: { step: S.String },
  AwaitApproval: {},
  Complete: { outcome: S.String },
  Exhausted: {},
  Refused: { reason: S.String },
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
  purpose: S.String,
  versions: RunVersions,
  allowance: S.Int,
  historyBound: S.Int,
  source: GrantRef,
  terms: GrantTerms,
});
/**
 * @category models
 * @since 0.0.0
 */
export type RunRequest = typeof RunRequest.Type;

/**
 * The run could not be started, and why.
 *
 * @category errors
 * @since 0.0.0
 */
export class RunRequestRefused extends S.TaggedError<RunRequestRefused>()("RunRequestRefused", {
  reason: S.String,
}) {}

/**
 * A report was refused, and why. `remaining` is set when the budget refused it.
 *
 * @category errors
 * @since 0.0.0
 */
export class RunReportRefused extends S.TaggedError<RunReportRefused>()("RunReportRefused", {
  reason: S.String,
  remaining: S.NullOr(S.Int),
}) {}

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
    /** Report to the run, re-admitted as the run for this hop. */
    readonly report: (report: {
      readonly provenance: Provenance;
      readonly hop: Hop;
      readonly run: RunId;
      readonly report: RunReport;
    }) => Effect.Effect<void, RunReportRefused>;
  }
>()("Runs/Gateway") {}
