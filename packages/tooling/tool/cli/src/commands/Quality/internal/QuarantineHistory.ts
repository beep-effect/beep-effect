/**
 * Flake-quarantine incidents in gate run history. A quarantined no-location
 * TS2589 failure whose standalone rerun passed is one input with two
 * outcomes, the one flaky rule, so each incident is recorded as the check
 * item `(package, TS2589, no location)` failing and then passing on one
 * input fingerprint. History labels it `flaky`; the quarantine stays the
 * authority on the lane's verdict and nothing here changes it.
 *
 * @since 0.0.0
 */
import { GateReport, Totals, Unit } from "@beep/gate-report/GateReport";
import { Item } from "@beep/gate-report/Item";
import { ItemKey } from "@beep/gate-report/ItemKey";
import { HistoryScope } from "@beep/repo-gate-run/GateHistoryRecord";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import {
  GateHistoryTarget,
  HistorySetting,
  historyStoreLayer,
  ingestAfterConsole,
  resolveHistoryTarget,
} from "../../Gate/GateHistoryRuntime.ts";
import type { FlakeQuarantineIncident } from "./FlakeQuarantine.ts";

/**
 * The shape the check item of a quarantined TS2589 carries in place of a
 * message.
 *
 * **Example** (Read the shape)
 *
 * ```ts
 * import { QUARANTINE_ITEM_SHAPE } from "@beep/repo-cli/test/Quality"
 *
 * console.log(QUARANTINE_ITEM_SHAPE) // no location
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const QUARANTINE_ITEM_SHAPE = "no location";

/**
 * The check item a quarantine incident is about: the package, TS2589, and
 * no location.
 *
 * **Example** (Key an incident)
 *
 * ```ts
 * import { quarantineItemKey } from "@beep/repo-cli/test/Quality"
 * import { FlakeQuarantineIncident } from "@beep/repo-cli/test/Quality"
 *
 * const incident = FlakeQuarantineIncident.make({
 *   policy: "ts2589-no-location",
 *   laneLabel: "quality:build",
 *   taskId: "@beep/box#build",
 *   packageName: "@beep/box",
 *   task: "build",
 *   standaloneCommand: "bun run build -- --filter=@beep/box",
 *   detectedAt: "2026-08-01T00:00:00.000Z",
 *   standaloneDurationMs: 42000,
 *   laneRerunDurationMs: 31000,
 * })

 * console.log(quarantineItemKey(incident).code) // TS2589
 * ```
 *
 * @param incident - a quarantined no-location TS2589 failure
 * @returns the diagnostic key of the package's TS2589 with no location
 * @category constructors
 * @since 0.0.0
 */
export const quarantineItemKey = (incident: FlakeQuarantineIncident) =>
  ItemKey.cases.DiagnosticKey.make({ file: incident.packageName, code: "TS2589", shape: QUARANTINE_ITEM_SHAPE });

const detectedAt = (incident: FlakeQuarantineIncident): DateTime.Utc =>
  pipe(
    DateTime.make(incident.detectedAt),
    O.map(DateTime.toUtc),
    O.getOrElse(() => DateTime.makeUnsafe(0))
  );

/**
 * One incident as a check report: the item failed and then passed on one
 * input fingerprint, the incident's own.
 *
 * **Example** (Report an incident)
 *
 * ```ts
 * import { quarantineHistoryReport } from "@beep/repo-cli/test/Quality"
 * import { FlakeQuarantineIncident } from "@beep/repo-cli/test/Quality"
 *
 * const incident = FlakeQuarantineIncident.make({
 *   policy: "ts2589-no-location",
 *   laneLabel: "quality:build",
 *   taskId: "@beep/box#build",
 *   packageName: "@beep/box",
 *   task: "build",
 *   standaloneCommand: "bun run build -- --filter=@beep/box",
 *   detectedAt: "2026-08-01T00:00:00.000Z",
 *   standaloneDurationMs: 42000,
 *   laneRerunDurationMs: 31000,
 * })

 * console.log(quarantineHistoryReport(incident).items[0]?.outcome) // passed
 * ```
 *
 * @param incident - a quarantined no-location TS2589 failure
 * @returns a passed check report whose one item failed, then passed, on one input
 * @category constructors
 * @since 0.0.0
 */
export const quarantineHistoryReport = (incident: FlakeQuarantineIncident): GateReport => {
  const runId = `quarantine-${incident.laneLabel}-${incident.taskId}-${incident.detectedAt}`;
  return GateReport.make({
    gate: "check",
    subject: incident.packageName,
    itemKind: "diagnostic",
    runId,
    startedAt: detectedAt(incident),
    durationMs: incident.standaloneDurationMs,
    inputFingerprint: runId,
    reason: "passed",
    outcome: "all-pass",
    units: [Unit.make({ id: incident.packageName, kind: "package" })],
    items: [
      Item.make({
        key: quarantineItemKey(incident),
        unit: incident.packageName,
        path: [],
        name: "TS2589 with no location",
        outcome: "passed",
        attempts: O.some(["failed", "passed"]),
        code: O.some("TS2589"),
      }),
    ],
    totals: Totals.make({ collected: 1, passed: 1 }),
  });
};

/**
 * Record a lane's quarantine incidents in history. It never fails and
 * returns nothing, so the lane's verdict is the quarantine's alone; a store
 * that cannot be written prints one line on standard error per incident.
 *
 * **Example** (Record no incidents)
 *
 * ```ts
 * import { recordQuarantineHistory } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(recordQuarantineHistory("/repo", []))) // true
 * ```
 *
 * @param repoRoot - the checkout the lane ran in
 * @param incidents - the incidents the lane quarantined
 * @param setting - the history setting, resolved automatically by default
 * @returns an effect that records every incident and never fails
 * @category use-cases
 * @since 0.0.0
 */
export const recordQuarantineHistory = Effect.fn("QualityTasks.recordQuarantineHistory")(function* (
  repoRoot: string,
  incidents: ReadonlyArray<FlakeQuarantineIncident>,
  setting: HistorySetting = HistorySetting.cases.HistoryAuto.make({})
) {
  if (A.isReadonlyArrayEmpty(incidents)) return;
  const target = yield* resolveHistoryTarget(repoRoot, setting);
  if (O.isNone(target)) return;
  // An incident reports one item of its package's check, never the whole of it.
  const scope = HistoryScope.make({ ...target.value.scope, partial: true });
  const ingest = ingestAfterConsole(GateHistoryTarget.make({ ...target.value, scope }));
  const context = yield* Layer.build(historyStoreLayer(target.value));
  yield* Effect.forEach(
    incidents,
    (incident) => Effect.provideContext(ingest(quarantineHistoryReport(incident)), context),
    {
      concurrency: 1,
      discard: true,
    }
  );
}, Effect.scoped);
