import { AiProviderCliSession, ManagedLaunchProfile } from "@beep/ai-provider-cli";
import {
  initializeObservationClaims,
  makeObservationClaims,
  ObservationClaimAnchor,
  ObservationClaimPolicy,
} from "@beep/repo-ai-metrics/observation-launch-claims";
import { ObservationLaunchClientPolicy } from "@beep/repo-ai-metrics/observation-launch-client";
import { ObservationLaunchFact, ObservationLaunchIdentity } from "@beep/repo-ai-metrics/observation-launch-facts";
import { ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { agentMessageServeCommand, LaunchGrant } from "@beep/repo-cli/commands/AgentMessage";
import {
  AgentObservationEnrollment,
  AgentObservationOwner,
  AgentObservationProvisioning,
  AgentObservationRequest,
  enrollAgentObservation,
  initializeAgentObservationClaims,
  openAgentMessageSession,
  recoverAgentObservation,
} from "@beep/repo-cli/commands/AgentMessage/AgentMessage.observation";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";

const salt = "synthetic-observation-owner-salt";
const hash = (value: string) => hashPrivateIdentifier(value, O.some(salt));
const id = (digit: string) => Sha256Hex.make(Str.repeat(64)(digit));
const encodeAgentObservationOwnerJson = S.encodeEffect(S.fromJsonString(AgentObservationOwner));
const encodeAgentObservationEnrollmentJson = S.encodeEffect(S.fromJsonString(AgentObservationEnrollment));

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ directory: "/tmp", prefix: "obs-owner-" });
  yield* fs.chmod(root, 0o700);
  for (const name of ["workspace", "home", "enrollment", "collector"]) {
    yield* fs.makeDirectory(`${root}/${name}`, { mode: 0o700 });
  }
  const profile = ManagedLaunchProfile.make({
    provider: "codex",
    executable: process.execPath,
    prefixArgs: [
      path.resolve(import.meta.dirname, "../../../../drivers/ai-provider-cli/test/fixtures/managed-codex-peer.ts"),
    ],
    workspace: `${root}/workspace`,
    profileRoot: `${root}/home`,
    env: { HOME: `${root}/home`, CODEX_HOME: `${root}/home/.codex`, PATH: "/usr/bin:/bin" },
    authLane: "existing-subscription",
    tools: [],
  });
  const owner = AgentObservationOwner.make({
    endpointId: "synthetic-endpoint",
    ownerId: "synthetic-owner",
    generation: 1,
    repositoryScope: "synthetic-repository",
    workspace: profile.workspace,
    provider: profile.provider,
  });
  const ownerBinding = yield* hash(
    `agent-message-observation-owner/v1:${yield* encodeAgentObservationOwnerJson(owner)}`
  );
  const launchId = yield* hash(`agent-message-observation-attempt/v1:${ownerBinding}`);
  const namespaceId = yield* hash("ai-metrics-hash-salt-namespace/v1");
  const claimPolicy = ObservationClaimPolicy.make({
    directory: `${root}/claims`,
    journalDirectory: `${root}/collector`,
    anchor: ObservationClaimAnchor.make({ fenceId: id("e"), hostId: id("a"), namespaceId, maxClaims: 2 }),
  });
  const submission = ObservationLaunchSubmission.make({
    hostId: id("a"),
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
        evidenceId: id("d"),
      }),
    }),
  });
  const enrollment = AgentObservationEnrollment.make({
    ownerBinding,
    claims: claimPolicy,
    destination: ObservationLaunchClientPolicy.make({
      directory: `${root}/collector`,
      hostId: id("a"),
      namespaceId,
      timeoutMillis: 100,
    }),
    submission,
  });
  const write = (value: AgentObservationEnrollment) =>
    encodeAgentObservationEnrollmentJson(value).pipe(
      Effect.flatMap((text) => fs.writeFileString(`${root}/enrollment/enrollment.json`, text, { mode: 0o600 }))
    );
  yield* write(enrollment);
  yield* initializeObservationClaims(claimPolicy, process.geteuid?.() ?? -1);
  const request = AgentObservationRequest.make({ profile, owner, enrollmentDirectory: O.some(`${root}/enrollment`) });
  const claims = yield* makeObservationClaims(claimPolicy, process.geteuid?.() ?? -1);
  return { fs, root, profile, owner, request, claims, launchId, write, enrollment };
});
const layer = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  AiProviderCliSession.layer,
  Reactivity.layer,
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ BEEP_AI_METRICS_HASH_SALT: salt }))
);
const encodeAgentObservationProvisioningJson = S.encodeEffect(S.fromJsonString(AgentObservationProvisioning));
const encodeManagedLaunchProfileJson = S.encodeEffect(S.fromJsonString(ManagedLaunchProfile));
const encodeLaunchGrantJson = S.encodeEffect(S.fromJsonString(LaunchGrant));

