import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { CoverageConfig } from "@beep/repo-cli/test/Quality";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterEach, beforeEach, expect, it } from "@effect/vitest";
import { IstanbulCoverageProvider } from "@vitest/coverage-istanbul/dist/provider.js";
import { V8CoverageProvider } from "@vitest/coverage-v8/dist/provider.js";
import { createCoverageMap } from "@vitest/istanbul-lib-coverage";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { vi } from "vitest";
import { hostNodeExecutable } from "./helpers/native-node.ts";

const mocks = vi.hoisted(() => ({ create: vi.fn(), close: vi.fn(), main: vi.fn() }));
vi.mock("vitest/node", () =>
  vi.importActual<typeof import("vitest/node")>("vitest/node").then((actual) => ({
    ...actual,
    createVitest: mocks.create,
  }))
);
vi.mock("@effect/platform-node/NodeRuntime", () => ({ runMain: mocks.main }));
const encodeString = S.encodeEffect(S.fromJsonString(S.String));
const decodeFiles = S.decodeUnknownEffect(S.fromJsonString(S.Array(S.String)));
const actualVersions = process.versions;
const expected = (
  runtime = actualVersions.bun === undefined ? "node" : "bun",
  version = actualVersions.bun ?? actualVersions.node
) =>
  ConfigProvider.fromEnvRecord({
    BEEP_COVERAGE_EXPECTED_RUNTIME: runtime,
    BEEP_COVERAGE_EXPECTED_RUNTIME_VERSION: version,
    BEEP_COVERAGE_EXPECTED_PROVIDER: "istanbul",
  });
const inspect = (argv: ReadonlyArray<string> = ["vitest", "run"]) =>
  CoverageConfig.inspectCoverageRuntimeSources(argv).pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, expected())
  );

