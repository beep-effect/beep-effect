/**
 * Positive native metadata projection into deterministic OTLP protobuf.
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
import { DeliveryAttempt } from "./delivery-ledger.ts";
import {
  encodeObservationTraceWire,
  otlpBooleanAttribute as flag,
  hashObservationPayload,
  otlpIntegerAttribute as integer,
  otlpStringAttribute as text,
} from "./internal/native-trace-wire.ts";
import { NativeTraceMetadata } from "./native-trace.ts";

const $I = $RepoAiMetricsId.create("native-export");
/**
 * Owned export context and canonical sanitized spans.
 * **Example** (Inspecting the projection input)
 * ```ts
 * import { NativeExportInput } from "@beep/repo-ai-metrics/native-export"
 * console.log(typeof NativeExportInput.make)
 * ```
 * **Details** acceptedAtMillis is the durable intake time and supplies a stable point timestamp only when source endpoints are absent. It is not a measured duration. Unknown models/providers and incomplete usage remain unknown. Only the declared Phoenix project, approved model names and enabled finite synthetic fixture labels are plaintext labels. Fixture labels are not real application instrumentation.
 * @category models
 * @since 0.0.0
 */
export class NativeExportInput extends S.Opaque<NativeExportInput, { readonly brand: unique symbol }>()(
  S.Struct({
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    project: S.String.check(S.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}$/)),
    evidenceEpoch: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    acceptedAtMillis: S.Int.check(S.isBetween({ minimum: 1, maximum: 18446744073709 })),
    spans: S.Array(NativeTraceMetadata).check(
      S.isMinLength(1),
      S.isMaxLength(512),
      S.makeFilter((spans) => A.dedupe(A.map(spans, (span) => span.eventId)).length === spans.length, {
        identifier: "UniqueNativeExportEvents",
        message: "Export events must be unique",
      })
    ),
  }).pipe(
    $I.annoteSchema("NativeExportInput", { description: "Bounded canonical metadata and stable timing context." })
  )
) {}
/**
 * Exact outgoing bytes, digest and logical event population.
 * **Example** (Inspecting the encoded batch)
 * ```ts
 * import { NativeEncodedBatch } from "@beep/repo-ai-metrics/native-export"
 * console.log(typeof NativeEncodedBatch.make)
 * ```
 * **Details** The SHA-256 covers the actual protobuf bytes, not their hexadecimal text. Native trace/span/parent identifiers remain unchanged. Explicit source timestamp strings also retain exact nanoseconds in backends whose standard timestamp columns truncate precision. No raw source attributes, commands, prompts, outputs, exceptions or URLs are encoded.
 * @category models
 * @since 0.0.0
 */
export class NativeEncodedBatch extends S.Opaque<NativeEncodedBatch, { readonly brand: unique symbol }>()(
  S.Struct({
    eventIds: DeliveryAttempt.fields.eventIds,
    payloadDigest: Sha256Hex,
    body: S.Uint8Array.check(
      S.makeFilter((bytes) => bytes.byteLength <= 4_194_304, {
        identifier: "ExportByteCeiling",
        message: "Export exceeds 4 MiB",
      })
    ),
  }).pipe($I.annoteSchema("NativeEncodedBatch", { description: "Bounded deterministic metadata-only OTLP request." }))
) {}
/**
 * Safe projection failure without source content.
 * **Example** (Inspecting a failure)
 * ```ts
 * import { NativeExportError } from "@beep/repo-ai-metrics/native-export"
 * console.log(NativeExportError.make({ reason: "encoding" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class NativeExportError extends S.TaggedError<NativeExportError, { readonly brand: unique symbol }>(
  $I`NativeExportError`
)(
  "NativeExportError",
  { reason: S.Literals(["encoding", "namespace", "digest"]) },
  $I.annote("NativeExportError", { description: "Safe native export projection refusal." })
) {}
const sum = (values: ReadonlyArray<O.Option<number>>) => {
  if (A.some(values, O.isNone)) return O.none<number>();
  const total = A.reduce(A.getSomes(values), 0, (a, b) => a + b);
  return Number.isSafeInteger(total) ? O.some(total) : O.none<number>();
};
const usageAttributes = (span: NativeTraceMetadata) => {
  const u = span.usage;
  const raw = [
    text("ai_metrics.usage.convention", u.convention),
    ...A.flatMap(
      [
        { key: "input", value: u.input },
        { key: "output", value: u.output },
        { key: "cache_read", value: u.cacheRead },
        { key: "cache_write", value: u.cacheWrite },
      ],
      ({ key, value }) => (O.isSome(value) ? [integer(`ai_metrics.usage.${key}`, value.value)] : [])
    ),
  ];
  if (span.kind !== "LLM" || u.convention === "unknown") return [...raw, flag("ai_metrics.usage.normalized", false)];
  const prompt = u.convention === "claude-code" ? sum([u.input, u.cacheRead, u.cacheWrite]) : u.input;
  const invalidDetails =
    u.convention === "openinference" &&
    O.isSome(prompt) &&
    ((O.isSome(u.cacheRead) && O.isSome(u.cacheWrite) && u.cacheRead.value > prompt.value - u.cacheWrite.value) ||
      (O.isSome(u.cacheRead) && u.cacheRead.value > prompt.value) ||
      (O.isSome(u.cacheWrite) && u.cacheWrite.value > prompt.value));
  if (invalidDetails)
    return [...raw, flag("ai_metrics.usage.normalized", false), flag("ai_metrics.usage.invalid", true)];
  const total = sum([prompt, u.output]);
  return [
    ...raw,
    flag("ai_metrics.usage.normalized", true),
    flag("ai_metrics.usage.complete", O.isSome(total)),
    ...O.toArray(O.map(prompt, (value) => integer("llm.token_count.prompt", value))),
    ...O.toArray(O.map(u.output, (value) => integer("llm.token_count.completion", value))),
    ...O.toArray(O.map(total, (value) => integer("llm.token_count.total", value))),
    ...O.toArray(O.map(u.cacheRead, (value) => integer("llm.token_count.prompt_details.cache_read", value))),
    ...O.toArray(O.map(u.cacheWrite, (value) => integer("llm.token_count.prompt_details.cache_write", value))),
  ];
};
/**
 * Encode canonical native metadata, preserving source time and cache accounting.
 * **Example** (Inspecting the encoder)
 * ```ts
 * import { encodeNativeTraceBatch } from "@beep/repo-ai-metrics/native-export"
 * console.log(typeof encodeNativeTraceBatch)
 * ```
 * **Details** Claude prompt count is uncached input plus cache read plus cache write only when all are known. OpenInference prompt input is already inclusive and is not summed again. Standard usage fields are emitted only for LLM spans, preventing agent-level aggregates from being counted as another model call. Unknown/incomplete/overflow values are not fabricated. No provider or dollar cost is inferred. This is encoding proof, not Phoenix ingestion or UI reconciliation.
 * @category encoding
 * @since 0.0.0
 */
