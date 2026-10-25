import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import {
  CoveragePackageArtifact,
  CoverageProducerCompareOptions,
  CoverageProducerIdentity,
  CoverageProducerManifest,
  CoverageProducerPackage,
  CoverageProducerPartition,
  CoverageProducerWriteOptions,
  CoverageRawFile,
  CoverageRegressionBaseline,
  CoverageRuntimeReceipt,
  collectCoverageProducerArtifacts,
  compareCoverageProducerArtifacts,
  discoverCoverageArtifactSources,
  resolveCoverageProducerIdentity,
  writeCoverageProducerArtifact,
} from "@beep/repo-cli/test/Quality";
import { sha256Hex } from "@beep/repo-utils/Sha256Hex";
import { currentHostPlatform } from "@beep/utils";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import { assertDefined } from "@effect/vitest/utils";
import { createInstrumenter } from "@vitest/istanbul-lib-instrument";
import convertV8 from "ast-v8-to-istanbul";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import { ts } from "ts-morph";
import { parse } from "vite";
import { hostNodeExecutable } from "./helpers/native-node.ts";

const nativeTestRuntime = process.versions.bun === undefined ? "node" : "bun";
const nativeTestVersion = process.versions.bun ?? process.versions.node;

// The producer's runtime metadata is a boundary: fixtures exercise both admitted
// Bun metadata and its rejection while retaining real filesystem/process services.
const runtimeVersions = (bun: string | undefined) =>
  vi.stubGlobal(
    "process",
    new Proxy(process, {
      get: (target, key, receiver) =>
        key === "versions"
          ? new Proxy(target.versions, {
              get: (versions, versionKey, versionReceiver) =>
                versionKey === "bun" ? bun : Reflect.get(versions, versionKey, versionReceiver),
            })
          : Reflect.get(target, key, receiver),
    })
  );
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const encode = S.encodeEffect(S.fromJsonString(S.Unknown));
const decodeManifest = S.decodeUnknownEffect(S.fromJsonString(CoverageProducerManifest));
const fixture = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "coverage-artifacts-" });
  const packagePath = "packages/example";
  const packageRoot = path.join(root, packagePath);
  yield* fs.makeDirectory(path.join(packageRoot, "src"), { recursive: true });
  yield* fs.makeDirectory(path.join(packageRoot, "coverage"), { recursive: true });
  yield* fs.writeFileString(
    path.join(root, "package.json"),
    '{"name":"@beep/fixture-root","private":true,"workspaces":["packages/*"]}'
  );
  yield* fs.writeFileString(
    path.join(packageRoot, "package.json"),
    '{"name":"@beep/example","type":"module","scripts":{"coverage":"vitest run --coverage"}}'
  );
  yield* fs.writeFileString(
    path.join(packageRoot, "vitest.config.ts"),
    'export default { test: { coverage: { include: ["src/**/*.ts"], exclude: ["src/excluded.ts"] } } }'
  );
  const source = "export const choose = (flag: boolean) => flag ? 1 : 2;\n";
  yield* fs.writeFileString(path.join(packageRoot, "src/choose.ts"), source);
  yield* fs.writeFileString(path.join(packageRoot, "src/index.ts"), 'export { choose } from "./choose.js";\n');
  yield* fs.writeFileString(path.join(packageRoot, "src/excluded.ts"), "export const excluded = 1;\n");
  const git = yield* StepExec.runCaptured({ command: "git", args: ["init", "--quiet"], cwd: root });
  expect(git.exitCode).toBe(0);
  const commit = yield* StepExec.runCaptured({
    command: "git",
    args: [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--allow-empty",
      "--no-gpg-sign",
      "-m",
      "fixture",
    ],
    cwd: root,
  });
  expect(commit.exitCode).toBe(0);
  const head = yield* StepExec.runCaptured({ command: "git", args: ["rev-parse", "HEAD"], cwd: root });
  const identity = CoverageProducerIdentity.make({
    executionSha: Str.trim(head.output),
    baseSha: Str.trim(head.output),
    runId: "123",
    runAttempt: 1,
    scopeDigest: yield* sha256Hex(yield* encode(["@beep/example"])),
  });
  const tests = [`${packagePath}/test/one.test.ts`, `${packagePath}/test/two.test.ts`];
  const instrumenter = createInstrumenter({ esModules: true });
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
  });
  instrumenter.instrumentSync(outputText, path.join(packageRoot, "src/choose.ts"));
  const raw = instrumenter.lastFileCoverage();
  if (raw === null || raw === undefined) return yield* Effect.die("Fixture instrumentation produced no coverage map");
  // Load the real Node/Bun Vitest provider before changing only the producer
  // metadata boundary, so Vite chooses its actual runtime implementation.
  yield* discoverCoverageArtifactSources(root, packagePath);
  runtimeVersions(process.versions.bun ?? "fixture-bun");
  const selection = (index: number) =>
    CoverageProducerPackage.make({
      packageName: "@beep/example",
      packagePath,
      expectedTestFiles: tests,
      testReportPath: "coverage/unit-results.json",
      testRuntime: nativeTestRuntime,
      testRuntimeVersion: nativeTestVersion,
      shard: { index, total: 2 },
    });
  const write = Effect.fnUntraced(function* (index: number, includeBarrel?: boolean, runAttempt = 1) {
    const coverage = {
      ...raw,
      s: R.map(raw.s, () => 1),
      f: R.map(raw.f, () => 1),
      b: R.map(raw.b, (hits) => A.map(hits, (_, branch) => (branch === index - 1 ? 1 : 0))),
    };
    yield* fs.writeFileString(
      path.join(packageRoot, "coverage/coverage-final.json"),
      yield* encode({
        [raw.path]: coverage,
        ...(includeBarrel === true
          ? {
              [path.join(packageRoot, "src/index.ts")]: {
                path: path.join(packageRoot, "src/index.ts"),
                statementMap: {},
                fnMap: {},
                branchMap: {},
                s: {},
                f: {},
                b: {},
              },
            }
          : {}),
      })
    );
    yield* fs.writeFileString(
      path.join(packageRoot, "coverage/unit-results.json"),
      yield* encode({
        success: true,
        numFailedTests: 0,
        numFailedTestSuites: 0,
        testResults: [{ name: path.join(root, tests[index - 1] ?? ""), status: "passed" }],
      })
    );
    yield* fs.writeFileString(
      path.join(packageRoot, "coverage/runtime.json"),
      yield* encode(
        CoverageRuntimeReceipt.make({
          schemaVersion: "coverage-runtime/v1",
          invocationId: "0",
          testRuntime: nativeTestRuntime,
          runtimeVersion: nativeTestVersion,
          provider: "istanbul",
          success: true,
        })
      )
    );
    yield* writeCoverageProducerArtifact(
      root,
      CoverageProducerWriteOptions.make({
        artifactRoot: `.beep/artifacts/shard-${index}`,
        identity: CoverageProducerIdentity.make({ ...identity, runAttempt }),
        partitionId: `unit-${index}`,
        packages: [selection(index)],
      })
    );
  });
  const options = CoverageProducerCompareOptions.make({
    artifactRoot: ".beep/artifacts",
    identity,
    scoped: true,
    expectedPartitions: A.map([1, 2], (index) =>
      CoverageProducerPartition.make({ partitionId: `unit-${index}`, packages: [selection(index)] })
    ),
  });
  return { root, fs, path, packageRoot, packagePath, identity, tests, raw, options, write };
});

