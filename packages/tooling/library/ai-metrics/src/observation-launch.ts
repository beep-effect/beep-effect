/**
 * Explicit private launch configuration for the owned observation process.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { PhoenixConfigInput } from "@beep/phoenix";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { DeliveryLedgerConfig } from "./delivery-ledger.ts";
import { EvidenceRetentionPolicy } from "./evidence-retention.ts";
import { NativeDeliveryPolicy, nativeDeliveryTargetId } from "./native-delivery.ts";
import { NativeHttpPolicy } from "./native-http.ts";
import { NativeSchedulePolicy } from "./native-schedule.ts";
import { ObservationControlPolicy } from "./observation-control.ts";
import { isPrivateObservationFile, readBoundedMetadata } from "./observation-file.ts";
import { ObservationLaunchHttpPolicy } from "./observation-launch-http.ts";
import { ObservationRuntimePolicy } from "./observation-runtime.ts";
import { ObservationWorkerConfig } from "./observation-worker.ts";
import { PayloadRetentionPolicy } from "./payload-reclamation.ts";
import {
  AI_METRICS_LOCAL_INSECURE_HASH_SALT,
  hashPrivateIdentifier,
  resolveAiMetricsHashSaltStatus,
} from "./privacy.ts";
import { TranscriptDiscoveryInput, TranscriptDiscoveryReadPolicy } from "./transcript-discovery.ts";
import { TranscriptIntakeConfig } from "./transcript-intake.ts";

const $I = $RepoAiMetricsId.create("observation-launch");
/**
 * Versioned private configuration without embedded secrets or inferred routing.
 * **Example** (Inspecting the launch schema)
 * ```ts
 * import { ObservationLaunchConfig } from "@beep/repo-ai-metrics/observation-launch"
 * console.log(typeof ObservationLaunchConfig.make)
 * ```
 * **Details** Read only from a private owned directory. Salt and optional Phoenix query credentials come from the configured secret environment. Endpoints remain private metadata. Every startup remains paused; this schema contains no auto-resume switch. Optional discovery declares exact private roots and bounded reading/cadence; omitted discovery stays unconfigured. At least two worker admission slots are required when both loops are configured. The target digest is derived from the validated export/query policy, while the declared salt namespace is checked before opening the worker.
 * @category models
 * @since 0.0.0
 */
export class ObservationLaunchConfig extends S.Opaque<ObservationLaunchConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("observation-launch/v1"),
    intake: TranscriptIntakeConfig,
    route: S.Struct({
      routeId: NativeHttpPolicy.fields.routeId,
      approvedModels: NativeHttpPolicy.fields.approvedModels,
      usageConvention: NativeHttpPolicy.fields.usageConvention,
      syntheticFixtureMetadata: NativeHttpPolicy.fields.syntheticFixtureMetadata,
      bodyTimeoutMillis: NativeHttpPolicy.fields.bodyTimeoutMillis,
    }),
    destination: S.Struct({
      endpoint: S.String.check(S.isMaxLength(2048)),
      backendOrigin: S.String.check(S.isMaxLength(2048)),
      project: NativeDeliveryPolicy.fields.project,
      timeoutMillis: NativeDeliveryPolicy.fields.timeoutMillis,
    }),
    ledger: S.Struct({
      maxEvents: DeliveryLedgerConfig.fields.maxEvents,
      maxAttempts: DeliveryLedgerConfig.fields.maxAttempts,
      maxAttemptsPerEvent: DeliveryLedgerConfig.fields.maxAttemptsPerEvent,
    }),
    scheduling: NativeSchedulePolicy,
    launchHttp: S.OptionFromOptionalKey(ObservationLaunchHttpPolicy).pipe(S.withConstructorDefault(Effect.succeedNone)),
    runtime: ObservationRuntimePolicy,
    discovery: S.OptionFromOptionalKey(
      S.Struct({
        roots: TranscriptDiscoveryInput.fields.roots,
        maxDepth: TranscriptDiscoveryInput.fields.maxDepth,
        maxEntries: TranscriptDiscoveryInput.fields.maxEntries,
        maxFiles: TranscriptDiscoveryInput.fields.maxFiles,
        maxCycleEntries: TranscriptDiscoveryInput.fields.maxCycleEntries,
        read: TranscriptDiscoveryReadPolicy,
        runtime: ObservationRuntimePolicy,
      })
    ),
    control: ObservationControlPolicy,
    payloadRetention: PayloadRetentionPolicy,
    evidenceRetention: EvidenceRetentionPolicy,
  })
    .check(
      S.makeFilter((config) => O.isNone(config.discovery) || config.control.maxActive >= 2, {
        identifier: "ObservationLaunchAdmission",
        title: "Independent source and native admission",
        description: "Configured discovery requires at least two concurrent admission slots.",
        message: "Discovery and native delivery require at least two admission slots",
      })
    )
    .pipe(
      $I.annoteSchema("ObservationLaunchConfig", {
        description: "Explicit versioned private observation launch settings.",
      })
    )
) {}
/**
 * Content-free launch configuration refusal.
 * **Example** (Inspecting a launch error)
 * ```ts
 * import { ObservationLaunchError } from "@beep/repo-ai-metrics/observation-launch"
 * console.log(ObservationLaunchError.make({reason:"configuration"}).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ObservationLaunchError extends S.TaggedError<ObservationLaunchError, { readonly brand: unique symbol }>(
  $I`ObservationLaunchError`
)(
  "ObservationLaunchError",
  { reason: S.Literals(["directory", "configuration", "namespace"]) },
  $I.annote("ObservationLaunchError", { description: "Safe configuration boundary refusal without private details." })
) {}
const failure = (reason: ObservationLaunchError["reason"]) => ObservationLaunchError.make({ reason });
const decodeObservationLaunchConfigJson = S.decodeEffect(S.fromJsonString(ObservationLaunchConfig));

/**
 * Verify and read a bounded private launch file from a pre-created state directory.
 * **Example** (Inspecting the configuration reader)
 * ```ts
 * import { readObservationLaunchConfig } from "@beep/repo-ai-metrics/observation-launch"
 * console.log(typeof readObservationLaunchConfig)
 * ```
 * **Details** Requires canonical absolute ASCII directory paths at most 80 bytes, an owned 0700 directory and an owned regular 0600 worker.json without symlinks. Reads at most 64 KiB before schema decoding. The process boundary supplies its actual effective UID. This is not a lock or permission to mutate the directory; ownership/resource qualification must precede database/listener startup. Errors never contain the path or file contents.
 * @category services
 * @since 0.0.0
 */
