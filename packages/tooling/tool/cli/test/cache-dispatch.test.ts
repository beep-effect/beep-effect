import {
  CacheActivationPreview,
  CacheActivationRequest,
  CacheBaselineRequest,
  CacheCensusDefinition,
  CacheCommandError,
  CacheComputationConfiguration,
  CacheExecutablePin,
  CacheLiveIdentity,
  CacheQualificationService,
  CacheToolchainSnapshot,
  CacheTransitionRequest,
} from "@beep/repo-cli/commands/Cache";
import * as Profile from "@beep/repo-cli/commands/Cache/Cache.profile";
import * as Runtime from "@beep/repo-cli/commands/Cache/Cache.runtime";
import { makeCacheCommandForTesting } from "@beep/repo-cli/test/Cache";
import {
  CacheActivationProjection,
  CacheEvidenceReference,
  CachePolicyAuditReport,
  CachePolicyBaseline,
  CachePolicyFinding,
  CachePolicyProjection,
  CacheQualificationEntry,
  CacheQualificationKey,
  CacheQualificationStore,
  CacheReviewDecision,
  CacheTaskConfiguration,
} from "@beep/repo-configs/cache";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { A } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import * as NodeTerminal from "@effect/platform-node/NodeTerminal";
import { afterEach, describe, expect, vi } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import { Command } from "effect/cli";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const digest = Sha256Hex.make(Str.repeat(64)("a"));
const key = CacheQualificationKey.make({
  computation: "@beep/fixture#lint",
  layer: "turbo-task-result",
  profile: "local-linux-x64-bun1.4.2",
  epoch: "fixture",
});
const reference = CacheEvidenceReference.make({ path: "review.json", sha256: digest });
const review = CacheReviewDecision.make({ reviewer: "fixture", reason: "bounded fixture review", basis: reference });
const baseline = CachePolicyBaseline.make({
  review,
  scope: [key.computation],
  profile: key.profile,
  epoch: key.epoch,
  projection: CachePolicyProjection.make({ globalConfiguration: {}, nodes: [], sources: [] }),
});
const entry = CacheQualificationEntry.make({ key, status: { state: "excluded", review } });
const store = CacheQualificationStore.make({ revision: S.Natural.make(1), entries: [entry], history: [] });
const executable = CacheExecutablePin.make({ version: "1.4.2", sha256: digest });
const identity = CacheLiveIdentity.make({
  key,
  configuration: CacheComputationConfiguration.make({
    computation: key.computation,
    globalConfiguration: {},
    nodes: [
      CacheCensusDefinition.make({
        id: key.computation,
        command: O.some("biome check ."),
        commandDigest: digest,
        dependencies: [],
        configuration: CacheTaskConfiguration.make({
          cache: false,
          inputs: [],
          outputs: [],
          env: [],
          passThroughEnv: [],
          dependsOn: [],
          persistent: false,
          interactive: false,
          interruptible: false,
          outputLogs: "full",
        }),
      }),
    ],
    sources: [],
  }),
  configurationDigest: digest,
  toolchainDigest: digest,
  toolchain: CacheToolchainSnapshot.make({
    profile: "local-linux-x64-bun1.4.2",
    kernel: "fixture",
    libc: "fixture",
    bun: executable,
    node: executable,
    turbo: executable,
    biome: executable,
    sources: [],
  }),
});
const activation = CacheActivationProjection.make({
  path: "packages/fixture/turbo.json",
  before: reference,
  after: CacheEvidenceReference.make({ ...reference, path: "after.json" }),
  sourceConfiguration: digest,
});
const preview = CacheActivationPreview.make({ activation, source: identity, target: identity });
const emptyAudit = CachePolicyAuditReport.make({ findings: [], unassessed: [key.computation] });
const encodeBaselineRequest = S.encodeEffect(S.fromJsonString(CacheBaselineRequest));
const encodeTransitionRequest = S.encodeEffect(S.fromJsonString(CacheTransitionRequest));
const encodeActivationRequest = S.encodeEffect(S.fromJsonString(CacheActivationRequest));
const decodeIdentity = S.decodeUnknownEffect(S.fromJsonString(CacheLiveIdentity));
const decodePreview = S.decodeUnknownEffect(S.fromJsonString(CacheActivationPreview));
const testLayer = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer))
);

const memoryFsLayer = Layer.effect(
  FileSystem.FileSystem,
  Effect.gen(function* () {
    const fs = yield* MemoryFileSystem.make;
    yield* fs.makeDirectory(process.cwd(), { recursive: true });
    return fs;
  })
);
const memoryPlatform = Layer.mergeAll(
  memoryFsLayer,
  NodePath.layer,
  NodeCrypto.layer,
  TestConsole.layer,
  NodeChildProcessSpawner.layer.pipe(Layer.provide(Layer.merge(memoryFsLayer, NodePath.layer))),
  NodeStdio.layer,
  NodeTerminal.layer
);
const memoryLayer = Layer.merge(memoryPlatform, FsUtilsLive.pipe(Layer.provide(memoryPlatform)));

