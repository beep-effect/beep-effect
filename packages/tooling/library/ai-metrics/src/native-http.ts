/**
 * Bounded OTLP/HTTP trace admission into the owned local metadata journal.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Protobuf from "protobufjs";
import {
  observationHttpBodyFailure as bodyFailure,
  readObservationHttpBytes,
} from "./internal/observation-http-body.ts";
import { makeNativeIntakeJournal } from "./native-intake.ts";
import { NativeTraceRequest, projectNativeTraceRequest } from "./native-trace.ts";
import { makeObservationControl, ObservationControlPolicy } from "./observation-control.ts";
import type { ObservationControl } from "./observation-control.ts";
import type { TranscriptIntakeConfig } from "./transcript-intake.ts";

const $I = $RepoAiMetricsId.create("native-http");
const ResponseCounts = S.Struct({
  accepted: S.Natural,
  partial: S.Natural,
  unsupported: S.Natural,
  oversized: S.Natural,
  malformed: S.Natural,
  timedOut: S.Natural,
  capacity: S.Natural,
  storage: S.Natural,
  expired: S.Natural,
  unavailable: S.Natural,
  overloaded: S.Natural,
  controlRefusal: S.Natural,
}).pipe(
  $I.annoteSchema("NativeResponseCounts", { description: "Fixed response decision counters without caller labels." })
);
/**
 * Process-lifetime intake response decisions, including refusals before journaling.
 * **Example** (Inspecting intake health)
 * ```ts
 * import { NativeHttpHealth } from "@beep/repo-ai-metrics/native-http"
 * console.log(typeof NativeHttpHealth.make)
 * ```
 * **Details** Counts reset with the intake instance, saturate at the safe integer
 * ceiling, and count response decisions rather than delivered replies or events.
 * @category models
 * @since 0.0.0
 */
export class NativeHttpHealth extends S.Opaque<NativeHttpHealth, { readonly brand: unique symbol }>()(
  S.Struct({ startedAt: S.Natural, observedAt: S.Natural, counts: ResponseCounts, saturated: S.Boolean }).pipe(
    $I.annoteSchema("NativeHttpHealth", {
      description: "Bounded content-free native intake counters with reset identity.",
    })
  )
) {}
/**
 * Render fixed intake counters without event, session or caller labels.
 * **Example** (Inspecting the metric renderer)
 * ```ts
 * import { renderNativeHttpMetrics } from "@beep/repo-ai-metrics/native-http"
 * console.log(typeof renderNativeHttpMetrics)
 * ```
 * **Details** Start timestamp identifies process-lifetime resets. Saturation is
 * explicit. Collector counters cannot substitute for these pre-journal refusals.
 * @category utilities
 * @since 0.0.0
 */
export const renderNativeHttpMetrics = (health: NativeHttpHealth): string =>
  A.join(
    [
      "# HELP beep_observation_intake_responses_total Process-lifetime response decisions, not delivered replies or events.",
      "# TYPE beep_observation_intake_responses_total counter",
      ...A.map(
        R.toEntries(health.counts),
        ([outcome, count]) => `beep_observation_intake_responses_total{outcome="${outcome}"} ${count}`
      ),
      "# TYPE beep_observation_intake_started_timestamp_seconds gauge",
      `beep_observation_intake_started_timestamp_seconds ${health.startedAt / 1000}`,
      "# TYPE beep_observation_intake_counters_saturated gauge",
      `beep_observation_intake_counters_saturated ${health.saturated ? 1 : 0}`,
      "",
    ],
    "\n"
  );
const byteLimit = 262144;
/**
 * Owned route policy and cooperative body-read deadline.
 *
 * **Example** (Inspecting the policy constructor)
 * ```ts
 * import { NativeHttpPolicy } from "@beep/repo-ai-metrics/native-http"
 * console.log(typeof NativeHttpPolicy.make)
 * ```
 * **Details** The route identity and model allowlist are administrator inputs. Requests cannot override them. The deadline bounds body reading and gzip expansion, not a durable transaction already in progress. The caller must also configure server connection/header limits and hard worker resource limits.
 * @category models
 * @since 0.0.0
 */
export class NativeHttpPolicy extends S.Opaque<NativeHttpPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    routeId: NativeTraceRequest.fields.routeId,
    hashSalt: NativeTraceRequest.fields.hashSalt,
    approvedModels: NativeTraceRequest.fields.approvedModels,
    usageConvention: NativeTraceRequest.fields.usageConvention,
    syntheticFixtureMetadata: NativeTraceRequest.fields.syntheticFixtureMetadata,
    bodyTimeoutMillis: S.Int.check(S.isGreaterThanOrEqualTo(100), S.isLessThanOrEqualTo(10000)),
  }).pipe($I.annoteSchema("NativeHttpPolicy", { description: "Private native route and bounded body deadline." }))
) {}

