/**
 * Single-attempt native and reconstructed metadata delivery with durable pre-send evidence.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { DeliveryAttempt, DeliveryOutcome, makeDeliveryLedger } from "./delivery-ledger.ts";
import { DeliveryHttpReply, interpretDeliveryHttpReply } from "./delivery-response.ts";
import { makeObservationExportReader } from "./internal/observation-export-reader.ts";
import { NativeExportInput } from "./native-export.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import type { DeliveryLedgerConfig } from "./delivery-ledger.ts";
import type { TranscriptIntakeConfig } from "./transcript-intake.ts";

const $I = $RepoAiMetricsId.create("native-delivery");
/**
 * Explicit private destination and cooperative request deadline.
 * **Example** (Inspecting delivery policy)
 * ```ts
 * import { NativeDeliveryPolicy } from "@beep/repo-ai-metrics/native-delivery"
 * console.log(typeof NativeDeliveryPolicy.make)
 * ```
 * **Details** Only HTTPS or loopback HTTP /v1/traces is accepted, without credentials, query or fragment. The injected HTTP client must have no automatic retries or redirects. This layer sends no credentials and never infers a destination from source metadata.
 * @category models
 * @since 0.0.0
 */
export class NativeDeliveryPolicy extends S.Opaque<NativeDeliveryPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    endpoint: S.Redacted(S.String.check(S.isMaxLength(2048))),
    project: NativeExportInput.fields.project,
    readbackOrigin: S.String.check(S.isMaxLength(2048)).pipe(
      S.RedactedFromValue,
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    timeoutMillis: S.Int.check(S.isBetween({ minimum: 100, maximum: 10000 })),
  }).pipe($I.annoteSchema("NativeDeliveryPolicy", { description: "Owned single-attempt destination and timeout." }))
) {}
/**
 * A bounded canonical page slice and unique network-attempt identity.
 * **Example** (Inspecting a send request)
 * ```ts
 * import { NativeDeliveryRequest } from "@beep/repo-ai-metrics/native-delivery"
 * console.log(typeof NativeDeliveryRequest.make)
 * ```
 * **Details** Offsets address canonical new events, excluding native duplicate/conflict occurrences and rejected transcript frames. Each retry uses a new attempt ID. The original receipt and intake timestamp determine bytes across restarts.
 * @category models
 * @since 0.0.0
 */
export class NativeDeliveryRequest extends S.Opaque<NativeDeliveryRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    receiptId: Sha256Hex,
    attemptId: Sha256Hex,
    offset: S.Int.check(S.isBetween({ minimum: 0, maximum: 4095 })),
    limit: S.Int.check(S.isBetween({ minimum: 1, maximum: 512 })),
  }).pipe($I.annoteSchema("NativeDeliveryRequest", { description: "Bounded canonical event send selection." }))
) {}
/**
 * Durable result of a send call, separate from backend visibility.
 * **Example** (Inspecting result constructors)
 * ```ts
 * import { NativeDeliveryResult } from "@beep/repo-ai-metrics/native-delivery"
 * console.log(NativeDeliveryResult.cases.Recorded)
 * ```
 * **Details** Recorded follows the outcome commit. ExistingAttempt means no new network operation was performed; callers query the ledger for prior evidence.
 * @category models
 * @since 0.0.0
 */