const defaultBaselineRequest = CacheBaselineRequest.make({
  review,
  scope: baseline.scope,
  profile: baseline.profile,
  epoch: baseline.epoch,
  previous: O.none(),
});

const consoleText = TestConsole.logLines.pipe(Effect.map(A.filter(P.isString)), Effect.map(A.join("\n")));
const errorText = TestConsole.errorLines.pipe(Effect.map(A.filter(P.isString)), Effect.map(A.join("\n")));
const fixture = Effect.fn("CacheDispatchTest.fixture")(function* (
  report = emptyAudit,
  baselineRequest = defaultBaselineRequest
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ directory: process.cwd(), prefix: ".cache-dispatch-test-" });
  const requests = {
    baseline: path.join(root, "baseline.json"),
    transition: path.join(root, "transition.json"),
    activation: path.join(root, "activation.json"),
  };
  const transitionRequest = CacheTransitionRequest.make({ expectedRevision: S.Natural.make(0), entry });
  const activationRequest = CacheActivationRequest.make({
    computation: key.computation,
    path: activation.path,
    before: activation.before,
    after: activation.after,
  });
  yield* fs.writeFileString(requests.baseline, yield* encodeBaselineRequest(baselineRequest));
  yield* fs.writeFileString(requests.transition, yield* encodeTransitionRequest(transitionRequest));
  yield* fs.writeFileString(requests.activation, yield* encodeActivationRequest(activationRequest));
  const calls = A.empty<string>();
  const layer = Layer.succeed(
    CacheQualificationService,
    CacheQualificationService.of({
      audit: Effect.fn("CacheDispatchTest.audit")(() => Effect.succeed(report)),
      inspect: Effect.fn("CacheDispatchTest.inspect")(() => Effect.succeed(store)),
      fingerprint: Effect.fn("CacheDispatchTest.fingerprint")(function* (_root, computation) {
        if (computation !== key.computation) return yield* CacheCommandError.new("Unknown computation.");
        return identity;
      }),
      baseline: Effect.fn("CacheDispatchTest.baseline")((_root, request) =>
        Effect.sync(() => {
          expect(request).toEqual(baselineRequest);
          A.appendInPlace(calls, "baseline");
          return baseline;
        })
      ),
      transition: Effect.fn("CacheDispatchTest.transition")((_root, request) =>
        Effect.sync(() => {
          expect(request).toEqual(transitionRequest);
          A.appendInPlace(calls, "transition");
          return store;
        })
      ),
      activation: Effect.fn("CacheDispatchTest.activation")((_root, request) =>
        Effect.sync(() => {
          expect(request).toEqual(activationRequest);
          A.appendInPlace(calls, "activation");
          return preview;
        })
      ),
    })
  );
  return {
    fs,
    path,
    root,
    requests,
    calls,
    run: Command.runWith(makeCacheCommandForTesting(layer), { version: "0.0.0" }),
  };
});

afterEach(() => vi.restoreAllMocks());