const boundedBytes = <E, R>(stream: Stream.Stream<Uint8Array, E, R>) => readObservationHttpBytes(stream, byteLimit);
const expandGzip = (compressed: Uint8Array) =>
  boundedBytes(
    Stream.fromReadableStream({
      evaluate: () => new Blob([Uint8Array.from(compressed)]).stream().pipeThrough(new DecompressionStream("gzip")),
      onError: () => bodyFailure("malformed"),
    })
  );
const responseSchema = Protobuf.Root.fromJSON({
  nested: {
    ExportTraceServiceResponse: {
      fields: { partialSuccess: { type: "PartialSuccess", id: 1 } },
    },
    PartialSuccess: {
      fields: { rejectedSpans: { type: "int64", id: 1 }, errorMessage: { type: "string", id: 2 } },
    },
    Status: { fields: { code: { type: "int32", id: 1 }, message: { type: "string", id: 2 } } },
  },
});
const exportResponse = responseSchema.lookupType("ExportTraceServiceResponse");
const statusResponse = responseSchema.lookupType("Status");
const response = (
  contentType: "application/json" | "application/x-protobuf",
  status: number,
  rejected = 0,
  receiptId?: string,
  expired = 0
) => {
  const message =
    status === 410
      ? "Request references expired local acceptance; it cannot be reaccepted"
      : status === 200
        ? expired > 0
          ? `${expired} spans reference expired local records; total rejected: ${rejected}`
          : "Some spans were rejected by local admission"
        : "Local intake refused the request";
  const value =
    status === 200
      ? rejected === 0
        ? {}
        : { partialSuccess: { rejectedSpans: `${rejected}`, errorMessage: message } }
      : { code: status === 503 ? 14 : status === 413 ? 8 : status === 410 ? 9 : 3, message };
  const headers = {
    "cache-control": "no-store",
    connection: "close",
    ...(status === 503 ? { "retry-after": "1" } : {}),
    ...(receiptId === undefined ? {} : { "x-observation-receipt": receiptId }),
  };
  return contentType === "application/json"
    ? HttpServerResponse.json(value, { status, headers })
    : Effect.sync(() =>
        HttpServerResponse.uint8Array((status === 200 ? exportResponse : statusResponse).encode(value).finish(), {
          status,
          headers,
          contentType,
        })
      );
};

/**
 * Create a single-admission HTTP handler backed by the durable native journal.
 *
 * **Example** (Inspecting the factory)
 * ```ts
 * import { makeNativeHttpIntake } from "@beep/repo-ai-metrics/native-http"
 * console.log(typeof makeNativeHttpIntake)
 * ```
 * **Details** POST /v1/traces accepts JSON or protobuf, identity or gzip, with 256 KiB ceilings before and after decompression. One request is admitted at a time; overlapping requests receive retryable 503 without entering a waiting queue. Full/partial 200 responses follow the local commit; duplicates are accepted, identity conflicts rejected. Expired exact replays receive non-retryable 410; expired identities in a fresh batch are counted as partial rejections, preserving admission of new events. Empty requests consume no journal page. A response is hop-local acceptance, never Phoenix visibility. Only this trace route is implemented; metrics and logs are not silently accepted. An injected controller coordinates admission with maintenance; standalone construction creates and resumes its own controller. Paused/closed/busy admission returns retryable 503 without reading the body. The caller owns a private listener, authentication, connection/header limits, storage lifecycle and process isolation.
 * @category services
 * @since 0.0.0
 */
