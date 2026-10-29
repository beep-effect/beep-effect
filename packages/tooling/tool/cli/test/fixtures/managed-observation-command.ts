// Actual command composition with a synthetic protocol peer; no model requests.

import { AiProviderCliSession, ManagedLaunchProfile } from "@beep/ai-provider-cli";
import {
  ObservationClaimPopulationReport,
  ObservationClaimPopulationRequest,
} from "@beep/repo-ai-metrics/observation-claim-population";
import { ObservationInventory, ObservationRoute } from "@beep/repo-ai-metrics/observation-inventory";
import {
  makeObservationClaims,
  ObservationClaimAnchor,
  ObservationClaimError,
  ObservationClaimPolicy,
} from "@beep/repo-ai-metrics/observation-launch-claims";
import { ObservationLaunchClientPolicy } from "@beep/repo-ai-metrics/observation-launch-client";
import { ObservationLaunchFact, ObservationLaunchIdentity } from "@beep/repo-ai-metrics/observation-launch-facts";
import { ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { agentMessageCommand } from "@beep/repo-cli/commands/AgentMessage/AgentMessage.command";
import { LaunchGrant } from "@beep/repo-cli/commands/AgentMessage/AgentMessage.models";
import {
  AgentObservationEnrollment,
  AgentObservationError,
  AgentObservationOwner,
  AgentObservationProvisioned,
  AgentObservationProvisioning,
  AgentObservationRecovery,
} from "@beep/repo-cli/commands/AgentMessage/AgentMessage.observation";
import { Sha256Hex } from "@beep/schema";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const salt = "synthetic-launch-proof-salt";
const hash = (value: string) => hashPrivateIdentifier(value, O.some(salt));
const id = (digit: string) => Sha256Hex.make(Str.repeat(64)(digit));
const decodeArguments = S.decodeUnknownEffect(
  S.Tuple([S.String, Sha256Hex, Sha256Hex, S.String, S.String, S.Literals(["initialize", "recover", "hold"])])
);
const encodeAgentObservationOwnerJson = S.encodeEffect(S.fromJsonString(AgentObservationOwner));
const encodeAgentObservationProvisioningJson = S.encodeEffect(S.fromJsonString(AgentObservationProvisioning));
const decodeAgentObservationProvisionedJson = S.decodeEffect(S.fromJsonString(AgentObservationProvisioned));
const decodeAgentObservationEnrollmentJson = S.decodeEffect(S.fromJsonString(AgentObservationEnrollment));
const encodeManagedLaunchProfileJson = S.encodeEffect(S.fromJsonString(ManagedLaunchProfile));
const encodeLaunchGrantJson = S.encodeEffect(S.fromJsonString(LaunchGrant));
const encodeClaimIntegrityRefusalChildLaunchesRecordJson = S.encodeEffect(
  S.fromJsonString(S.Struct({ claimIntegrityRefusal: S.Boolean, childLaunches: S.Natural }))
);
const decodeAgentObservationRecoveryJson = S.decodeEffect(S.fromJsonString(AgentObservationRecovery));
const encodeObservationClaimPopulationRequestJson = S.encodeEffect(S.fromJsonString(ObservationClaimPopulationRequest));
const decodeObservationClaimPopulationReportJson = S.decodeEffect(S.fromJsonString(ObservationClaimPopulationReport));
const encodeReportPopulationRecordJson = S.encodeEffect(
  S.fromJsonString(
    S.Struct({
      report: AgentObservationRecovery,
      population: ObservationClaimPopulationReport,
      populationDisplay: S.String,
      childLaunches: S.Natural,
      childStopped: S.Boolean,
      relaunchRefused: S.Boolean,
      syntheticOnly: S.tag(true),
      explicitSetupCommands: S.Boolean,
    })
  )
);

const program = Effect.gen(function* () {
  const [directory, hostId, namespaceId, peer, root, mode] = yield* decodeArguments(A.drop(process.argv, 2));
  const fs = yield* FileSystem.FileSystem;
  const enrollmentDirectory = `${root}/enrollment`;
  const profile = ManagedLaunchProfile.make({
    provider: "codex",
    executable: process.execPath,
    prefixArgs: [peer],
    workspace: `${root}/workspace`,
    profileRoot: `${root}/home`,
    env: { HOME: `${root}/home`, CODEX_HOME: `${root}/home/.codex`, PATH: "/usr/bin:/bin" },
    authLane: "existing-subscription",
    tools: [],
  });
  const owner = AgentObservationOwner.make({
    endpointId: "command-proof-endpoint",
    ownerId: "command-proof-owner",
    generation: 1,
    repositoryScope: "command-proof-repository",
    workspace: profile.workspace,
    provider: "codex",
  });
  const ownerBinding = yield* hash(
    `agent-message-observation-owner/v1:${yield* encodeAgentObservationOwnerJson(owner)}`
  );
  const launchId = yield* hash(`agent-message-observation-attempt/v1:${ownerBinding}`);
  const policy = ObservationClaimPolicy.make({
    directory: `${root}/claims`,
    journalDirectory: directory,
    anchor: ObservationClaimAnchor.make({ fenceId: id("9"), hostId, namespaceId, maxClaims: 2 }),
  });
  const originalConsole = yield* Console.Console;
  if (mode === "initialize") {
    for (const name of ["workspace", "home", "request"]) yield* fs.makeDirectory(`${root}/${name}`, { mode: 0o700 });
    const enrollment = AgentObservationEnrollment.make({
      ownerBinding,
      claims: policy,
      destination: ObservationLaunchClientPolicy.make({ directory, hostId, namespaceId, timeoutMillis: 1000 }),
      submission: ObservationLaunchSubmission.make({
        hostId,
        namespaceId,
        evidenceEpoch: 0,
        fact: ObservationLaunchFact.cases.Prepared.make({
          launchId,
          identity: ObservationLaunchIdentity.make({
            routeId: id("c"),
            harness: "codex-cli",
            surface: "cli",
            root: { _tag: "Unknown" },
            repository: { _tag: "Unknown" },
            clone: { _tag: "Unknown" },
            worktree: { _tag: "Unknown" },
            task: { _tag: "Unknown" },
            attempt: { _tag: "Unknown" },
            evidenceId: id("8"),
          }),
        }),
      }),
    });
    if (enrollment.submission.fact._tag !== "Prepared") return yield* Effect.die("Expected prepared fixture");
    const request = AgentObservationProvisioning.make({
      owner,
      claims: policy,
      destination: enrollment.destination,
      evidenceEpoch: 0,
      identity: enrollment.submission.fact.identity,
    });
    yield* fs.writeFileString(`${root}/request/request.json`, yield* encodeAgentObservationProvisioningJson(request), {
      mode: 0o600,
    });
    for (const operation of ["initialize-claims", "enroll"]) {
      const output = yield* Deferred.make<string>();
      yield* Command.runWith(agentMessageCommand, { version: "proof", renderErrors: false })([
        "observation",
        operation,
        "--request-dir",
        `${root}/request`,
        ...(operation === "enroll" ? ["--observation-dir", enrollmentDirectory] : []),
      ]).pipe(
        Effect.provideService(
          Console.Console,
          Console.Console.of({
            ...originalConsole,
            log: (message) => {
              Deferred.doneUnsafe(output, Effect.succeed(message));
            },
          })
        )
      );
      const receipt = yield* decodeAgentObservationProvisionedJson(yield* Deferred.await(output));
      if (receipt.launchId !== launchId || receipt.operation !== operation || receipt.fenceId !== policy.anchor.fenceId)
        return yield* Effect.die("Setup receipt differs from expected binding");
    }
    const installed = yield* decodeAgentObservationEnrollmentJson(
      yield* fs.readFileString(`${enrollmentDirectory}/enrollment.json`)
    );
    if (!S.toEquivalence(AgentObservationEnrollment)(installed, enrollment))
      return yield* Effect.die("Installed enrollment differs from expected metadata");
    yield* fs.writeFileString(`${root}/profile.json`, yield* encodeManagedLaunchProfileJson(profile), { mode: 0o600 });
    // A deliberately stale, synthetic cold snapshot. Never install it as active claims.
    yield* fs.makeDirectory(`${root}/cold-claims-snapshot`, { mode: 0o700 });
    yield* fs.copyFile(`${policy.directory}/anchor.json`, `${root}/cold-claims-snapshot/anchor.json`);
  }
  // Refresh only this fixture's messaging grant. Observation enrollment and facts stay immutable.
  const grant = LaunchGrant.make({
    grantId: "command-proof-grant",
    endpointId: owner.endpointId,
    generation: owner.generation,
    ownerId: owner.ownerId,
    repositoryScope: owner.repositoryScope,
    conversationScope: O.none(),
    allowedRecipients: ["synthetic-peer"],
    expiresAt: (yield* Clock.currentTimeMillis) + 60000,
    maxMessages: 1,
  });
  yield* fs.writeFileString(`${root}/grant.json`, yield* encodeLaunchGrantJson(grant), {
    mode: 0o600,
  });
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const children = yield* Ref.make<ReadonlyArray<ChildProcessSpawner.ChildProcessHandle>>([]);
  const watched = ChildProcessSpawner.make((command) =>
    spawner.spawn(command).pipe(Effect.tap((child) => Ref.update(children, A.append(child))))
  );
  const execute = Command.runWith(agentMessageCommand, { version: "proof", renderErrors: false })([
    "serve",
    "--state-dir",
    `${root}/mailbox`,
    "--profile-file",
    `${root}/profile.json`,
    "--grant-file",
    `${root}/grant.json`,
    "--endpoint",
    owner.endpointId,
    "--participant",
    "synthetic-participant",
    "--owner",
    owner.ownerId,
    "--repository-scope",
    owner.repositoryScope,
    "--generation",
    "1",
    "--observation-dir",
    enrollmentDirectory,
  ]).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, watched));
  if (mode === "hold") {
    const refused = yield* execute.pipe(Effect.flip);
    if (
      !(S.is(AgentObservationError)(refused) && refused.reason === "claim") &&
      !(S.is(ObservationClaimError)(refused) && A.contains(["configuration", "storage", "integrity"], refused.reason))
    )
      return yield* Effect.die("Serve refused for a reason other than claim integrity");
    for (const operation of ["status", "reconcile", "population"]) {
      const error = yield* Command.runWith(agentMessageCommand, { version: "proof", renderErrors: false })([
        "observation",
        operation,
        "--observation-dir",
        enrollmentDirectory,
        ...(operation === "population" ? ["--request-dir", `${root}/request`] : []),
      ]).pipe(Effect.flip);
      if (!S.is(AgentObservationError)(error) || error.reason !== "claim")
        return yield* Effect.die("Recovery command refused for a reason other than claim integrity");
    }
    if ((yield* Ref.get(children)).length !== 0) return yield* Effect.die("Recovery hold spawned a child");
    return yield* Console.log(
      yield* encodeClaimIntegrityRefusalChildLaunchesRecordJson({ claimIntegrityRefusal: true, childLaunches: 0 })
    );
  }
  const claims = yield* makeObservationClaims(policy, process.geteuid?.() ?? -1);
  if (mode === "initialize") {
    const ready = yield* Deferred.make<void>();
    const task = yield* execute.pipe(
      Effect.provideService(
        Console.Console,
        Console.Console.of({
          ...originalConsole,
          log: () => {
            Deferred.doneUnsafe(ready, Effect.void);
          },
        })
      ),
      Effect.forkChild
    );
    yield* Deferred.await(ready).pipe(Effect.timeout("5 seconds"));
    yield* Fiber.interrupt(task);
  } else {
    if (!(yield* execute.pipe(Effect.isFailure))) return yield* Effect.die("Duplicate command launched");
  }
  const childHandles = yield* Ref.get(children);
  for (const child of childHandles)
    if (yield* child.isRunning) return yield* Effect.die("Child survived command shutdown");
  if (childHandles.length !== (mode === "initialize" ? 1 : 0))
    return yield* Effect.die("Unexpected process launch count");
  const operation = mode === "initialize" ? "status" : "reconcile";
  const output = yield* Deferred.make<string>();
  yield* Command.runWith(agentMessageCommand, { version: "proof", renderErrors: false })([
    "observation",
    operation,
    "--observation-dir",
    enrollmentDirectory,
  ]).pipe(
    Effect.provideService(
      Console.Console,
      Console.Console.of({
        ...originalConsole,
        log: (message) => {
          Deferred.doneUnsafe(output, Effect.succeed(message));
        },
      })
    )
  );
  const report = yield* decodeAgentObservationRecoveryJson(yield* Deferred.await(output));
  const state = yield* claims.readOutbox(launchId);
  if (!S.toEquivalence(AgentObservationRecovery)(report, AgentObservationRecovery.make({ operation, outbox: state })))
    return yield* Effect.die("Command report differs from retained evidence");
  if (state.submissions.length !== 4 || state.receipts.length !== (mode === "initialize" ? 0 : 4))
    return yield* Effect.die("Unexpected command lifecycle evidence");
  const now = yield* DateTime.now;
  const populationRequest = ObservationClaimPopulationRequest.make({
    routeIds: [id("c")],
    inventory: ObservationInventory.make({
      observedAt: now,
      populationWindowStart: DateTime.makeUnsafe(0),
      populationWindowEnd: now,
      boundaryEvidenceId: id("7"),
      hosts: [{ hostId, identityNamespaceId: namespaceId }],
      roots: [],
      routes: [
        ObservationRoute.make({
          routeId: id("c"),
          hostId,
          harness: "codex-cli",
          surface: "cli",
          transport: "managed-launch",
          root: { _tag: "Unknown" },
          capability: { _tag: "Unknown" },
          policy: { _tag: "Included" },
          heartbeat: { _tag: "Unknown" },
          knownLaunches: { _tag: "Unknown" },
          expectedEvents: { _tag: "Unknown" },
        }),
      ],
    }),
  });
  yield* fs.writeFileString(
    `${root}/request/population.json`,
    yield* encodeObservationClaimPopulationRequestJson(populationRequest),
    { mode: 0o600 }
  );
  const populationOutput = yield* Deferred.make<string>();
  yield* Command.runWith(agentMessageCommand, { version: "proof", renderErrors: false })([
    "observation",
    "population",
    "--json",
    "--observation-dir",
    enrollmentDirectory,
    "--request-dir",
    `${root}/request`,
  ]).pipe(
    Effect.provideService(
      Console.Console,
      Console.Console.of({
        ...originalConsole,
        log: (message) => {
          Deferred.doneUnsafe(populationOutput, Effect.succeed(message));
        },
      })
    )
  );
  const population = yield* decodeObservationClaimPopulationReportJson(yield* Deferred.await(populationOutput));
  if (
    population.rows[0]?.started.length !== 1 ||
    population.rows[0]?.started[0] !== launchId ||
    population.rows[0]?.receiptedStarts.length !== (mode === "initialize" ? 0 : 1) ||
    population.coverage.inventory.routes[0]?.knownLaunches._tag !== "Enumerated" ||
    population.coverage.inventory.routes[0]?.expectedEvents._tag !== "Unknown" ||
    population.coverage.routes[0]?.visibleEvents._tag !== "Unknown"
  )
    return yield* Effect.die("Population command conflated evidence boundaries");
  let populationDisplay = "";
  yield* Command.runWith(agentMessageCommand, { version: "proof", renderErrors: false })([
    "observation",
    "population",
    "--observation-dir",
    enrollmentDirectory,
    "--request-dir",
    `${root}/request`,
  ]).pipe(
    Effect.provideService(
      Console.Console,
      Console.Console.of({
        ...originalConsole,
        log: (message) => {
          populationDisplay += `${message}\n`;
        },
      })
    )
  );
  if (
    !Str.includes("Known process starts: 1")(populationDisplay) ||
    !Str.includes(`Historical collector acknowledgments of starts: ${mode === "initialize" ? 0 : 1}`)(
      populationDisplay
    ) ||
    !Str.includes("backend visibility remain unknown")(populationDisplay)
  )
    return yield* Effect.die("Population display blurred boundaries");
  yield* Console.log(
    yield* encodeReportPopulationRecordJson({
      report,
      population,
      populationDisplay,
      childLaunches: childHandles.length,
      childStopped: true,
      relaunchRefused: mode === "recover",
      syntheticOnly: true,
      explicitSetupCommands: mode === "initialize",
    })
  );
});
NodeRuntime.runMain(
  Layer.mergeAll(
    NodeServices.layer,
    NodeCrypto.layer,
    NodeHttpClient.layerNodeHttp,
    AiProviderCliSession.layer,
    Reactivity.layer,
    Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ BEEP_AI_METRICS_HASH_SALT: salt }))
  ).pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.tapCause((cause) => cause.pipe(Cause.pretty, Console.error)),
    Effect.scoped
  )
);