const BranchHitsJson = S.fromJsonString(CoverageRawFile.fields.b);
const encodeBranchHits = S.encodeEffect(BranchHitsJson);
const decodeBranchHits = S.decodeEffect(BranchHitsJson);
const sameBranchHits = S.toEquivalence(CoverageRawFile.fields.b);
const decodeRawFixture = S.decodeUnknownEffect(S.fromJsonString(S.Record(S.String, CoverageRawFile)));
const signedV8Fixture = Effect.fnUntraced(function* () {
  const f = yield* fixture();
  const file = f.path.join(f.packageRoot, "src/choose.ts");
  const code = "export function choose(flag) { if (flag) { return 1; } return 2; }\n";
  yield* f.fs.writeFileString(file, code);
  yield* f.fs.remove(f.path.join(f.packageRoot, "src/index.ts"));
  const consequent = pipe(code, Str.indexOf("{ return 1; }"), O.getOrElse(constant(-1)));
  const fileUrl = yield* f.path.toFileUrl(file);
  const converted = yield* Effect.forEach([3, 0], (count) =>
    Effect.tryPromise(() =>
      convertV8({
        code,
        ast: parse("choose.js", code).then((result) => result.program),
        coverage: {
          url: fileUrl.href,
          functions: [
            {
              functionName: "choose",
              isBlockCoverage: true,
              ranges: [
                { startOffset: 0, endOffset: code.length, count: 1 },
                { startOffset: consequent + 1, endOffset: consequent + "{ return 1; }".length - 1, count },
              ],
            },
          ],
        },
      })
    ).pipe(Effect.flatMap(encode), Effect.flatMap(decodeRawFixture), Effect.map(R.values))
  );
  const first = converted[0]?.[0];
  const second = converted[1]?.[0];
  if (first === undefined || second === undefined) return yield* Effect.die("Expected real converter maps");
  expect(first.b["0"]).toEqual([3, -2]);
  expect(second.b["0"]).toEqual([0, 1]);
  const node = yield* hostNodeExecutable;
  const version = yield* StepExec.runCaptured({ command: node, args: ["--print", "process.versions.node"] });
  const searchPath = yield* Config.String("PATH");
  const delimiter = currentHostPlatform === "win32" ? ";" : ":";
  const selection = (index: number, provider: "v8" | "istanbul" = "v8") =>
    CoverageProducerPackage.make({
      packageName: "@beep/example",
      packagePath: f.packagePath,
      expectedTestFiles: f.tests,
      testReportPath: "coverage/unit-results.json",
      testRuntime: "node",
      testRuntimeVersion: Str.trim(version.output),
      provider,
      testCommand: ["bunx", "vitest", "run"],
      testEnvironment: { PATH: `${f.path.dirname(node)}${delimiter}${searchPath}` },
      shard: { index, total: 2 },
    });
  const write = Effect.fnUntraced(function* (index: number, raw: unknown, provider: "v8" | "istanbul" = "v8") {
    const invocation = selection(index, provider);
    yield* f.fs.writeFileString(
      f.path.join(f.packageRoot, "coverage/coverage-final.json"),
      yield* encode({ [file]: raw })
    );
    yield* f.fs.writeFileString(
      f.path.join(f.packageRoot, "coverage/unit-results.json"),
      yield* encode({
        success: true,
        numFailedTests: 0,
        numFailedTestSuites: 0,
        testResults: [{ name: f.path.join(f.root, f.tests[index - 1] ?? ""), status: "passed" }],
      })
    );
    yield* f.fs.writeFileString(
      f.path.join(f.packageRoot, "coverage/runtime.json"),
      yield* encode(
        CoverageRuntimeReceipt.make({
          schemaVersion: "coverage-runtime/v1",
          invocationId: invocation.invocationId,
          testRuntime: "node",
          runtimeVersion: invocation.testRuntimeVersion,
          provider,
          success: true,
        })
      )
    );
    yield* writeCoverageProducerArtifact(
      f.root,
      CoverageProducerWriteOptions.make({
        artifactRoot: `.beep/signed-artifacts/shard-${index}`,
        identity: f.identity,
        partitionId: `signed-${index}`,
        packages: [invocation],
      })
    );
  });
  const options = CoverageProducerCompareOptions.make({
    artifactRoot: ".beep/signed-artifacts",
    identity: f.identity,
    scoped: true,
    expectedPartitions: A.map([1, 2], (index) =>
      CoverageProducerPartition.make({
        partitionId: `signed-${index}`,
        packages: [selection(index)],
      })
    ),
  });
  return { ...f, first, second, write, options };
});

type ArtifactFixture = Effect.Success<ReturnType<typeof fixture>>;
const sealedFixture = Effect.fnUntraced(function* () {
  const f = yield* fixture();
  yield* f.write(1);
  yield* f.write(2);
  const manifestPath = f.path.join(f.root, ".beep/artifacts/shard-2/manifest.json");
  const manifest = yield* f.fs.readFileString(manifestPath).pipe(Effect.flatMap(decodeManifest));
  const entry = manifest.packages[0];
  if (entry === undefined) return yield* Effect.die("Expected sealed package");
  return { ...f, manifest, manifestPath, entry };
});
const rejectChangedManifest = Effect.fnUntraced(function* (
  f: Effect.Success<ReturnType<typeof sealedFixture>>,
  manifest: CoverageProducerManifest
) {
  yield* f.fs.writeFileString(f.manifestPath, yield* encode(manifest));
  const failure = yield* collectCoverageProducerArtifacts(f.root, f.options).pipe(Effect.flip);
  expect(failure.message).toContain("Coverage artifact:");
});

