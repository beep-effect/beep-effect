/**
 * Match stored Phoenix metadata to the exact original native or reconstructed delivery attempt.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { makePhoenixSpanReader, PhoenixSpanLookup } from "@beep/phoenix";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { DeliveryVisibility, makeDeliveryLedger } from "./delivery-ledger.ts";
import { nativeTraceWire } from "./internal/native-trace-wire.ts";
import { makeObservationExportReader } from "./internal/observation-export-reader.ts";
import { parseSourceEventTime } from "./internal/source-event-time.ts";
import { nativeDeliveryReadbackOrigin, nativeDeliveryTargetId } from "./native-delivery.ts";
import type { PhoenixConfigInput } from "@beep/phoenix";
import type { DeliveryLedgerConfig } from "./delivery-ledger.ts";
import type { NativeDeliveryPolicy, NativeDeliveryRequest } from "./native-delivery.ts";
import type { TranscriptIntakeConfig } from "./transcript-intake.ts";

const $I = $RepoAiMetricsId.create("native-readback");
/**
 * A verified historical backend observation or a non-conclusive query result.
 * **Example** (Inspecting read-back results)
 * ```ts
 * import { NativeReadbackResult } from "@beep/repo-ai-metrics/native-readback"
 * console.log(NativeReadbackResult.cases.Visible)
 * ```
 * **Details** Missing and Mismatch never erase earlier visibility, acceptance or ambiguity. Visible follows the visibility fact commit. No response bodies or unexpected metadata values are retained.
 * @category models
 * @since 0.0.0
 */
