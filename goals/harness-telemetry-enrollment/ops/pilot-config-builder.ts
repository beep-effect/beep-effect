/**
 * Provision-only pilot configuration builder using the actual worker schemas and renderer.
 * Creates three new private files in pre-created owned directories; never installs
 * or starts a unit, container, collector, or provider.
 *
 * Usage: bun goals/harness-telemetry-enrollment/ops/pilot-config-builder.ts [--owners] <private-input.json>
 * @packageDocumentation
 */

import { ManagedLaunchProfile } from "@beep/ai-provider-cli";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { EvidenceRetentionPolicy } from "../../../packages/tooling/library/ai-metrics/src/evidence-retention.ts";
import { NativeSchedulePolicy } from "../../../packages/tooling/library/ai-metrics/src/native-schedule.ts";
import { ObservationControlPolicy } from "../../../packages/tooling/library/ai-metrics/src/observation-control.ts";
import { ObservationLaunchConfig } from "../../../packages/tooling/library/ai-metrics/src/observation-launch.ts";
import {
  ObservationClaimAnchor,
  ObservationClaimPolicy,
} from "../../../packages/tooling/library/ai-metrics/src/observation-launch-claims.ts";
import { ObservationLaunchClientPolicy } from "../../../packages/tooling/library/ai-metrics/src/observation-launch-client.ts";
import { ObservationLaunchIdentity } from "../../../packages/tooling/library/ai-metrics/src/observation-launch-facts.ts";
import {
  ObservationLaunchContext,
  ObservationLaunchHttpPolicy,
} from "../../../packages/tooling/library/ai-metrics/src/observation-launch-http.ts";
import { ObservationRootProbeResult } from "../../../packages/tooling/library/ai-metrics/src/observation-root-probe.ts";
import { ObservationRuntimePolicy } from "../../../packages/tooling/library/ai-metrics/src/observation-runtime.ts";
import { PayloadRetentionPolicy } from "../../../packages/tooling/library/ai-metrics/src/payload-reclamation.ts";
import { hashPublicTextSha256 } from "../../../packages/tooling/library/ai-metrics/src/privacy.ts";
import { TranscriptIntakeConfig } from "../../../packages/tooling/library/ai-metrics/src/transcript-intake.ts";
import {
  AgentObservationOwner,
  AgentObservationProvisioning,
  AgentObservationRequest,
} from "../../../packages/tooling/tool/cli/src/commands/AgentMessage/AgentMessage.observation.ts";
import {
  ObservationDeploymentPlan,
  ObservationDeploymentRequest,
  renderObservationDeployment,
} from "../../../packages/tooling/tool/cli/src/commands/AIMetrics/internal/ObservationDeployment.ts";

