import {
  CheckProbeReadError,
  checkPackageReferencesBuilt,
  UnbuiltReferenceOutputs,
} from "@beep/repo-cli/commands/Quality/CheckProbe";
import { scaffoldPackageScripts } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas";
import { runCaptured } from "@beep/repo-cli-kit/process/StepExec";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

// The fixture's `beep:check` stands in for the compiler: its marker in the
// output proves the compiler ran, its absence proves nothing was spawned.
const COMPILER_MARKER = "compiler-ran";
const EXPECTED_LINE =
  "[beep-cli] @fixture/consumer check: unbuilt upstream declarations: 1 missing (first: ../upstream/dist/index.d.ts); build them with: bun x turbo run build --filter=@fixture/consumer^...";

const writeFile = Effect.fn("CheckProbeTest.writeFile")(function* (
  root: string,
  relativePath: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(root, relativePath);
  yield* fs.makeDirectory(path.dirname(absolutePath), { recursive: true });
  yield* fs.writeFileString(absolutePath, content);
});

const writeJson = Effect.fn("CheckProbeTest.writeJson")(function* (
  root: string,
  relativePath: string,
  document: unknown
) {
  const json = yield* encodeJson(document);
  yield* writeFile(root, relativePath, `${json}\n`);
});

// A consumer that references two projects: `built` has its declaration index,
// `upstream` (referenced by directory) does not until `buildUpstream` runs.
// The consumer's `check` is the generated script text.
const writeFixtureRepo = Effect.fn("CheckProbeTest.writeFixtureRepo")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  // Under the checkout's node_modules/.tmp, as the census fixtures, so `bun`
  // resolves `beep-cli` from the checkout's node_modules/.bin.
  const tempRoot = path.join(repoRoot, "node_modules", ".tmp");
  yield* fs.makeDirectory(tempRoot, { recursive: true });
  const root = yield* fs.makeTempDirectoryScoped({ directory: tempRoot, prefix: "check-probe-" });

  yield* writeFile(root, "bun.lock", "{}\n");
  yield* writeJson(root, "package.json", { name: "check-probe-fixture", private: true, workspaces: ["packages/*"] });
  for (const name of ["upstream", "built"]) {
    yield* writeJson(root, `packages/${name}/package.json`, { name: `@fixture/${name}`, private: true });
    yield* writeJson(root, `packages/${name}/tsconfig.json`, {
      compilerOptions: { composite: true, declaration: true, outDir: "dist" },
      include: ["src"],
    });
  }
  yield* writeFile(root, "packages/built/dist/index.d.ts", "export declare const built: number;\n");
  yield* writeJson(root, "packages/consumer/package.json", {
    name: "@fixture/consumer",
    private: true,
    scripts: {
      check: scaffoldPackageScripts("library", []).check,
      "beep:check": `echo ${COMPILER_MARKER}`,
    },
  });
  yield* writeJson(root, "packages/consumer/tsconfig.json", {
    compilerOptions: { composite: true, declaration: true, outDir: "dist" },
    include: ["src"],
    references: [{ path: "../built/tsconfig.json" }, { path: "../upstream" }],
  });

  return {
    repoRoot,
    consumerDir: path.join(root, "packages", "consumer"),
    consumerLog: path.join(root, "packages", "consumer", ".beep", "gates", "check", "report.log"),
    buildUpstream: writeFile(root, "packages/upstream/dist/index.d.ts", "export declare const upstream: number;\n"),
  };
});

const outputLines = (output: string): ReadonlyArray<string> =>
  A.filter(Str.split(Str.trim(output), "\n"), Str.isNonEmpty);

// Bun's script runner echoes `$ <script>` and reports `error: script ... exited`;
// those lines are Bun's own, not the check's.
const isBunRunnerLine = (line: string): boolean => Str.startsWith("$ ")(line) || Str.startsWith("error: script ")(line);

