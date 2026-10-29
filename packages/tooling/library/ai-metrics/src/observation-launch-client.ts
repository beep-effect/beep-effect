/**
 * Scoped Unix-socket client for exact managed-launch observations.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { readObservationHttpBytes } from "./internal/observation-http-body.ts";
import {
  ObservationLaunchFact,
  ObservationLaunchReceipt,
  observationLaunchReceiptId,
} from "./observation-launch-facts.ts";
import { ObservationLaunchContext, ObservationLaunchSubmission } from "./observation-launch-http.ts";

const $I = $RepoAiMetricsId.create("observation-launch-client");
/**
 * Explicit private socket directory, expected destination and exchange deadline.
 * **Example** (Inspect the client policy)
 * ```ts
 * import { ObservationLaunchClientPolicy } from "@beep/repo-ai-metrics/observation-launch-client"
 * console.log(typeof ObservationLaunchClientPolicy.make)
 * ```
 * **Details** No TCP address, credential, raw command or environment is accepted. Host and namespace must come from the owner's enrollment, never from an unchecked server response.
 * @category models
 * @since 0.0.0
 */
export class ObservationLaunchClientPolicy extends S.Opaque<
  ObservationLaunchClientPolicy,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    directory: S.NonEmptyString.check(S.isMaxLength(80)),
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    timeoutMillis: S.Int.check(S.isBetween({ minimum: 100, maximum: 10000 })),
  }).pipe($I.annoteSchema("ObservationLaunchClientPolicy", { description: "Pinned private local launch destination." }))
) {}
/**
 * Content-free client refusal or uncertain delivery.
 * **Example** (Describe ambiguity)
 * ```ts
 * import { ObservationLaunchClientError } from "@beep/repo-ai-metrics/observation-launch-client"
 * console.log(ObservationLaunchClientError.make({ reason: "ambiguous" }).reason)
 * ```
 * **Details** ambiguous and invalid-response do not prove non-acceptance. Reconcile the exact submission; never start another process or switch epochs automatically. conflict and retired also require explicit reconciliation.
 * @category errors
 * @since 0.0.0
 */
export class ObservationLaunchClientError extends S.TaggedError<
  ObservationLaunchClientError,
  { readonly brand: unique symbol }
>($I`ObservationLaunchClientError`)(
  "ObservationLaunchClientError",
  {
    reason: S.Literals([
      "configuration",
      "busy",
      "unavailable",
      "ambiguous",
      "invalid-response",
      "conflict",
      "retired",
    ]),
  },
  $I.annote("ObservationLaunchClientError", { description: "Safe client failure without paths or response contents." })
) {}
const failure = (reason: ObservationLaunchClientError["reason"]) => ObservationLaunchClientError.make({ reason });
const equivalentFact = S.toEquivalence(ObservationLaunchFact);
const encodeSubmission = S.encodeEffect(S.fromJsonString(ObservationLaunchSubmission));
const decodeReceipt = S.decodeEffect(S.fromJsonString(ObservationLaunchReceipt), { onExcessProperty: "error" });
const decodeContext = S.decodeEffect(S.fromJsonString(ObservationLaunchContext), { onExcessProperty: "error" });

/**
 * Connect to one owner-only socket with bounded single-attempt exchanges.
 * **Example** (Inspect the client factory)
 * ```ts
 * import { makeObservationLaunchClient } from "@beep/repo-ai-metrics/observation-launch-client"
 * console.log(typeof makeObservationLaunchClient)
 * ```
 * **Details** The runtime supplies its effective UID. Requires a canonical absolute 0700 directory and 0600 socket owned by that UID, and pins both inode identities for this client lifetime. Replacement requires a new client, never transparent retargeting. Uses the Effect Node socket client without redirects or retries, one exchange at a time and bounded response bytes. context is a read, not admission authority; submit retains its supplied epoch. Receipt metadata, header and digest must all agree. The client does not launch agents or establish independent coverage.
 * @category services
 * @since 0.0.0
 */
