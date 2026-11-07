/**
 * Known-ID read models for process outcomes and separately attributed quota reports.
 * No backend stream, model call, billing estimate or population inference.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { makeObservationAvailability, ObservationAvailabilityReceipt } from "./observation-availability.ts";
import { makeObservationLaunchFacts, ObservationLaunchIdentity } from "./observation-launch-facts.ts";
import type { TranscriptIntakeConfig } from "./transcript-intake.ts";

const $I = $RepoAiMetricsId.create("observation-outcomes");
/**
 * One observed launch, with declaration and actual process evidence kept separate.
 * **Example** (Inspect the launch outcome constructor)
 * ```ts
 * import { ObservationLaunchOutcome } from "@beep/repo-ai-metrics/observation-outcomes"
 * console.log(typeof ObservationLaunchOutcome.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ObservationLaunchOutcome extends S.Opaque<ObservationLaunchOutcome, { readonly brand: unique symbol }>()(
  S.Struct({
    launchId: Sha256Hex,
    evidenceEpoch: S.Natural,
    declaredIdentity: ObservationLaunchIdentity,
    transport: S.tag("managed-launch"),
    processInstanceId: S.OptionFromNullOr(Sha256Hex),
    sourceSessionId: S.OptionFromNullOr(Sha256Hex),
    nativeRuntime: S.tag("unknown"),
    model: S.tag("unknown"),
    cause: S.tag("unknown"),
    population: S.tag("unknown"),
    timeBasis: S.tag("intake-observation"),
    preparedObservedAt: S.Natural,
    terminalObservedAt: S.OptionFromNullOr(S.Natural),
    outcome: S.Literals(["pending", "succeeded", "failed", "cancelled", "unknown"]),
  }).pipe(
    $I.annoteSchema("ObservationLaunchOutcome", {
      description: "Process result, never task quality, model activity or quota diagnosis.",
    })
  )
) {}
const exhausted = (value: O.Option<{ readonly usedPercent: number }>) => O.exists(value, (w) => w.usedPercent === 100);
const availability = (receipt: ObservationAvailabilityReceipt) => {
  const report = receipt.snapshot.report;
  if (report._tag !== "Reported") return "unknown";
  if (exhausted(report.weekly)) return "weekly-exhausted";
  return exhausted(report.session) ? "session-capped" : "unknown";
};
/**
 * Display label for a historical quota report; current availability is always Unknown.
 * **Example** (Inspect the historical availability view)
 * ```ts
 * import { ObservationAvailabilityView } from "@beep/repo-ai-metrics/observation-outcomes"
 * console.log(typeof ObservationAvailabilityView.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ObservationAvailabilityView extends S.Opaque<
  ObservationAvailabilityView,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    receipt: ObservationAvailabilityReceipt,
    reportedAvailability: S.Literals(["weekly-exhausted", "session-capped", "unknown"]),
    currentAvailability: S.tag("unknown"),
    invocationBinding: S.tag("unknown"),
  })
    .check(
      S.makeFilter((view) => view.reportedAvailability === availability(view.receipt), {
        identifier: "ObservationAvailabilityViewConsistency",
        message: "Reported availability must match the historical receipt, with weekly exhaustion taking precedence",
      })
    )
    .pipe(
      $I.annoteSchema("ObservationAvailabilityView", {
        description: "No causal or account join to a model attempt; absence of windows never means ready.",
      })
    )
) {}
/**
 * Render one historical status receipt without claiming freshness, native authority or launch causation.
 * **Example** (Inspect the historical availability renderer)
 * ```ts
 * import { renderObservationAvailability } from "@beep/repo-ai-metrics/observation-outcomes"
 * console.log(typeof renderObservationAvailability)
 * ```
 * @param receipt - The original durable snapshot acknowledgment.
 * @returns Historical source availability with current availability and invocation binding explicitly unknown.
 * @category mapping
 * @since 0.0.0
 */
export const renderObservationAvailability = (receipt: ObservationAvailabilityReceipt) =>
  ObservationAvailabilityView.make({
    receipt,
    reportedAvailability: availability(receipt),
  });
/**
 * Read independently by explicit ID and evidence epoch. No enumeration or implicit cross-source join.
 * Underlying launch read validates every envelope, ordering, receipt digest and owner binding.
 * No duration is derived from local observation timestamps.
 * **Example** (Inspect the outcome reader factory)
 * ```ts
 * import { makeObservationOutcomes } from "@beep/repo-ai-metrics/observation-outcomes"
 * console.log(typeof makeObservationOutcomes)
 * ```
 * @category services
 * @since 0.0.0
 */
export const makeObservationOutcomes = Effect.fn("AiMetrics.makeObservationOutcomes")(function* (
  config: TranscriptIntakeConfig
) {
  const launches = yield* makeObservationLaunchFacts(config);
  const quota = yield* makeObservationAvailability(config);
  const sql = yield* SqlClient.SqlClient;
  const readLaunch = Effect.fnUntraced(function* (launchId: Sha256Hex, epoch: number) {
    const receipts = yield* launches.read(launchId, epoch);
    const prepared = A.findFirst(receipts, (r) => r.fact._tag === "Prepared");
    if (O.isNone(prepared) || prepared.value.fact._tag !== "Prepared") return O.none<ObservationLaunchOutcome>();
    const processId = A.findFirstMap(receipts, (r) =>
      r.fact._tag === "Started" ? O.some(r.fact.processInstanceId) : O.none()
    );
    const session = A.findFirstMap(receipts, (r) =>
      r.fact._tag === "SessionBound" ? O.some(r.fact.sourceSessionId) : O.none()
    );
    const terminal = A.findFirstMap(receipts, (r) =>
      r.fact._tag === "Finished" ? O.some({ outcome: r.fact.outcome, recordedAt: r.recordedAt }) : O.none()
    );
    return O.some(
      ObservationLaunchOutcome.make({
        launchId,
        evidenceEpoch: epoch,
        declaredIdentity: prepared.value.fact.identity,
        processInstanceId: processId,
        sourceSessionId: session,
        preparedObservedAt: prepared.value.recordedAt,
        terminalObservedAt: O.map(terminal, (r) => r.recordedAt),
        outcome: O.match(terminal, {
          onNone: () => "pending",
          onSome: (r) => r.outcome,
        }),
      })
    );
  });
  const launch = Effect.fn("AiMetrics.outcomes.launch")((launchId: Sha256Hex, epoch: number) =>
    sql.withTransaction(readLaunch(launchId, epoch))
  );
  const availability = Effect.fn("AiMetrics.outcomes.availability")((snapshotId: Sha256Hex, epoch: number) =>
    quota.read(snapshotId, epoch).pipe(Effect.map(O.map(renderObservationAvailability)))
  );
  return { launch, availability };
});