const Input = S.Struct({
  rootProbeFile: S.String,
  rootProbeSha256: S.String.check(S.isPattern(/^[0-9a-f]{64}$/)),
  pilotToken: S.String.check(S.isPattern(/^[0-9a-f]{16}$/)),
  stateDirectory: S.String,
  artifactDirectory: S.String,
  hashSaltFile: S.String,
  bunPath: S.String,
  intakePort: S.Int,
  collectorTraceEndpoint: S.String,
  backendOrigin: S.String,
  project: S.String,
});
const workerProgram = Effect.fn("PilotBuilder.worker")(function* (requestFile: string) {
  const fs = yield* FileSystem.FileSystem;
  const request = yield* S.decodeEffect(S.fromJsonString(Input), { onExcessProperty: "error" })(
    yield* fs.readFileString(requestFile)
  );
  const probeBytes = yield* fs.readFileString(request.rootProbeFile);
  if ((yield* hashPublicTextSha256(probeBytes)) !== request.rootProbeSha256)
    return yield* Effect.die("Real-root probe pin mismatch");
  const probe = yield* S.decodeEffect(S.fromJsonString(ObservationRootProbeResult))(probeBytes);
  const host = probe.inventory.hosts[0];
  if (
    !host ||
    probe.inventory.hosts.length !== 1 ||
    probe.inventory.roots.length !== 2 ||
    probe.inventory.roots.some(
      (root) =>
        root.availability !== "present" ||
        root.repositoryId._tag !== "Verified" ||
        root.cloneId._tag !== "Verified" ||
        root.worktreeId._tag !== "Verified"
    )
  )
    return yield* Effect.die("Unqualified real-root probe");
  if (request.stateDirectory.length > 80) return yield* Effect.die("Private worker/socket directory too long");
  for (const directory of [request.stateDirectory, request.artifactDirectory]) {
    const info = yield* fs.lstat(directory);
    if (
      info.type !== "Directory" ||
      (info.mode & 0o777) !== 0o700 ||
      !O.contains(info.uid, process.geteuid?.() ?? -1) ||
      (yield* fs.realPath(directory)) !== directory
    )
      return yield* Effect.die("Pre-create owned canonical private directories");
  }
  const nativeRouteId = yield* hashPublicTextSha256(`harness-pilot/v1:${request.pilotToken}:native`);
  const launchRoutes = yield* Effect.forEach(["grok", "claude-code", "codex-cli", "cursor-agent"], (harness) =>
    Effect.gen(function* () {
      return {
        routeId: yield* hashPublicTextSha256(`harness-pilot/v1:${request.pilotToken}:launch:${harness}`),
        harness,
        surface: "cli",
      };
    })
  );
  // Decode the exact route boundary so no cast, inferred attribution or invented
  // synthetic root can enter the source-owned policy constructor.
  const launchHttp = yield* S.decodeUnknownEffect(ObservationLaunchHttpPolicy)({
    routes: launchRoutes,
    bodyTimeoutMillis: 1000,
  });
  const config = ObservationLaunchConfig.make({
    intake: TranscriptIntakeConfig.make({
      hostId: host.hostId,
      namespaceId: host.identityNamespaceId,
      maxPages: 64,
      maxPayloadBytes: 1048576,
      maxDatabasePages: 1024,
    }),
    route: {
      routeId: nativeRouteId,
      approvedModels: [],
      usageConvention: "unknown",
      producer: O.some("managed-controller"),
      bodyTimeoutMillis: 1000,
    },
    destination: {
      endpoint: request.collectorTraceEndpoint,
      backendOrigin: request.backendOrigin,
      project: request.project,
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
    launchHttp: O.some(launchHttp),
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
    unitBase: `beep-observation-pilot-${request.pilotToken}`,
    stateDirectory: request.stateDirectory,
    artifactDirectory: request.artifactDirectory,
    bunPath: request.bunPath,
    hashSaltFile: request.hashSaltFile,
    intakePort: request.intakePort,
    runtimeMaxSeconds: 900,
    journalMaxDatabasePages: 1024,
  });
  const plan = yield* renderObservationDeployment(deployment);
  const outputs: ReadonlyArray<readonly [string, string]> = [
    [`${request.stateDirectory}/worker.json`, yield* S.encodeEffect(S.fromJsonString(ObservationLaunchConfig))(config)],
    [
      `${request.artifactDirectory}/deployment-request.json`,
      yield* S.encodeEffect(S.fromJsonString(ObservationDeploymentRequest))(deployment),
    ],
    [
      `${request.artifactDirectory}/deployment-plan.json`,
      yield* S.encodeEffect(S.fromJsonString(ObservationDeploymentPlan))(plan),
    ],
  ];
  for (const [filename] of outputs)
    if (yield* fs.exists(filename)) return yield* Effect.die("Refuse existing pilot artifact");
  for (const [filename, body] of outputs) yield* fs.writeFileString(filename, `${body}\n`, { flag: "wx", mode: 0o600 });
});

const OwnersInput = S.Struct({
  rootProbeFile: S.String,
  rootProbeSha256: S.String,
  declarationFile: S.String,
  declarationSha256: S.String,
  contextFile: S.String,
  contextSha256: S.String,
  rootIndex: S.Int.check(S.isBetween({ minimum: 0, maximum: 31 })),
  workerStateDirectory: S.String,
  claimsDirectory: S.String,
  outputDirectory: S.String,
  pilotToken: S.String.check(S.isPattern(/^[0-9a-f]{16}$/)),
  executables: S.Struct({ codex: S.String, grok: S.String, claude: S.String, cursor: S.String }),
});
const ownersProgram = Effect.fn("PilotBuilder.owners")(function* (requestFile: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const input = yield* S.decodeEffect(S.fromJsonString(OwnersInput), { onExcessProperty: "error" })(
    yield* fs.readFileString(requestFile)
  );
  const checkedRead = Effect.fnUntraced(function* (file: string, expected: string) {
    const body = yield* fs.readFileString(file);
    if ((yield* hashPublicTextSha256(body)) !== expected) return yield* Effect.die("Input pin mismatch");
    return body;
  });
  const probe = yield* S.decodeEffect(S.fromJsonString(ObservationRootProbeResult))(
    yield* checkedRead(input.rootProbeFile, input.rootProbeSha256)
  );
  const declaration = yield* S.decodeEffect(
    S.fromJsonString(S.Struct({ roots: S.Array(S.Struct({ path: S.String, state: S.String })) }))
  )(yield* checkedRead(input.declarationFile, input.declarationSha256));
  const context = yield* S.decodeEffect(S.fromJsonString(ObservationLaunchContext))(
    yield* checkedRead(input.contextFile, input.contextSha256)
  );
  const root = probe.inventory.roots[input.rootIndex];
  const declared = declaration.roots[input.rootIndex];
  const host = probe.inventory.hosts[0];
  if (
    !root ||
    !declared ||
    !host ||
    probe.inventory.hosts.length !== 1 ||
    !context.accepting ||
    context.hostId !== host.hostId ||
    context.namespaceId !== host.identityNamespaceId ||
    root.hostId !== host.hostId ||
    root.availability !== "present" ||
    declared.state !== "inspect" ||
    root.repositoryId._tag !== "Verified" ||
    root.cloneId._tag !== "Verified" ||
    root.worktreeId._tag !== "Verified" ||
    (yield* fs.realPath(declared.path)) !== declared.path
  )
    return yield* Effect.die("Actual admitted worker context and selected verified root required");
  const outInfo = yield* fs.lstat(input.outputDirectory);
  if (
    outInfo.type !== "Directory" ||
    (outInfo.mode & 0o777) !== 0o700 ||
    !O.contains(outInfo.uid, process.geteuid?.() ?? -1) ||
    (yield* fs.realPath(input.outputDirectory)) !== input.outputDirectory
  )
    return yield* Effect.die("Owned canonical output directory required");
  const directories = [input.outputDirectory, input.claimsDirectory, input.workerStateDirectory];
  for (const directory of directories) {
    if (!path.isAbsolute(directory) || path.normalize(directory) !== directory || directory === "/")
      return yield* Effect.die("Canonical absolute independent directories required");
    for (const other of directories)
      if (directory !== other && (directory.startsWith(`${other}/`) || other.startsWith(`${directory}/`)))
        return yield* Effect.die("Independent claims, worker and owner outputs must be disjoint");
  }
  if (A.dedupe(directories).length !== 3)
    return yield* Effect.die("Independent claims, worker and owner outputs must be distinct");
  const anchor = ObservationClaimAnchor.make({
    fenceId: yield* hashPublicTextSha256(`harness-pilot/v1:${input.pilotToken}:claims`),
    hostId: host.hostId,
    namespaceId: host.identityNamespaceId,
    maxClaims: 4,
  });
  const claims = ObservationClaimPolicy.make({
    directory: input.claimsDirectory,
    journalDirectory: input.workerStateDirectory,
    anchor,
  });
  const destination = ObservationLaunchClientPolicy.make({
    directory: input.workerStateDirectory,
    hostId: host.hostId,
    namespaceId: host.identityNamespaceId,
    timeoutMillis: 2000,
  });
  const providers = ["codex", "claude", "grok", "cursor"];
  for (const provider of providers)
    if (yield* fs.exists(`${input.outputDirectory}/${provider}`))
      return yield* Effect.die("Refuse existing owner output");
  for (const provider of providers) {
    const providerName = yield* S.decodeUnknownEffect(ManagedLaunchProfile.fields.provider)(provider);
    const harness =
      provider === "codex"
        ? "codex-cli"
        : provider === "claude"
          ? "claude-code"
          : provider === "cursor"
            ? "cursor-agent"
            : "grok";
    const routes = A.filter(context.routes, (route) => route.harness === harness && route.surface === "cli");
    const route = routes[0];
    if (routes.length !== 1 || !route) return yield* Effect.die("Exactly one matching admitted CLI route required");
    const base = `${input.outputDirectory}/${provider}`;
    const profileRoot = `${base}/home`;
    const executable = input.executables[providerName];
    if (!executable.startsWith("/")) return yield* Effect.die("Explicit absolute provider executable required");
    const profile = ManagedLaunchProfile.make({
      provider: providerName,
      executable,
      prefixArgs: [],
      workspace: declared.path,
      profileRoot,
      env: {
        HOME: profileRoot,
        PATH: "/usr/bin:/bin",
        ...(provider === "codex" ? { CODEX_HOME: `${profileRoot}/.codex` } : {}),
      },
      tools: [],
      sandboxWritablePaths: [],
    });
    const owner = AgentObservationOwner.make({
      endpointId: `pilot-${input.pilotToken}-${provider}`,
      ownerId: `pilot-owner-${input.pilotToken}-${provider}`,
      generation: 1,
      repositoryScope: root.repositoryId.id,
      workspace: declared.path,
      provider: providerName,
    });
    const identity = yield* S.decodeUnknownEffect(ObservationLaunchIdentity)({
      routeId: route.routeId,
      harness,
      surface: "cli",
      root: { _tag: "Verified", rootId: root.rootId, evidenceId: root.evidenceId },
      repository: root.repositoryId,
      clone: root.cloneId,
      worktree: root.worktreeId,
      task: { _tag: "Unknown" },
      attempt: { _tag: "Unknown" },
      evidenceId: root.evidenceId,
    });
    const provisioning = AgentObservationProvisioning.make({
      owner,
      claims,
      destination,
      evidenceEpoch: context.evidenceEpoch,
      identity,
    });
    const open = AgentObservationRequest.make({ profile, owner, enrollmentDirectory: O.some(`${base}/enrollment`) });
    yield* fs.makeDirectory(base, { mode: 0o700 });
    yield* fs.makeDirectory(profileRoot, { mode: 0o700 });
    const docs: ReadonlyArray<readonly [string, string]> = [
      ["profile.json", yield* S.encodeEffect(S.fromJsonString(ManagedLaunchProfile))(profile)],
      ["request.json", yield* S.encodeEffect(S.fromJsonString(AgentObservationProvisioning))(provisioning)],
      ["canary-request.json", yield* S.encodeEffect(S.fromJsonString(AgentObservationRequest))(open)],
    ];
    for (const [name, body] of docs)
      yield* fs.writeFileString(`${base}/${name}`, `${body}\n`, { flag: "wx", mode: 0o600 });
  }
});
const program = Effect.gen(function* () {
  const args = process.argv.slice(2);
  if (args.length === 2 && args[0] === "--owners") {
    const [, requestFile] = yield* S.decodeUnknownEffect(S.Tuple([S.Literal("--owners"), S.String]))(args);
    return yield* ownersProgram(requestFile);
  }
  const [requestFile] = yield* S.decodeUnknownEffect(S.Tuple([S.String]))(args);
  return yield* workerProgram(requestFile);
});
await Effect.runPromise(program.pipe(Effect.provide(Layer.merge(NodeServices.layer, NodeCrypto.layer))));
