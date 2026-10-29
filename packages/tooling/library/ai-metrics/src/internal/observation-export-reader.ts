/**
 * Verified retained-page reading shared by send, scheduling and exact read-back.
 * @packageDocumentation
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import { encodeNativeTraceBatch, NativeExportInput } from "../native-export.ts";
import { makeNativeIntakeJournal } from "../native-intake.ts";
import { NativeTraceMetadata } from "../native-trace.ts";
import { hashPublicTextSha256 } from "../privacy.ts";
import { encodeTranscriptTraceBatch, TranscriptExportInput } from "../transcript-export.ts";
import { TranscriptAcceptance, TranscriptIntakeError } from "../transcript-intake.ts";
import { TranscriptPage } from "../transcript-page.ts";
import { parseSourceEventTime } from "./source-event-time.ts";
import type { TranscriptIntakeConfig } from "../transcript-intake.ts";

const $I = $RepoAiMetricsId.create("internal/observation-export-reader");
const ExportPageSlice = S.Struct({
  offset: S.Int.check(S.isBetween({ minimum: 0, maximum: 4095 })),
  limit: S.Int.check(S.isBetween({ minimum: 1, maximum: 512 })),
}).pipe($I.annoteSchema("ExportPageSlice", { description: "Bounded canonical event selection before page lookup." }));
const isExportPageSlice = S.is(ExportPageSlice);
const AcceptedPage = S.TaggedUnion({
  Native: { receipt: TranscriptAcceptance, spans: S.Array(NativeTraceMetadata) },
  Reconstructed: { receipt: TranscriptAcceptance, page: TranscriptPage },
}).pipe($I.annoteSchema("AcceptedPage", { description: "Verified retained page with explicit stream identity." }));
const Row = S.Struct({
  payload: S.String,
  sourceKey: S.String,
  receiptId: Sha256Hex,
  sequence: S.Natural,
  acceptedAt: S.Natural,
  payloadBytes: S.Natural,
  frames: S.Natural,
  evidenceEpoch: S.Natural,
});
/**
 * Typed internal selection refusal without retained metadata.
 * **Example** (Inspecting a refusal)
 * Internal consumers inspect `reason` before any send reservation.
 * @category errors
 * @since 0.0.0
 */
export class SelectionError extends S.TaggedError<SelectionError, { readonly brand: unique symbol }>(
  $I`SelectionError`
)(
  "ObservationExportSelectionError",
  { reason: S.Literals(["unknown-page", "empty-selection", "invalid-selection"]) },
  $I.annote("SelectionError", { description: "Safe retained-page selection refusal." })
) {}
const failure = () => TranscriptIntakeError.make({ reason: "storage" });
const decodeRowRows = S.decodeUnknownEffect(S.Array(Row));
const decodeTranscriptPageJson = S.decodeEffect(S.fromJsonString(TranscriptPage), { onExcessProperty: "error" });

/**
 * Read only canonical retained pages and reconstruct their deterministic wire bytes.
 * **Example** (Sharing verified pages)
 * Internal sender/scheduler/read-back consumers share this capability.
 * @category internal
 */