export const NativeDeliveryResult = S.TaggedUnion({
  Recorded: { attemptId: Sha256Hex, outcome: DeliveryOutcome },
  ExistingAttempt: { attemptId: Sha256Hex },
}).pipe($I.annoteSchema("NativeDeliveryResult", { description: "Committed send outcome or suppressed replay." }));
/**
 * Safe sender refusal without endpoint, payload or response content.
 * **Example** (Inspecting a refusal)
 * ```ts
 * import { NativeDeliveryError } from "@beep/repo-ai-metrics/native-delivery"
 * console.log(NativeDeliveryError.make({ reason: "busy" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class NativeDeliveryError extends S.TaggedError<NativeDeliveryError, { readonly brand: unique symbol }>(
  $I`NativeDeliveryError`
)(
  "NativeDeliveryError",
  { reason: S.Literals(["configuration", "unknown-page", "empty-selection", "busy"]) },
  $I.annote("NativeDeliveryError", { description: "Safe pre-send refusal." })
) {}
const failure = (reason: NativeDeliveryError["reason"]) => NativeDeliveryError.make({ reason });
const endpoint = (policy: NativeDeliveryPolicy) =>
  Effect.try({
    try: () => new URL(Redacted.value(policy.endpoint)),
    catch: () => failure("configuration"),
  }).pipe(
    Effect.flatMap((url) => {
      const loopback = A.contains(["localhost", "127.0.0.1", "[::1]"], url.hostname);
      return (url.protocol === "https:" || (url.protocol === "http:" && loopback)) &&
        url.username === "" &&
        url.password === "" &&
        url.search === "" &&
        url.hash === "" &&
        url.pathname === "/v1/traces"
        ? Effect.succeed(url.href)
        : Effect.fail(failure("configuration"));
    })
  );
/**
 * Resolve the declared Phoenix query origin independently of an intermediary collector.
 * **Example** (Inspecting read-back routing)
 * ```ts
 * import { nativeDeliveryReadbackOrigin } from "@beep/repo-ai-metrics/native-delivery"
 * console.log(typeof nativeDeliveryReadbackOrigin)
 * ```
 * **Details** Defaults to the export origin for direct Phoenix delivery. An intermediary requires an explicitly declared backend origin. Both origins enter the immutable target identity; changing either requires a new owned journal or migration.
 * @category utilities
 * @since 0.0.0
 */
export const nativeDeliveryReadbackOrigin = Effect.fn("AiMetrics.nativeDeliveryReadbackOrigin")(function* (
  policy: NativeDeliveryPolicy
) {
  const exportUrl = yield* endpoint(policy);
  const url = yield* Effect.try({
    try: () =>
      new URL(
        O.isSome(policy.readbackOrigin) ? Redacted.value(policy.readbackOrigin.value) : new URL(exportUrl).origin
      ),
    catch: () => failure("configuration"),
  });
  const loopback = A.contains(["localhost", "127.0.0.1", "[::1]"], url.hostname);
  if (
    !(url.protocol === "https:" || (url.protocol === "http:" && loopback)) ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.pathname !== "/"
  )
    return yield* failure("configuration");
  return url.origin;
});
/**
 * Bind the ledger target to its exact destination, project and projection version.
 * **Example** (Inspecting target derivation)
 * ```ts
 * import { nativeDeliveryTargetId } from "@beep/repo-ai-metrics/native-delivery"
 * console.log(typeof nativeDeliveryTargetId)
 * ```
 * **Details** The hash is destination identity, not authentication. Changing destination/project/projection requires a new owned journal or explicit migration.
 * @category utilities
 * @since 0.0.0
 */
export const nativeDeliveryTargetId = Effect.fn("AiMetrics.nativeDeliveryTargetId")(function* (
  policy: NativeDeliveryPolicy
) {
  return yield* hashPublicTextSha256(
    `observation-target/v3:${yield* endpoint(policy)}:${yield* nativeDeliveryReadbackOrigin(policy)}:${policy.project}:native-export/v1:transcript-export/v1`
  );
});
const unknown = (reason: typeof DeliveryOutcome.cases.Unknown.Type.reason) =>
  DeliveryOutcome.cases.Unknown.make({ reason });
const boundedReply = Effect.fn("AiMetrics.nativeDelivery.boundedReply")(function* <E, R>(
  stream: Stream.Stream<Uint8Array, E, R>
) {
  const bytes = new Uint8Array(65536);
  let used = 0;
  yield* stream.pipe(
    Stream.runForEach((chunk) =>
      Effect.gen(function* () {
        if (chunk.byteLength > bytes.byteLength - used) return yield* Effect.fail(unknown("invalid-response"));
        bytes.set(chunk, used);
        used += chunk.byteLength;
      })
    )
  );
  return bytes.slice(0, used);
});
/**
 * Create a bounded single-send worker over canonical locally accepted metadata.
 * **Example** (Inspecting the worker)
 * ```ts
 * import { makeNativeDelivery } from "@beep/repo-ai-metrics/native-delivery"
 * console.log(typeof makeNativeDelivery)
 * ```
 * **Details** One request at a time with no waiting queue; commit a single-use attempt before I/O, parse at most 64 KiB of reply, and commit the outcome before returning. Existing attempt IDs never send again. Interrupted or killed sends remain unresolved. Full acknowledgment means accepted-unverified, never backend visibility. Inject a raw client without retries/redirects; process resource limits, scheduling, authentication and backend read-back are caller responsibilities.
 * @category services
 * @since 0.0.0
 */