describe("cache qualification command dispatch", () => {
  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("checks and regenerates the profile only through the selected operation", () =>
      Effect.gen(function* () {
        const verify = vi.spyOn(Profile, "verifyCacheIdentityLintProfile").mockReturnValue(Effect.void);
        const write = vi.spyOn(Profile, "writeCacheIdentityLintProfile").mockReturnValue(Effect.void);
        const f = yield* fixture();
        yield* f.run(["profile"]);
        expect(verify).toHaveBeenCalledWith(process.cwd());
        expect(write).not.toHaveBeenCalled();
        yield* f.run(["profile", "--write"]);
        expect(verify).toHaveBeenCalledTimes(1);
        expect(write).toHaveBeenCalledWith(process.cwd());
        const text = yield* consoleText;
        expect(text).toContain("Identity lint candidate profile is current.");
        expect(text).toContain("Identity lint candidate profile written.");
        verify.mockReturnValue(Effect.fail(CacheCommandError.new("stale profile fixture")));
        expect(yield* f.run(["profile"]).pipe(Effect.isFailure)).toBe(true);
        expect(yield* errorText).toContain("stale profile fixture");
      })
    );
  });

  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("forwards native arguments and reports unsuccessful native execution", () =>
      Effect.gen(function* () {
        const execute = vi.spyOn(Runtime, "runCacheRuntimeTasks").mockReturnValue(Effect.succeed(0));
        const f = yield* fixture();
        const args = ["run", "lint", "--filter=@beep/identity"];
        yield* f.run(["execute", "--", ...args]);
        expect(execute).toHaveBeenCalledWith(process.cwd(), args);
        execute.mockReturnValue(Effect.succeed(7));
        expect(yield* f.run(["execute", "--", ...args]).pipe(Effect.isFailure)).toBe(true);
      })
    );
  });

  it.layer(memoryLayer, { timeout: "30 seconds" })((it) => {
    it.effect.prop(
      "preserves arbitrary reviewed baseline requests through file decoding and command dispatch",
      [CacheBaselineRequest],
      ([request]) =>
        Effect.gen(function* () {
          const f = yield* fixture(emptyAudit, request);
          yield* f.run(["baseline", "--request", f.requests.baseline]);
          expect(f.calls).toEqual(["baseline"]);
        }),
      { arbitrary: fcRuns(40) }
    );
  });

  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("renders the index, audit formats and explicit ledger through the injected authority", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.run([]);
        yield* f.run(["audit"]);
        yield* f.run(["audit", "--json"]);
        yield* f.run(["inspect"]);
        const text = yield* consoleText;
        expect(text).toContain("cache commands: census");
        expect(text).toContain("0 blocking findings; 1 unassessed");
        expect(text).toContain('"unassessed"');
        expect(text).toContain('"revision":1');
      })
    );
  });

  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("prints review and blocking findings and fails only on blocking audit results", () =>
      Effect.gen(function* () {
        const advisory = CachePolicyFinding.make({
          kind: "configuration-source-drift",
          subject: "turbo.json",
          blocking: false,
        });
        const blocking = CachePolicyFinding.make({
          kind: "unqualified-reuse",
          subject: key.computation,
          blocking: true,
        });
        const reviewed = yield* fixture(CachePolicyAuditReport.make({ findings: [advisory], unassessed: [] }));
        yield* reviewed.run(["audit"]);
        const refused = yield* fixture(CachePolicyAuditReport.make({ findings: [advisory, blocking], unassessed: [] }));
        expect(yield* refused.run(["audit"]).pipe(Effect.isFailure)).toBe(true);
        expect(yield* refused.run(["audit", "--json"]).pipe(Effect.isFailure)).toBe(true);
        expect(yield* consoleText).toContain("REVIEW configuration-source-drift: turbo.json");
        expect(yield* consoleText).toContain("BLOCK unqualified-reuse: @beep/fixture#lint");
        expect(yield* errorText).toContain("Current cache reuse differs from reviewed policy.");
      })
    );
  });

  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("decodes reviewed requests before dispatching baseline, transition and activation operations", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.run(["baseline", "--request", f.requests.baseline]);
        yield* f.run(["transition", "--request", f.requests.transition]);
        const output = f.path.join(f.root, "preview.json");
        yield* f.run(["activation", "--request", f.requests.activation, "--output", output]);
        expect(yield* f.fs.readFileString(output).pipe(Effect.flatMap(decodePreview))).toEqual(preview);
        expect(f.calls).toEqual(["baseline", "transition", "activation"]);
        expect(yield* consoleText).toContain("Reviewed baseline written for 0 executable computations");
        expect(yield* consoleText).toContain("Qualification revision 1: @beep/fixture#lint is excluded.");
      })
    );
  });

  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("prints fingerprints or writes their exact schema representation to a selected file", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.run(["fingerprint", "--computation", key.computation]);
        const output = f.path.join(f.root, "identity.json");
        yield* f.run(["fingerprint", "--computation", key.computation, "--output", output]);
        expect(yield* f.fs.readFileString(output).pipe(Effect.flatMap(decodeIdentity))).toEqual(identity);
        expect(yield* consoleText).toContain('"cache-live-identity/v1"');
        expect(yield* consoleText).toContain("Fingerprint recorded for @beep/fixture#lint");
        expect(yield* f.run(["fingerprint", "--computation", "@beep/unknown#lint"]).pipe(Effect.isFailure)).toBe(true);
        expect(
          yield* Effect.acquireUseRelease(
            Effect.sync(() => vi.spyOn(Bun, "write").mockRejectedValue(new Error("fixture write failure"))),
            () => f.run(["fingerprint", "--computation", key.computation, "--output", output]).pipe(Effect.isFailure),
            (spy) => Effect.sync(() => spy.mockRestore())
          )
        ).toBe(true);
        expect(yield* errorText).toContain("Unknown computation.");
        expect(yield* errorText).toContain("Failed to write");
      })
    );
  });

  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect("rejects malformed, missing, escaping and invalid UTF-8 requests before calling an operation", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const bad = f.path.join(f.root, "bad.json");
        yield* f.fs.writeFileString(bad, "{}");
        for (const command of ["baseline", "transition", "activation", "synthetic", "pilot"]) {
          expect(yield* f.run([command, "--request", bad]).pipe(Effect.isFailure)).toBe(true);
        }
        yield* f.fs.writeFile(bad, new Uint8Array([255]));
        expect(yield* f.run(["activation", "--request", bad]).pipe(Effect.isFailure)).toBe(true);
        expect(yield* errorText).toContain("not valid UTF-8");
        expect(
          yield* f.run(["activation", "--request", f.path.join(f.root, "missing.json")]).pipe(Effect.isFailure)
        ).toBe(true);
        expect(yield* f.run(["activation", "--request", "/outside-request.json"]).pipe(Effect.isFailure)).toBe(true);
        expect(f.calls).toEqual([]);
      })
    );
  });
});
