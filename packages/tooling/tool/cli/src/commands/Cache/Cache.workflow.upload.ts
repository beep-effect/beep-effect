/**
 * Bounded join between an owned native task summary and observed upload bytes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CacheConformanceBackendResult,
  CacheConformanceExchange,
  CacheConformanceProxyEvent,
} from "./Cache.conformance.schemas.ts";
import { classifyCacheConformanceBackendResult } from "./Cache.conformance.wire.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import { CacheHostedProducerUpload } from "./Cache.workflow.github.schemas.ts";
import type { CacheProducerBinding } from "./Cache.producer.schemas.ts";
import type { CacheProtocolNativeSummary } from "./Cache.protocol.runner.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.workflow.upload");
const MetadataOperation = LiteralKit(["GET /v8/artifacts/status", "POST /v8/artifacts/events"]).pipe(
  $I.annoteSchema("MetadataOperation", {
    description: "Non-artifact operations permitted beside the first producer's single upload.",
  })
);
const isMetadataOperation = S.is(MetadataOperation);
const ProducerExchange = S.Struct({
  ...CacheConformanceExchange.fields,
  role: S.tag("writer"),
  selector: S.tag("team-id"),
  strictScored: S.tag(true),
  outcome: S.tag("success"),
}).pipe(
  $I.annoteSchema("ProducerExchange", {
    description: "Successful unfaulted exchange attributed to the selected writer and tenant.",
  })
);
const ProducerEvent = S.Struct({
  ...CacheConformanceProxyEvent.fields,
  fault: S.tag("none"),
  exchange: ProducerExchange,
}).pipe(
  $I.annoteSchema("ProducerEvent", { description: "An unfaulted writer event; shape alone grants no producer trust." })
);
const ProducerUploadEvent = S.Struct({
  ...ProducerEvent.fields,
  exchange: S.Struct({
    ...ProducerExchange.fields,
    method: S.tag("PUT"),
    route: S.tag("/v8/artifacts/{hash}"),
    hash: S.tag("valid"),
  }),
}).pipe(
  $I.annoteSchema("ProducerUploadEvent", { description: "The sole artifact PUT in a bounded producer capture." })
);
const isProducerEvent = S.is(ProducerEvent);
const isProducerUploadEvent = S.is(ProducerUploadEvent);
const isSuccessStatus = S.is(CacheHostedProducerUpload.fields.status);
const decodeUpload = S.decodeUnknownEffect(CacheHostedProducerUpload);

const producedTaskHash = Effect.fn("CacheWorkflow.producedTaskHash")(function* (
  binding: CacheProducerBinding,
  summary: CacheProtocolNativeSummary
) {
  const task = yield* A.head(summary.tasks).pipe(
    Effect.fromOption(() => CacheCommandError.new("Producer task did not execute."))
  );
  if (
    summary.tasks.length !== 1 ||
    summary.turboVersion !== binding.client.version ||
    task.taskId !== binding.key.computation ||
    task.cache.status !== "MISS" ||
    task.execution.exitCode !== 0
  )
    return yield* CacheCommandError.new("Producer summary differs from the selected completed fresh task.");
  return task.hash;
});

/**
 * Join one freshly completed native task to its exact observed artifact upload.
 *
 * **Details**
 * Only the owned producer supervisor may supply the summary and complete settled
 * capture. This pure validation step authenticates no caller, signs no payload
 * and grants no qualification or reuse authority. The first producer profile
 * permits one artifact PUT plus successful status/events metadata operations.
 * A native signature still needs independent verification; a tag digest proves
 * only that an opaque tag was carried on the request.
 *
 * **Example** (Reference the observation join)
 * ```ts
 * import { joinCacheProducerUpload } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof joinCacheProducerUpload === "function")
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const joinCacheProducerUpload = Effect.fn("CacheWorkflow.joinProducerUpload")(function* (
  binding: CacheProducerBinding,
  summary: CacheProtocolNativeSummary,
  events: ReadonlyArray<CacheConformanceProxyEvent>
) {
  const expectedHash = yield* producedTaskHash(binding, summary);
  if (events.length === 0 || events.length > 200)
    return yield* CacheCommandError.new("Producer capture is empty or exceeds its event bound.");
  if (
    A.some(
      events,
      (event) =>
        !isProducerEvent(event) ||
        !O.contains(event.exchange.backendResult, CacheConformanceBackendResult.Enum.allowed) ||
        !O.exists(event.exchange.status, isSuccessStatus) ||
        !Equal.equals(event.upstreamStatus, event.exchange.status)
    )
  )
    return yield* CacheCommandError.new("Producer capture contains a failed, foreign or faulted exchange.");
  const uploads = A.filter(events, (event) => !isMetadataOperation(`${event.exchange.method} ${event.exchange.route}`));
  if (uploads.length !== 1)
    return yield* CacheCommandError.new("Producer capture has no unambiguous single artifact upload.");
  const selected = yield* A.head(uploads).pipe(
    Effect.fromOption(() => CacheCommandError.new("Producer artifact upload is absent."))
  );
  if (!isProducerUploadEvent(selected) || O.isNone(selected.exchange.requestTagSha256))
    return yield* CacheCommandError.new("Producer artifact upload lacks its route, hash or opaque tag evidence.");
  const exchange = selected.exchange;
  const upload = yield* decodeUpload({
    taskHash: O.getOrUndefined(exchange.taskHash),
    archiveSha256: O.getOrUndefined(exchange.requestSha256),
    archiveBytes: exchange.requestBytes,
    status: O.getOrUndefined(exchange.status),
    backendResult: O.getOrUndefined(
      classifyCacheConformanceBackendResult(exchange.backendResult, exchange.method, exchange.status)
    ),
  }).pipe(Effect.mapError(() => CacheCommandError.new("Producer upload lacks bounded successful byte evidence.")));
  if (upload.taskHash !== expectedHash)
    return yield* CacheCommandError.new("Producer upload task hash differs from its owned native summary.");
  return upload;
});