export const makeObservationExportReader = Effect.fn("AiMetrics.makeObservationExportReader")(function* (
  intake: TranscriptIntakeConfig
) {
  const sql = yield* SqlClient.SqlClient;
  const native = yield* makeNativeIntakeJournal(intake);
  const readReconstructed = Effect.fnUntraced(function* (row: typeof Row.Type, receiptId: Sha256Hex) {
    if (new TextEncoder().encode(row.payload).byteLength !== row.payloadBytes || row.payloadBytes > 4194304)
      return yield* failure();
    const digest = yield* hashPublicTextSha256(
      row.evidenceEpoch === 0
        ? `transcript-acceptance/v1:${intake.hostId}:${intake.namespaceId}:${row.payload}`
        : `transcript-acceptance/v2:${intake.hostId}:${intake.namespaceId}:${row.evidenceEpoch}:${row.payload}`
    );
    if (digest !== receiptId) return yield* failure();
    const page = yield* decodeTranscriptPageJson(row.payload);
    if (
      page.cursor.namespaceId !== intake.namespaceId ||
      row.sourceKey !== `${page.cursor.source}:${page.cursor.pathHash}` ||
      page.frames.length !== row.frames
    )
      return yield* failure();
    return O.some(AcceptedPage.cases.Reconstructed.make({ receipt: TranscriptAcceptance.make(row), page }));
  });
  const read = Effect.fn("AiMetrics.observationExport.read")(function* (receiptId: Sha256Hex) {
    const rows =
      yield* sql`SELECT substr(payload,1,4194305) AS payload,source_key AS "sourceKey",receipt_id AS "receiptId",sequence,accepted_at AS "acceptedAt",payload_bytes AS "payloadBytes",frames,evidence_epoch AS "evidenceEpoch" FROM observation_intake_pages WHERE receipt_id=${receiptId}`.pipe(
        Effect.flatMap(decodeRowRows)
      );
    const row = rows[0];
    if (row === undefined) return O.none<typeof AcceptedPage.Type>();
    if (Str.startsWith("native:")(row.sourceKey)) {
      const receipt = yield* native.receipt(receiptId);
      const spans = yield* native.readNewEvents(receiptId);
      if (O.isNone(receipt) || O.isNone(spans)) return yield* failure();
      return O.some(AcceptedPage.cases.Native.make({ receipt: receipt.value.page, spans: spans.value }));
    }
    return yield* readReconstructed(row, receiptId);
  }, Effect.mapError(failure));
  const eventIds = (page: typeof AcceptedPage.Type) =>
    page._tag === "Native"
      ? A.map(page.spans, (s) => s.eventId)
      : A.map(
          A.filter(page.page.frames, (f) => f._tag === "Accepted"),
          (f) => f.occurrenceId
        );
  const prepare = Effect.fn("AiMetrics.observationExport.prepare")(function* (
    receiptId: Sha256Hex,
    offset: number,
    limit: number,
    project: NativeExportInput["project"]
  ) {
    if (!isExportPageSlice({ offset, limit })) return yield* SelectionError.make({ reason: "invalid-selection" });
    const selected = yield* read(receiptId);
    if (O.isNone(selected)) return yield* SelectionError.make({ reason: "unknown-page" });
    const page = selected.value;
    if (offset >= eventIds(page).length) return yield* SelectionError.make({ reason: "empty-selection" });
    const context = {
      hostId: intake.hostId,
      namespaceId: intake.namespaceId,
      project,
      evidenceEpoch: page.receipt.evidenceEpoch,
      acceptedAtMillis: page.receipt.acceptedAt,
    };
    if (page._tag === "Native")
      return yield* encodeNativeTraceBatch(
        NativeExportInput.make({ ...context, spans: A.take(A.drop(page.spans, offset), limit) })
      );
    return yield* encodeTranscriptTraceBatch(
      TranscriptExportInput.make({
        ...context,
        cursor: page.page.cursor,
        frames: A.take(
          A.drop(
            A.filter(page.page.frames, (f) => f._tag === "Accepted"),
            offset
          ),
          limit
        ),
      })
    );
  });
  const sourceTimeMillis = (page: typeof AcceptedPage.Type, index: number): O.Option<number> =>
    page._tag === "Native"
      ? O.fromUndefinedOr(page.spans[index]).pipe(
          O.flatMap((span) => span.startTimeUnixNano.pipe(O.orElse(() => span.endTimeUnixNano))),
          O.map((nano) => Number(BigInt(nano) / BigInt(1_000_000)))
        )
      : O.fromUndefinedOr(A.filter(page.page.frames, (frame) => frame._tag === "Accepted")[index]).pipe(
          O.flatMap((frame) => frame.metadata.sourceTime),
          O.flatMap(parseSourceEventTime),
          O.map((time) => time.seconds * 1000 + Math.floor(time.nanoseconds / 1_000_000))
        );
  return { read, eventIds, prepare, sourceTimeMillis };
});
