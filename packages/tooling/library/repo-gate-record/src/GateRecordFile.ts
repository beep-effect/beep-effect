/**
 * The record file codec over the model's `gate-report/v1` envelope, the
 * errors of writing and reading records, and how a reader tells a replayed
 * record from a fresh one.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GateRecord } from "@beep/gate-report/GateRecord";
import { $RepoGateRecordId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoGateRecordId.create("GateRecordFile");

/**
 * The record file as JSON text, indented two spaces so a reader can open it.
 *
 * **Example** (Encode a record file)
 *
 * ```ts
 * import { GateRecord } from "@beep/gate-report/GateRecord";
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import { GateRecordFile } from "@beep/repo-gate-record/GateRecordFile";
 * import * as DateTime from "effect/DateTime";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "errored", outcome: "some-fail", units: [], items: [], totals: Totals.make({}),
 * });
 * const text = S.encodeEffect(GateRecordFile)(GateRecord.make({ generatedAt: DateTime.makeUnsafe(0), report }));
 * console.log(Effect.isEffect(text)); // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const GateRecordFile = S.fromJsonString(GateRecord, { space: 2 }).pipe(
  $I.annoteSchema("GateRecordFile", {
    description: "The gate-report/v1 record file as indented JSON text.",
  })
);

/**
 * Writing a record or a raw log failed.
 *
 * **Example** (Build the error)
 *
 * ```ts
 * import { GateRecordWriteError } from "@beep/repo-gate-record/GateRecordFile";
 *
 * const error = GateRecordWriteError.make({ path: ".beep/gates/test/r1.json", message: "disk full" });
 * console.log(error._tag); // GateRecordWriteError
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GateRecordWriteError extends S.TaggedError<GateRecordWriteError, { readonly brand: unique symbol }>(
  $I`GateRecordWriteError`
)(
  "GateRecordWriteError",
  {
    path: S.String,
    message: S.String,
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annoteError<GateRecordWriteError>("GateRecordWriteError", {
    description: "Writing a gate record or raw log, or removing an expired run, failed.",
  })
) {}

/**
 * Why a record could not be read: it is missing, the file could not be
 * read, or its text is not a `gate-report/v1` record.
 *
 * **Example** (Match a read failure reason)
 *
 * ```ts
 * import { RecordReadFailure } from "@beep/repo-gate-record/GateRecordFile";
 *
 * console.log(RecordReadFailure.is.missing("missing")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RecordReadFailure = LiteralKit(["missing", "unreadable", "invalid"]).pipe(
  $I.annoteSchema("RecordReadFailure", {
    description: "Why a record could not be read: missing, unreadable or invalid.",
  })
);

/**
 * Type of {@link RecordReadFailure}.
 *
 * @category models
 * @since 0.0.0
 */
export type RecordReadFailure = typeof RecordReadFailure.Type;

/**
 * Reading a record or listing a gate's runs failed.
 *
 * **Example** (Build the error)
 *
 * ```ts
 * import { GateRecordReadError } from "@beep/repo-gate-record/GateRecordFile";
 *
 * const error = GateRecordReadError.make({ path: ".beep/gates/test/r1.json", reason: "missing", message: "no record" });
 * console.log(error.reason); // missing
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GateRecordReadError extends S.TaggedError<GateRecordReadError, { readonly brand: unique symbol }>(
  $I`GateRecordReadError`
)(
  "GateRecordReadError",
  {
    path: S.String,
    reason: RecordReadFailure,
    message: S.String,
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annoteError<GateRecordReadError>("GateRecordReadError", {
    description: "A gate record could not be read: it is missing, unreadable or not a gate-report/v1 record.",
  })
) {}

/**
 * Whether a record was written by the current run or restored from an
 * earlier one, such as a Turbo cache hit.
 *
 * **Example** (Match a provenance)
 *
 * ```ts
 * import { RecordProvenance } from "@beep/repo-gate-record/GateRecordFile";
 *
 * console.log(RecordProvenance.is.replay("replay")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RecordProvenance = LiteralKit(["fresh", "replay"]).pipe(
  $I.annoteSchema("RecordProvenance", {
    description: "Whether a record came from the current run or was restored from an earlier one.",
  })
);

/**
 * Type of {@link RecordProvenance}.
 *
 * @category models
 * @since 0.0.0
 */
export type RecordProvenance = typeof RecordProvenance.Type;

/**
 * Tell a fresh record from a replay: a restored record keeps the run id of
 * the run that wrote it, so it differs from the current run's id.
 *
 * **Example** (Recognize a replay)
 *
 * ```ts
 * import { GateRecord } from "@beep/gate-report/GateRecord";
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import { recordProvenance } from "@beep/repo-gate-record/GateRecordFile";
 * import * as DateTime from "effect/DateTime";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "errored", outcome: "some-fail", units: [], items: [], totals: Totals.make({}),
 * });
 * const record = GateRecord.make({ generatedAt: DateTime.makeUnsafe(0), report });
 * console.log(recordProvenance(record, "r2")); // replay
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const recordProvenance: {
  (record: GateRecord, currentRunId: string): RecordProvenance;
  (currentRunId: string): (record: GateRecord) => RecordProvenance;
} = dual(
  2,
  (record: GateRecord, currentRunId: string): RecordProvenance =>
    record.report.runId === currentRunId ? "fresh" : "replay"
);