export const NativeReadbackResult = S.TaggedUnion({
  Visible: { proof: DeliveryVisibility },
  Missing: { eventId: Sha256Hex },
  Mismatch: { eventId: Sha256Hex },
}).pipe(
  $I.annoteSchema("NativeReadbackResult", { description: "Verified backend observation or inconclusive response." })
);
/**
 * Safe refusal before backend verification can establish visibility.
 * **Example** (Inspecting read-back refusal)
 * ```ts
 * import { NativeReadbackError } from "@beep/repo-ai-metrics/native-readback"
 * console.log(NativeReadbackError.make({ reason: "attempt-mismatch" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class NativeReadbackError extends S.TaggedError<NativeReadbackError, { readonly brand: unique symbol }>(
  $I`NativeReadbackError`
)(
  "NativeReadbackError",
  { reason: S.Literals(["configuration", "unknown-page", "unknown-attempt", "attempt-mismatch", "encoding", "busy"]) },
  $I.annote("NativeReadbackError", { description: "Safe native read-back refusal." })
) {}
const fail = (reason: NativeReadbackError["reason"]) => NativeReadbackError.make({ reason });
const expectedSpan = S.Struct({
  traceId: S.Uint8Array,
  spanId: S.Uint8Array,
  parentSpanId: S.optionalKey(S.Uint8Array),
  name: S.String,
  startTimeUnixNano: S.String,
  endTimeUnixNano: S.String,
  status: S.Struct({ code: S.optionalKey(S.Int) }),
  attributes: S.Array(
    S.Struct({
      key: S.String,
      value: S.Struct({
        stringValue: S.optionalKey(S.String),
        intValue: S.optionalKey(S.String),
        boolValue: S.optionalKey(S.Boolean),
      }),
    })
  ),
});
const wire = S.Struct({
  resourceSpans: S.Array(S.Struct({ scopeSpans: S.Array(S.Struct({ spans: S.Array(expectedSpan) })) })),
});
// Include optional managed keys even when absent in the encoded request, so
// unexpected totals/provider/session metadata cannot pass a subset comparison.
const optionalKeys = [
  "ai_metrics.route_id",
  "ai_metrics.synthetic",
  "ai_metrics.fixture.surface",
  "ai_metrics.fixture.provenance",
  "ai_metrics.usage.convention",
  "ai_metrics.source_id",
  "ai_metrics.source_format",
  "ai_metrics.source_generation_id",
  "ai_metrics.source_kind",
  "ai_metrics.content_hash",
  "ai_metrics.logical_message_id",
  "ai_metrics.source_working_directory_hash",
  "ai_metrics.session_conflicted",
  "ai_metrics.usage.basis",
  "ai_metrics.usage.additive",
  "session.id",
  "llm.model_name",
  "llm.provider",
  "llm.token_count.prompt",
  "llm.token_count.completion",
  "llm.token_count.total",
  "llm.token_count.prompt_details.cache_read",
  "llm.token_count.prompt_details.cache_write",
  "ai_metrics.local_evidence_epoch",
  "ai_metrics.duplicate_detection_scope",
  "ai_metrics.prior_local_history_retired",
  "ai_metrics.model_hash",
  "ai_metrics.source_name_hash",
  "ai_metrics.source_start_time_unix_nano",
  "ai_metrics.source_end_time_unix_nano",
  "ai_metrics.usage.input",
  "ai_metrics.usage.output",
  "ai_metrics.usage.cache_read",
  "ai_metrics.usage.cache_write",
  "ai_metrics.usage.invalid",
  "ai_metrics.usage.complete",
];
const micros = (value: string) =>
  O.map(
    O.filter(parseSourceEventTime(value), (time) => time.nanoseconds % 1000 === 0),
    (time) => BigInt(time.seconds) * BigInt(1_000_000) + BigInt(Math.floor(time.nanoseconds / 1000))
  );
// Phoenix converts integer nanoseconds through floating-point seconds into a
// microsecond datetime. Permit only the adjacent representable floor/ceil bucket;
// exact source nanosecond attributes are still checked independently below.
const microsecondMatches = (stored: O.Option<bigint>, sourceNano: string) =>
  O.isSome(stored) &&
  stored.value * BigInt(1000) > BigInt(sourceNano) - BigInt(1000) &&
  stored.value * BigInt(1000) < BigInt(sourceNano) + BigInt(1000);
/**
 * Reconcile one event against its original encoded request and declared backend.
 * **Example** (Inspecting the reconciler)
 * ```ts
 * import { makeNativeReadback } from "@beep/repo-ai-metrics/native-readback"
 * console.log(typeof makeNativeReadback)
 * ```
 * **Details** Rebuilds the original bounded page slice and validates event population and byte digest against the durable attempt before querying. Exact identity, parent, kind, status, all managed scalar metadata and standard timestamps must be microsecond-aligned and differ from the source by strictly less than one microsecond (rounding or truncation); explicit source timestamps retain nanoseconds. Only then append visibility. Queries do not imply completeness, permanence or absence of loss. The backend origin must match the immutable target, including when export traverses an intermediary collector. One reconciliation runs at a time with no waiting queue.
 * @category services
 * @since 0.0.0
 */
