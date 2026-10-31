import CoverageRuntimeReporter from "@beep/repo-cli/commands/Ci/CiCoverage.reporter";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { CoverageRuntimeReceipt } from "@beep/repo-cli/test/Quality";
import { currentHostPlatform } from "@beep/utils";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterEach, expect, it, vi } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { createVitest } from "vitest/node";

// Match the existing native-Node parity fixture: Bun puts a node shim first on PATH.
const hostNodeExecutable = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const override = yield* Config.option(Config.NonEmptyString("BEEP_NODE_BIN"));
  const searchPath = yield* Config.String("PATH");
  const candidates = O.isSome(override)
    ? [override.value]
    : A.map(Str.split(currentHostPlatform === "win32" ? ";" : ":")(searchPath), (directory) =>
        path.join(directory, currentHostPlatform === "win32" ? "node.exe" : "node")
      );
  const found = yield* Effect.findFirstFilter(
    candidates,
    Effect.fnUntraced(function* (candidate) {
      if (!(yield* fs.exists(candidate))) return Result.fail(undefined);
      const result = yield* StepExec.runCaptured({
        command: candidate,
        args: ["-p", 'process.versions.bun === undefined ? process.execPath : ""'],
        source: "stdout",
        timeout: "5 seconds",
      });
      const executable = Str.trim(result.output);
      return result.exitCode === 0 && Str.isNonEmpty(executable) ? Result.succeed(executable) : Result.fail(undefined);
    })
  );
  return yield* O.match(found, {
    onSome: Effect.succeed,
    onNone: () => Effect.die("Native Node is required for the reporter runtime proof; PATH only supplied Bun shims."),
  });
});

afterEach(vi.unstubAllEnvs);