export const encodeNativeTraceBatch = Effect.fn("AiMetrics.encodeNativeTraceBatch")(function* (
  input: NativeExportInput
) {
  if (A.some(input.spans, (span) => span.namespaceId !== input.namespaceId))
    return yield* NativeExportError.make({ reason: "namespace" });
  const fallback = `${BigInt(input.acceptedAtMillis) * BigInt(1_000_000)}`;
  const spans = yield* Effect.forEach(input.spans, (span) =>
    Effect.gen(function* () {
      const point = O.getOrElse(
        O.orElse(span.startTimeUnixNano, () => span.endTimeUnixNano),
        () => fallback
      );
      return {
        traceId: yield* Effect.fromResult(Hex.decode(span.traceId)),
        spanId: yield* Effect.fromResult(Hex.decode(span.spanId)),
        parentSpanId: O.isSome(span.parentSpanId)
          ? yield* Effect.fromResult(Hex.decode(span.parentSpanId.value))
          : undefined,
        name: O.isSome(span.fixtureSurface)
          ? `fixture.${span.fixtureSurface.value}.${Str.toLowerCase(span.kind)}`
          : `agent.${Str.toLowerCase(span.kind)}`,
        kind: 1,
        startTimeUnixNano: point,
        endTimeUnixNano: span.durationKnown ? O.getOrElse(span.endTimeUnixNano, () => point) : point,
        status: { code: span.status === "ok" ? 1 : span.status === "error" ? 2 : 0 },
        attributes: [
          text("openinference.span.kind", span.kind),
          text("ai_metrics.event_id", span.eventId),
          text("ai_metrics.route_id", span.routeId),
          text("ai_metrics.stream", "native"),
          ...O.toArray(O.map(span.fixtureSurface, (surface) => text("ai_metrics.fixture.surface", surface))),
          ...(O.isSome(span.fixtureSurface)
            ? [flag("ai_metrics.synthetic", true), text("ai_metrics.fixture.provenance", "declared_synthetic_fixture")]
            : []),
          ...(input.evidenceEpoch > 0
            ? [
                integer("ai_metrics.local_evidence_epoch", input.evidenceEpoch),
                text("ai_metrics.duplicate_detection_scope", "current_epoch"),
                flag("ai_metrics.prior_local_history_retired", true),
              ]
            : []),
          flag("ai_metrics.duration_known", span.durationKnown),
          text(
            "ai_metrics.time_basis",
            O.isSome(span.startTimeUnixNano) || O.isSome(span.endTimeUnixNano) ? "source_event" : "intake_observation"
          ),
          ...O.toArray(O.map(span.startTimeUnixNano, (value) => text("ai_metrics.source_start_time_unix_nano", value))),
          ...O.toArray(O.map(span.endTimeUnixNano, (value) => text("ai_metrics.source_end_time_unix_nano", value))),
          ...O.toArray(O.map(span.nameHash, (value) => text("ai_metrics.source_name_hash", value))),
          ...O.toArray(O.map(span.sessionHash, (value) => text("session.id", value))),
          ...O.toArray(O.map(span.modelHash, (value) => text("ai_metrics.model_hash", value))),
          ...O.toArray(O.map(span.modelName, (value) => text("llm.model_name", value))),
          ...usageAttributes(span),
        ],
      };
    })
  ).pipe(Effect.mapError(() => NativeExportError.make({ reason: "encoding" })));
  const body = yield* encodeObservationTraceWire(
    input.project,
    input.hostId,
    input.namespaceId,
    "native-export/v1",
    spans
  ).pipe(Effect.mapError(() => NativeExportError.make({ reason: "encoding" })));
  const payloadDigest = yield* hashObservationPayload(body).pipe(
    Effect.mapError(() => NativeExportError.make({ reason: "digest" }))
  );
  return yield* S.decodeEffect(NativeEncodedBatch)({
    body,
    payloadDigest,
    eventIds: A.map(input.spans, (span) => span.eventId),
  }).pipe(Effect.mapError(() => NativeExportError.make({ reason: "encoding" })));
});
