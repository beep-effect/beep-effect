/**
 * The record file a gate writes beside its raw log: one versioned envelope
 * around one report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { GateReport } from "./GateReport.ts";
import { IsoInstant } from "./Scalars.ts";

const $I = $GateReportId.create("GateRecord");

/**
 * **Details**
 *
 * Replaces upstream `RunReportFile` (`schemaVersion: 1`, many reports): a
 * record holds exactly one report, and its version names the format. A
 * restored record keeps its report's run id, so a replay is recognizable.
 *
 * **Example** (Build a record)
 *
 * ```ts
 * import { GateRecord } from "@beep/gate-report/GateRecord";
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import * as DateTime from "effect/DateTime";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "errored", outcome: "some-fail", units: [], items: [], totals: Totals.make({}),
 * });
 * console.log(GateRecord.make({ generatedAt: DateTime.makeUnsafe(0), report }).version); // gate-report/v1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GateRecord extends S.Opaque<GateRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("gate-report/v1"),
    generatedAt: IsoInstant,
    report: GateReport,
  }).pipe(
    $I.annoteSchema("GateRecord", {
      description: "The record file of one gate run: the gate-report/v1 envelope around its report.",
    })
  )
) {}

/**
 * **Example** (Encode a record to JSON text)
 *
 * ```ts
 * import { GateRecord, GateRecordFromJson } from "@beep/gate-report/GateRecord";
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import * as DateTime from "effect/DateTime";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "errored", outcome: "some-fail", units: [], items: [], totals: Totals.make({}),
 * });
 * const program = S.encodeEffect(GateRecordFromJson)(GateRecord.make({ generatedAt: DateTime.makeUnsafe(0), report }));
 * console.log(Effect.isEffect(program)); // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const GateRecordFromJson = S.fromJsonString(GateRecord).pipe(
  $I.annoteSchema("GateRecordFromJson", {
    description: "The gate-report/v1 record file as JSON text.",
  })
);
