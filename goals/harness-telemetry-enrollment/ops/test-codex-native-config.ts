/** Fixed private configuration checks; no provider, socket, journal or service starts. */
import { AiMetricsGitRootEvidence } from "@beep/repo-ai-metrics/git-root-evidence";
import {
  ObservationHost,
  ObservationIdentity,
  ObservationInventory,
  ObservationRoot,
} from "@beep/repo-ai-metrics/observation-inventory";
import { ObservationLaunchConfig, readObservationLaunchConfig } from "@beep/repo-ai-metrics/observation-launch";
import { ObservationRootProbeResult, ObservationRootReceipt } from "@beep/repo-ai-metrics/observation-root-probe";
import { hashPublicTextSha256 } from "@beep/repo-ai-metrics/privacy";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { generateNativeCanaryConfig, NativeCanaryConfigRequest } from "./native-canary-config.ts";

const hash = (letter: string) => Sha256Hex.make(Str.repeat(64)(letter));
const encodeUnknown = S.encodeEffect(S.fromJsonString(S.Unknown));
const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const home = yield* fs.makeTempDirectoryScoped({ directory: "/tmp", prefix: "nct-" });
  yield* fs.chmod(home, 0o700);
  const stateRoot = `${home}/.local/state/beep`;
  yield* fs.makeDirectory(stateRoot, { recursive: true, mode: 0o700 });
  const host = ObservationHost.make({ hostId: hash("a"), identityNamespaceId: hash("b") });
  const now = DateTime.makeUnsafe("2026-11-03T00:00:00Z");
  const observation = {
    version: "agent-observation-root-receipt/v1",
    host,
    rootId: `root-${hash("c")}`,
    declaredState: "inspect",
    availability: "present",
    observedAt: "2026-11-03T00:00:00Z",
    git: AiMetricsGitRootEvidence.cases.Observed.make({
      observedAtEpochMillis: 1,
      hashSaltNamespaceId: hash("b"),
      owningCloneIdHash: hash("d"),
      worktreeIdHash: hash("e"),
      repositoryIdHash: hash("f"),
      repositoryIdentityScope: "remote",
      linkedWorktree: true,
    }),
  };
  const decodedObservation = yield* S.decodeUnknownEffect(ObservationRootReceipt.fields.observation)(observation);
  const evidenceId = yield* hashPublicTextSha256(
    yield* S.encodeEffect(S.fromJsonString(ObservationRootReceipt.fields.observation))(decodedObservation)
  );
  const identity = (id: Sha256Hex) => ObservationIdentity.cases.Verified.make({ id, evidenceId });
  const root = ObservationRoot.make({
    rootId: decodedObservation.rootId,
    hostId: host.hostId,
    repositoryId: identity(hash("f")),
    cloneId: identity(hash("d")),
    worktreeId: identity(hash("e")),
    availability: "present",
    evidenceId,
  });
  const probe = ObservationRootProbeResult.make({
    inventory: ObservationInventory.make({
      observedAt: now,
      populationWindowStart: DateTime.makeUnsafe("2026-11-02T23:00:00Z"),
      populationWindowEnd: now,
      boundaryEvidenceId: hash("a"),
      hosts: [host],
      roots: [root],
      routes: [],
    }),
    rootReceipts: [ObservationRootReceipt.make({ evidenceId, observation: decodedObservation })],
  });
  const probeBody = yield* S.encodeEffect(S.fromJsonString(ObservationRootProbeResult))(probe);
  const allowlistBody = yield* encodeUnknown({
    version: "native-canary-destination/v1",
    backendOrigin: "https://fixture.tailtest.ts.net:8447",
  });
  const credential = `${home}/salt.credential`;
  yield* fs.writeFileString(credential, "SYNTHETIC_SALT_NEVER_READ", { mode: 0o600 });
  yield* fs.writeFileString(`${home}/probe.json`, probeBody, { mode: 0o600 });
  yield* fs.writeFileString(`${home}/destination.json`, allowlistBody, { mode: 0o600 });
  const request = NativeCanaryConfigRequest.make({
    rootProbeFile: `${home}/probe.json`,
    rootProbeSha256: yield* hashPublicTextSha256(probeBody),
    rootId: root.rootId,
    hostId: host.hostId,
    namespaceId: host.identityNamespaceId,
    destinationAllowlistFile: `${home}/destination.json`,
    destinationAllowlistSha256: yield* hashPublicTextSha256(allowlistBody),
    backendOrigin: "https://fixture.tailtest.ts.net:8447",
    pilotToken: "0000000000000001",
    outputDirectory: `${stateRoot}/nc-0000000000000001`,
    saltCredentialFile: credential,
    bunPath: "/usr/bin/false",
    intakePort: 43991,
    exportPort: 43992,
  });
  const provide = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ HOME: home })));
  // Any credential read through the platform is a test failure; only lstat/realPath
  // may access it. No process-spawner service is required by this generator.
  const guardedFs = {
    ...fs,
    open: (filename: string, options?: Parameters<typeof fs.open>[1]) =>
      filename === credential ? Effect.die("credential read attempted") : fs.open(filename, options),
    readFileString: (filename: string, encoding?: Parameters<typeof fs.readFileString>[1]) =>
      filename === credential ? Effect.die("credential read attempted") : fs.readFileString(filename, encoding),
    readFile: (filename: string) =>
      filename === credential ? Effect.die("credential read attempted") : fs.readFile(filename),
  };
  return { request, fs, provide, guardedFs, home, probe };
});