export const makeNativeHttpIntake = Effect.fn("AiMetrics.makeNativeHttpIntake")(function* (
  config: TranscriptIntakeConfig,
  policy: NativeHttpPolicy,
  sharedControl?: ObservationControl
) {
  const journal = yield* makeNativeIntakeJournal(config);
  const startedAt = yield* Clock.currentTimeMillis;
  const counts = yield* Ref.make(
    ResponseCounts.make({
      accepted: 0,
      partial: 0,
      unsupported: 0,
      oversized: 0,
      malformed: 0,
      timedOut: 0,
      capacity: 0,
      storage: 0,
      expired: 0,
      unavailable: 0,
      overloaded: 0,
      controlRefusal: 0,
    })
  );
  const count = (outcome: keyof typeof ResponseCounts.Type) =>
    Ref.update(counts, (current) => ({
      ...current,
      [outcome]: Math.min(Number.MAX_SAFE_INTEGER, current[outcome] + 1),
    }));
  const refused = (
    contentType: "application/json" | "application/x-protobuf",
    status: number,
    outcome: keyof typeof ResponseCounts.Type
  ) => count(outcome).pipe(Effect.andThen(response(contentType, status)));
  const health = Effect.gen(function* () {
    const current = yield* Ref.get(counts);
    return NativeHttpHealth.make({
      startedAt,
      observedAt: yield* Clock.currentTimeMillis,
      counts: current,
      saturated: A.some(R.values(current), (value) => value === Number.MAX_SAFE_INTEGER),
    });
  });
  const control =
    sharedControl ??
    (yield* makeObservationControl(ObservationControlPolicy.make({ maxActive: 1, drainTimeoutMillis: 10000 })));
  if (sharedControl === undefined) yield* control.resume;
  const permit = yield* Semaphore.make(1);
  const handler = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const mediaType = Str.toLowerCase(Str.trim(Str.split(request.headers["content-type"] ?? "", ";")[0] ?? ""));
    const contentType = mediaType === "application/x-protobuf" ? "application/x-protobuf" : "application/json";
    if (request.url !== "/v1/traces") return yield* response(contentType, 404);
    if (request.method !== "POST") return yield* response(contentType, 405);
    if (mediaType !== "application/json" && mediaType !== "application/x-protobuf")
      return yield* refused(contentType, 415, "unsupported");
    const encoding = Str.toLowerCase(Str.trim(request.headers["content-encoding"] ?? "identity"));
    if (encoding !== "identity" && encoding !== "gzip") return yield* refused(contentType, 415, "unsupported");
    const declaredLength = request.headers["content-length"];
    if (declaredLength !== undefined && (!/^[0-9]{1,10}$/.test(declaredLength) || Number(declaredLength) > byteLimit))
      return yield* refused(contentType, 413, "oversized");
    const admitted = yield* permit.withPermitsIfAvailable(1)(
      control
        .run(
          Effect.gen(function* () {
            // The public Web adapter preserves an absent body as null. Some platform
            // request.stream implementations otherwise reject valid empty protobuf.
            const webRequest = yield* HttpServerRequest.toWeb(request).pipe(
              Effect.mapError(() => bodyFailure("malformed"))
            );
            const incoming = O.fromNullishOr(webRequest.body).pipe(
              O.map((body) =>
                Stream.fromReadableStream({ evaluate: () => body, onError: () => bodyFailure("malformed") })
              ),
              O.getOrElse(() => Stream.empty)
            );
            const body = yield* boundedBytes(incoming).pipe(
              Effect.filterOrElse(() => encoding !== "gzip", expandGzip),
              Effect.timeoutOrElse({
                duration: policy.bodyTimeoutMillis,
                orElse: () => Effect.fail(bodyFailure("timed-out")),
              })
            );
            const batch = yield* projectNativeTraceRequest(NativeTraceRequest.make({ ...policy, contentType, body }));
            if (batch.spans.length === 0 && batch.rejections.length === 0)
              return yield* count("accepted").pipe(Effect.andThen(response(contentType, 200)));
            const receipt = yield* journal.acceptBatch(batch);
            yield* count(receipt.rejected > 0 ? "partial" : "accepted");
            return yield* response(
              contentType,
              200,
              receipt.rejected,
              receipt.page.receiptId,
              receipt.expiredIndices.length
            );
          }).pipe(
            Effect.catchTags({
              ObservationHttpBodyError: (error) =>
                refused(
                  contentType,
                  error.reason === "oversize" ? 413 : error.reason === "timed-out" ? 503 : 400,
                  error.reason === "oversize" ? "oversized" : error.reason === "timed-out" ? "timedOut" : "malformed"
                ),
              NativeTraceError: (error) =>
                refused(
                  contentType,
                  error.reason === "hash-failure" || error.reason === "missing-salt" ? 503 : 400,
                  error.reason === "hash-failure" || error.reason === "missing-salt" ? "unavailable" : "malformed"
                ),
              TranscriptIntakeError: (error) =>
                refused(
                  contentType,
                  error.reason === "expired" ? 410 : 503,
                  error.reason === "expired" ? "expired" : error.reason === "capacity" ? "capacity" : "storage"
                ),
            })
          )
        )
        .pipe(Effect.catchTag("ObservationControlError", () => refused(contentType, 503, "controlRefusal")))
    );
    return O.isSome(admitted) ? admitted.value : yield* refused(contentType, 503, "overloaded");
  });
  return { handler, journal, control, health };
});
