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
import * as Order from "effect/Order";
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
import type { CacheProtocolNativeSummary } from "./Cache.protocol.runner.schemas.ts";

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
const SingleExchange = S.Tuple([CacheConformanceProxyEvent]).pipe(
  $I.annoteSchema("SingleExchange", {
    description: "Exactly one candidate artifact exchange after permitted metadata operations are filtered.",
  })
);
const isProducerEvent = S.is(ProducerEvent);
const isProducerUploadEvent = S.is(ProducerUploadEvent);
const isSingleExchange = S.is(SingleExchange);
const isSuccessStatus = S.is(CacheHostedProducerUpload.fields.status);
const isNativeTaskHash = S.is(CacheHostedProducerUpload.fields.taskHash);
const sameTaskIds = S.toEquivalence(S.Array(S.String));
const decodeUpload = S.decodeUnknownEffect(CacheHostedProducerUpload);

const producedTaskHash = Effect.fn("CacheWorkflow.producedTaskHash")(function* (
  binding: CacheProducerBinding,
  summary: CacheProtocolNativeSummary,
  expectedTasks: ReadonlyArray<string>
) {
  if (
    expectedTasks.length > 64 ||
    A.dedupe(expectedTasks).length !== expectedTasks.length ||
    summary.turboVersion !== binding.client.version ||
    !sameTaskIds(
      A.sort(expectedTasks, Order.String),
      A.sort(
        A.map(summary.tasks, (task) => task.taskId),
        Order.String
      )
    ) ||
    A.some(
      summary.tasks,
      (task) =>
        !isNativeTaskHash(task.hash) ||
        task.cache.status !== "MISS" ||
        O.isSome(task.cache.source) ||
        task.execution.exitCode !== 0
    )
  )
    return yield* CacheCommandError.new("Producer summary differs from the reviewed completed fresh task graph.");
  const task = yield* A.findFirst(summary.tasks, (task) => task.taskId === binding.key.computation).pipe(
    Effect.fromOption(() => CacheCommandError.new("Producer task did not execute."))
  );
  return task.hash;
});

/**
 * Join one freshly completed native task to its exact observed artifact upload.
 *
 * **Details**
 * Only the owned producer supervisor may supply the summary and complete settled
 * capture. It supplies the complete independently reviewed task closure; the
 * default closure permits only the selected task. Every task must execute fresh
 * and succeed before the upload task is selected. This pure validation step
 * authenticates no caller, signs no payload and grants no qualification or reuse
 * authority. The first producer profile
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
  events: ReadonlyArray<CacheConformanceProxyEvent>,
  expectedTasks: ReadonlyArray<string> = [binding.key.computation]
) {
  const expectedHash = yield* producedTaskHash(binding, summary, expectedTasks);
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
  if (!isSingleExchange(uploads))
    return yield* CacheCommandError.new("Producer capture has no unambiguous single artifact upload.");
  const [selected] = uploads;
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
