/**
 * Deterministic metadata-only reconstruction of accepted transcript occurrences.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  encodeObservationTraceWire,
  otlpBooleanAttribute as flag,
  hashObservationPayload,
  otlpIntegerAttribute as integer,
  otlpStringAttribute as text,
} from "./internal/native-trace-wire.ts";
import { parseSourceEventTime } from "./internal/source-event-time.ts";
import { NativeEncodedBatch, NativeExportInput } from "./native-export.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import { TranscriptCursor, TranscriptFrame } from "./transcript-page.ts";

const $I = $RepoAiMetricsId.create("transcript-export");
/**
 * Owned context and a bounded slice of accepted physical occurrences.
 *
 * **Details**
 *
 * Session IDs are explicit source evidence. Source format is not a desktop/CLI/provider assertion. Model/cwd remain hashes; unknown repository/task/attempt identities are not invented.
 *
 * **Example** (Inspect the transcript export input constructor)
 *
 * ```ts
 * import { TranscriptExportInput } from "@beep/repo-ai-metrics/transcript-export"
 * console.log(typeof TranscriptExportInput.make)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TranscriptExportInput extends S.Opaque<TranscriptExportInput, { readonly brand: unique symbol }>()(
  S.Struct({
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    project: NativeExportInput.fields.project,
    evidenceEpoch: S.Natural,
    acceptedAtMillis: NativeExportInput.fields.acceptedAtMillis,
    cursor: TranscriptCursor,
    frames: S.Array(TranscriptFrame.cases.Accepted).check(S.isMinLength(1), S.isMaxLength(512)),
  }).pipe(
    $I.annoteSchema("TranscriptExportInput", {
      description: "Explicit owned context for one reconstructed metadata batch.",
    })
  )
) {}
/**
 * Content-free reconstruction failure.
 * **Example** (Inspecting a refusal)
 * ```ts
 * import { TranscriptExportError } from "@beep/repo-ai-metrics/transcript-export"
 * console.log(TranscriptExportError.make({reason:"encoding"}).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class TranscriptExportError extends S.TaggedError<TranscriptExportError, { readonly brand: unique symbol }>(
  $I`TranscriptExportError`
)(
  "TranscriptExportError",
  { reason: S.Literals(["namespace", "identity", "encoding", "digest"]) },
  $I.annote("TranscriptExportError", { description: "Safe reconstruction refusal without source contents." })
) {}
/**
 * Encode reconstructed points separately from native spans without invented costs or durations.
 *
 * **Details**
 *
 * Stable host/namespace/occurrence-derived trace and span IDs prevent collision with native IDs. Each record is a CHAIN observation point with no fabricated parent. Explicit session hashes permit grouping but do not prove completeness. Source timestamps retain nanoseconds; missing time uses durable intake time. Usage remains a non-additive observation with message/last-request/cumulative basis, never standard model-call totals: repeated updates and native/reconstructed overlap are not deduplicated by this projection. No model/provider/cost, duration, task or repository identity is inferred.
 *
 * **Example** (Inspect the transcript-trace batch encoder)
 *
 * ```ts
 * import { encodeTranscriptTraceBatch } from "@beep/repo-ai-metrics/transcript-export"
 * console.log(typeof encodeTranscriptTraceBatch)
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeTranscriptTraceBatch = Effect.fn("AiMetrics.encodeTranscriptTraceBatch")(function* (
  input: TranscriptExportInput
) {
  if (input.cursor.namespaceId !== input.namespaceId) return yield* TranscriptExportError.make({ reason: "namespace" });
  if (A.dedupe(A.map(input.frames, (f) => f.occurrenceId)).length !== input.frames.length)
    return yield* TranscriptExportError.make({ reason: "identity" });
  const sourceId = yield* hashPublicTextSha256(
    `reconstructed-source/v1:${input.hostId}:${input.namespaceId}:${input.cursor.source}:${input.cursor.pathHash}`
  ).pipe(Effect.mapError(() => TranscriptExportError.make({ reason: "digest" })));
  const fallback = `${BigInt(input.acceptedAtMillis) * BigInt(1000000)}`;
  const spans = yield* Effect.forEach(
    input.frames,
    Effect.fnUntraced(function* (frame) {
      const trace = Str.slice(
        0,
        32
      )(
        yield* hashPublicTextSha256(`reconstructed-trace/v1:${input.hostId}:${input.namespaceId}:${frame.occurrenceId}`)
      );
      const span = Str.slice(
        0,
        16
      )(
        yield* hashPublicTextSha256(`reconstructed-span/v1:${input.hostId}:${input.namespaceId}:${frame.occurrenceId}`)
      );
      if (/^0+$/.test(trace) || /^0+$/.test(span)) return yield* TranscriptExportError.make({ reason: "identity" });
      const m = frame.metadata;
      const time = O.flatMap(m.sourceTime, parseSourceEventTime);
      const point = O.match(time, {
        onNone: () => fallback,
        onSome: (t) => `${BigInt(t.seconds) * BigInt(1000000000) + BigInt(t.nanoseconds)}`,
      });
      const usage = O.isSome(m.usage)
        ? [
            text("ai_metrics.usage.basis", m.usage.value.basis),
            ...A.flatMap(
              [
                { key: "input", value: m.usage.value.input },
                { key: "output", value: m.usage.value.output },
                { key: "cache_read", value: m.usage.value.cacheRead },
                { key: "cache_write", value: m.usage.value.cacheWrite },
              ],
              (v) => (O.isSome(v.value) ? [integer(`ai_metrics.usage.${v.key}`, v.value.value)] : [])
            ),
          ]
        : [];
      return {
        traceId: yield* Effect.fromResult(Hex.decode(trace)),
        spanId: yield* Effect.fromResult(Hex.decode(span)),
        name: `observed.${m.kind}`,
        kind: 1,
        startTimeUnixNano: point,
        endTimeUnixNano: point,
        status: { code: 0 },
        attributes: [
          text("openinference.span.kind", "CHAIN"),
          text("ai_metrics.stream", "reconstructed"),
          text("ai_metrics.event_id", frame.occurrenceId),
          text("ai_metrics.source_id", sourceId),
          text("ai_metrics.source_format", input.cursor.source),
          text("ai_metrics.source_generation_id", input.cursor.generationId),
          text("ai_metrics.source_kind", m.kind),
          text("ai_metrics.content_hash", frame.contentHash),
          flag("ai_metrics.duration_known", false),
          text("ai_metrics.time_basis", O.isSome(time) ? "source_event" : "intake_observation"),
          flag("ai_metrics.usage.normalized", false),
          flag("ai_metrics.usage.additive", false),
          flag("ai_metrics.session_conflicted", m.session.conflicted),
          ...(input.evidenceEpoch > 0
            ? [
                integer("ai_metrics.local_evidence_epoch", input.evidenceEpoch),
                text("ai_metrics.duplicate_detection_scope", "current_epoch"),
                flag("ai_metrics.prior_local_history_retired", true),
              ]
            : []),
          ...O.toArray(O.map(time, () => text("ai_metrics.source_start_time_unix_nano", point))),
          ...O.toArray(O.map(m.session.conflicted ? O.none() : m.session.id, (v) => text("session.id", v))),
          ...O.toArray(O.map(m.logicalMessageId, (v) => text("ai_metrics.logical_message_id", v))),
          ...O.toArray(O.map(m.workingDirectoryHash, (v) => text("ai_metrics.source_working_directory_hash", v))),
          ...O.toArray(O.map(m.modelHash, (v) => text("ai_metrics.model_hash", v))),
          ...usage,
        ],
      };
    })
  ).pipe(Effect.mapError(() => TranscriptExportError.make({ reason: "encoding" })));
  const body = yield* encodeObservationTraceWire(
    input.project,
    input.hostId,
    input.namespaceId,
    "transcript-export/v1",
    spans
  ).pipe(Effect.mapError(() => TranscriptExportError.make({ reason: "encoding" })));
  const payloadDigest = yield* hashObservationPayload(body).pipe(
    Effect.mapError(() => TranscriptExportError.make({ reason: "digest" }))
  );
  return yield* S.decodeEffect(NativeEncodedBatch)({
    body,
    payloadDigest,
    eventIds: A.map(input.frames, (f) => f.occurrenceId),
  }).pipe(Effect.mapError(() => TranscriptExportError.make({ reason: "encoding" })));
});