const compoundFixture = Effect.fnUntraced(function* (secondRuntime: "bun" | "node", testOnly = false) {
  const f = yield* fixture();
  const runtimes: ReadonlyArray<"bun" | "node"> = testOnly === true ? ["node", "bun"] : ["bun", secondRuntime];
  const bunVersion = yield* StepExec.runCaptured({ command: "bun", args: ["--print", "process.versions.bun"] });
  const node = yield* hostNodeExecutable;
  const searchPath = yield* Config.String("PATH");
  const delimiter = currentHostPlatform === "win32" ? ";" : ":";
  const nodeVersion = yield* StepExec.runCaptured({ command: node, args: ["--print", "process.versions.node"] });
  const packages = yield* Effect.forEach(
    runtimes,
    Effect.fnUntraced(function* (runtime, index) {
      const invocationId = `invocation-${index}`;
      const directory = `coverage/${invocationId}`;
      yield* f.fs.makeDirectory(f.path.join(f.packageRoot, directory), { recursive: true });
      const selection = CoverageProducerPackage.make({
        packageName: "@beep/example",
        packagePath: f.packagePath,
        invocationId,
        testRuntime: runtime,
        testOnly: testOnly === true && index === 1,
        provider: testOnly === true && index === 0 ? "v8" : "istanbul",
        testEnvironment: runtime === "node" ? { PATH: `${f.path.dirname(node)}${delimiter}${searchPath}` } : {},
        testRuntimeVersion: runtime === "bun" ? Str.trim(bunVersion.output) : Str.trim(nodeVersion.output),
        expectedTestFiles: testOnly === true ? A.take(A.drop(f.tests, index), 1) : f.tests,
        testReportPath: `${directory}/unit-results.json`,
        runtimeReportPath: `${directory}/runtime.json`,
        testCommand: runtime === "bun" ? ["bunx", "--bun", "vitest", "run"] : ["bunx", "vitest", "run"],
      });
      const raw = {
        ...f.raw,
        s: R.map(f.raw.s, () => 1),
        f: R.map(f.raw.f, () => 1),
        b: R.map(f.raw.b, (hits) => A.map(hits, (_, branch) => (branch === index ? 1 : 0))),
      };
      yield* f.fs.writeFileString(
        f.path.join(f.packageRoot, directory, "coverage-final.json"),
        yield* encode({
          [f.raw.path]: raw,
          ...(selection.provider === "v8"
            ? {
                [f.path.join(f.packageRoot, "src/index.ts")]: {
                  path: f.path.join(f.packageRoot, "src/index.ts"),
                  statementMap: {},
                  fnMap: {},
                  branchMap: {},
                  s: {},
                  f: {},
                  b: {},
                },
              }
            : {}),
        })
      );
      yield* f.fs.writeFileString(
        f.path.join(f.packageRoot, selection.testReportPath),
        yield* encode({
          success: true,
          numFailedTests: 0,
          numFailedTestSuites: 0,
          testResults: A.map(selection.expectedTestFiles, (file) => ({
            name: f.path.join(f.root, file),
            status: "passed",
          })),
        })
      );
      yield* f.fs.writeFileString(
        f.path.join(f.packageRoot, selection.runtimeReportPath),
        yield* encode(
          CoverageRuntimeReceipt.make({
            schemaVersion: "coverage-runtime/v1",
            invocationId,
            testRuntime: runtime,
            runtimeVersion: selection.testRuntimeVersion,
            provider: selection.provider,
            success: true,
          })
        )
      );
      return selection;
    }),
    { concurrency: 1 }
  );
  const options = CoverageProducerCompareOptions.make({
    artifactRoot: ".beep/compound",
    identity: f.identity,
    scoped: true,
    expectedPartitions: [CoverageProducerPartition.make({ partitionId: "compound", packages })],
  });
  const write = writeCoverageProducerArtifact(
    f.root,
    CoverageProducerWriteOptions.make({
      artifactRoot: ".beep/compound/one",
      identity: f.identity,
      partitionId: "compound",
      packages,
    })
  );
  return { ...f, packages, options, write };
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("coverage artifact integrity", (it) => {
  describe("runtime invocation integrity", () => {
    it.effect("refuses to publish Bun provenance from a Node runtime", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        runtimeVersions(undefined);
        const failure = yield* writeCoverageProducerArtifact(
          f.root,
          CoverageProducerWriteOptions.make({
            artifactRoot: ".beep/rejected-node",
            identity: f.identity,
            partitionId: "node",
            packages: [],
          })
        ).pipe(Effect.flip);
        expect(failure.message).toContain("must run under Bun");
        expect(yield* f.fs.exists(f.path.join(f.root, ".beep/rejected-node/manifest.json"))).toBe(false);
      })
    );

    for (const [kind, source] of R.toEntries({
      imported: 'import { Runtime } from "./excluded.ts"; export const it = Runtime.it;',
      namespace: 'import * as Runtime from "./excluded.ts"; export const it = Runtime.it;',
      default: 'import Runtime from "./excluded.ts"; export const it = Runtime.it;',
      typeOnly: 'import type { Runtime } from "./excluded.ts"; export const it = Runtime.it;',
      destructured: 'import { Runtime } from "./excluded.ts"; export const { it } = Runtime;',
      uninitialized: 'import { Runtime } from "./excluded.ts"; export const it: unknown;',
      mutable: 'import { Runtime } from "./excluded.ts"; export let it = Runtime.it;',
      callback: 'import { Runtime } from "./excluded.ts"; export const it = () => Runtime.it;',
      call: 'import { Runtime } from "./excluded.ts"; export const it = Runtime.it();',
      local: "const Runtime = { it: 1 }; export const it = Runtime.it;",
      initializer: 'import { Runtime } from "./excluded.ts"; export const it = Runtime.it, extra = 1;',
    })) {
      it.effect(
        `validates present V8 zero maps against real provider and immutable import-binding shape: ${kind}`,
        () =>
          Effect.gen(function* () {
            const f = yield* signedV8Fixture();
            yield* f.fs.writeFileString(f.path.join(f.packageRoot, "src/choose.ts"), source);
            yield* f.fs.writeFileString(
              f.path.join(f.packageRoot, "src/excluded.ts"),
              "export const Runtime = { it: 1 };"
            );
            const empty = { ...f.first, statementMap: {}, fnMap: {}, branchMap: {}, s: {}, f: {}, b: {} };
            if (kind === "imported" || kind === "default") {
              yield* f.write(1, empty);
              yield* f.write(2, empty);
              const snapshots = yield* collectCoverageProducerArtifacts(f.root, f.options);
              expect(snapshots[0]?.baseline.uncovered).toEqual({ lines: 0, statements: 0, functions: 0, branches: 0 });
            } else {
              const failure = yield* f.write(1, empty).pipe(Effect.flip);
              expect(failure.message).toContain("missing executable source");
            }
          })
      );
    }

    it.effect("merges every explicit Bun and Node invocation while preserving their runtime receipts", () =>
      Effect.gen(function* () {
        const f = yield* compoundFixture("node");
        yield* f.write;
        const snapshots = yield* collectCoverageProducerArtifacts(f.root, f.options);
        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]?.baseline.branches).toBe(100);
        const manifest = yield* f.fs
          .readFileString(f.path.join(f.root, ".beep/compound/one/manifest.json"))
          .pipe(Effect.flatMap(decodeManifest));
        expect(A.map(manifest.packages, (entry) => entry.selection.testRuntime)).toEqual(["bun", "node"]);
        expect(manifest.producerRuntime).toBe("bun");
        expect(A.dedupe(A.map(manifest.packages, (entry) => entry.reportPath))).toHaveLength(2);
      })
    );
    it.effect("rejects two canonical invocations that use different coverage providers", () =>
      Effect.gen(function* () {
        const f = yield* compoundFixture("bun", true);
        const packages = A.map(f.packages, (selection) =>
          CoverageProducerPackage.make({ ...selection, testOnly: false })
        );
        yield* writeCoverageProducerArtifact(
          f.root,
          CoverageProducerWriteOptions.make({
            artifactRoot: ".beep/mixed-providers/one",
            identity: f.identity,
            partitionId: "mixed",
            packages,
          })
        );
        const failure = yield* collectCoverageProducerArtifacts(
          f.root,
          CoverageProducerCompareOptions.make({
            ...f.options,
            artifactRoot: ".beep/mixed-providers",
            expectedPartitions: [CoverageProducerPartition.make({ partitionId: "mixed", packages })],
          })
        ).pipe(Effect.flip);
        expect(failure.message).toContain("mixed coverage providers within one package");
      })
    );
    it.effect("rejects evidence consisting entirely of test-only invocations", () =>
      Effect.gen(function* () {
        const f = yield* compoundFixture("bun", true);
        const packages = A.map(f.packages, (selection) =>
          CoverageProducerPackage.make({ ...selection, testOnly: true })
        );
        yield* writeCoverageProducerArtifact(
          f.root,
          CoverageProducerWriteOptions.make({
            artifactRoot: ".beep/test-only/one",
            identity: f.identity,
            partitionId: "test-only",
            packages,
          })
        );
        const failure = yield* collectCoverageProducerArtifacts(
          f.root,
          CoverageProducerCompareOptions.make({
            ...f.options,
            artifactRoot: ".beep/test-only",
            expectedPartitions: [CoverageProducerPartition.make({ partitionId: "test-only", packages })],
          })
        ).pipe(Effect.flip);
        expect(failure.message).toContain("missing canonical coverage invocation");
      })
    );
    it.effect("authenticates Bun-only Unit receipts without adding their hits to canonical Node/V8 coverage", () =>
      Effect.gen(function* () {
        const f = yield* compoundFixture("bun", true);
        yield* f.write;
        const snapshots = yield* collectCoverageProducerArtifacts(f.root, f.options);
        expect(snapshots[0]?.baseline.branches).toBe(50);
        expect(snapshots[0]?.baseline.uncovered.branches).toBe(1);
        const manifestPath = f.path.join(f.root, ".beep/compound/one/manifest.json");
        const manifest = yield* f.fs.readFileString(manifestPath).pipe(Effect.flatMap(decodeManifest));
        expect(A.map(manifest.packages, (entry) => entry.selection.testOnly)).toEqual([false, true]);
        const unit = manifest.packages[1];
        assertDefined(unit);
        yield* f.fs.writeFileString(f.path.join(f.root, ".beep/compound/one", unit.runtimeReceiptPath), "{}");
        const failure = yield* collectCoverageProducerArtifacts(f.root, f.options).pipe(Effect.flip);
        expect(failure.message).toContain("runtime receipt digest mismatch");
      })
    );

    it.effect("rejects a compound package whose second canonical invocation is absent", () =>
      Effect.gen(function* () {
        const f = yield* compoundFixture("node");
        yield* f.write;
        const manifestPath = f.path.join(f.root, ".beep/compound/one/manifest.json");
        const manifest = yield* f.fs.readFileString(manifestPath).pipe(Effect.flatMap(decodeManifest));
        yield* f.fs.writeFileString(
          manifestPath,
          yield* encode(CoverageProducerManifest.make({ ...manifest, packages: A.take(manifest.packages, 1) }))
        );
        const failure = yield* collectCoverageProducerArtifacts(f.root, f.options).pipe(Effect.flip);
        expect(failure.message).toContain("package assignment differs");
      })
    );
    it.effect("rejects duplicate invocation identities even when different runtimes are claimed", () =>
      Effect.gen(function* () {
        const f = yield* compoundFixture("node");
        const packages = A.map(f.packages, (selection) =>
          CoverageProducerPackage.make({ ...selection, invocationId: "duplicate" })
        );
        const failure = yield* writeCoverageProducerArtifact(
          f.root,
          CoverageProducerWriteOptions.make({
            artifactRoot: ".beep/duplicate-invocations",
            identity: f.identity,
            partitionId: "duplicate",
            packages,
          })
        ).pipe(Effect.flip);
        expect(failure.message).toContain("duplicate producer package invocation");
      })
    );

    it.effect("rejects repeated test files across two same-runtime invocations", () =>
      Effect.gen(function* () {
        const f = yield* compoundFixture("bun");
        yield* f.write;
        const failure = yield* collectCoverageProducerArtifacts(f.root, f.options).pipe(Effect.flip);
        expect(failure.message).toContain("overlapping same-runtime invocations");
      })
    );
    for (const [scenario, patch] of R.toEntries({
      invocation: { invocationId: "different" },
      runtime: { testRuntime: nativeTestRuntime === "bun" ? "node" : "bun" },
      version: { runtimeVersion: "unexpected-version" },
      provider: { provider: "v8" },
      failed: { success: false },
    })) {
      it.effect(`rejects ${scenario} runtime attestation mismatch before sealing`, () =>
        Effect.gen(function* () {
          const f = yield* sealedFixture();
          const receipt = {
            schemaVersion: "coverage-runtime/v1",
            invocationId: "0",
            testRuntime: f.entry.selection.testRuntime,
            runtimeVersion: f.entry.selection.testRuntimeVersion,
            provider: f.entry.selection.provider,
            success: true,
            ...patch,
          };
          yield* f.fs.writeFileString(f.path.join(f.packageRoot, "coverage/runtime.json"), yield* encode(receipt));
          const failure = yield* writeCoverageProducerArtifact(
            f.root,
            CoverageProducerWriteOptions.make({
              artifactRoot: ".beep/invalid-runtime",
              identity: f.identity,
              partitionId: "invalid",
              packages: [f.entry.selection],
            })
          ).pipe(Effect.flip);
          expect(failure.message).toContain("runtime receipt differs");
        })
      );
    }
    for (const rewriteHash of [false, true]) {
      it.effect(
        `rejects runtime attestation tampering with ${rewriteHash ? "a rewritten" : "the original"} digest`,
        () =>
          Effect.gen(function* () {
            const f = yield* sealedFixture();
            const text = yield* encode({
              schemaVersion: "coverage-runtime/v1",
              invocationId: "0",
              testRuntime: "node",
              runtimeVersion: "wrong",
              provider: "istanbul",
              success: true,
            });
            yield* f.fs.writeFileString(
              f.path.join(f.root, ".beep/artifacts/shard-2", f.entry.runtimeReceiptPath),
              text
            );
            const entry = CoveragePackageArtifact.make({
              ...f.entry,
              runtimeReceiptSha256: rewriteHash ? yield* sha256Hex(text) : f.entry.runtimeReceiptSha256,
            });
            yield* rejectChangedManifest(f, CoverageProducerManifest.make({ ...f.manifest, packages: [entry] }));
          })
      );
    }
  });
  describe("source census and raw merging", () => {
    it.effect("discovers the declared environment and explicit config without executing test bodies", () =>
      Effect.gen(function* () {
        const f = yield* sealedFixture();
        vi.stubEnv("VITEST_COVERAGE_RATCHET", "1");
        yield* f.fs.writeFileString(
          f.path.join(f.packageRoot, "selected.config.ts"),
          'export default { test: { coverage: { include: process.env.VITEST_COVERAGE_RATCHET === "1" ? ["src/choose.ts"] : process.env.SELECTED_SOURCE === "alternate" ? ["src/excluded.ts"] : ["src/choose.ts"] } } }'
        );
        const invocation = CoverageProducerPackage.make({
          ...f.entry.selection,
          testEnvironment: { SELECTED_SOURCE: "alternate" },
          testCommand: ["bunx", "vitest", "run", "--config", "selected.config.ts"],
        });
        const files = yield* discoverCoverageArtifactSources(f.root, f.packagePath, invocation);
        expect(files).toEqual([`${f.packagePath}/src/excluded.ts`]);
        const failure = yield* writeCoverageProducerArtifact(
          f.root,
          CoverageProducerWriteOptions.make({
            artifactRoot: ".beep/config-mismatch",
            identity: f.identity,
            partitionId: "config-mismatch",
            packages: [invocation],
          })
        ).pipe(Effect.flip);
        expect(failure.message).toContain("unexpected coverage sources");
      })
    );
    it.effect("rejects a canonical discovery child whose runtime version differs from its declaration", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const invocation = CoverageProducerPackage.make({
          packageName: "@beep/example",
          packagePath: f.packagePath,
          expectedTestFiles: f.tests,
          testReportPath: "coverage/unit-results.json",
          testRuntime: nativeTestRuntime,
          testRuntimeVersion: "invalid-declared-version",
        });
        const failure = yield* discoverCoverageArtifactSources(f.root, f.packagePath, invocation).pipe(Effect.flip);
        expect(failure.message).toContain("canonical invocation source discovery failed");
        expect(failure.message).toContain("Coverage discovery runtime differs");
      })
    );

    it.effect("retains the configuration cause when source discovery cannot initialize Vitest", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.fs.writeFileString(
          f.path.join(f.packageRoot, "vitest.config.ts"),
          'throw new Error("invalid fixture coverage configuration"); export default {};'
        );
        const failure = yield* discoverCoverageArtifactSources(f.root, f.packagePath).pipe(Effect.flip);
        expect(failure.message).toContain("cannot resolve Vitest configuration");
        expect(failure.message).toContain("invalid fixture coverage configuration");
      })
    );

    it.effect("rejects a barrel that changes into executable source after its inventory was validated", () =>
      Effect.gen(function* () {
        const f = yield* sealedFixture();
        const barrel = f.path.join(f.packageRoot, "src/index.ts");
        let reads = 0;
        const racingFs = FileSystem.make({
          ...f.fs,
          readFile: Effect.fnUntraced(function* (file: string) {
            if (file === barrel) {
              reads += 1;
              if (reads === 2) yield* f.fs.writeFileString(barrel, "export const changed = 1;\n");
            }
            return yield* f.fs.readFile(file);
          }),
        });
        const failure = yield* collectCoverageProducerArtifacts(f.root, f.options).pipe(
          Effect.provideService(FileSystem.FileSystem, racingFs),
          Effect.flip
        );
        expect(reads).toBe(2);
        expect(failure.message).toContain(`missing source ${f.packagePath}/src/index.ts`);
        expect(yield* f.fs.readFileString(barrel)).toContain("export const changed = 1");
      })
    );

    it.effect("rejects an omitted V8 source instead of borrowing an Istanbul zero witness", () =>
      Effect.gen(function* () {
        const f = yield* sealedFixture();
        const selection = CoverageProducerPackage.make({ ...f.entry.selection, provider: "v8" });
        yield* f.fs.writeFileString(
          f.path.join(f.packageRoot, "coverage/runtime.json"),
          yield* encode(
            CoverageRuntimeReceipt.make({
              schemaVersion: "coverage-runtime/v1",
              invocationId: selection.invocationId,
              testRuntime: selection.testRuntime,
              runtimeVersion: selection.testRuntimeVersion,
              provider: "v8",
              success: true,
            })
          )
        );
        const failure = yield* writeCoverageProducerArtifact(
          f.root,
          CoverageProducerWriteOptions.make({
            artifactRoot: ".beep/missing-v8",
            identity: f.identity,
            partitionId: "v8",
            packages: [selection],
          })
        ).pipe(Effect.flip);
        expect(failure.message).toContain("missing V8 source");
      })
    );
    it.effect.prop(
      "round trips schema-generated signed branch records without changing hit counts",
      { branches: CoverageRawFile.fields.b },
      Effect.fnUntraced(function* ({ branches }) {
        const text = yield* encodeBranchHits(branches);
        const decoded = yield* decodeBranchHits(text);
        expect(sameBranchHits(branches, decoded)).toBe(true);
      }),
      { arbitrary: { runs: 64, seed: 1934 } }
    );

    it.effect("preserves real V8 implicit-else residuals through native merge and uncovered summaries", () =>
      Effect.gen(function* () {
        const f = yield* signedV8Fixture();
        yield* f.write(1, f.first);
        yield* f.write(2, f.second);
        const manifest = yield* f.fs
          .readFileString(f.path.join(f.root, ".beep/signed-artifacts/shard-1/manifest.json"))
          .pipe(Effect.flatMap(decodeManifest));
        const entry = manifest.packages[0];
        if (entry === undefined) return yield* Effect.die("Expected signed report");
        const raw = yield* f.fs
          .readFileString(f.path.join(f.root, ".beep/signed-artifacts/shard-1", entry.reportPath))
          .pipe(Effect.flatMap(decodeRawFixture));
        expect(R.values(raw)[0]?.b["0"]).toEqual([3, -2]);
        const snapshots = yield* collectCoverageProducerArtifacts(f.root, f.options);
        const row = snapshots[0]?.baseline.files[`${f.packagePath}/src/choose.ts`];
        // Native signed addition gives [3,-1]. Clamping before merge would falsely cover both branches.
        expect(row?.branches).toBe(50);
        expect(row?.uncovered.branches).toBe(1);
      })
    );

    it.effect("rejects an Istanbul signed residual even when its shape matches V8", () =>
      Effect.gen(function* () {
        const f = yield* signedV8Fixture();
        const failure = yield* f.write(1, f.first, "istanbul").pipe(Effect.flip);
        expect(failure.message).toContain("invalid branch counters");
      })
    );

    for (const [kind, mutate] of R.toEntries({
      explicitElse: (raw: CoverageRawFile) => ({
        ...raw,
        branchMap: R.map(raw.branchMap, (branch) => ({ ...branch, locations: [branch.loc, branch.loc] })),
      }),
      wrongType: (raw: CoverageRawFile) => ({
        ...raw,
        branchMap: R.map(raw.branchMap, (branch) => ({ ...branch, type: "cond-expr" })),
      }),
      wrongArity: (raw: CoverageRawFile) => ({ ...raw, b: { "0": [3, -2, 0] } }),
      negativeFirst: (raw: CoverageRawFile) => ({ ...raw, b: { "0": [-1, 2] } }),
      negativeParent: (raw: CoverageRawFile) => ({ ...raw, b: { "0": [1, -2] } }),
      wrongFirstLocation: (raw: CoverageRawFile) => ({
        ...raw,
        branchMap: R.map(raw.branchMap, (branch) => ({
          ...branch,
          locations: [{ start: { line: 1, column: 0 }, end: { line: 1, column: 1 } }, branch.locations[1]],
        })),
      }),
      negativeStatement: (raw: CoverageRawFile) => ({ ...raw, s: R.map(raw.s, () => -1) }),
      negativeFunction: (raw: CoverageRawFile) => ({ ...raw, f: R.map(raw.f, () => -1) }),
      fractional: (raw: CoverageRawFile) => ({ ...raw, b: { "0": [3, -0.5] } }),
    })) {
      it.effect(`rejects ${kind} signed coverage outside the V8 implicit-else contract`, () =>
        Effect.gen(function* () {
          const f = yield* signedV8Fixture();
          const failure = yield* f.write(1, mutate(f.first)).pipe(Effect.flip);
          expect(failure.message).toContain("Coverage artifact:");
        })
      );
    }

    it.effect("rejects mixed providers within one package before merging maps", () =>
      Effect.gen(function* () {
        const f = yield* sealedFixture();
        const selection = CoverageProducerPackage.make({ ...f.entry.selection, provider: "v8" });
        const manifest = CoverageProducerManifest.make({
          ...f.manifest,
          packages: [CoveragePackageArtifact.make({ ...f.entry, selection })],
        });
        yield* f.fs.writeFileString(f.manifestPath, yield* encode(manifest));
        const options = CoverageProducerCompareOptions.make({
          ...f.options,
          expectedPartitions: A.map(f.options.expectedPartitions, (partition) =>
            partition.partitionId === "unit-2"
              ? CoverageProducerPartition.make({ ...partition, packages: [selection] })
              : partition
          ),
        });
        const failure = yield* collectCoverageProducerArtifacts(f.root, options).pipe(Effect.flip);
        expect(failure.message).toContain("mixed coverage providers");
      })
    );
    it.effect("merges complementary branch hits and retains an instrumenter-proven empty barrel", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.write(1);
        yield* f.write(2);
        const snapshots = yield* collectCoverageProducerArtifacts(f.root, f.options);
        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]?.baseline.branches).toBe(100);
        expect(snapshots[0]?.baseline.uncovered).toEqual({ lines: 0, statements: 0, functions: 0, branches: 0 });
        expect(R.keys(snapshots[0]?.baseline.files ?? {})).toEqual([
          `${f.packagePath}/src/choose.ts`,
          `${f.packagePath}/src/index.ts`,
        ]);
        expect(yield* discoverCoverageArtifactSources(f.root, f.packagePath)).toEqual([
          `${f.packagePath}/src/choose.ts`,
          `${f.packagePath}/src/index.ts`,
        ]);
      })
    );

    it.effect("merges a genuine empty barrel present in one shard and omitted in another", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.write(1, true);
        yield* f.write(2);
        const snapshots = yield* collectCoverageProducerArtifacts(f.root, f.options);
        expect(snapshots[0]?.baseline.files[`${f.packagePath}/src/index.ts`]?.uncovered).toEqual({
          lines: 0,
          statements: 0,
          functions: 0,
          branches: 0,
        });
      })
    );

    for (const [kind, source] of R.toEntries({
      schemaError:
        'import { TaggedError, String as StringSchema } from "effect/Schema"; export class DomainError extends TaggedError<DomainError>()("DomainError", { message: StringSchema }) {}',
      typeDeclarations: 'export interface Model { value: string } export type Value = Model["value"];',
      typeReexports:
        'import type { Model } from "./types.js"; export type { Model }; export { choose } from "./choose.js";',
    })) {
      it.effect(`retains ${kind} only when the real instrumenter proves zero units`, () =>
        Effect.gen(function* () {
          const f = yield* fixture();
          yield* f.fs.writeFileString(f.path.join(f.packageRoot, "src/model.ts"), source);
          yield* f.write(1);
          yield* f.write(2);
          const snapshots = yield* collectCoverageProducerArtifacts(f.root, f.options);
          expect(snapshots[0]?.baseline.files[`${f.packagePath}/src/model.ts`]?.uncovered).toEqual({
            lines: 0,
            statements: 0,
            functions: 0,
            branches: 0,
          });
        })
      );
    }
    it.effect("retains a default registry call only when Istanbul assigns no own units", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.fs.writeFileString(
          f.path.join(f.packageRoot, "src/registry.ts"),
          'import { definePlugin, rule } from "./rules.js"; export default definePlugin({ meta: { name: "fixture" }, rules: { stable: rule } });'
        );
        yield* f.write(1);
        yield* f.write(2);
        const snapshots = yield* collectCoverageProducerArtifacts(f.root, f.options);
        expect(snapshots[0]?.baseline.files[`${f.packagePath}/src/registry.ts`]?.uncovered).toEqual({
          lines: 0,
          statements: 0,
          functions: 0,
          branches: 0,
        });
      })
    );

    it.effect("retains a directive-prologue re-export only when Istanbul proves zero own units", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.fs.writeFileString(
          f.path.join(f.packageRoot, "src/direction.ts"),
          '"use client"; "use strict"; export { DirectionProvider, useDirection } from "@base-ui/react/direction-provider";'
        );
        yield* f.write(1);
        yield* f.write(2);
        const snapshots = yield* collectCoverageProducerArtifacts(f.root, f.options);
        expect(snapshots[0]?.baseline.files[`${f.packagePath}/src/direction.ts`]?.uncovered).toEqual({
          lines: 0,
          statements: 0,
          functions: 0,
          branches: 0,
        });
      })
    );

    for (const [kind, source] of R.toEntries({
      method: "export class Runtime { run() { return 1; } }",
      field: "export class Runtime { value = 1; }",
      static: "export class Runtime { static { console.log(1); } }",
      decorator: "@decorate export class Runtime {}",
      callbackBase: "export class Runtime extends (() => Object)() {}",
      enum: "export enum Runtime { First }",
      defaultCallback: "export default definePlugin({ create: () => 1 });",
      defaultMethod: "export default definePlugin({ create() { return 1; } });",
      defaultBranch: "export default definePlugin({ value: flag ? 1 : 2 });",
      defaultMutable: "export default (globalThis.value = 1);",
      mixedDefault: "export const value = 1; export default definePlugin({ value });",
      exportEquals: "export = definePlugin({});",
      nonPrologueString: 'export { choose } from "./choose.js"; "use client";',
      computedDirective: '("use client"); export { choose } from "./choose.js";',
      directiveRuntime: '"use client"; export const value = sideEffect();',
      directiveCallback: '"use client"; export default definePlugin({ create: () => 1 });',
    })) {
      it.effect(`rejects missing ${kind} coverage instead of treating it as a zero-unit declaration`, () =>
        Effect.gen(function* () {
          const f = yield* fixture();
          yield* f.fs.writeFileString(f.path.join(f.packageRoot, "src/runtime.ts"), source);
          const failure = yield* f.write(1).pipe(Effect.flip);
          expect(failure.message).toContain("missing executable source");
        })
      );
    }

    it.effect("compares sealed snapshots with existing floors without a local coverage producer", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.write(1);
        yield* f.write(2);
        const snapshots = yield* collectCoverageProducerArtifacts(f.root, f.options);
        const first = snapshots[0];
        if (first === undefined) return yield* Effect.die("Expected validated snapshot");
        yield* f.fs.makeDirectory(f.path.join(f.root, "standards"));
        const baseline = CoverageRegressionBaseline.make({
          schema_version: 2,
          generated_at: "fixture",
          git_sha: f.identity.executionSha,
          command: "fixture",
          epsilon: 0.001,
          minimum: {
            lines: first.baseline.lines,
            statements: first.baseline.statements,
            functions: first.baseline.functions,
            branches: first.baseline.branches,
          },
          exemptions: {},
          follow_ups: {},
          packages: { "@beep/example": first.baseline },
        });
        yield* f.fs.writeFileString(
          f.path.join(f.root, "standards/coverage.regression-baseline.jsonc"),
          yield* encode(baseline)
        );
        // Removing local reports proves the adapter consumes sealed artifacts only.
        yield* f.fs.remove(f.path.join(f.packageRoot, "coverage"), { recursive: true });
        yield* compareCoverageProducerArtifacts(f.root, f.options).pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}))
        );
        expect(yield* f.fs.exists(f.path.join(f.packageRoot, "coverage"))).toBe(false);
      })
    );
  });
  describe("checkout and source identity", () => {
    it.effect("keeps the explicit run base and scope stable when origin main advances", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const resolve = resolveCoverageProducerIdentity(f.root, {
          base: f.identity.baseSha,
          packageNames: ["@beep/example"],
        }).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({ GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1" })
          )
        );
        const before = yield* resolve;
        for (const args of [
          ["update-ref", "refs/remotes/origin/main", f.identity.baseSha],
          [
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.test",
            "commit",
            "--allow-empty",
            "--no-gpg-sign",
            "-m",
            "advanced main",
          ],
          ["update-ref", "refs/remotes/origin/main", "HEAD"],
          ["update-ref", "HEAD", f.identity.executionSha],
        ]) {
          const result = yield* StepExec.runCaptured({ command: "git", args, cwd: f.root });
          expect(result.exitCode).toBe(0);
        }
        const moving = yield* StepExec.runCaptured({ command: "git", args: ["rev-parse", "origin/main"], cwd: f.root });
        expect(Str.trim(moving.output)).not.toBe(before.baseSha);
        expect(yield* resolve).toEqual(before);
      })
    );

    it.effect("fails closed when a selected shard never uploaded", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.write(1);
        const failure = yield* collectCoverageProducerArtifacts(f.root, f.options).pipe(Effect.flip);
        expect(failure.message).toContain("missing producer partitions");
      })
    );

    it.effect("rejects changed checkout identity before consuming reports", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const failure = yield* collectCoverageProducerArtifacts(
          f.root,
          CoverageProducerCompareOptions.make({
            ...f.options,
            identity: CoverageProducerIdentity.make({ ...f.identity, executionSha: Str.repeat(40)("b") }),
          })
        ).pipe(Effect.flip);
        expect(failure.message).toContain("differs from the checkout");
      })
    );

    it.effect("refuses to overwrite an existing producer manifest", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.write(1);
        const failure = yield* f.write(1).pipe(Effect.flip);
        expect(failure.message).toContain("already exists");
      })
    );

    it.effect("rejects a newly selected executable source omitted by the producer", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.fs.writeFileString(
          f.path.join(f.packageRoot, "src/untouched.ts"),
          "export const untouched = () => 42;\n"
        );
        const failure = yield* f.write(1).pipe(Effect.flip);
        expect(failure.message).toContain("missing executable source");
      })
    );

    it.effect("binds the actual execution SHA while keeping the requested PR head separate", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const identity = yield* resolveCoverageProducerIdentity(f.root, {
          base: "HEAD",
          packageNames: ["@beep/example"],
        }).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({
              BEEP_COVERAGE_RUN_ID: "producer",
              BEEP_COVERAGE_RUN_ATTEMPT: "3",
              GITHUB_RUN_ID: "consumer",
              GITHUB_RUN_ATTEMPT: "9",
              BEEP_COVERAGE_REQUEST_HEAD_SHA: Str.repeat(40)("b"),
            })
          )
        );
        expect(identity.executionSha).toBe(f.identity.executionSha);
        expect(identity.baseSha).toBe(f.identity.executionSha);
        expect(identity.requestHeadSha).toBe(Str.repeat(40)("b"));
        expect(identity.runId).toBe("producer");
        expect(identity.runAttempt).toBe(3);
        const fallback = yield* resolveCoverageProducerIdentity(f.root, {
          base: "HEAD",
          packageNames: ["@beep/example"],
        }).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({ GITHUB_RUN_ID: "producer", GITHUB_RUN_ATTEMPT: "3" })
          )
        );
        expect(fallback.scopeDigest).toBe(identity.scopeDigest);
        expect(fallback.requestHeadSha).toBeUndefined();
      })
    );

    it.effect("accepts genuine remapped Istanbul ranges and implicit else locations without losing counters", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.write(1);
        const remapped = {
          ...f.raw,
          statementMap: R.map(f.raw.statementMap, (range) => ({ ...range, end: { ...range.end, column: null } })),
          fnMap: R.map(f.raw.fnMap, ({ line: _line, ...fn }) => ({
            ...fn,
            loc: { ...fn.loc, end: { ...fn.loc.end, column: null } },
          })),
          branchMap: R.map(f.raw.branchMap, ({ line: _line, ...branch }) => ({
            ...branch,
            locations: A.map(branch.locations, (range, index) => (index === 0 ? range : { start: {}, end: {} })),
          })),
          s: R.map(f.raw.s, () => 1),
          f: R.map(f.raw.f, () => 1),
          b: R.map(f.raw.b, (hits) => A.map(hits, () => 1)),
        };
        yield* f.fs.writeFileString(
          f.path.join(f.packageRoot, "coverage/coverage-final.json"),
          yield* encode({ [f.raw.path]: remapped })
        );
        const selection = CoverageProducerPackage.make({
          packageName: "@beep/example",
          packagePath: f.packagePath,
          expectedTestFiles: [f.tests[0] ?? ""],
          testReportPath: "coverage/unit-results.json",
          testRuntime: nativeTestRuntime,
          testRuntimeVersion: nativeTestVersion,
        });
        yield* writeCoverageProducerArtifact(
          f.root,
          CoverageProducerWriteOptions.make({
            artifactRoot: ".beep/remapped/one",
            identity: f.identity,
            partitionId: "one",
            packages: [selection],
          })
        );
        const snapshots = yield* collectCoverageProducerArtifacts(
          f.root,
          CoverageProducerCompareOptions.make({
            artifactRoot: ".beep/remapped",
            identity: f.identity,
            scoped: true,
            expectedPartitions: [CoverageProducerPartition.make({ partitionId: "one", packages: [selection] })],
          })
        );
        expect(snapshots[0]?.baseline.uncovered).toEqual({ lines: 0, statements: 0, functions: 0, branches: 0 });
        expect(snapshots[0]?.baseline.branches).toBe(100);
      })
    );
  });
  describe("manifest and raw counter validation", () => {
    it.effect("decodes an older sealed manifest as canonical coverage with no preparation commands", () =>
      Effect.gen(function* () {
        const f = yield* sealedFixture();
        const manifest = yield* decodeManifest(
          yield* encode({
            ...f.manifest,
            packages: [{ ...f.entry, selection: Struct.omit(f.entry.selection, ["preparationCommands", "testOnly"]) }],
          })
        );
        expect(manifest.packages[0]?.selection.preparationCommands).toEqual([]);
        expect(manifest.packages[0]?.selection.testOnly).toBe(false);
      })
    );
    it.effect("selects the newest sealed attempt per partition without replaying successful older partitions", () =>
      Effect.gen(function* () {
        const f = yield* sealedFixture();
        yield* f.fs.rename(
          f.path.join(f.root, ".beep/artifacts/shard-2"),
          f.path.join(f.root, ".beep/artifacts/old-shard-2")
        );
        yield* f.write(2, false, 2);
        // The obsolete report is deliberately unreadable: only its envelope is
        // authoritative; raw counts must come from the newer complete attempt.
        yield* f.fs.writeFileString(
          f.path.join(f.root, ".beep/artifacts/old-shard-2", f.entry.reportPath),
          "obsolete report"
        );
        const snapshots = yield* collectCoverageProducerArtifacts(
          f.root,
          CoverageProducerCompareOptions.make({
            ...f.options,
            identity: CoverageProducerIdentity.make({ ...f.identity, runAttempt: 3 }),
          })
        );
        expect(snapshots[0]?.baseline.branches).toBe(100);
      })
    );

    it.effect("rejects a newer corrupted attempt instead of falling back to an older sealed partition", () =>
      Effect.gen(function* () {
        const f = yield* sealedFixture();
        yield* f.fs.rename(
          f.path.join(f.root, ".beep/artifacts/shard-2"),
          f.path.join(f.root, ".beep/artifacts/old-shard-2")
        );
        yield* f.write(2, false, 2);
        yield* f.fs.writeFileString(
          f.path.join(f.root, ".beep/artifacts/shard-2", f.entry.reportPath),
          "corrupted report"
        );
        const failure = yield* collectCoverageProducerArtifacts(
          f.root,
          CoverageProducerCompareOptions.make({
            ...f.options,
            identity: CoverageProducerIdentity.make({ ...f.identity, runAttempt: 2 }),
          })
        ).pipe(Effect.flip);
        expect(failure.message).toContain("digest");
      })
    );

    for (const scenario of ["missing", "attempt", "git"] as const) {
      it.effect(`rejects ${scenario} execution provenance`, () =>
        Effect.gen(function* () {
          const f = yield* fixture();
          const failure = yield* resolveCoverageProducerIdentity(f.root, {
            base: scenario === "git" ? "nonexistent-ref" : "HEAD",
            packageNames: [],
          }).pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown(
                scenario === "missing"
                  ? {}
                  : { GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: scenario === "attempt" ? "invalid" : "1" }
              )
            ),
            Effect.flip
          );
          expect(failure.message).toContain(
            scenario === "missing" ? "required" : scenario === "attempt" ? "invalid workflow attempt" : "cannot resolve"
          );
        })
      );
    }

    it.effect("rejects report bytes from an unsuccessful suite", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.write(1);
        yield* f.fs.writeFileString(
          f.path.join(f.packageRoot, "coverage/unit-results.json"),
          yield* encode({ success: false, numFailedTests: 1, numFailedTestSuites: 1, testResults: [] })
        );
        const failure = yield* writeCoverageProducerArtifact(
          f.root,
          CoverageProducerWriteOptions.make({
            artifactRoot: ".beep/artifacts/failed",
            identity: f.identity,
            partitionId: "failed",
            packages: [
              CoverageProducerPackage.make({
                packageName: "@beep/example",
                packagePath: f.packagePath,
                expectedTestFiles: f.tests,
                testReportPath: "coverage/unit-results.json",
                testRuntime: nativeTestRuntime,
                testRuntimeVersion: nativeTestVersion,
              }),
            ],
          })
        ).pipe(Effect.flip);
        expect(failure.message).toContain("unsuccessful");
      })
    );

    for (const [scenario, patch] of R.toEntries({
      attempt: { runAttempt: 2 },
      run: { runId: "different-run" },
      requestHead: { requestHeadSha: Str.repeat(40)("b") },
      base: { baseSha: Str.repeat(40)("b") },
      scope: { scopeDigest: Str.repeat(64)("b") },
    })) {
      it.effect(`rejects stale ${scenario} provenance`, () =>
        Effect.gen(function* () {
          const f = yield* sealedFixture();
          yield* rejectChangedManifest(
            f,
            CoverageProducerManifest.make({
              ...f.manifest,
              identity: CoverageProducerIdentity.make({ ...f.manifest.identity, ...patch }),
            })
          );
        })
      );
    }
    for (const [scenario, patch] of R.toEntries({
      partition: { partitionId: "unplanned" },
      assignment: { packages: [] },
    })) {
      it.effect(`rejects unexpected ${scenario}`, () =>
        Effect.gen(function* () {
          const f = yield* sealedFixture();
          yield* rejectChangedManifest(f, CoverageProducerManifest.make({ ...f.manifest, ...patch }));
        })
      );
    }
    const packagePatches = {
      preparation: (_f: ArtifactFixture, entry: CoveragePackageArtifact) => ({
        ...entry,
        selection: CoverageProducerPackage.make({
          ...entry.selection,
          preparationCommands: [["bun", "run", "--cwd", "node_modules/unexpected", "build"]],
        }),
      }),
      continuation: (_f: ArtifactFixture, entry: CoveragePackageArtifact) => ({
        ...entry,
        selection: CoverageProducerPackage.make({ ...entry.selection, continuationScripts: ["test:unexpected"] }),
      }),
      overlap: (f: ArtifactFixture, entry: CoveragePackageArtifact) => ({
        ...entry,
        actualTestFiles: [f.tests[0] ?? ""],
      }),
      missingTests: (_f: ArtifactFixture, entry: CoveragePackageArtifact) => ({ ...entry, actualTestFiles: [] }),
      sourceHash: (_f: ArtifactFixture, entry: CoveragePackageArtifact) => ({
        ...entry,
        sources: A.map(entry.sources, (source) => ({ ...source, sha256: Str.repeat(64)("b") })),
      }),
      reportHash: (_f: ArtifactFixture, entry: CoveragePackageArtifact) => ({
        ...entry,
        reportSha256: Str.repeat(64)("b"),
      }),
    };
    for (const [scenario, patch] of R.toEntries(packagePatches)) {
      it.effect(`rejects ${scenario} envelope corruption`, () =>
        Effect.gen(function* () {
          const f = yield* sealedFixture();
          yield* rejectChangedManifest(
            f,
            CoverageProducerManifest.make({
              ...f.manifest,
              packages: [CoveragePackageArtifact.make(patch(f, f.entry))],
            })
          );
        })
      );
    }
    const rawPatches = {
      emptyMap: (_f: ArtifactFixture) => ({ statementMap: {}, fnMap: {}, branchMap: {}, s: {}, f: {}, b: {} }),
      counterMap: (_f: ArtifactFixture) => ({ s: {} }),
      negativeHits: (f: ArtifactFixture) => ({ s: R.map(f.raw.s, () => -1) }),
      branchArity: (f: ArtifactFixture) => ({ b: R.map(f.raw.b, () => []) }),
      keyPath: (f: ArtifactFixture) => ({ path: `${f.packagePath}/src/different.ts` }),
      instrumentation: (f: ArtifactFixture) => ({
        statementMap: R.map(f.raw.statementMap, (range) => ({ ...range, start: { ...range.start, line: 10 } })),
      }),
    };
    for (const [scenario, patch] of R.toEntries(rawPatches)) {
      it.effect(`rejects ${scenario} raw counter corruption`, () =>
        Effect.gen(function* () {
          const f = yield* sealedFixture();
          const rawPath = `${f.packagePath}/src/choose.ts`;
          const report = yield* encode({ [rawPath]: { ...f.raw, path: rawPath, ...patch(f) } });
          yield* f.fs.writeFileString(f.path.join(f.root, ".beep/artifacts/shard-2", f.entry.reportPath), report);
          yield* rejectChangedManifest(
            f,
            CoverageProducerManifest.make({
              ...f.manifest,
              packages: [CoveragePackageArtifact.make({ ...f.entry, reportSha256: yield* sha256Hex(report) })],
            })
          );
        })
      );
    }
  });
  describe("partition completeness", () => {
    it.effect("rejects a consumer plan that omits a selected package", () =>
      Effect.gen(function* () {
        const f = yield* sealedFixture();
        const failure = yield* collectCoverageProducerArtifacts(
          f.root,
          CoverageProducerCompareOptions.make({ ...f.options, expectedPartitions: [] })
        ).pipe(Effect.flip);
        expect(failure.message).toContain("selected package scope");
      })
    );
    it.effect("rejects a complete partition set containing an incomplete package shard set", () =>
      Effect.gen(function* () {
        const f = yield* sealedFixture();
        yield* f.fs.writeFileString(
          f.manifestPath,
          yield* encode(CoverageProducerManifest.make({ ...f.manifest, packages: [] }))
        );
        const expectedPartitions = A.map(f.options.expectedPartitions, (partition) =>
          partition.partitionId === "unit-2"
            ? CoverageProducerPartition.make({ ...partition, packages: [] })
            : partition
        );
        const failure = yield* collectCoverageProducerArtifacts(
          f.root,
          CoverageProducerCompareOptions.make({ ...f.options, expectedPartitions })
        ).pipe(Effect.flip);
        expect(failure.message).toContain("incomplete shard set");
      })
    );
    it.effect("rejects two reported slices for the same shard index", () =>
      Effect.gen(function* () {
        const f = yield* sealedFixture();
        const selection = CoverageProducerPackage.make({ ...f.entry.selection, shard: { index: 1, total: 2 } });
        yield* f.fs.writeFileString(
          f.manifestPath,
          yield* encode(
            CoverageProducerManifest.make({
              ...f.manifest,
              packages: [CoveragePackageArtifact.make({ ...f.entry, selection })],
            })
          )
        );
        const expectedPartitions = A.map(f.options.expectedPartitions, (partition) =>
          partition.partitionId === "unit-2"
            ? CoverageProducerPartition.make({ ...partition, packages: [selection] })
            : partition
        );
        const failure = yield* collectCoverageProducerArtifacts(
          f.root,
          CoverageProducerCompareOptions.make({ ...f.options, expectedPartitions })
        ).pipe(Effect.flip);
        expect(failure.message).toContain("shard indexes");
      })
    );
    for (const scenario of ["missing-report", "unexpected-test", "unexpected-source"] as const) {
      it.effect(`refuses to seal ${scenario} producer evidence`, () =>
        Effect.gen(function* () {
          const f = yield* sealedFixture();
          if (scenario === "missing-report") {
            yield* f.fs.remove(f.path.join(f.packageRoot, "coverage/unit-results.json"));
          } else if (scenario === "unexpected-test") {
            yield* f.fs.writeFileString(
              f.path.join(f.packageRoot, "coverage/unit-results.json"),
              yield* encode({
                success: true,
                numFailedTests: 0,
                numFailedTestSuites: 0,
                testResults: [{ name: f.path.join(f.root, "test/unselected.test.ts"), status: "passed" }],
              })
            );
          } else {
            const extra = f.path.join(f.packageRoot, "src/excluded.ts");
            yield* f.fs.writeFileString(
              f.path.join(f.packageRoot, "coverage/coverage-final.json"),
              yield* encode({ [f.raw.path]: f.raw, [extra]: { ...f.raw, path: extra } })
            );
          }
          const failure = yield* writeCoverageProducerArtifact(
            f.root,
            CoverageProducerWriteOptions.make({
              artifactRoot: ".beep/rejected",
              identity: f.identity,
              partitionId: "rejected",
              packages: [f.entry.selection],
            })
          ).pipe(Effect.flip);
          expect(failure.message).toContain("Coverage artifact:");
        })
      );
    }
  });
  describe("contained filesystem artifacts", () => {
    it.effect("refuses to publish through a symlinked artifact directory", () =>
      Effect.gen(function* () {
        const f = yield* sealedFixture();
        const fs = yield* FileSystem.FileSystem;
        const outside = f.path.join(f.root, "outside-artifacts");
        yield* fs.makeDirectory(outside);
        yield* fs.symlink(outside, f.path.join(f.root, ".beep/unsafe-output"));
        const failure = yield* writeCoverageProducerArtifact(
          f.root,
          CoverageProducerWriteOptions.make({
            artifactRoot: ".beep/unsafe-output",
            identity: f.identity,
            partitionId: "unsafe",
            packages: [f.entry.selection],
          })
        ).pipe(Effect.flip);
        expect(failure.message).toContain("cannot seal runtime receipt");
        expect(yield* fs.readDirectory(outside)).toEqual([]);
      })
    );

    it.effect("rejects a sealed report replaced by a filesystem symlink", () =>
      Effect.gen(function* () {
        const f = yield* sealedFixture();
        const fs = yield* FileSystem.FileSystem;
        const reportPath = f.path.join(f.root, ".beep/artifacts/shard-2", f.entry.reportPath);
        const original = yield* fs.readFileString(reportPath);
        const outside = f.path.join(f.root, "outside-report.json");
        yield* fs.writeFileString(outside, original);
        yield* fs.remove(reportPath);
        yield* fs.symlink(outside, reportPath);
        const failure = yield* collectCoverageProducerArtifacts(f.root, f.options).pipe(Effect.flip);
        expect(failure.message).toContain("cannot safely read");
      })
    );

    it.effect("rejects duplicate partitions even when their manifests are identical", () =>
      Effect.gen(function* () {
        const f = yield* sealedFixture();
        yield* f.fs.makeDirectory(f.path.join(f.root, ".beep/artifacts/duplicate"), { recursive: true });
        yield* f.fs.writeFileString(
          f.path.join(f.root, ".beep/artifacts/duplicate/manifest.json"),
          yield* encode(f.manifest)
        );
        yield* rejectChangedManifest(f, f.manifest);
      })
    );
    it.effect("rejects tied obsolete attempts even when a newer partition is available", () =>
      Effect.gen(function* () {
        const f = yield* sealedFixture();
        yield* f.fs.copy(
          f.path.join(f.root, ".beep/artifacts/shard-2"),
          f.path.join(f.root, ".beep/artifacts/duplicate-old-shard-2")
        );
        yield* f.fs.rename(
          f.path.join(f.root, ".beep/artifacts/shard-2"),
          f.path.join(f.root, ".beep/artifacts/old-shard-2")
        );
        yield* f.write(2, false, 2);
        const failure = yield* collectCoverageProducerArtifacts(
          f.root,
          CoverageProducerCompareOptions.make({
            ...f.options,
            identity: CoverageProducerIdentity.make({ ...f.identity, runAttempt: 3 }),
          })
        ).pipe(Effect.flip);
        expect(failure.message).toContain("duplicate producer partition attempt");
      })
    );
    it.effect("rejects source bytes changed after the producer executed", () =>
      Effect.gen(function* () {
        const f = yield* sealedFixture();
        yield* f.fs.writeFileString(f.path.join(f.packageRoot, "src/choose.ts"), "export const changed = 1;\n");
        yield* rejectChangedManifest(f, f.manifest);
      })
    );
    it.effect("rejects report paths escaping the selected source root", () =>
      Effect.gen(function* () {
        const f = yield* sealedFixture();
        const report = yield* encode({ "../escape.ts": f.raw });
        yield* f.fs.writeFileString(f.path.join(f.root, ".beep/artifacts/shard-2", f.entry.reportPath), report);
        yield* rejectChangedManifest(
          f,
          CoverageProducerManifest.make({
            ...f.manifest,
            packages: [CoveragePackageArtifact.make({ ...f.entry, reportSha256: yield* sha256Hex(report) })],
          })
        );
      })
    );
  });
});
