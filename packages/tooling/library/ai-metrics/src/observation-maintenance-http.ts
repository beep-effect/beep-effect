/**
 * Bounded owner-only maintenance transport for the paused observation worker.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { EvidenceRetirement, EvidenceWindow } from "./evidence-window.ts";
import { observationHttpBodyFailure, readObservationHttpText } from "./internal/observation-http-body.ts";
import { ObservationBackupPolicy, ObservationBackupReceipt } from "./observation-backup.ts";
import { PageDisposition, TranscriptAcceptance } from "./transcript-intake.ts";
import type { makeObservationWorker, ObservationWorkerConfig } from "./observation-worker.ts";

const $I = $RepoAiMetricsId.create("observation-maintenance-http");
/**
 * Finite owner operations with no caller-selected filesystem destination.
 *
 * **Details**
 *
 * Pages returns at most 32 receipt summaries after a sequence. Backup slots are create-only: occupied or partial generations are preserved. Reclaim and Expire retain the configured age, quiet-period and delivery checks. RestoreEvidence restores the latest logical retirement only; physical disaster restore remains an offline operation into a fresh destination.
 *
 * **Example** (Construct the window observation maintenance command case)
 *
 * ```ts
 * import { ObservationMaintenanceCommand } from "@beep/repo-ai-metrics/observation-maintenance-http"
 * console.log(ObservationMaintenanceCommand.cases.Window.make({})._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservationMaintenanceCommand = S.TaggedUnion({
  Window: {},
  Pages: { afterSequence: S.Natural },
  Reclaim: { receiptId: Sha256Hex },
  Expire: { receiptId: Sha256Hex },
  Backup: { slot: S.Int.check(S.isBetween({ minimum: 0, maximum: 3 })) },
  Seal: { epoch: S.Natural },
  RestoreEvidence: { digest: Sha256Hex },
}).pipe($I.annoteSchema("ObservationMaintenanceCommand", { description: "Bounded private maintenance operations." }));
/**
 * Decoded private maintenance operation.
 * @category models
 * @since 0.0.0
 */
export type ObservationMaintenanceCommand = typeof ObservationMaintenanceCommand.Type;

