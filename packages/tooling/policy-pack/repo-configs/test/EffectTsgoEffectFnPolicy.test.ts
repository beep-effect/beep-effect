import { fileURLToPath } from "node:url";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, pipe, Stream } from "effect";
import * as O from "effect/Option";
import { ChildProcess } from "effect/process";
import * as jsonc from "jsonc-parser";
import typescript from "typescript";

const repoRoot = fileURLToPath(new URL("../../../../..", import.meta.url));
const tscBinPath = fileURLToPath(new URL("../../../../../node_modules/.bin/tsc", import.meta.url));
const tsgoBinPath = fileURLToPath(new URL("../../../../../node_modules/.bin/tsgo", import.meta.url));

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const TestLayer = Layer.mergeAll(PlatformLayer, NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(PlatformLayer)));
const encodeJson = UnknownFromJsonString.encodeUnknownSync;

const collectText = <E>(stream: Stream.Stream<Uint8Array, E>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (text, chunk) => `${text}${chunk}`
    )
  );

const writeJsonFile = Effect.fn(function* (filePath: string, value: unknown) {
  const fs = yield* FileSystem.FileSystem;
  const encoded = encodeJson(value);
  const edits = jsonc.format(encoded, undefined, {
    tabSize: 2,
    insertSpaces: true,
  });

  yield* fs.writeFileString(filePath, `${jsonc.applyEdits(encoded, edits)}\n`);
});

const writeProjectFile = Effect.fn(function* (projectDir: string, relativePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const filePath = path.join(projectDir, relativePath);

  yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
  yield* fs.writeFileString(filePath, content);
});

const bootstrapTsgoProject = Effect.fn(function* (projectDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs.symlink(path.join(repoRoot, "node_modules"), path.join(projectDir, "node_modules"));
  yield* writeJsonFile(path.join(projectDir, "package.json"), {
    name: "@beep/effect-tsgo-effect-fn-test",
    private: true,
    type: "module",
  });
  yield* writeJsonFile(path.join(projectDir, "tsconfig.json"), {
    extends: path.join(repoRoot, "tsconfig.base.json"),
    include: ["src"],
    compilerOptions: {
      rootDir: "src",
      outDir: "dist",
      noEmit: true,
    },
  });
  yield* writeProjectFile(
    projectDir,
    "src/index.ts",
    pipe(
      [
        'import { Effect } from "effect";',
        "",
        "export const shouldError = (value: string) => {",
        "  return Effect.gen(function* () {",
        "    yield* Effect.succeed(value);",
        "    return value.toUpperCase();",
        "  });",
        "};",
        "",
        "export const shortPlain = (value: number) => value + 1;",
        "",
      ],
      A.join("\n")
    )
  );
});

const runCommand = Effect.fn("EffectTsgoEffectFnPolicy.runCommand")(function* (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
) {
  const child = ChildProcess.make(command, args, {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  return yield* Effect.scoped(
    Effect.gen(function* () {
      yield* Effect.logInfo("compiler child: acquiring");
      const handle = yield* child;
      yield* Effect.logInfo("compiler child: draining stdout, stderr and exit");
      const result = yield* Effect.all(
        {
          stdout: collectText(handle.stdout),
          stderr: collectText(handle.stderr),
          exitCode: handle.exitCode,
        },
        { concurrency: 3 }
      );

      yield* Effect.logInfo("compiler child: output and exit observed");
      return {
        stdout: Str.trim(result.stdout),
        stderr: Str.trim(result.stderr),
        exitCode: result.exitCode,
      };
    })
  );
});

const runTsgoOnProject = Effect.fn(function* (projectDir: string) {
  const path = yield* Path.Path;
  return yield* runCommand(
    process.execPath,
    [tsgoBinPath, "--noEmit", "--pretty", "false", "-p", path.join(projectDir, "tsconfig.json")],
    projectDir
  );
});

// Share native platform services only; each compiler call owns its child scope.
it.layer(TestLayer, { timeout: "10 seconds" })((it) => {
  describe("TypeScript compiler routing", () => {
    it.effect("keeps the TypeScript 6 API beside the Effect-patched TypeScript 7 compiler", () =>
      Effect.gen(function* () {
        yield* Effect.logInfo("compiler versions: starting");
        const [tsc, tsgo] = yield* Effect.all(
          [
            runCommand(process.execPath, [tscBinPath, "--version"], repoRoot),
            runCommand(process.execPath, [tsgoBinPath, "--version"], repoRoot),
          ],
          { concurrency: 1 }
        );
        yield* Effect.logInfo("compiler versions: completed");
        const tscContext = `tsc --version: stdout=${Str.takeLeft(tsc.stdout, 2048)}; stderr=${Str.takeLeft(tsc.stderr, 2048)}`;
        const tsgoContext = `tsgo --version: stdout=${Str.takeLeft(tsgo.stdout, 2048)}; stderr=${Str.takeLeft(tsgo.stderr, 2048)}`;
        expect(tsc.exitCode, tscContext).toBe(0);
        expect(tsgo.exitCode, tsgoContext).toBe(0);
        expect(tsc.stdout, `${tscContext}; ${tsgoContext}`).toBe(tsgo.stdout);
        expect(tsc.stdout, tscContext).toMatch(/^Version 7\..*\+effect-tsgo\./u);
        expect(typescript.version, "TypeScript API version").toMatch(/^6\./u);
      })
    );
  });
  describe("Effect tsgo effectFn policy", () => {
    it.effect(
      "fails reusable Effect.gen wrappers with a named Effect.fn suggestion",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const projectDir = yield* fs.makeTempDirectoryScoped({ prefix: "effect-tsgo-effect-fn-" });
          yield* Effect.logInfo("compiler diagnostic: preparing fixture");
          yield* bootstrapTsgoProject(projectDir);
          yield* Effect.logInfo("compiler diagnostic: starting");
          const result = yield* runTsgoOnProject(projectDir);
          yield* Effect.logInfo("compiler diagnostic: completed");
          const diagnosticContext = `tsgo diagnostic: stdout=${Str.takeLeft(result.stdout, 2048)}; stderr=${Str.takeLeft(result.stderr, 2048)}`;
          const output = Str.trim(`${result.stdout}\n${result.stderr}`);
          const effectFnOpportunityMatches = pipe(
            output,
            Str.match(/effect\(effectFnOpportunity\)/g),
            O.getOrElse(() => [])
          );
          expect(result.exitCode, diagnosticContext).not.toBe(0);
          expect(effectFnOpportunityMatches, diagnosticContext).toHaveLength(1);
          expect(output, diagnosticContext).toContain("error TS");
          expect(output, diagnosticContext).toContain('Effect.fn("shouldError")(function*(value) { ... })');
          expect(output, diagnosticContext).not.toContain("shortPlain");
        }),
      15_000
    );
  });
});