beforeEach(() => {
  mocks.create.mockReset();
  mocks.close.mockReset();
  mocks.main.mockReset();
  mocks.close.mockResolvedValue(undefined);
  mocks.create.mockResolvedValue({ close: mocks.close });
  vi.spyOn(IstanbulCoverageProvider.prototype, "initialize").mockImplementation(() => undefined);
  vi.spyOn(IstanbulCoverageProvider.prototype, "getUntestedFiles").mockResolvedValue([
    "/fixture/src/b.ts",
    "/fixture/src/a.ts",
    "/fixture/src/a.ts",
  ]);
  vi.spyOn(V8CoverageProvider.prototype, "initialize").mockImplementation(() => undefined);
  vi.spyOn(V8CoverageProvider.prototype, "getUntestedFiles").mockResolvedValue(["/fixture/src/v8.ts"]);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.effect("preserves canonical --root, --config and provider flags while discovering all sources without tests", () =>
  Effect.gen(function* () {
    const files = yield* inspect([
      "vitest",
      "run",
      "--root=/canonical/root",
      "--config=selected.config.ts",
      "--coverage.include=src/*.ts",
    ]);
    expect(files).toEqual(["/fixture/src/a.ts", "/fixture/src/b.ts"]);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        root: "/canonical/root",
        config: "selected.config.ts",
        watch: false,
        coverage: expect.objectContaining({
          enabled: true,
          provider: "istanbul",
          clean: false,
          include: ["src/*.ts"],
        }),
      })
    );
    expect(mocks.close).toHaveBeenCalledTimes(1);
  })
);
it.effect("discovers the selected canonical V8 provider rather than substituting Istanbul", () =>
  Effect.gen(function* () {
    const files = yield* CoverageConfig.inspectCoverageRuntimeSources(["vitest", "run"]).pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnvRecord({
          BEEP_COVERAGE_EXPECTED_RUNTIME: actualVersions.bun === undefined ? "node" : "bun",
          BEEP_COVERAGE_EXPECTED_RUNTIME_VERSION: actualVersions.bun ?? actualVersions.node,
          BEEP_COVERAGE_EXPECTED_PROVIDER: "v8",
        })
      )
    );
    expect(files).toEqual(["/fixture/src/v8.ts"]);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ coverage: expect.objectContaining({ provider: "v8" }) })
    );
  })
);
it.effect("derives Node identity from the actual process metadata rather than the Bun sealing runtime", () =>
  Effect.gen(function* () {
    const { bun: _bun, ...versions } = actualVersions;
    vi.stubGlobal(
      "process",
      new Proxy(process, {
        get: (target, key, receiver) => (key === "versions" ? versions : Reflect.get(target, key, receiver)),
      })
    );
    const files = yield* CoverageConfig.inspectCoverageRuntimeSources(["vitest", "run"]).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, expected("node", versions.node))
    );
    expect(files).toEqual(["/fixture/src/a.ts", "/fixture/src/b.ts"]);
  })
);
it.effect("derives Bun identity when the actual runtime metadata contains its version", () =>
  Effect.gen(function* () {
    const versions = { ...actualVersions, bun: "fixture-bun-version" };
    vi.stubGlobal(
      "process",
      new Proxy(process, {
        get: (target, key, receiver) => (key === "versions" ? versions : Reflect.get(target, key, receiver)),
      })
    );
    const files = yield* CoverageConfig.inspectCoverageRuntimeSources(["vitest", "run"]).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, expected("bun", versions.bun))
    );
    expect(files).toEqual(["/fixture/src/a.ts", "/fixture/src/b.ts"]);
  })
);
it.effect("rejects runtime or version mismatch before creating a Vitest context", () =>
  Effect.gen(function* () {
    for (const provider of [expected("unexpected"), expected(undefined, "wrong-version")]) {
      const failure = yield* CoverageConfig.inspectCoverageRuntimeSources(["vitest", "run"]).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider),
        Effect.flip
      );
      expect(failure.message).toContain("runtime differs");
    }
    expect(mocks.create).not.toHaveBeenCalled();
  })
);
it.effect("rejects invalid canonical CLI without creating a context", () =>
  Effect.gen(function* () {
    const failure = yield* inspect(["wrong-binary"]).pipe(Effect.flip);
    expect(failure.message).toContain("Cannot parse canonical");
    expect(mocks.create).not.toHaveBeenCalled();
  })
);
it.effect("propagates configuration resolution failure", () =>
  Effect.gen(function* () {
    mocks.create.mockRejectedValueOnce(new Error("invalid config"));
    const failure = yield* inspect().pipe(Effect.flip);
    expect(failure.message).toContain("Cannot resolve invocation");
    expect(mocks.close).not.toHaveBeenCalled();
  })
);
it.effect("closes the Vitest context after provider initialization fails", () =>
  Effect.gen(function* () {
    vi.mocked(IstanbulCoverageProvider.prototype.initialize).mockImplementationOnce(() => {
      throw new Error("provider init");
    });
    const failure = yield* inspect().pipe(Effect.flip);
    expect(failure.message).toContain("Cannot initialize invocation");
    expect(mocks.close).toHaveBeenCalledTimes(1);
  })
);
it.effect("closes the Vitest context after provider census fails", () =>
  Effect.gen(function* () {
    vi.mocked(IstanbulCoverageProvider.prototype.getUntestedFiles).mockRejectedValueOnce(new Error("provider census"));
    const failure = yield* inspect().pipe(Effect.flip);
    expect(failure.message).toContain("Cannot discover invocation");
    expect(mocks.close).toHaveBeenCalledTimes(1);
  })
);
it.effect("admits only provider-backed files with zero statement, function, and branch units", () =>
  Effect.gen(function* () {
    const map = createCoverageMap({});
    const loc = { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } };
    map.addFileCoverage({ path: "/zero.ts", statementMap: {}, fnMap: {}, branchMap: {}, s: {}, f: {}, b: {} });
    map.addFileCoverage({
      path: "/statement.ts",
      statementMap: { 0: loc },
      fnMap: {},
      branchMap: {},
      s: { 0: 0 },
      f: {},
      b: {},
    });
    map.addFileCoverage({
      path: "/function.ts",
      statementMap: {},
      fnMap: { 0: { name: "f", decl: loc, loc, line: 1 } },
      branchMap: {},
      s: {},
      f: { 0: 0 },
      b: {},
    });
    map.addFileCoverage({
      path: "/branch.ts",
      statementMap: {},
      fnMap: {},
      branchMap: { 0: { type: "if", loc, locations: [loc], line: 1 } },
      s: {},
      f: {},
      b: { 0: [0] },
    });
    const generate = vi.spyOn(V8CoverageProvider.prototype, "generateCoverage").mockResolvedValueOnce(map);
    const config = (provider: string) =>
      ConfigProvider.fromEnvRecord({
        BEEP_COVERAGE_EXPECTED_RUNTIME: actualVersions.bun === undefined ? "node" : "bun",
        BEEP_COVERAGE_EXPECTED_RUNTIME_VERSION: actualVersions.bun ?? actualVersions.node,
        BEEP_COVERAGE_EXPECTED_PROVIDER: provider,
        BEEP_COVERAGE_V8_ZERO_WITNESS: "1",
      });
    const discovery = () => CoverageConfig.inspectCoverageRuntimeSources(["vitest", "run"]);
    expect(yield* discovery().pipe(Effect.provideService(ConfigProvider.ConfigProvider, config("v8")))).toEqual([
      "/zero.ts",
    ]);
    expect(generate).toHaveBeenCalledWith({ allTestsRun: true });
    generate.mockRejectedValueOnce(new Error("coverage generation failed"));
    const failed = yield* discovery().pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, config("v8")),
      Effect.flip
    );
    expect(failed.message).toContain("Cannot derive provider-backed V8 zero-unit witnesses");
    const wrongProvider = yield* discovery().pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, config("istanbul")),
      Effect.flip
    );
    expect(wrongProvider.message).toContain("Zero-unit discovery requires the V8 provider");
    expect(mocks.close).toHaveBeenCalledTimes(3);
  })
);