const encode = S.encodeEffect(S.fromJsonString(S.Unknown));
const decode = S.decodeUnknownEffect(S.fromJsonString(CoverageRuntimeReceipt));
const fixture = Effect.fn("CoverageReporterTest.fixture")(function* (
  passing: boolean,
  provider: CoverageRuntimeReceipt["provider"] = "istanbul"
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = path.resolve(import.meta.dirname, "../../../../..");
  yield* fs.makeDirectory(path.join(repoRoot, ".beep"), { recursive: true });
  const root = yield* fs.makeTempDirectoryScoped({ directory: path.join(repoRoot, ".beep"), prefix: "reporter-" });
  const reporter = path.join(repoRoot, "packages/tooling/tool/cli/src/commands/Ci/CiCoverage.reporter.ts");
  yield* fs.writeFileString(path.join(root, "package.json"), '{"type":"module"}');
  yield* fs.writeFileString(
    path.join(root, "vitest.config.ts"),
    `export default ${yield* encode({ test: { include: ["proof.test.ts"], reporters: ["default", reporter], maxWorkers: 1, coverage: { enabled: true, provider, include: ["value.ts"], reporter: ["json"] } } })}`
  );
  yield* fs.writeFileString(path.join(root, "value.ts"), "export const answer = 42;\n");
  yield* fs.writeFileString(
    path.join(root, "proof.test.ts"),
    `import { test, expect } from ${yield* encode(path.join(repoRoot, "node_modules/vitest/dist/index.js"))};\n` +
      `import { answer } from "./value.ts";\n` +
      `test("actual invocation", () => { expect(answer).toBe(42); console.log("RUNTIME_PROOF:" + (process.versions.bun === undefined ? "node" : "bun") + ":" + (process.versions.bun ?? process.versions.node)); expect(${passing}).toBe(true) });`
  );
  const run = Effect.fn("CoverageReporterTest.run")(function* (
    runtime: "bun" | "node",
    invocationId = "invocation-1",
    destination = "coverage/runtime.json"
  ) {
    return yield* StepExec.runCaptured({
      command: runtime === "node" ? yield* hostNodeExecutable : "bun",
      args: [path.join(repoRoot, "node_modules/vitest/vitest.mjs"), "run", "--config", "vitest.config.ts"],
      cwd: root,
      env: { BEEP_COVERAGE_INVOCATION_ID: invocationId, BEEP_COVERAGE_RUNTIME_RECEIPT: destination },
      extendEnv: true,
    });
  });
  return { fs, path, root, run };
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "60 seconds" })(
  "same-process coverage runtime reporter",
  (it) => {
    it.effect("settles the in-process lifecycle with actual runtime and every terminal outcome", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ directory: process.cwd(), prefix: ".reporter-lifecycle-" });
        const context = yield* Effect.acquireRelease(
          Effect.promise(() =>
            createVitest({ root, config: false, coverage: { enabled: true, provider: "istanbul" } })
          ),
          (value) => Effect.promise(() => value.close())
        );
        const reporter = new CoverageRuntimeReporter();
        reporter.onInit(context);
        const cases = [
          ["passed", [], true],
          ["failed", [], false],
          ["interrupted", [], false],
          ["passed", [{ message: "unhandled fixture error" }], false],
        ] satisfies ReadonlyArray<
          readonly [
            Parameters<CoverageRuntimeReporter["onTestRunEnd"]>[2],
            Parameters<CoverageRuntimeReporter["onTestRunEnd"]>[1],
            boolean,
          ]
        >;
        yield* Effect.forEach(
          cases,
          Effect.fnUntraced(function* ([reason, errors, success], index) {
            const destination = path.join(root, `runtime-${index}.json`);
            vi.stubEnv("BEEP_COVERAGE_INVOCATION_ID", `lifecycle-${index}`);
            vi.stubEnv("BEEP_COVERAGE_RUNTIME_RECEIPT", path.relative(process.cwd(), destination));
            yield* Effect.promise(() => reporter.onTestRunEnd([], errors, reason));
            const receipt = yield* fs.readFileString(destination).pipe(Effect.flatMap(decode));
            expect(receipt.invocationId).toBe(`lifecycle-${index}`);
            expect(receipt.testRuntime).toBe(process.versions.bun === undefined ? "node" : "bun");
            expect(receipt.runtimeVersion).toBe(process.versions.bun ?? process.versions.node);
            expect(receipt.success).toBe(success);
            expect(receipt.provider).toBe(context.config.coverage.provider);
          })
        );
      })
    );

    it.effect("rejects an absolute receipt path without writing outside the invocation cwd", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ directory: process.cwd(), prefix: ".reporter-absolute-" });
        const context = yield* Effect.acquireRelease(
          Effect.promise(() =>
            createVitest({ root, config: false, coverage: { enabled: true, provider: "istanbul" } })
          ),
          (value) => Effect.promise(() => value.close())
        );
        const reporter = new CoverageRuntimeReporter();
        reporter.onInit(context);
        const destination = path.join(root, "absolute-runtime.json");
        vi.stubEnv("BEEP_COVERAGE_INVOCATION_ID", "absolute-boundary");
        vi.stubEnv("BEEP_COVERAGE_RUNTIME_RECEIPT", destination);
        yield* Effect.promise(() =>
          expect(reporter.onTestRunEnd([], [], "passed")).rejects.toThrow(
            "Coverage runtime receipt must be relative to the test cwd."
          )
        );
        expect(yield* fs.exists(destination)).toBe(false);
      })
    );

    it.effect("maps a scoped Bun capability marker to the receipt runtime and its exact version", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ directory: process.cwd(), prefix: ".reporter-marker-" });
        const context = yield* Effect.acquireRelease(
          Effect.promise(() =>
            createVitest({ root, config: false, coverage: { enabled: true, provider: "istanbul" } })
          ),
          (value) => Effect.promise(() => value.close())
        );
        const reporter = new CoverageRuntimeReporter();
        reporter.onInit(context);
        const destination = path.join(root, "runtime.json");
        vi.stubEnv("BEEP_COVERAGE_INVOCATION_ID", "bun-marker-boundary");
        vi.stubEnv("BEEP_COVERAGE_RUNTIME_RECEIPT", path.relative(process.cwd(), destination));
        // Only this boundary assertion simulates the marker; child-process tests prove real runtimes.
        yield* Effect.acquireRelease(
          Effect.sync(() =>
            vi.stubGlobal(
              "process",
              Object.create(process, { versions: { value: { ...process.versions, bun: "1.4.3" } } })
            )
          ),
          () => Effect.sync(vi.unstubAllGlobals)
        );
        yield* Effect.promise(() => reporter.onTestRunEnd([], [], "passed"));
        const receipt = yield* fs.readFileString(destination).pipe(Effect.flatMap(decode));
        expect(receipt.testRuntime).toBe("bun");
        expect(receipt.runtimeVersion).toBe("1.4.3");
        expect(receipt.invocationId).toBe("bun-marker-boundary");
        expect(receipt.success).toBe(true);
        expect(receipt.provider).toBe("istanbul");
      })
    );

    for (const runtime of ["bun", "node"] satisfies ReadonlyArray<"bun" | "node">) {
      it.effect(`attests the real ${runtime} invocation and exact test runtime version`, () =>
        Effect.gen(function* () {
          const f = yield* fixture(true);
          const result = yield* f.run(runtime);
          expect(result.exitCode, result.output).toBe(0);
          const receipt = yield* f.fs
            .readFileString(f.path.join(f.root, "coverage/runtime.json"))
            .pipe(Effect.flatMap(decode));
          expect(receipt.invocationId).toBe("invocation-1");
          expect(receipt.testRuntime).toBe(runtime);
          expect(receipt.success).toBe(true);
          expect(receipt.provider).toBe("istanbul");
          expect(yield* f.fs.exists(f.path.join(f.root, "coverage/coverage-final.json"))).toBe(true);
          expect(Str.includes(`RUNTIME_PROOF:${runtime}:${receipt.runtimeVersion}`)(result.output)).toBe(true);
        })
      );
    }

    it.effect("attests the real Node V8 provider from resolved configuration", () =>
      Effect.gen(function* () {
        const f = yield* fixture(true, "v8");
        const result = yield* f.run("node");
        expect(result.exitCode, result.output).toBe(0);
        const receipt = yield* f.fs
          .readFileString(f.path.join(f.root, "coverage/runtime.json"))
          .pipe(Effect.flatMap(decode));
        expect(receipt.testRuntime).toBe("node");
        expect(receipt.provider).toBe("v8");
        expect(receipt.success).toBe(true);
        expect(yield* f.fs.exists(f.path.join(f.root, "coverage/coverage-final.json"))).toBe(true);
      })
    );

    it.effect("refuses a terminal hook without resolved Vitest initialization", () =>
      Effect.gen(function* () {
        const result = yield* Effect.promise(() => new CoverageRuntimeReporter().onTestRunEnd([], [], "passed")).pipe(
          Effect.exit
        );
        result.pipe(Exit.isFailure, assertTrue);
      })
    );

    it.effect("records unsuccessful tests without claiming a successful invocation", () =>
      Effect.gen(function* () {
        const f = yield* fixture(false);
        const result = yield* f.run("bun");
        expect(result.exitCode).not.toBe(0);
        const receipt = yield* f.fs
          .readFileString(f.path.join(f.root, "coverage/runtime.json"))
          .pipe(Effect.flatMap(decode));
        expect(receipt.success).toBe(false);
      })
    );

    it.effect("fails closed on missing invocation identity", () =>
      Effect.gen(function* () {
        const f = yield* fixture(true);
        const result = yield* f.run("bun", "");
        expect(result.exitCode).not.toBe(0);
        expect(yield* f.fs.exists(f.path.join(f.root, "coverage/runtime.json"))).toBe(false);
      })
    );

    it.effect("rejects an absolute receipt destination", () =>
      Effect.gen(function* () {
        const f = yield* fixture(true);
        const result = yield* f.run("bun", "invocation-1", f.path.join(f.root, "absolute.json"));
        expect(result.exitCode).not.toBe(0);
        expect(yield* f.fs.exists(f.path.join(f.root, "absolute.json"))).toBe(false);
      })
    );

    it.effect("rejects a symlinked receipt parent without touching its target", () =>
      Effect.gen(function* () {
        const f = yield* fixture(true);
        const fs = yield* FileSystem.FileSystem;
        const outside = yield* fs.makeTempDirectoryScoped({ prefix: "reporter-outside-" });
        const target = f.path.join(outside, "runtime.json");
        yield* fs.writeFileString(target, "preserve");
        yield* fs.symlink(outside, f.path.join(f.root, "receipts"));
        const result = yield* f.run("bun", "invocation-1", "receipts/runtime.json");
        expect(result.exitCode).not.toBe(0);
        expect(yield* fs.readFileString(target)).toBe("preserve");
      })
    );

    it.effect("refuses to overwrite a receipt from a prior invocation", () =>
      Effect.gen(function* () {
        const f = yield* fixture(true);
        const first = yield* f.run("bun", "invocation-1", "receipts/runtime.json");
        expect(first.exitCode, first.output).toBe(0);
        const original = yield* f.fs.readFileString(f.path.join(f.root, "receipts/runtime.json"));
        const second = yield* f.run("bun", "invocation-2", "receipts/runtime.json");
        expect(second.exitCode).not.toBe(0);
        expect(yield* f.fs.readFileString(f.path.join(f.root, "receipts/runtime.json"))).toBe(original);
      })
    );
  }
);