/**
 * Private selection of one worker process and configured delivery target.
 *
 * **Details**
 *
 * A fresh ownerInstanceId is generated on every worker start. It distinguishes even otherwise identical journals on the same host. It is not a credential or a persisted journal identifier. After restart, explicitly select the intended worker's new context before reconciling an uncertain operation.
 *
 * **Example** (Inspect the observation maintenance context constructor)
 *
 * ```ts
 * import { ObservationMaintenanceContext } from "@beep/repo-ai-metrics/observation-maintenance-http"
 * console.log(typeof ObservationMaintenanceContext.make)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservationMaintenanceContext extends S.Opaque<
  ObservationMaintenanceContext,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag("observation-maintenance-context/v1"),
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    targetId: Sha256Hex,
    ownerInstanceId: S.String.check(S.isUUID(4)),
  }).pipe(
    $I.annoteSchema("ObservationMaintenanceContext", {
      description: "Exact private worker process and target selection.",
    })
  )
) {}
/**
 * Exact destination binding for a private maintenance request.
 *
 * **Details**
 *
 * The socket directory authenticates the local owner. These identifiers refuse accidental operations against a different worker; they are not credentials. Unknown fields are rejected, never stored or echoed.
 *
 * **Example** (Inspect the observation maintenance request constructor)
 *
 * ```ts
 * import { ObservationMaintenanceRequest } from "@beep/repo-ai-metrics/observation-maintenance-http"
 * console.log(typeof ObservationMaintenanceRequest.make)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservationMaintenanceRequest extends S.Opaque<
  ObservationMaintenanceRequest,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag("observation-maintenance/v1"),
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    targetId: ObservationMaintenanceContext.fields.targetId,
    ownerInstanceId: ObservationMaintenanceContext.fields.ownerInstanceId,
    command: ObservationMaintenanceCommand,
  }).pipe(
    $I.annoteSchema("ObservationMaintenanceRequest", { description: "Owner request bound to one journal namespace." })
  )
) {}

const decode = S.decodeEffect(S.fromJsonString(ObservationMaintenanceRequest), { onExcessProperty: "error" });
const headers = { "cache-control": "no-store", connection: "close" };
const refused = (status: number) => HttpServerResponse.text("Observation maintenance unavailable", { status, headers });
const encodeResponse =
  <A, RE>(schema: S.ConstraintCodec<A, unknown, unknown, RE>) =>
  <E, R>(operation: Effect.Effect<A, E, R>) =>
    operation.pipe(
      Effect.flatMap(HttpServerResponse.schemaJson(schema)),
      Effect.orElseSucceed(() => refused(503))
    );

/**
 * Expose existing maintenance invariants on one private, non-queued HTTP route.
 *
 * **Details**
 *
 * Serve only on the owned private socket, never through the public frontend. One request at a time, 4096 body bytes and a one-second body deadline bound admission. Mutations require a drained paused worker and leave it paused on all outcomes. Four fixed backup slots cap generations at four times the configured journal ceiling (at most 128 MiB plus manifests); no automatic deletion or overwrite occurs. Retain returned backup receipts independently and replicate snapshots outside the host for host-loss recovery. A lost response is uncertain: inspect the slot or replay the exact receipt/epoch/digest operation. No request can change retention policy or resume collection.
 *
 * **Example** (Inspect the factory for observation maintenance http)
 *
 * ```ts
 * import { makeObservationMaintenanceHttp } from "@beep/repo-ai-metrics/observation-maintenance-http"
 * console.log(typeof makeObservationMaintenanceHttp)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const makeObservationMaintenanceHttp = Effect.fn("AiMetrics.makeObservationMaintenanceHttp")(function* (
  worker: Effect.Success<ReturnType<typeof makeObservationWorker>>,
  config: ObservationWorkerConfig,
  directory: string
) {
  const backupPolicy = yield* S.decodeEffect(ObservationBackupPolicy)({
    maxBytes: config.intake.maxDatabasePages * 4096,
  });
  const random = yield* SecureRandom.SecureRandom;
  const context = ObservationMaintenanceContext.make({
    hostId: config.intake.hostId,
    namespaceId: config.intake.namespaceId,
    targetId: config.ledger.targetId,
    ownerInstanceId: yield* random.uuidV4(),
  });
  const permit = yield* Semaphore.make(1);
  const handler = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    if (request.url !== "/maintenance") return refused(404);
    if (request.method === "GET")
      return yield* HttpServerResponse.schemaJson(ObservationMaintenanceContext)(context, { headers });
    if (request.method !== "POST") return refused(405);
    if (
      request.headers["content-type"] !== "application/json" ||
      (request.headers["content-encoding"] ?? "identity") !== "identity"
    )
      return refused(415);
    const admitted = yield* permit.withPermitsIfAvailable(1)(
      Effect.gen(function* () {
        const text = yield* readObservationHttpText(request.stream, 4096, 1000);
        const input = yield* decode(text).pipe(Effect.mapError(() => observationHttpBodyFailure("malformed")));
        if (
          input.hostId !== context.hostId ||
          input.namespaceId !== context.namespaceId ||
          input.targetId !== context.targetId ||
          input.ownerInstanceId !== context.ownerInstanceId
        )
          return refused(409);
        return yield* ObservationMaintenanceCommand.match(input.command, {
          Window: () => worker.window.pipe(encodeResponse(EvidenceWindow)),
          Pages: ({ afterSequence }) =>
            worker.pages(afterSequence).pipe(encodeResponse(S.Array(TranscriptAcceptance).check(S.isMaxLength(32)))),
          Reclaim: ({ receiptId }) =>
            worker.reclaimPaused(receiptId).pipe(encodeResponse(S.OptionFromNullOr(PageDisposition))),
          Expire: ({ receiptId }) =>
            worker.expirePaused(receiptId).pipe(encodeResponse(S.OptionFromNullOr(PageDisposition))),
          Backup: ({ slot }) =>
            worker.backup(backupPolicy, `${directory}/backup-${slot}`).pipe(encodeResponse(ObservationBackupReceipt)),
          Seal: ({ epoch }) =>
            worker
              .seal(epoch)
              .pipe(encodeResponse(S.OptionFromNullOr(S.Struct({ record: EvidenceRetirement, digest: Sha256Hex })))),
          RestoreEvidence: ({ digest }) =>
            worker.restore(digest).pipe(encodeResponse(S.Literals(["restored", "already-restored"]))),
        });
      }).pipe(
        Effect.catchTag("ObservationHttpBodyError", (error) =>
          Effect.succeed(refused(error.reason === "oversize" ? 413 : error.reason === "timed-out" ? 408 : 400))
        ),
        Effect.timeoutOrElse({ duration: "30 seconds", orElse: () => Effect.succeed(refused(503)) })
      )
    );
    return O.isSome(admitted) ? admitted.value : refused(503);
  }).pipe(
    Effect.orElseSucceed(() => refused(503)),
    Effect.map(HttpServerResponse.setHeaders(headers))
  );
  return { handler, context };
});