export const readObservationLaunchConfig = Effect.fn("AiMetrics.readObservationLaunchConfig")(function* (
  directory: string,
  uid: number
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (
    !path.isAbsolute(directory) ||
    path.normalize(directory) !== directory ||
    !/^\/[A-Za-z0-9_./-]{1,79}$/.test(directory)
  )
    return yield* failure("directory");
  yield* Effect.gen(function* () {
    const info = yield* fs.lstat(directory);
    if (
      info.type !== "Directory" ||
      (info.mode & 0o777) !== 0o700 ||
      O.isNone(info.uid) ||
      info.uid.value !== uid ||
      (yield* fs.realPath(directory)) !== directory
    )
      return yield* failure("directory");
  }).pipe(Effect.mapError(() => failure("directory")));
  const file = path.join(directory, "worker.json");
  const body = yield* Effect.gen(function* () {
    const info = yield* fs.lstat(file);
    if (!isPrivateObservationFile(info, uid) || (yield* fs.realPath(file)) !== file)
      return yield* failure("configuration");
    return yield* readBoundedMetadata(file, 65536, {
      readFailed: failure("configuration"),
      oversize: failure("configuration"),
      encodingFailed: failure("configuration"),
    });
  }).pipe(Effect.mapError(() => failure("configuration")));
  return yield* decodeObservationLaunchConfigJson(body).pipe(Effect.mapError(() => failure("configuration")));
});
/**
 * Bind launch declarations to redacted environment secrets and exact target identity.
 * **Example** (Inspecting configuration composition)
 * ```ts
 * import { observationWorkerConfigFromLaunch } from "@beep/repo-ai-metrics/observation-launch"
 * console.log(typeof observationWorkerConfigFromLaunch)
 * ```
 * **Details** The supplied salt must match the explicit intake namespace. Export and query origins are validated before target derivation; no network request is made. API credentials apply only to Phoenix read-back, never to an unowned export endpoint. The result is private configuration and must not be published as health or telemetry.
 * @category services
 * @since 0.0.0
 */
export const observationWorkerConfigFromLaunch = Effect.fn("AiMetrics.observationWorkerConfigFromLaunch")(function* (
  config: ObservationLaunchConfig,
  salt: Redacted.Redacted<string>,
  apiKey: O.Option<Redacted.Redacted<string>>
) {
  const hashSalt = salt.pipe(Redacted.value, O.some);
  if (
    resolveAiMetricsHashSaltStatus(hashSalt) !== "provided" ||
    Redacted.value(salt) === AI_METRICS_LOCAL_INSECURE_HASH_SALT
  )
    return yield* failure("namespace");
  const namespace = yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", hashSalt);
  if (namespace !== config.intake.namespaceId) return yield* failure("namespace");
  const delivery = NativeDeliveryPolicy.make({
    endpoint: Redacted.make(config.destination.endpoint),
    readbackOrigin: O.some(Redacted.make(config.destination.backendOrigin)),
    project: config.destination.project,
    timeoutMillis: config.destination.timeoutMillis,
  });
  const targetId = yield* nativeDeliveryTargetId(delivery).pipe(Effect.mapError(() => failure("configuration")));
  return ObservationWorkerConfig.make({
    intake: config.intake,
    nativeHttp: NativeHttpPolicy.make({ ...config.route, hashSalt: salt }),
    launchHttp: config.launchHttp,
    delivery,
    ledger: DeliveryLedgerConfig.make({ ...config.ledger, targetId }),
    backend: PhoenixConfigInput.make({ baseUrl: config.destination.backendOrigin, apiKey }),
    payloadRetention: config.payloadRetention,
    evidenceRetention: config.evidenceRetention,
    control: config.control,
    scheduling: config.scheduling,
  });
});