it.layer(Layer.merge(NodeServices.layer, NodeCrypto.layer), { concurrent: false })("native config generator", (it) => {
  it.effect("renders only new private paused Codex/controller policy with fixed bounds and no secret read", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const receipt = yield* f.provide(
        generateNativeCanaryConfig(f.request).pipe(Effect.provideService(FileSystem.FileSystem, f.guardedFs))
      );
      const config = yield* readObservationLaunchConfig(receipt.stateDirectory, process.geteuid?.() ?? -1);
      expect(config.route.producer).toEqual(O.some("managed-controller"));
      expect(config.route.approvedModels).toEqual([]);
      expect(config.route.usageConvention).toBe("unknown");
      expect(config.route.syntheticFixtureMetadata).toEqual(O.none());
      expect(config.discovery).toEqual(O.none());
      expect(O.getOrUndefined(config.launchHttp)?.routes).toEqual([
        { routeId: receipt.launchRouteId, harness: "codex-cli", surface: "cli" },
      ]);
      expect(receipt.ingressRouteId).not.toBe(receipt.launchRouteId);
      expect(receipt.installed).toBe(false);
      expect(receipt.resumed).toBe(false);
      expect(config.intake.maxDatabasePages).toBe(1024);
      const plan = yield* f.fs.readFileString(`${receipt.artifactDirectory}/deployment-plan.json`);
      expect(plan).toContain("RuntimeMaxSec=900");
      expect(plan).toContain("LoadCredential=hash-salt:");
      expect(plan).not.toContain("SYNTHETIC_SALT_NEVER_READ");
      expect(plan).not.toContain("EnvironmentFile");
      expect(yield* f.fs.exists(`${receipt.stateDirectory}/journal.sqlite`)).toBe(false);
      expect(yield* f.fs.exists(receipt.socketPath)).toBe(false);
      for (const file of [
        receipt.workerConfigFile,
        `${receipt.artifactDirectory}/deployment-request.json`,
        `${receipt.artifactDirectory}/deployment-plan.json`,
        `${f.request.outputDirectory}/receipt.json`,
      ])
        expect((yield* f.fs.lstat(file)).mode & 0o777).toBe(0o600);
      expect((yield* f.provide(generateNativeCanaryConfig(f.request)).pipe(Effect.result))._tag).toBe("Failure");
    })
  );
  for (const mode of ["pin", "destination", "namespace", "escape", "credential-env", "credential-public"]) {
    it.effect(`refuses ${mode} before creating output`, () =>
      Effect.gen(function* () {
        const f = yield* fixture;
        if (mode === "credential-public") yield* f.fs.chmod(f.request.saltCredentialFile, 0o644);
        if (mode === "credential-env")
          yield* f.fs.writeFileString(`${f.home}/salt.env`, "SYNTHETIC_ENV", { mode: 0o600 });
        const request = NativeCanaryConfigRequest.make({
          ...f.request,
          rootProbeSha256: mode === "pin" ? hash("0") : f.request.rootProbeSha256,
          backendOrigin: mode === "destination" ? "https://other.tailtest.ts.net:8447" : f.request.backendOrigin,
          namespaceId: mode === "namespace" ? hash("0") : f.request.namespaceId,
          outputDirectory: mode === "escape" ? `${f.home}/escaped` : f.request.outputDirectory,
          saltCredentialFile: mode === "credential-env" ? `${f.home}/salt.env` : f.request.saltCredentialFile,
        });
        expect((yield* f.provide(generateNativeCanaryConfig(request)).pipe(Effect.result))._tag).toBe("Failure");
        expect(yield* f.fs.exists(request.outputDirectory)).toBe(false);
      })
    );
  }
  it.effect("refuses symlinked input and undeclared headers without creating output", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      yield* f.fs.symlink(f.request.rootProbeFile, `${f.home}/probe-alias.json`);
      const alias = NativeCanaryConfigRequest.make({ ...f.request, rootProbeFile: `${f.home}/probe-alias.json` });
      expect((yield* f.provide(generateNativeCanaryConfig(alias)).pipe(Effect.result))._tag).toBe("Failure");
      const extra = { ...f.request, headers: { Authorization: "SYNTHETIC_FORBIDDEN_HEADER" } };
      expect((yield* f.provide(generateNativeCanaryConfig(extra)).pipe(Effect.result))._tag).toBe("Failure");
      expect(yield* f.fs.exists(f.request.outputDirectory)).toBe(false);
    })
  );
  it.effect("refuses a correctly pinned probe with no retained matching root receipt", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const body = yield* S.encodeEffect(S.fromJsonString(ObservationRootProbeResult))(
        ObservationRootProbeResult.make({ ...f.probe, rootReceipts: [] })
      );
      yield* f.fs.writeFileString(f.request.rootProbeFile, body);
      const request = NativeCanaryConfigRequest.make({
        ...f.request,
        rootProbeSha256: yield* hashPublicTextSha256(body),
      });
      expect((yield* f.provide(generateNativeCanaryConfig(request)).pipe(Effect.result))._tag).toBe("Failure");
      expect(yield* f.fs.exists(request.outputDirectory)).toBe(false);
    })
  );
});