export const makeNativeDelivery = Effect.fn("AiMetrics.makeNativeDelivery")(function* (
  intakeConfig: TranscriptIntakeConfig,
  ledgerConfig: DeliveryLedgerConfig,
  policy: NativeDeliveryPolicy
) {
  const url = yield* endpoint(policy);
  if ((yield* nativeDeliveryTargetId(policy)) !== ledgerConfig.targetId) return yield* failure("configuration");
  const client = yield* HttpClient.HttpClient;
  const pages = yield* makeObservationExportReader(intakeConfig);
  const ledger = yield* makeDeliveryLedger(intakeConfig, ledgerConfig);
  const permit = yield* Semaphore.make(1);
  const send = Effect.fn("AiMetrics.nativeDelivery.send")(function* (input: NativeDeliveryRequest) {
    const admitted = yield* permit.withPermitsIfAvailable(1)(
      Effect.gen(function* () {
        const page = yield* pages.read(input.receiptId);
        if (O.isNone(page)) return yield* failure("unknown-page");
        if (input.offset >= pages.eventIds(page.value).length) return yield* failure("empty-selection");
        const encoded = yield* pages.prepare(input.receiptId, input.offset, input.limit, policy.project);
        yield* ledger.registerPage(input.receiptId);
        return yield* Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            const reserved = yield* ledger.reserveSend(
              DeliveryAttempt.make({
                attemptId: input.attemptId,
                eventIds: encoded.eventIds,
                payloadDigest: encoded.payloadDigest,
              })
            );
            if (!reserved) return NativeDeliveryResult.cases.ExistingAttempt.make({ attemptId: input.attemptId });
            const request = HttpClientRequest.post(url).pipe(
              HttpClientRequest.bodyUint8Array(encoded.body),
              HttpClientRequest.setHeaders({ "content-type": "application/x-protobuf", "accept-encoding": "identity" })
            );
            const exchange = Effect.scoped(
              Effect.gen(function* () {
                const response = yield* client.execute(request).pipe(Effect.mapError(() => unknown("connection-lost")));
                const contentType = Str.toLowerCase(
                  Str.trim(Str.split(";")(response.headers["content-type"] ?? "")[0] ?? "")
                );
                const normalized =
                  contentType === "application/json"
                    ? "application/json"
                    : contentType === "application/x-protobuf"
                      ? "application/x-protobuf"
                      : "other";
                // Non-200 responses carry only status evidence. Do not buffer their private error bodies.
                if (response.status !== 200)
                  return yield* interpretDeliveryHttpReply(
                    DeliveryHttpReply.make({
                      status: response.status,
                      requestContentType: "application/x-protobuf",
                      responseContentType: normalized,
                      sentSpans: encoded.eventIds.length,
                      body: new Uint8Array(),
                    })
                  );
                if ((response.headers["content-encoding"] ?? "identity") !== "identity")
                  return unknown("invalid-response");
                const bytes = yield* boundedReply(response.stream).pipe(Effect.orElseSucceed(() => undefined));
                if (bytes === undefined) return unknown("invalid-response");
                return yield* interpretDeliveryHttpReply(
                  DeliveryHttpReply.make({
                    status: response.status,
                    requestContentType: "application/x-protobuf",
                    responseContentType: normalized,
                    sentSpans: encoded.eventIds.length,
                    body: bytes,
                  })
                );
              })
            ).pipe(
              Effect.timeoutOrElse({
                duration: policy.timeoutMillis,
                orElse: () => Effect.succeed(unknown("timed-out")),
              }),
              Effect.orElseSucceed(() => unknown("connection-lost"))
            );
            const outcome = yield* restore(exchange).pipe(
              Effect.onInterrupt(() => ledger.recordOutcome(input.attemptId, unknown("interrupted")))
            );
            yield* ledger.recordOutcome(input.attemptId, outcome);
            return NativeDeliveryResult.cases.Recorded.make({ attemptId: input.attemptId, outcome });
          })
        );
      })
    );
    return O.isSome(admitted) ? admitted.value : yield* failure("busy");
  });
  return { send, ledger };
});
