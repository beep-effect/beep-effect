/**
 * Private, provision-only configuration for one fixed native controller pilot.
 * No credential reads, service changes, enrollment, provider invocation or resume.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { EvidenceRetentionPolicy } from "@beep/repo-ai-metrics/evidence-retention";
import { NativeSchedulePolicy } from "@beep/repo-ai-metrics/native-schedule";
import { ObservationControlPolicy } from "@beep/repo-ai-metrics/observation-control";
import { readBoundedMetadata } from "@beep/repo-ai-metrics/observation-file";
import { ObservationHost, ObservationRoot } from "@beep/repo-ai-metrics/observation-inventory";
import { ObservationLaunchConfig } from "@beep/repo-ai-metrics/observation-launch";
import { ObservationLaunchHttpPolicy } from "@beep/repo-ai-metrics/observation-launch-http";
import { ObservationRootProbeResult, ObservationRootReceipt } from "@beep/repo-ai-metrics/observation-root-probe";
import { ObservationRuntimePolicy } from "@beep/repo-ai-metrics/observation-runtime";
import { PayloadRetentionPolicy } from "@beep/repo-ai-metrics/payload-reclamation";
import { hashPublicTextSha256 } from "@beep/repo-ai-metrics/privacy";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  ObservationDeploymentPlan,
  ObservationDeploymentRequest,
  renderObservationDeployment,
} from "../../../packages/tooling/tool/cli/src/commands/AIMetrics/internal/ObservationDeployment.ts";

const $I = $RepoCliId.create("goals/harness-telemetry-enrollment/ops/native-canary-config");
const PrivatePath = S.String.check(S.isPattern(/^\/[A-Za-z0-9_./-]+$/), S.isMaxLength(240)).pipe(
  $I.annoteSchema("NativeCanaryPrivatePath", {
    description: "Canonical ASCII absolute private path, checked before use.",
  })
);
const TailnetOrigin = S.String.check(S.isPattern(/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.ts\.net:8447$/)).pipe(
  $I.annoteSchema("NativeCanaryTailnetOrigin", {
    description: "HTTPS tailnet origin; exact admission comes from a separately pinned private allowlist.",
  })
);
const DestinationAllowlist = S.Struct({
  version: S.tag("native-canary-destination/v1"),
  backendOrigin: TailnetOrigin,
}).pipe(
  $I.annoteSchema("NativeCanaryDestinationAllowlist", {
    description: "One administrator-qualified destination, with no credentials or headers.",
  })
);

/**
 * Explicit metadata-only inputs; salt credential bytes are never read.
 * **Example** (Inspect the builder request)
 * ```ts
 * console.log(typeof NativeCanaryConfigRequest.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NativeCanaryConfigRequest extends S.Opaque<NativeCanaryConfigRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("native-canary-config-request/v1"),
    harness: S.Literals(["codex-cli", "claude-code", "grok", "muse"]).pipe(
      S.withConstructorDefault(Effect.succeed("codex-cli" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("codex-cli" as const))
    ),
    rootProbeFile: PrivatePath,
    rootProbeSha256: Sha256Hex,
    rootId: ObservationRoot.fields.rootId,
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    destinationAllowlistFile: PrivatePath,
    destinationAllowlistSha256: Sha256Hex,
    backendOrigin: TailnetOrigin,
    pilotToken: S.String.check(S.isPattern(/^[0-9a-f]{16}$/)),
    outputDirectory: PrivatePath,
    saltCredentialFile: PrivatePath,
    bunPath: PrivatePath,
    intakePort: S.Int.check(S.isBetween({ minimum: 1024, maximum: 65535 })),
    exportPort: S.Int.check(S.isBetween({ minimum: 1024, maximum: 65535 })),
  }).pipe(
    $I.annoteSchema("NativeCanaryConfigRequest", {
      description: "Pinned root and destination metadata, private output and an unread raw LoadCredential source.",
    })
  )
) {}

/**
 * Content-free configuration refusal; partial files remain for owner inspection.
 * **Example** (Inspect the error model)
 * ```ts
 * console.log(typeof NativeCanaryConfigError.make)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class NativeCanaryConfigError extends S.TaggedError<NativeCanaryConfigError, { readonly brand: unique symbol }>(
  $I`NativeCanaryConfigError`
)(
  "NativeCanaryConfigError",
  { reason: S.Literals(["input", "path", "pin", "root", "destination", "output"]) },
  $I.annote("NativeCanaryConfigError", { description: "Fixed refusal without private path, body or underlying cause." })
) {}
const fail = (reason: NativeCanaryConfigError["reason"]) => NativeCanaryConfigError.make({ reason });

/**
 * Private resulting paths and declared identities, never launch/backend proof.
 * **Example** (Inspect the generation receipt)
 * ```ts
 * console.log(typeof NativeCanaryConfigReceipt.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NativeCanaryConfigReceipt extends S.Opaque<NativeCanaryConfigReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("native-canary-config-receipt/v1"),
    root: ObservationRoot,
    host: ObservationHost,
    ingressRouteId: Sha256Hex,
    launchRouteId: Sha256Hex,
    stateDirectory: PrivatePath,
    artifactDirectory: PrivatePath,
    socketPath: PrivatePath,
    workerConfigFile: PrivatePath,
    credentialNamespace: S.tag("worker-startup-verification-required"),
    installed: S.tag(false),
    resumed: S.tag(false),
  }).pipe(
    $I.annoteSchema("NativeCanaryConfigReceipt", {
      description: "Provisioned configuration only; actual salt namespace must still be verified by worker startup.",
    })
  )
) {}

const requirePrivate = Effect.fn("NativeCanaryConfig.requirePrivate")(function* (filename: string, directory: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const info = yield* fs.lstat(filename);
  if (
    !path.isAbsolute(filename) ||
    path.normalize(filename) !== filename ||
    (yield* fs.realPath(filename)) !== filename ||
    info.type !== (directory ? "Directory" : "File") ||
    (info.mode & 0o777) !== (directory ? 0o700 : 0o600) ||
    !O.contains(process.geteuid?.() ?? -1)(info.uid)
  )
    return yield* fail("path");
  return info;
});
const readPrivate = Effect.fn("NativeCanaryConfig.readPrivate")(function* (filename: string, limit: number) {
  yield* requirePrivate(filename, false);
  return yield* readBoundedMetadata(filename, limit, {
    readFailed: fail("input"),
    oversize: fail("input"),
    encodingFailed: fail("input"),
  });
});

/**
 * Generate a new paused, bounded Codex-only policy and rendered plan, never install it.
 * **Details**
 * Source-root and destination pins are explicit caller admission. The credential
 * file is checked by metadata only; systemd and the worker own its later read and
 * namespace verification. No claims store, header bag or arbitrary resource fields
 * are accepted. Existing scheduler and EventState behavior are unchanged.
 * **Example** (Inspect the generation program)
 * ```ts
 * console.log(typeof generateNativeCanaryConfig)
 * ```
 * @param input - Explicit pinned metadata and new private state output.
 * @returns Private configuration receipt with separate ingress and launch IDs.
 * @category programs
 * @since 0.0.0
 */