it.layer(Layer.merge(NodeServices.layer, NodeCrypto.layer), { concurrent: false })("native harness selection", (it) => {
  it.effect("keeps default Codex configuration bytes identical to the explicit Codex route", () =>
    Effect.gen(function* () {
      const f = yield* fixture;
      const first = yield* f.provide(generateNativeCanaryConfig(f.request));
      const filenames = [
        first.workerConfigFile,
        `${first.artifactDirectory}/deployment-request.json`,
        `${first.artifactDirectory}/deployment-plan.json`,
      ];
      const original = yield* Effect.forEach(filenames, (name) => f.fs.readFileString(name));
      yield* f.fs.remove(f.request.outputDirectory, { recursive: true });
      yield* f.provide(
        generateNativeCanaryConfig(NativeCanaryConfigRequest.make({ ...f.request, harness: "codex-cli" }))
      );
      const explicit = yield* Effect.forEach(filenames, (name) => f.fs.readFileString(name));
      expect(explicit).toEqual(original);
    })
  );
  for (const harness of ["claude-code", "grok", "muse"] as const)
    it.effect(`admits the finite ${harness} route while preserving controller intake policy`, () =>
      Effect.gen(function* () {
        const f = yield* fixture;
        const receipt = yield* f.provide(
          generateNativeCanaryConfig(
            NativeCanaryConfigRequest.make({
              ...f.request,
              harness,
            })
          )
        );
        const raw = yield* f.fs.readFileString(receipt.workerConfigFile);
        const config = yield* S.decodeEffect(S.fromJsonString(ObservationLaunchConfig))(raw);
        expect(O.getOrThrow(config.launchHttp).routes).toEqual([
          { routeId: receipt.launchRouteId, harness, surface: "cli" },
        ]);
        expect(config.route.producer).toEqual(O.some("managed-controller"));
        expect(config.route.approvedModels).toEqual([]);
        expect(config.route.usageConvention).toBe("unknown");
      })
    );
});