// The check gate's agent console for the unbuilt reference: the verdict, one
// fold line naming the cause and the build command, the record and log paths,
// the pointer, the verdict again. At most five lines, whatever the cascade.
const expectFoldedConsole = (lines: ReadonlyArray<string>): void => {
  expect(lines.length).toBeLessThanOrEqual(5);
  expect(A.head(lines)).toStrictEqual(A.last(lines));
  expect(A.getUnsafe(lines, 0)).toMatch(/^check @fixture\/consumer .*: FAILED, 1 error/);
  expect(A.filter(lines, Str.includes("TS6305"))).toStrictEqual([
    "TS6305 x1: upstream declarations are not built. Fix: bun x turbo run build --filter=@fixture/consumer^...",
  ]);
};

const expectGreenConsole = (lines: ReadonlyArray<string>): void => {
  expect(lines.length).toBe(1);
  expect(A.getUnsafe(lines, 0)).toMatch(/^check @fixture\/consumer: PASSED, 0 errors/);
};

// `bin` leads PATH so `beep-cli` resolves to this checkout's entry.
const runIn = Effect.fn("CheckProbeTest.runIn")(function* (cwd: string, bin: string, args: ReadonlyArray<string>) {
  const inheritedPath = yield* Config.String("PATH");
  return yield* runCaptured({
    command: "bun",
    args,
    cwd,
    // The gate prints the agent console, whoever runs the suite.
    env: { PATH: `${bin}:${inheritedPath}`, BEEP_TURBO_HOST_CACHE_DISABLED: "true", AI_AGENT: "1" },
    extendEnv: true,
    source: "all",
    timeout: "60 seconds",
  });
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "120 seconds" })(
  "package check unbuilt-reference probe",
  (it) => {
    it.effect(
      "prints one line naming the count, first output and build closure, then fails",
      Effect.fnUntraced(function* () {
        const fixture = yield* writeFixtureRepo();

        const failure = yield* checkPackageReferencesBuilt(fixture.consumerDir).pipe(
          Effect.flip,
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        );

        assertInstanceOf(failure, UnbuiltReferenceOutputs);
        expect(failure.missing).toBe(1);
        expect(failure.firstOutput).toBe("../upstream/dist/index.d.ts");
        expect(failure.buildCommand).toBe("bun x turbo run build --filter=@fixture/consumer^...");
        expect(failure.message).toBe(EXPECTED_LINE);
      })
    );

    it.effect(
      "writes exactly that one line to the console",
      Effect.fnUntraced(function* () {
        const fixture = yield* writeFixtureRepo();

        const lines = yield* Effect.gen(function* () {
          yield* Effect.flip(checkPackageReferencesBuilt(fixture.consumerDir));
          return {
            errors: yield* TestConsole.errorLines,
            logs: yield* TestConsole.logLines,
          };
        }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));

        expect(lines.errors).toStrictEqual([EXPECTED_LINE]);
        expect(lines.logs).toStrictEqual([]);
      })
    );

    it.effect(
      "passes silently once every referenced project has its declaration index",
      Effect.fnUntraced(function* () {
        const fixture = yield* writeFixtureRepo();
        yield* fixture.buildUpstream;

        const lines = yield* Effect.gen(function* () {
          yield* checkPackageReferencesBuilt(fixture.consumerDir);
          const errors = yield* TestConsole.errorLines;
          const logs = yield* TestConsole.logLines;
          return A.appendAll(errors, logs);
        }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));

        expect(lines).toStrictEqual([]);
      })
    );

    it.effect(
      "passes silently for a package that references no project",
      Effect.fnUntraced(function* () {
        const fixture = yield* writeFixtureRepo();
        yield* writeJson(fixture.consumerDir, "tsconfig.json", {
          compilerOptions: { composite: true, declaration: true, outDir: "dist" },
          include: ["src"],
        });

        const lines = yield* Effect.gen(function* () {
          yield* checkPackageReferencesBuilt(fixture.consumerDir);
          const errors = yield* TestConsole.errorLines;
          const logs = yield* TestConsole.logLines;
          return A.appendAll(errors, logs);
        }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));

        expect(lines).toStrictEqual([]);
      })
    );

    it.effect(
      "names a package whose manifest has no name by its directory",
      Effect.fnUntraced(function* () {
        const fixture = yield* writeFixtureRepo();
        yield* writeJson(fixture.consumerDir, "package.json", { private: true });

        const failure = yield* checkPackageReferencesBuilt(fixture.consumerDir).pipe(
          Effect.flip,
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        );

        assertInstanceOf(failure, UnbuiltReferenceOutputs);
        expect(failure.package).toBe(fixture.consumerDir);
        expect(failure.missing).toBe(1);
      })
    );

    it.effect(
      "reports a package without a tsconfig as a read error naming the file",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* writeFixtureRepo();
        const tsconfigPath = path.join(fixture.consumerDir, "tsconfig.json");
        yield* fs.remove(tsconfigPath);

        const failure = yield* Effect.flip(checkPackageReferencesBuilt(fixture.consumerDir));

        assertInstanceOf(failure, CheckProbeReadError);
        expect(failure.message).toBe(`Failed to read references from ${tsconfigPath}.`);
      })
    );

    it.effect(
      "`bun run check` folds the cascade to one cause line, exits non-zero and never reaches the compiler",
      Effect.fnUntraced(function* () {
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;
        const fixture = yield* writeFixtureRepo();
        const binDir = path.join(fixture.repoRoot, "node_modules", ".bin");

        const unbuilt = yield* runIn(fixture.consumerDir, binDir, ["run", "check"]);
        expect(unbuilt.exitCode).not.toBe(0);
        expectFoldedConsole(A.filter(outputLines(unbuilt.output), (line) => !isBunRunnerLine(line)));
        expect(unbuilt.output).not.toContain(COMPILER_MARKER);

        yield* fixture.buildUpstream;
        const built = yield* runIn(fixture.consumerDir, binDir, ["run", "check"]);
        expect(built.exitCode).toBe(0);
        expectGreenConsole(A.filter(outputLines(built.output), (line) => !isBunRunnerLine(line)));
        // The compiler's own output goes to the raw log, never to the console.
        expect(built.output).not.toContain(COMPILER_MARKER);
        const log = yield* fs.readFileString(fixture.consumerLog);
        expect(log).toContain(COMPILER_MARKER);
      })
    );

    it.effect(
      "`beep-cli check` prints only the gate console, exits 1 and never reaches the compiler",
      Effect.fnUntraced(function* () {
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;
        const fixture = yield* writeFixtureRepo();
        const binDir = path.join(fixture.repoRoot, "node_modules", ".bin");
        const bin = path.join(fixture.repoRoot, "packages", "tooling", "tool", "cli", "src", "bin.ts");

        const unbuilt = yield* runIn(fixture.consumerDir, binDir, [bin, "check", "--agent"]);
        expect(unbuilt.exitCode).toBe(1);
        expectFoldedConsole(outputLines(unbuilt.output));

        yield* fixture.buildUpstream;
        const built = yield* runIn(fixture.consumerDir, binDir, [bin, "check", "--agent"]);
        expect(built.exitCode).toBe(0);
        expectGreenConsole(outputLines(built.output));
        const log = yield* fs.readFileString(fixture.consumerLog);
        expect(log).toContain(COMPILER_MARKER);
      })
    );

    it.effect(
      "`beep-cli check` leaves a package alone when its generated check carries no probe",
      Effect.fnUntraced(function* () {
        const path = yield* Path.Path;
        const fixture = yield* writeFixtureRepo();
        const binDir = path.join(fixture.repoRoot, "node_modules", ".bin");
        const bin = path.join(fixture.repoRoot, "packages", "tooling", "tool", "cli", "src", "bin.ts");
        // The infra kind: `beep:check` builds the referenced projects itself, so
        // the generator writes a plain `check`.
        yield* writeJson(fixture.consumerDir, "package.json", {
          name: "@fixture/consumer",
          private: true,
          scripts: { check: "bun run beep:check", "beep:check": `echo ${COMPILER_MARKER}` },
        });

        const unbuilt = yield* runIn(fixture.consumerDir, binDir, [bin, "check"]);
        expect(unbuilt.exitCode).toBe(0);
        expect(unbuilt.output).toContain(COMPILER_MARKER);
        expect(unbuilt.output).not.toContain("unbuilt upstream declarations");
      })
    );
  }
);
