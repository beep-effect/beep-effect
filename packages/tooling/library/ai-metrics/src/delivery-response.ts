/**
 * Strict content-free interpretation of bounded OTLP/HTTP trace replies.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Protobuf from "protobufjs";
import { DeliveryOutcome } from "./delivery-ledger.ts";

const $I = $RepoAiMetricsId.create("delivery-response");
const MediaType = S.Literals(["application/json", "application/x-protobuf"]);
/**
 * Bounded response bytes and the exact outgoing span population.
 * **Example** (Inspecting a response)
 * ```ts
 * import { DeliveryHttpReply } from "@beep/repo-ai-metrics/delivery-response"
 * console.log(typeof DeliveryHttpReply.make)
 * ```
 * **Details** The transport must enforce the 64 KiB ceiling while reading, before constructing this value. Content type has already been normalized by the transport. Missing or mismatched response types never imply acceptance. Only actual HTTP responses belong here; connection failure or timeout is a separate Unknown outcome.
 * @category models
 * @since 0.0.0
 */
export class DeliveryHttpReply extends S.Opaque<DeliveryHttpReply, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.Int.check(S.isBetween({ minimum: 100, maximum: 599 })),
    requestContentType: MediaType,
    responseContentType: S.Literals(["application/json", "application/x-protobuf", "other"]),
    sentSpans: S.Int.check(S.isBetween({ minimum: 1, maximum: 512 })),
    body: S.Uint8Array.check(
      S.makeFilter((bytes) => bytes.byteLength <= 65536, {
        identifier: "DeliveryResponseBytes",
        message: "Response exceeds 64 KiB",
      })
    ),
  }).pipe($I.annoteSchema("DeliveryHttpReply", { description: "Bounded private OTLP response envelope." }))
) {}
const partial = S.Struct({
  rejectedSpans: S.optionalKey(
    S.Union([
      S.Int.check(S.isBetween({ minimum: 0, maximum: 512 })),
      S.String.check(S.isPattern(/^(0|[1-9][0-9]{0,2})$/)),
    ])
  ),
  errorMessage: S.optionalKey(S.String),
});
const response = S.Struct({ partialSuccess: S.optionalKey(partial) });
const wire = Protobuf.Root.fromJSON({
  nested: {
    ExportTraceServiceResponse: { fields: { partialSuccess: { type: "PartialSuccess", id: 1 } } },
    PartialSuccess: { fields: { rejectedSpans: { type: "int64", id: 1 }, errorMessage: { type: "string", id: 2 } } },
  },
}).lookupType("ExportTraceServiceResponse");
const invalid = DeliveryOutcome.cases.Unknown.make({ reason: "invalid-response" });
/**
 * Interpret one trace reply without losing partial-success semantics.
 * **Example** (Inspecting the decoder)
 * ```ts
 * import { interpretDeliveryHttpReply } from "@beep/repo-ai-metrics/delivery-response"
 * console.log(typeof interpretDeliveryHttpReply)
 * ```
 * **Details** A parsed 200 with zero rejected spans means complete hop acceptance, including warning-only partialSuccess. A positive count stays batch-level partial evidence, even when it equals the batch size. Invalid/missing/mismatched bodies and impossible counts remain unknown. The four OTLP retryable statuses remain distinct from permanent HTTP refusal. Raw server messages are neither returned nor persisted.
 * @category decoding
 * @since 0.0.0
 */
export const interpretDeliveryHttpReply = Effect.fn("AiMetrics.interpretDeliveryHttpReply")(function* (
  reply: DeliveryHttpReply
) {
  if (A.contains([429, 502, 503, 504], reply.status))
    return yield* S.decodeUnknownEffect(DeliveryOutcome.cases.Retryable)({ _tag: "Retryable", status: reply.status });
  if (reply.status >= 400) return DeliveryOutcome.cases.Rejected.make({ status: reply.status });
  if (reply.status !== 200 || reply.responseContentType !== reply.requestContentType) return invalid;
  return yield* Effect.gen(function* () {
    const decoded =
      reply.responseContentType === "application/json"
        ? yield* Effect.try(() => new TextDecoder("utf-8", { fatal: true }).decode(reply.body)).pipe(
            Effect.flatMap(S.decodeEffect(S.fromJsonString(response)))
          )
        : yield* Effect.try(() => wire.toObject(wire.decode(reply.body), { longs: String })).pipe(
            Effect.flatMap(S.decodeUnknownEffect(response))
          );
    const rejected = Number(decoded.partialSuccess?.rejectedSpans ?? 0);
    if (rejected > reply.sentSpans) return invalid;
    return rejected === 0
      ? DeliveryOutcome.cases.Accepted.make({})
      : DeliveryOutcome.cases.Partial.make({ rejectedCount: rejected });
  }).pipe(Effect.orElseSucceed(() => invalid));
});
