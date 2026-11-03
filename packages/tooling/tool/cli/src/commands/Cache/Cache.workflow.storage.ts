/**
 * Private, bounded R2 transport for independently authenticated producer observations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Sha256HexFromBytes } from "@beep/schema";
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { readContainedFileBytesNoFollow } from "../../internal/cli/FsGuards.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { cacheProducerObservationMaxBytes } from "./Cache.acceptance.store.ts";
import { classifyCacheConformanceStatus, readCacheConformanceReply } from "./Cache.conformance.wire.ts";
import { CacheProducerBinding } from "./Cache.producer.schemas.ts";
import {
  inspectCacheProducerDirectory,
  inspectCacheProducerFile,
  openCacheProducerVerifier,
  readCacheProducerExecutionProfile,
  readCacheProducerHostedApproval,
} from "./Cache.producer.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import { CacheHostedProducerApproval, CacheHostedProducerCompleteReport } from "./Cache.workflow.github.schemas.ts";
import {
  buildCacheHostedProducerCompleteReport,
  verifyCacheHostedProducerObservation,
  verifyCacheHostedProducerUpload,
} from "./Cache.workflow.github.ts";
import { CacheProducerExecutionProfile, CacheProducerObservation } from "./Cache.workflow.schemas.ts";
import { hashCacheProducerUploadTarget, loadCacheProducerStorageRuntime } from "./Cache.workflow.ts";
import type { HttpMethod } from "effect/http/HttpMethod";
import type { CacheConformanceOutcome } from "./Cache.conformance.schemas.ts";
import type { CacheHostedProducerReference, CacheHostedProducerRunReference } from "./Cache.workflow.github.schemas.ts";
import type { CacheProducerStorageRuntime } from "./Cache.workflow.schemas.ts";

const observationCodec = JsonStringCodec(CacheProducerObservation);
const profileCodec = JsonStringCodec(CacheProducerExecutionProfile);
const digest = S.decodeEffect(Sha256HexFromBytes);
const sameBinding = S.toEquivalence(CacheProducerBinding);
const sameHostedApproval = S.toEquivalence(CacheHostedProducerApproval);
const isCompleteReport = S.is(CacheHostedProducerCompleteReport);

const objectFailure = (outcome: CacheConformanceOutcome, method: HttpMethod = "GET") => {
  const ambiguous = method === "PUT" && A.contains(["transport-error", "timeout", "server-error"], outcome);
  return CacheCommandError.new(
    `Private producer object ${method} failed (${outcome}${ambiguous ? "; write-ambiguous" : ""}).`,
    ambiguous ? "write-ambiguous" : outcome
  );
};

const decodeObservation = Effect.fn("CacheObject.decodeObservation")(function* (bytes: Uint8Array) {
  const text = yield* Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    catch: () => objectFailure("payload-rejected"),
  });
  return yield* observationCodec.decode(text).pipe(Effect.mapError(() => objectFailure("payload-rejected")));
});

const snapshotObservation = Effect.fn("CacheObject.snapshotObservation")(function* (input: CacheProducerObservation) {
  const text = yield* observationCodec.encode(input).pipe(Effect.mapError(() => objectFailure("payload-rejected")));
  const initial = new TextEncoder().encode(text);
  if (initial.byteLength + 1 > cacheProducerObservationMaxBytes) return yield* objectFailure("payload-rejected");
  const observation = yield* decodeObservation(initial);
  const canonical = yield* observationCodec
    .encode(observation)
    .pipe(Effect.mapError(() => objectFailure("payload-rejected")));
  const bytes = new TextEncoder().encode(canonical);
  if (bytes.byteLength + 1 > cacheProducerObservationMaxBytes) return yield* objectFailure("payload-rejected");
  return Tuple.make(observation, bytes);
});

const objectKey = (runtime: CacheProducerStorageRuntime, report: CacheHostedProducerCompleteReport) =>
  `__beep_private_producer_v1/${runtime.target.namespace.teamId}/${report.runId}/${report.attempt}/${report.observationSha256}.json`;

const exchangeObject = Effect.fn("CacheObject.exchange")(function* (
  runtime: CacheProducerStorageRuntime,
  key: string,
  method: HttpMethod,
  expectedStatus: number,
  body: O.Option<Uint8Array>,
  maximumResponseBytes: number
) {
  const storage = yield* runtime.target.storage.pipe(
    Effect.fromOption(() => objectFailure("payload-rejected", method))
  );
  const url = `s3://${storage.bucket}/${key}`;
  const request = HttpClientRequest.make(method)(url);
  return yield* Effect.gen(function* () {
    const services = yield* Layer.build(
      BunHttpClient.layerOptions({
        redirect: "error",
        verbose: false,
        tls: { rejectUnauthorized: true },
        s3: {
          endpoint: storage.endpoint.origin,
          bucket: storage.bucket,
          region: "auto",
          accessKeyId: Redacted.value(runtime.accessKey),
          secretAccessKey: Redacted.value(runtime.secretKey),
          sessionToken: "",
          retry: 0,
          queueSize: 1,
          partSize: 8 * 1024 * 1024,
        },
      })
    );
    const client = Context.get(services, HttpClient.HttpClient);
    const response = yield* client
      .execute(
        O.match(body, {
          onNone: () => request,
          onSome: (bytes) => HttpClientRequest.bodyUint8Array(request, bytes, "application/json"),
        })
      )
      .pipe(Effect.mapError(() => objectFailure("transport-error", method)));
    if (response.status !== expectedStatus) {
      const outcome = classifyCacheConformanceStatus(false)(response.status);
      return yield* objectFailure(outcome === "success" ? "unexpected-status" : outcome, method);
    }
    const reply = yield* readCacheConformanceReply(response, maximumResponseBytes).pipe(
      Effect.catchTags({
        CacheCommandError: () => objectFailure("truncated-body", method),
        HttpClientError: () => objectFailure("transport-error", method),
      })
    );
    return reply.body;
  }).pipe(
    Effect.timeoutOrElse({
      duration: Duration.seconds(30),
      orElse: () => objectFailure("timeout", method),
    }),
    Effect.scoped
  );
});

const readPublication = Effect.fn("CacheObject.readPublication")(function* (
  directory: string,
  reference: CacheHostedProducerReference,
  inputArchive: Uint8Array
) {
  if (inputArchive.byteLength === 0 || inputArchive.byteLength > 1024 * 1024)
    return yield* objectFailure("payload-rejected");
  const archive = new Uint8Array(inputArchive);
  const [binding, profile] = yield* readCacheProducerExecutionProfile(directory);
  const approval = yield* readCacheProducerHostedApproval(directory);
  const upload = yield* binding.uploadApproval.pipe(Effect.fromOption(() => objectFailure("payload-rejected")));
  if (
    !sameBinding(approval.binding, binding) ||
    (yield* hashCacheProducerUploadTarget(profile.target)) !== upload.targetSha256
  )
    return yield* objectFailure("payload-rejected");
  const observed = yield* verifyCacheHostedProducerUpload(approval, reference, archive);
  if (!isCompleteReport(observed.report)) return yield* objectFailure("payload-rejected");
  return { binding, profile, approval, reference: observed.reference, archive, report: observed.report };
});

const assertPublicationUnchanged = Effect.fn("CacheObject.assertPublicationUnchanged")(function* (
  directory: string,
  binding: CacheProducerBinding,
  profile: CacheProducerExecutionProfile,
  approval: CacheHostedProducerApproval
) {
  const [currentBinding, currentProfile] = yield* readCacheProducerExecutionProfile(directory);
  const currentApproval = yield* readCacheProducerHostedApproval(directory);
  if (
    !sameBinding(currentBinding, binding) ||
    !sameHostedApproval(currentApproval, approval) ||
    (yield* profileCodec.encode(currentProfile)) !== (yield* profileCodec.encode(profile))
  )
    return yield* objectFailure("payload-rejected");
});

/**
 * Read one owner-only complete observation without following links or exceeding its existing byte budget.
 *
 * **Example** (Plan a private observation read)
 * ```ts
 * import { readCacheProducerPrivateObservation } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * const read = readCacheProducerPrivateObservation("/private/cache/observation.json")
 * console.assert(Effect.isEffect(read))
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const readCacheProducerPrivateObservation = Effect.fn("CacheObject.readPrivateObservation")(function* (
  file: string
) {
  const path = yield* Path.Path;
  const selected = path.resolve(file);
  const directory = path.dirname(selected);
  const uid = yield* inspectCacheProducerDirectory(directory);
  const info = yield* inspectCacheProducerFile(selected, uid, "Observation must be a private single-link file.");
  if (info.size === BigInt(0) || info.size > BigInt(cacheProducerObservationMaxBytes))
    return yield* objectFailure("payload-rejected");
  const read = yield* readContainedFileBytesNoFollow(directory, selected, cacheProducerObservationMaxBytes);
  const bytes = yield* read.contents.pipe(Effect.fromOption(() => objectFailure("payload-rejected")));
  return yield* decodeObservation(bytes);
}, CacheCommandError.mapError("Cannot read the bounded private producer observation."));

/**
 * Upload an already issued observation to its approved private R2 destination and return only its safe publication.
 *
 * **Details**
 * Verifies the existing issuer before loading storage capabilities. The object is
 * content-addressed by namespace, run, attempt and the canonical observation digest.
 * One PUT is attempted; an ambiguous write is never automatically retried.
 * This grants no hosted provenance or qualification and never publishes private matrices.
 *
 * **Example** (Prepare a private upload for a known workflow run)
 * ```ts
 * import { CacheHostedProducerRunReference, uploadCacheProducerPrivateObservation,
 *   type CacheProducerObservation } from "@beep/repo-cli/test/Cache"
 * const run = CacheHostedProducerRunReference.make({ runId: 42, attempt: 1 })
 * const upload = (observation: CacheProducerObservation) =>
 *   uploadCacheProducerPrivateObservation("/private/cache/producer", run, observation)
 * console.assert(typeof upload === "function")
 * ```
 *
 * @internal
 * @category commands
 * @since 0.0.0
 */