export const makeObservationLaunchClient = Effect.fn("AiMetrics.makeObservationLaunchClient")(function* (
  policy: ObservationLaunchClientPolicy,
  uid: number
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const inspect = Effect.gen(function* () {
    if (
      !path.isAbsolute(policy.directory) ||
      path.normalize(policy.directory) !== policy.directory ||
      !/^\/[A-Za-z0-9_./-]{1,79}$/.test(policy.directory) ||
      (yield* fs.realPath(policy.directory)) !== policy.directory
    )
      return yield* failure("configuration");
    const directory = yield* fs.lstat(policy.directory);
    const socket = yield* fs.lstat(path.join(policy.directory, "worker.sock"));
    if (
      directory.type !== "Directory" ||
      (directory.mode & 0o777) !== 0o700 ||
      directory.uid.pipe(O.getOrElse(() => -1)) !== uid ||
      socket.type !== "Socket" ||
      (socket.mode & 0o777) !== 0o600 ||
      socket.uid.pipe(O.getOrElse(() => -1)) !== uid ||
      O.isNone(directory.ino) ||
      O.isNone(socket.ino)
    )
      return yield* failure("configuration");
    return {
      directoryDev: directory.dev,
      directoryInode: directory.ino.value,
      socketDev: socket.dev,
      socketInode: socket.ino.value,
    };
  }).pipe(Effect.mapError(() => failure("configuration")));
  const original = yield* inspect;
  const client = Context.get(
    yield* Layer.build(
      NodeHttpClient.layerNodeHttpOptions({
        socketPath: path.join(policy.directory, "worker.sock"),
        keepAlive: false,
        maxSockets: 1,
      }).pipe(Layer.fresh)
    ),
    HttpClient.HttpClient
  );
  const permit = yield* Semaphore.make(1);
  const exchange = Effect.fn("AiMetrics.launchClient.exchange")(function* (
    submission: O.Option<ObservationLaunchSubmission>
  ) {
    const result = yield* permit.withPermitsIfAvailable(1)(
      Effect.gen(function* () {
        const current = yield* inspect;
        if (
          current.directoryDev !== original.directoryDev ||
          current.directoryInode !== original.directoryInode ||
          current.socketDev !== original.socketDev ||
          current.socketInode !== original.socketInode
        )
          return yield* failure("configuration");
        let request = HttpClientRequest.get("http://localhost/v1/launch-context");
        if (O.isSome(submission)) {
          if (submission.value.hostId !== policy.hostId || submission.value.namespaceId !== policy.namespaceId)
            return yield* failure("configuration");
          const body = yield* encodeSubmission(submission.value).pipe(Effect.mapError(() => failure("configuration")));
          if (new TextEncoder().encode(body).byteLength > 8192) return yield* failure("configuration");
          request = HttpClientRequest.post("http://localhost/v1/launch-facts").pipe(
            HttpClientRequest.bodyText(body, "application/json")
          );
        }
        const response = yield* client.execute(request);
        const bytes = yield* readObservationHttpBytes(response.stream, O.isSome(submission) ? 8192 : 16384);
        if (response.status !== 200)
          return yield* failure(
            O.isSome(submission)
              ? response.status === 410
                ? "retired"
                : response.status === 409
                  ? "conflict"
                  : "ambiguous"
              : "unavailable"
          );
        const body = yield* Effect.try({
          try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
          catch: () => failure("invalid-response"),
        });
        return { body, receiptHeader: response.headers["x-observation-receipt"] };
      }).pipe(
        Effect.timeoutOrElse({
          duration: policy.timeoutMillis,
          orElse: () => Effect.fail(failure(O.isSome(submission) ? "ambiguous" : "unavailable")),
        }),
        Effect.mapError((error) =>
          S.is(ObservationLaunchClientError)(error)
            ? error
            : failure(O.isSome(submission) ? "ambiguous" : "unavailable")
        )
      )
    );
    return O.isSome(result) ? result.value : yield* failure("busy");
  });
  const context = Effect.gen(function* () {
    const response = yield* exchange(O.none());
    const value = yield* decodeContext(response.body).pipe(Effect.mapError(() => failure("invalid-response")));
    if (value.hostId !== policy.hostId || value.namespaceId !== policy.namespaceId)
      return yield* failure("invalid-response");
    return value;
  });
  const submit = Effect.fn("AiMetrics.launchClient.submit")(function* (submission: ObservationLaunchSubmission) {
    const response = yield* exchange(O.some(submission));
    const receipt = yield* decodeReceipt(response.body).pipe(Effect.mapError(() => failure("invalid-response")));
    const expectedId = yield* observationLaunchReceiptId(
      policy.hostId,
      policy.namespaceId,
      submission.evidenceEpoch,
      submission.fact
    ).pipe(Effect.mapError(() => failure("invalid-response")));
    if (
      receipt.hostId !== policy.hostId ||
      receipt.namespaceId !== policy.namespaceId ||
      receipt.evidenceEpoch !== submission.evidenceEpoch ||
      !equivalentFact(receipt.fact, submission.fact) ||
      receipt.receiptId !== expectedId ||
      response.receiptHeader !== expectedId
    )
      return yield* failure("invalid-response");
    return receipt;
  });
  return { context, submit };
});