export const generateNativeCanaryConfig = Effect.fn("NativeCanaryConfig.generate")(
  function* (input: NativeCanaryConfigRequest) {
    const request = yield* S.decodeEffect(NativeCanaryConfigRequest, { onExcessProperty: "error" })(input);
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const home = yield* Config.String("HOME");
    const stateRoot = path.join(home, ".local/state/beep");
    const parent = yield* fs.lstat(stateRoot);
    if (
      parent.type !== "Directory" ||
      (parent.mode & 0o022) !== 0 ||
      !O.contains(process.geteuid?.() ?? -1)(parent.uid) ||
      (yield* fs.realPath(stateRoot)) !== stateRoot
    )
      return yield* fail("path");
    if (
      request.outputDirectory !== path.join(stateRoot, `nc-${request.pilotToken}`) ||
      (yield* fs.exists(request.outputDirectory)) ||
      request.intakePort === request.exportPort
    )
      return yield* fail("output");
    const stateDirectory = path.join(request.outputDirectory, "s");
    const artifactDirectory = path.join(request.outputDirectory, "a");
    if (Str.length(stateDirectory) > 80 || Str.length(path.join(stateDirectory, "worker.sock")) > 100)
      return yield* fail("path");
    const credential = yield* requirePrivate(request.saltCredentialFile, false);
    if (Str.endsWith(".env")(request.saltCredentialFile) || credential.size < 1n || credential.size > 4096n)
      return yield* fail("path");
    const executable = yield* fs.lstat(request.bunPath);
    if (
      executable.type !== "File" ||
      (executable.mode & 0o111) === 0 ||
      (executable.mode & 0o022) !== 0 ||
      !(O.contains(0)(executable.uid) || O.contains(process.geteuid?.() ?? -1)(executable.uid)) ||
      (yield* fs.realPath(request.bunPath)) !== request.bunPath
    )
      return yield* fail("path");
    const probeBody = yield* readPrivate(request.rootProbeFile, 262144);
    const allowlistBody = yield* readPrivate(request.destinationAllowlistFile, 4096);
    if (
      (yield* hashPublicTextSha256(probeBody)) !== request.rootProbeSha256 ||
      (yield* hashPublicTextSha256(allowlistBody)) !== request.destinationAllowlistSha256
    )
      return yield* fail("pin");
    const allowlist = yield* S.decodeEffect(S.fromJsonString(DestinationAllowlist), { onExcessProperty: "error" })(
      allowlistBody
    );
    if (allowlist.backendOrigin !== request.backendOrigin) return yield* fail("destination");
    const probe = yield* S.decodeEffect(S.fromJsonString(ObservationRootProbeResult))(probeBody);
    const host = A.head(probe.inventory.hosts);
    const root = A.findFirst(probe.inventory.roots, (candidate) => candidate.rootId === request.rootId);
    if (
      probe.inventory.hosts.length !== 1 ||
      O.isNone(host) ||
      O.isNone(root) ||
      root.value.availability !== "present" ||
      host.value.hostId !== request.hostId ||
      host.value.identityNamespaceId !== request.namespaceId ||
      root.value.hostId !== request.hostId ||
      root.value.repositoryId._tag !== "Verified" ||
      root.value.cloneId._tag !== "Verified" ||
      root.value.worktreeId._tag !== "Verified"
    )
      return yield* fail("root");
    const receiptEvidence = A.findFirst(
      probe.rootReceipts,
      (candidate) => candidate.evidenceId === root.value.evidenceId
    );
    if (O.isNone(receiptEvidence)) return yield* fail("root");
    const observation = receiptEvidence.value.observation;
    const observationBody = yield* S.encodeEffect(S.fromJsonString(ObservationRootReceipt.fields.observation))(
      observation
    );
    if (
      (yield* hashPublicTextSha256(observationBody)) !== root.value.evidenceId ||
      observation.rootId !== request.rootId ||
      observation.host.hostId !== request.hostId ||
      observation.host.identityNamespaceId !== request.namespaceId ||
      observation.availability !== "present" ||
      observation.declaredState !== "inspect" ||
      observation.git._tag !== "Observed" ||
      observation.git.hashSaltNamespaceId !== request.namespaceId ||
      observation.git.repositoryIdHash !== root.value.repositoryId.id ||
      observation.git.owningCloneIdHash !== root.value.cloneId.id ||
      observation.git.worktreeIdHash !== root.value.worktreeId.id
    )
      return yield* fail("root");
    const ingressRouteId = yield* hashPublicTextSha256(`native-canary/v1:${request.pilotToken}:ingress`);
    const launchRouteId = yield* hashPublicTextSha256(
      `native-canary/v1:${request.pilotToken}:launch:${request.harness}`
    );
    const config = ObservationLaunchConfig.make({
      intake: TranscriptIntakeConfig.make({
        hostId: request.hostId,
        namespaceId: request.namespaceId,
        maxPages: 64,
        maxPayloadBytes: 1048576,
        maxDatabasePages: 1024,
      }),
      route: {
        routeId: ingressRouteId,
        producer: O.some("managed-controller"),
        approvedModels: [],
        usageConvention: "unknown",
        syntheticFixtureMetadata: O.none(),
        bodyTimeoutMillis: 1000,
      },
      destination: {
        endpoint: `http://127.0.0.1:${request.exportPort}/v1/traces`,
        backendOrigin: request.backendOrigin,
        project: `native-canary-${request.pilotToken}`,
        timeoutMillis: 5000,
      },
      ledger: { maxEvents: 64, maxAttempts: 128, maxAttemptsPerEvent: 4 },
      scheduling: NativeSchedulePolicy.make({
        maxEvents: 4,
        retryDelayMillis: 1000,
        maxRetryDelayMillis: 10000,
        reconcileDelayMillis: 1000,
        tickTimeoutMillis: 5000,
      }),
      launchHttp: O.some(
        ObservationLaunchHttpPolicy.make({
          routes: [{ routeId: launchRouteId, harness: request.harness, surface: "cli" }],
          bodyTimeoutMillis: 1000,
        })
      ),
      runtime: ObservationRuntimePolicy.make({
        intervalMillis: 1000,
        cycleTimeoutMillis: 10000,
        staleAfterMillis: 15000,
      }),
      discovery: O.none(),
      control: ObservationControlPolicy.make({ maxActive: 4, drainTimeoutMillis: 5000 }),
      payloadRetention: PayloadRetentionPolicy.make({
        minAgeMillis: 86400000,
        minAttemptQuietMillis: 86400000,
        maxDispositions: 64,
      }),
      evidenceRetention: EvidenceRetentionPolicy.make({
        minEpochMillis: 86400000,
        minAttemptQuietMillis: 86400000,
        maxRecords: 256,
        deadlineMillis: 10000,
      }),
    });
    const deployment = ObservationDeploymentRequest.make({
      unitBase: `beep-observation-native-${request.pilotToken}`,
      stateDirectory,
      artifactDirectory,
      bunPath: request.bunPath,
      hashSaltFile: request.saltCredentialFile,
      intakePort: request.intakePort,
      runtimeMaxSeconds: 900,
      journalMaxDatabasePages: 1024,
    });
    const plan = yield* renderObservationDeployment(deployment);
    const receipt = NativeCanaryConfigReceipt.make({
      root: root.value,
      host: host.value,
      ingressRouteId,
      launchRouteId,
      stateDirectory,
      artifactDirectory,
      socketPath: path.join(stateDirectory, "worker.sock"),
      workerConfigFile: path.join(stateDirectory, "worker.json"),
    });
    const outputs = [
      [receipt.workerConfigFile, yield* S.encodeEffect(S.fromJsonString(ObservationLaunchConfig))(config)],
      [
        path.join(artifactDirectory, "deployment-request.json"),
        yield* S.encodeEffect(S.fromJsonString(ObservationDeploymentRequest))(deployment),
      ],
      [
        path.join(artifactDirectory, "deployment-plan.json"),
        yield* S.encodeEffect(S.fromJsonString(ObservationDeploymentPlan))(plan),
      ],
      [
        path.join(request.outputDirectory, "receipt.json"),
        yield* S.encodeEffect(S.fromJsonString(NativeCanaryConfigReceipt))(receipt),
      ],
    ];
    yield* fs.makeDirectory(request.outputDirectory, { mode: 0o700 });
    for (const directory of [stateDirectory, artifactDirectory]) yield* fs.makeDirectory(directory, { mode: 0o700 });
    for (const row of outputs) {
      const filename = row[0];
      const body = row[1];
      if (filename === undefined || body === undefined) return yield* fail("output");
      yield* fs.writeFileString(filename, `${body}\n`, { flag: "wx", mode: 0o600 });
    }
    return receipt;
  },
  Effect.mapError((error) => (S.is(NativeCanaryConfigError)(error) ? error : fail("input")))
);

if (import.meta.main)
  NodeRuntime.runMain(
    Effect.gen(function* () {
      const [filename] = yield* S.decodeUnknownEffect(S.Tuple([PrivatePath]))(A.drop(process.argv, 2));
      const body = yield* readPrivate(filename, 65536);
      const request = yield* S.decodeEffect(S.fromJsonString(NativeCanaryConfigRequest), { onExcessProperty: "error" })(
        body
      );
      yield* generateNativeCanaryConfig(request);
      yield* Console.log("Private paused native canary configuration generated; no installation or launch performed.");
    }).pipe(
      Effect.provide(Layer.merge(NodeServices.layer, NodeCrypto.layer)),
      Effect.catchCause(() => Effect.fail(fail("input")))
    ),
    { disableErrorReporting: true }
  );