export const uploadCacheProducerPrivateObservation = Effect.fn("CacheObject.upload")(function* (
  directory: string,
  run: CacheHostedProducerRunReference,
  input: CacheProducerObservation
) {
  const [observation, bytes] = yield* snapshotObservation(input);
  const verifier = yield* openCacheProducerVerifier(directory);
  const approved = yield* verifier.verify(observation.envelope, observation.observation);
  const report = yield* buildCacheHostedProducerCompleteReport(observation, run);
  if ((yield* digest(bytes)) !== report.observationSha256) return yield* objectFailure("payload-rejected", "PUT");
  const [binding, runtime] = yield* loadCacheProducerStorageRuntime(directory);
  if (!sameBinding(binding, approved.binding)) return yield* objectFailure("payload-rejected", "PUT");
  yield* exchangeObject(runtime, objectKey(runtime, report), "PUT", 200, O.some(bytes), 0);
  return report;
}, CacheCommandError.mapError("Cannot upload the private producer observation."));

/**
 * Fetch private bytes only after authenticating their immutable GitHub publication, then verify the issuer and full join.
 *
 * **Details**
 * The supervisor selects the private store; uploaded data selects no endpoint or
 * credentials. Requires the existing authenticated GitHub metadata services.
 * Both private approval and execution profile are re-read before returning. The
 * caller still owns qualification and exclusive private output persistence.
 *
 * **Example** (Plan an authenticated private fetch)
 * ```ts
 * import { downloadCacheProducerPrivateObservation, type CacheHostedProducerReference } from "@beep/repo-cli/test/Cache"
 * const download = (reference: CacheHostedProducerReference, archive: Uint8Array) =>
 *   downloadCacheProducerPrivateObservation("/private/cache/producer", reference, archive)
 * console.assert(typeof download === "function")
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const downloadCacheProducerPrivateObservation = Effect.fn("CacheObject.download")(function* (
  directory: string,
  reference: CacheHostedProducerReference,
  archive: Uint8Array
) {
  const selected = yield* readPublication(directory, reference, archive);
  const verifier = yield* openCacheProducerVerifier(directory);
  const [binding, runtime] = yield* loadCacheProducerStorageRuntime(directory);
  if (!sameBinding(binding, selected.binding)) return yield* objectFailure("payload-rejected");
  const bytes = yield* exchangeObject(
    runtime,
    objectKey(runtime, selected.report),
    "GET",
    200,
    O.none(),
    cacheProducerObservationMaxBytes - 1
  );
  if ((yield* digest(bytes)) !== selected.report.observationSha256) return yield* objectFailure("payload-rejected");
  const decodedObservation = yield* decodeObservation(bytes);
  const [observation, canonical] = yield* snapshotObservation(decodedObservation);
  if ((yield* digest(canonical)) !== selected.report.observationSha256) return yield* objectFailure("payload-rejected");
  yield* verifier.verify(observation.envelope, observation.observation);
  yield* verifyCacheHostedProducerObservation(selected.approval, selected.reference, selected.archive, observation);
  yield* assertPublicationUnchanged(directory, selected.binding, selected.profile, selected.approval);
  return observation;
}, CacheCommandError.mapError("Cannot download and authenticate the private producer observation."));

/**
 * Delete only the exact private observation selected by an authenticated publication.
 *
 * **Details**
 * Requires the existing independently approved writer profile. Cache artifacts
 * use another prefix and cannot be selected. One DELETE is attempted; retention
 * and cleanup decisions remain with the bounded trial supervisor.
 *
 * **Example** (Plan exact-object cleanup)
 * ```ts
 * import { removeCacheProducerPrivateObservation, type CacheHostedProducerReference } from "@beep/repo-cli/test/Cache"
 * const remove = (reference: CacheHostedProducerReference, archive: Uint8Array) =>
 *   removeCacheProducerPrivateObservation("/private/cache/producer", reference, archive)
 * console.assert(typeof remove === "function")
 * ```
 *
 * @internal
 * @category commands
 * @since 0.0.0
 */
export const removeCacheProducerPrivateObservation = Effect.fn("CacheObject.remove")(function* (
  directory: string,
  reference: CacheHostedProducerReference,
  archive: Uint8Array
) {
  const selected = yield* readPublication(directory, reference, archive);
  const [binding, runtime] = yield* loadCacheProducerStorageRuntime(directory);
  if (!sameBinding(binding, selected.binding)) return yield* objectFailure("payload-rejected", "DELETE");
  yield* exchangeObject(runtime, objectKey(runtime, selected.report), "DELETE", 204, O.none(), 0);
  yield* assertPublicationUnchanged(directory, selected.binding, selected.profile, selected.approval);
}, CacheCommandError.mapError("Cannot remove the exact private producer observation."));