it.layer(layer, { timeout: "20 seconds" })("Managed observation owner", (it) => {
  it.effect("records a real child locally while the collector is absent, closes it, and refuses another launch", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const session = yield* openAgentMessageSession(f.request);
      const isRunning1 = yield* session.process.isRunning;
      expect(isRunning1).toBe(true);
      expect(A.map((yield* f.claims.readOutbox(f.launchId)).submissions, (entry) => entry.fact._tag)).toEqual([
        "Prepared",
        "Started",
        "SessionBound",
      ]);
      yield* session.close;
      const isRunning2 = yield* session.process.isRunning;
      expect(isRunning2).toBe(false);
      const state = yield* f.claims.readOutbox(f.launchId);
      expect(state.submissions[3]?.fact).toEqual(
        ObservationLaunchFact.cases.Finished.make({ launchId: f.launchId, outcome: "cancelled" })
      );
      expect(state.receipts).toEqual([]);
      const pipe3 = yield* openAgentMessageSession(f.request).pipe(Effect.flip);
      expect(pipe3).toMatchObject({
        _tag: "ObservationClaimError",
        reason: "claimed",
      });
      const serialized = yield* f.fs.readFileString(`${f.root}/claims/fact-0-2.json`);
      expect(serialized).not.toContain("owned-thread");
      expect(serialized).not.toContain(f.profile.workspace);
      expect(serialized).not.toContain(salt);
    }).pipe(TestClock.withLive)
  );

  it.effect(
    "explicit setup preserves existing stores, refuses missing claims, and creates a usable private enrollment",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture;
        if (f.enrollment.submission.fact._tag !== "Prepared") {
          return yield* Effect.die("Expected prepared fixture");
        }
        const requestDirectory = `${f.root}/request`;
        yield* f.fs.makeDirectory(requestDirectory, { mode: 0o700 });
        const policy = ObservationClaimPolicy.make({ ...f.enrollment.claims, directory: `${f.root}/new-claims` });
        const request = AgentObservationProvisioning.make({
          owner: f.owner,
          claims: policy,
          destination: f.enrollment.destination,
          evidenceEpoch: 0,
          identity: f.enrollment.submission.fact.identity,
        });
        const writeRequest = (value: AgentObservationProvisioning) =>
          encodeAgentObservationProvisioningJson(value).pipe(
            Effect.flatMap((text) => f.fs.writeFileString(`${requestDirectory}/request.json`, text, { mode: 0o600 }))
          );
        yield* writeRequest(request);
        const target = `${f.root}/new-enrollment`;
        const pipe4 = yield* enrollAgentObservation(requestDirectory, target).pipe(Effect.flip);
        expect(pipe4).toMatchObject({
          reason: "claim",
        });
        const exists5 = yield* f.fs.exists(target);
        expect(exists5).toBe(false);
        const initialized = yield* initializeAgentObservationClaims(requestDirectory);
        expect(initialized.operation).toBe("initialize-claims");
        const anchor = yield* f.fs.readFileString(`${policy.directory}/anchor.json`);
        const pipe6 = yield* initializeAgentObservationClaims(requestDirectory).pipe(Effect.isFailure);
        expect(pipe6).toBe(true);
        const readFileString7 = yield* f.fs.readFileString(`${policy.directory}/anchor.json`);
        expect(readFileString7).toBe(anchor);
        const partial = `${f.root}/partial-enrollment`;
        yield* f.fs.makeDirectory(partial, { mode: 0o700 });
        yield* f.fs.writeFileString(`${partial}/enrollment.json`, "", { mode: 0o600 });
        const pipe8 = yield* enrollAgentObservation(requestDirectory, partial).pipe(Effect.isFailure);
        expect(pipe8).toBe(true);
        const readFileString9 = yield* f.fs.readFileString(`${partial}/enrollment.json`);
        expect(readFileString9).toBe("");
        const pipe10 = yield* enrollAgentObservation(requestDirectory, `${policy.directory}/nested`).pipe(
          Effect.isFailure
        );
        expect(pipe10).toBe(true);
        const exists11 = yield* f.fs.exists(`${policy.directory}/nested`);
        expect(exists11).toBe(false);
        const enrolled = yield* enrollAgentObservation(requestDirectory, target);
        expect(enrolled.launchId).toBe(initialized.launchId);
        const original = yield* f.fs.readFileString(`${target}/enrollment.json`);
        const pipe12 = yield* enrollAgentObservation(requestDirectory, target).pipe(Effect.isFailure);
        expect(pipe12).toBe(true);
        const readFileString13 = yield* f.fs.readFileString(`${target}/enrollment.json`);
        expect(readFileString13).toBe(original);
        const session = yield* openAgentMessageSession(
          AgentObservationRequest.make({ ...f.request, enrollmentDirectory: O.some(target) })
        );
        yield* session.close;
        expect((yield* recoverAgentObservation(target, "status")).outbox.submissions).toHaveLength(4);
        const pipe14 = yield* enrollAgentObservation(requestDirectory, `${f.root}/another-enrollment`).pipe(
          Effect.flip
        );
        expect(pipe14).toMatchObject({ reason: "claim" });
        const exists15 = yield* f.fs.exists(`${f.root}/another-enrollment`);
        expect(exists15).toBe(false);
        yield* writeRequest(
          AgentObservationProvisioning.make({
            ...request,
            destination: ObservationLaunchClientPolicy.make({ ...request.destination, namespaceId: id("f") }),
          })
        );
        const pipe16 = yield* initializeAgentObservationClaims(requestDirectory).pipe(Effect.flip);
        expect(pipe16).toMatchObject({
          reason: "identity",
        });
        yield* f.fs.writeFileString(`${requestDirectory}/request.json`, Str.repeat(32769)("X"));
        const pipe17 = yield* initializeAgentObservationClaims(requestDirectory).pipe(Effect.flip);
        expect(pipe17).toMatchObject({
          reason: "configuration",
        });
        const readFileString18 = yield* f.fs.readFileString(`${policy.directory}/anchor.json`);
        expect(readFileString18).toBe(anchor);
      }).pipe(TestClock.withLive)
  );

  it.effect("inspects offline facts without launching and refuses altered or damaged recovery state", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const session = yield* openAgentMessageSession(f.request);
      yield* session.close;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const count = yield* Ref.make(0);
      const watched = ChildProcessSpawner.make((command) =>
        Ref.update(count, (n) => n + 1).pipe(Effect.andThen(spawner.spawn(command)))
      );
      const recover = (operation: "status" | "reconcile") =>
        recoverAgentObservation(`${f.root}/enrollment`, operation).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, watched)
        );
      const status = yield* recover("status");
      expect(status.outbox.submissions).toHaveLength(4);
      expect(status.outbox.receipts).toHaveLength(0);
      expect(status.backendVisibility).toBe("unknown");
      expect(status.processLiveness).toBe("unknown");
      const pipe19 = yield* recover("reconcile").pipe(Effect.flip);
      expect(pipe19).toMatchObject({ reason: "recovery" });
      expect((yield* recover("status")).outbox).toEqual(status.outbox);
      yield* f.write(
        AgentObservationEnrollment.make({
          ...f.enrollment,
          submission: ObservationLaunchSubmission.make({ ...f.enrollment.submission, evidenceEpoch: 1 }),
        })
      );
      const pipe20 = yield* recover("reconcile").pipe(Effect.flip);
      expect(pipe20).toMatchObject({ reason: "identity" });
      yield* f.write(f.enrollment);
      yield* f.fs.writeFileString(`${f.root}/claims/receipt-0-0.json`, "", { mode: 0o600 });
      const pipe21 = yield* recover("status").pipe(Effect.flip);
      expect(pipe21).toMatchObject({ reason: "claim" });
      const readFileString22 = yield* f.fs.readFileString(`${f.root}/claims/receipt-0-0.json`);
      expect(readFileString22).toBe("");
      const got = yield* Ref.get(count);
      expect(got).toBe(0);
    }).pipe(TestClock.withLive)
  );

  it.effect("refuses wrong owner generation, salt, exposed enrollment and changed attempt before spawn", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const count = yield* Ref.make(0);
      const watched = ChildProcessSpawner.make((command) =>
        Ref.update(count, (n) => n + 1).pipe(Effect.andThen(spawner.spawn(command)))
      );
      const open = (request: AgentObservationRequest) =>
        openAgentMessageSession(request).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, watched),
          Effect.isFailure
        );
      const open23 = yield* open(
        AgentObservationRequest.make({
          ...f.request,
          owner: AgentObservationOwner.make({ ...f.owner, generation: 2 }),
        })
      );
      expect(open23).toBe(true);
      const pipe24 = yield* open(f.request).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ BEEP_AI_METRICS_HASH_SALT: "other-synthetic-salt" })
        )
      );
      expect(pipe24).toBe(true);
      const pipe25 = yield* open(f.request).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ BEEP_AI_METRICS_HASH_SALT: " " })
        )
      );
      expect(pipe25).toBe(true);
      yield* f.fs.chmod(`${f.root}/enrollment/enrollment.json`, 0o644);
      const open26 = yield* open(f.request);
      expect(open26).toBe(true);
      yield* f.fs.chmod(`${f.root}/enrollment/enrollment.json`, 0o600);
      yield* f.write(AgentObservationEnrollment.make({ ...f.enrollment, ownerBinding: id("f") }));
      const open27 = yield* open(f.request);
      expect(open27).toBe(true);
      const prepared = f.enrollment.submission.fact;
      if (prepared._tag !== "Prepared") {
        return yield* Effect.die("Invalid synthetic preparation");
      }
      yield* f.write(
        AgentObservationEnrollment.make({
          ...f.enrollment,
          submission: ObservationLaunchSubmission.make({
            ...f.enrollment.submission,
            fact: ObservationLaunchFact.cases.Prepared.make({ ...prepared, launchId: id("f") }),
          }),
        })
      );
      const open28 = yield* open(f.request);
      expect(open28).toBe(true);
      yield* f.fs.writeFileString(`${f.root}/enrollment/enrollment.json`, Str.repeat(32769)("x"));
      const open29 = yield* open(f.request);
      expect(open29).toBe(true);
      yield* f.write(f.enrollment);
      yield* f.fs.rename(`${f.root}/claims`, `${f.root}/claims-held`);
      const open30 = yield* open(f.request);
      expect(open30).toBe(true);
      const exists31 = yield* f.fs.exists(`${f.root}/claims`);
      expect(exists31).toBe(false);
      yield* f.fs.rename(`${f.root}/claims-held`, `${f.root}/claims`);
      const got32 = yield* Ref.get(count);
      expect(got32).toBe(0);
      const snapshot33 = yield* f.claims.snapshot;
      expect(snapshot33).toEqual([]);
    }).pipe(TestClock.withLive)
  );

  it.effect("retains an unknown closure and stops the child after handshake policy rejection", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const children = yield* Ref.make<ReadonlyArray<ChildProcessSpawner.ChildProcessHandle>>([]);
      const watched = ChildProcessSpawner.make((command) =>
        spawner.spawn(command).pipe(Effect.tap((child) => Ref.update(children, A.append(child))))
      );
      const pipe34 = yield* openAgentMessageSession(
        AgentObservationRequest.make({
          ...f.request,
          profile: ManagedLaunchProfile.make({
            ...f.profile,
            prefixArgs: [...f.profile.prefixArgs, "--beep-fixture-mode=wrong-policy"],
          }),
        })
      ).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, watched), Effect.isFailure);
      expect(pipe34).toBe(true);
      for (const child of yield* Ref.get(children)) {
        const isRunning3 = yield* child.isRunning;
        expect(isRunning3).toBe(false);
      }
      const state = yield* f.claims.readOutbox(f.launchId);
      expect(A.map(state.submissions, (entry) => entry.fact._tag)).toEqual(["Prepared", "Started", "Finished"]);
      expect(state.submissions[2]?.fact).toEqual(
        ObservationLaunchFact.cases.Finished.make({ launchId: f.launchId, outcome: "unknown" })
      );
    }).pipe(TestClock.withLive)
  );
  it.effect("the real serve command accepts explicit enrollment and persists closure when interrupted", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const profileFile = `${f.root}/profile.json`;
      const grantFile = `${f.root}/grant.json`;
      const encodedManagedLaunchProfileJson = yield* encodeManagedLaunchProfileJson(f.profile);
      yield* f.fs.writeFileString(profileFile, encodedManagedLaunchProfileJson, { mode: 0o600 });
      const grant = LaunchGrant.make({
        grantId: "synthetic-grant",
        endpointId: f.owner.endpointId,
        generation: f.owner.generation,
        ownerId: f.owner.ownerId,
        repositoryScope: f.owner.repositoryScope,
        conversationScope: O.none(),
        allowedRecipients: ["synthetic-peer"],
        expiresAt: (yield* Clock.currentTimeMillis) + 60000,
        maxMessages: 1,
      });
      const encodedLaunchGrantJson = yield* encodeLaunchGrantJson(grant);
      yield* f.fs.writeFileString(grantFile, encodedLaunchGrantJson, {
        mode: 0o600,
      });
      const ready = yield* Deferred.make<void>();
      const originalConsole = yield* Console.Console;
      const observedConsole = Console.Console.of({
        ...originalConsole,
        log: () => {
          Deferred.doneUnsafe(ready, Effect.void);
        },
      });
      const execute = Command.runWith(agentMessageServeCommand, { version: "test", renderErrors: false })([
        "--state-dir",
        `${f.root}/mailbox`,
        "--profile-file",
        profileFile,
        "--grant-file",
        grantFile,
        "--endpoint",
        f.owner.endpointId,
        "--participant",
        "synthetic-participant",
        "--owner",
        f.owner.ownerId,
        "--repository-scope",
        f.owner.repositoryScope,
        "--generation",
        "1",
        "--observation-dir",
        `${f.root}/enrollment`,
      ]);
      const task = yield* execute.pipe(Effect.provideService(Console.Console, observedConsole), Effect.forkChild);
      yield* Deferred.await(ready).pipe(Effect.timeout("5 seconds"));
      expect(A.map((yield* f.claims.readOutbox(f.launchId)).submissions, (entry) => entry.fact._tag)).toEqual([
        "Prepared",
        "Started",
        "SessionBound",
      ]);
      yield* Fiber.interrupt(task);
      expect((yield* f.claims.readOutbox(f.launchId)).submissions[3]?.fact).toEqual(
        ObservationLaunchFact.cases.Finished.make({ launchId: f.launchId, outcome: "cancelled" })
      );
      const pipe35 = yield* execute.pipe(Effect.isFailure);
      expect(pipe35).toBe(true);
    }).pipe(TestClock.withLive)
  );

  it.effect("retains unknown for an already stopped child whose numeric exit result is unavailable", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const child = yield* Deferred.make<ChildProcessSpawner.ChildProcessHandle>();
      const watched = ChildProcessSpawner.make((command) =>
        spawner.spawn(command).pipe(Effect.tap((handle) => Deferred.succeed(child, handle)))
      );
      const session = yield* openAgentMessageSession(f.request).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, watched)
      );
      const actual = yield* Deferred.await(child);
      yield* actual.kill({ killSignal: "SIGKILL" });
      const pipe36 = yield* actual.exitCode.pipe(Effect.isFailure);
      expect(pipe36).toBe(true);
      yield* session.close;
      expect((yield* f.claims.readOutbox(f.launchId)).submissions[3]?.fact).toEqual(
        ObservationLaunchFact.cases.Finished.make({ launchId: f.launchId, outcome: "unknown" })
      );
    }).pipe(TestClock.withLive)
  );
});