it("wires the isolated bootstrap to the Effect main without interpreting canonical argv", () => {
  CoverageConfig.runCoverageConfigRuntimeDiscovery(["node", "vitest", "run", "--config=selected.config.ts"]);
  expect(mocks.main).toHaveBeenCalledTimes(1);
  expect(Effect.isEffect(mocks.main.mock.calls[0]?.[0])).toBe(true);
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "60 seconds" })(
  "actual runtime coverage config census",
  (it) => {
    it.effect("uses actual Node/Bun, invocation environment and alternate config without importing tests", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = path.resolve(import.meta.dirname, "../../../../..");
        yield* fs.makeDirectory(path.join(repoRoot, ".beep"), { recursive: true });
        const temporaryRoot = yield* fs.makeTempDirectoryScoped({
          directory: path.join(repoRoot, ".beep"),
          prefix: "config-census-",
        });
        const root = yield* fs.realPath(temporaryRoot);
        yield* fs.makeDirectory(path.join(root, "src"));
        yield* fs.writeFileString(path.join(root, "package.json"), '{"type":"module"}');
        yield* fs.writeFileString(
          path.join(root, "proof.test.ts"),
          'throw new Error("Census must not import test modules");'
        );
        yield* fs.writeFileString(
          path.join(root, "vitest.config.ts"),
          'export default { test: { coverage: { include: ["src/trap.ts"] } } };'
        );
        yield* fs.writeFileString(
          path.join(root, "selected.config.ts"),
          'const runtime=process.versions.bun === undefined ? "node" : "bun"; export default { test: { include: ["proof.test.ts"], coverage: {include: [`src/${process.env.COVERAGE_SOURCE_SIDE}-${runtime}.ts`]} } };'
        );
        const cases = [
          { runtime: "node", side: "a", provider: "istanbul" },
          { runtime: "node", side: "b", provider: "istanbul" },
          { runtime: "node", side: "a", provider: "v8" },
          { runtime: "node", side: "b", provider: "v8" },
          { runtime: "bun", side: "a", provider: "istanbul" },
          { runtime: "bun", side: "b", provider: "istanbul" },
        ];
        for (const { runtime, side } of cases)
          yield* fs.writeFileString(path.join(root, `src/${side}-${runtime}.ts`), "export const value = () => 42;");
        const helper = yield* path.toFileUrl(
          path.join(repoRoot, "packages/tooling/tool/cli/src/commands/Quality/internal/CoverageConfig.runtime.ts")
        );
        const helperImport = yield* encodeString(helper.href);
        const bootstrap = `import(${helperImport}).then(m=>m.runCoverageConfigRuntimeDiscovery(process.argv))`;
        const node = yield* hostNodeExecutable;
        for (const { runtime, side, provider } of cases) {
          const command = runtime === "node" ? node : "bun";
          const version = yield* StepExec.runCaptured({
            command,
            args: ["--print", `process.versions.${runtime}`],
            source: "stdout",
            trim: true,
          });

          const result = yield* StepExec.runCaptured({
            command,
            args: [
              ...(runtime === "node" ? ["--experimental-strip-types"] : []),
              "--input-type=module",
              "--eval",
              bootstrap,
              "--",
              "vitest",
              "run",
              "--config=selected.config.ts",
            ],
            cwd: root,
            env: {
              COVERAGE_SOURCE_SIDE: side,
              BEEP_COVERAGE_EXPECTED_RUNTIME: runtime,
              BEEP_COVERAGE_EXPECTED_RUNTIME_VERSION: version.output,
              BEEP_COVERAGE_EXPECTED_PROVIDER: provider,
            },
            extendEnv: true,
            source: "stdout",
            trim: true,
          });
          expect(result.exitCode, result.output).toBe(0);
          expect(yield* decodeFiles(result.output)).toEqual([path.join(root, `src/${side}-${runtime}.ts`)]);
        }

        expect(yield* fs.readFileString(path.join(root, "proof.test.ts"))).toBe(
          'throw new Error("Census must not import test modules");'
        );
      })
    );
  }
);