export const makeNativeReadback = Effect.fn("AiMetrics.makeNativeReadback")(function* (
  intake: TranscriptIntakeConfig,
  config: DeliveryLedgerConfig,
  policy: NativeDeliveryPolicy,
  backend: PhoenixConfigInput
) {
  if (
    (yield* nativeDeliveryTargetId(policy)) !== config.targetId ||
    backend.baseUrl !== (yield* nativeDeliveryReadbackOrigin(policy))
  )
    return yield* fail("configuration");
  const reader = yield* makePhoenixSpanReader(backend);
  const pages = yield* makeObservationExportReader(intake);
  const ledger = yield* makeDeliveryLedger(intake, config);
  const permit = yield* Semaphore.make(1);
  const reconcile = Effect.fn("AiMetrics.nativeReadback.reconcile")(function* (
    request: NativeDeliveryRequest,
    eventId: Sha256Hex
  ) {
    const admitted = yield* permit.withPermitsIfAvailable(1)(
      Effect.gen(function* () {
        const attempt = yield* ledger.attempt(request.attemptId);
        if (O.isNone(attempt)) return yield* fail("unknown-attempt");
        const page = yield* pages.read(request.receiptId);
        if (O.isNone(page)) return yield* fail("unknown-page");
        if (request.offset >= pages.eventIds(page.value).length || !A.contains(attempt.value.eventIds, eventId))
          return yield* fail("attempt-mismatch");
        const encoded = yield* pages.prepare(request.receiptId, request.offset, request.limit, policy.project);
        if (
          encoded.payloadDigest !== attempt.value.payloadDigest ||
          encoded.eventIds.length !== attempt.value.eventIds.length ||
          !A.every(encoded.eventIds, (id) => A.contains(attempt.value.eventIds, id))
        )
          return yield* fail("attempt-mismatch");
        const decoded = yield* Effect.try(() =>
          nativeTraceWire.toObject(nativeTraceWire.decode(encoded.body), { longs: String })
        ).pipe(
          Effect.flatMap(S.decodeUnknownEffect(wire)),
          Effect.mapError(() => fail("encoding"))
        );
        const candidates = A.flatMap(decoded.resourceSpans, (resource) =>
          A.flatMap(resource.scopeSpans, (scope) => scope.spans)
        );
        const index = A.findFirstIndex(encoded.eventIds, (id) => id === eventId);
        if (O.isNone(index)) return yield* fail("attempt-mismatch");
        const expected = candidates[index.value];
        if (expected === undefined) return yield* fail("encoding");
        const entries = yield* Effect.forEach(
          A.filter(expected.attributes, (attr) => attr.key !== "openinference.span.kind"),
          ({ key, value }) =>
            Effect.gen(function* () {
              const scalar = yield* S.decodeUnknownEffect(S.Union([S.String, S.Finite, S.Boolean]))(
                value.stringValue ?? (value.intValue !== undefined ? Number(value.intValue) : value.boolValue)
              ).pipe(Effect.mapError(() => fail("encoding")));
              return [key, scalar] satisfies readonly [string, string | number | boolean];
            })
        );
        const attributes = R.fromEntries(entries);
        const lookup = yield* reader.lookup(
          PhoenixSpanLookup.make({
            project: policy.project,
            traceId: Hex.encode(expected.traceId),
            spanId: Hex.encode(expected.spanId),
            attributeKeys: A.dedupe([...R.keys(attributes), ...optionalKeys]),
          })
        );
        if (O.isNone(lookup)) return NativeReadbackResult.cases.Missing.make({ eventId });
        const stored = lookup.value;
        const kind = A.findFirst(expected.attributes, (attr) => attr.key === "openinference.span.kind");
        const start = micros(stored.startTime);
        const end = micros(stored.endTime);
        const orderedTimes =
          O.isSome(start) &&
          O.isSome(end) &&
          end.value >= start.value &&
          (expected.startTimeUnixNano !== expected.endTimeUnixNano || start.value === end.value);
        const metadataMatches =
          R.size(attributes) === R.size(stored.attributes) &&
          R.every(attributes, (value, key) => Equal.equals(value, stored.attributes[key]));
        if (
          stored.name !== expected.name ||
          stored.kind !== (O.isSome(kind) ? kind.value.value.stringValue : undefined) ||
          stored.parentId !==
            (expected.parentSpanId === undefined || expected.parentSpanId.byteLength === 0
              ? null
              : Hex.encode(expected.parentSpanId)) ||
          stored.status !==
            ((expected.status.code ?? 0) === 1 ? "OK" : expected.status.code === 2 ? "ERROR" : "UNSET") ||
          !orderedTimes ||
          !microsecondMatches(start, expected.startTimeUnixNano) ||
          !microsecondMatches(end, expected.endTimeUnixNano) ||
          !metadataMatches
        )
          return NativeReadbackResult.cases.Mismatch.make({ eventId });
        const proof = yield* ledger.recordVisibility(
          DeliveryVisibility.make({
            eventId,
            attemptId: request.attemptId,
            payloadDigest: encoded.payloadDigest,
            observedAt: yield* Clock.currentTimeMillis,
          })
        );
        return NativeReadbackResult.cases.Visible.make({ proof });
      })
    );
    return O.isSome(admitted) ? admitted.value : yield* fail("busy");
  });
  return { reconcile };
});
