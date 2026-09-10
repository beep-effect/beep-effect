import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { FsUtilsLive, findRepoRoot } from "@beep/repo-utils";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as R from "effect/Record";
import * as Str from "effect/String";

const providePlatform = provideScopedLayer(FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer)));
const write = Effect.fn("NativeRuntimePrefixTest.write")(function* (root: string, name: string, source: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, name);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, source);
});
const run = Effect.fn("NativeRuntimePrefixTest.run")(function* (args: ReadonlyArray<string>) {
  const repo = yield* findRepoRoot();
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "native-runtime-prefix-" });
  yield* write(root, "tsconfig.json", '{"include":["**/*.ts","**/*.tsx"]}');
  yield* write(root, "scratchpad/probe/index.tsx", "export const value = new Set();\n");
  yield* write(root, "packages/outside/clean.ts", "export const value = 1;\n");
  yield* write(root, "packages/outside/violation.ts", "export const value = new Set();\n");
  yield* write(root, "scratchpad/probe-neighbor/index.ts", "export const value = new Set();\n");
  for (const name of [
    "dist/index.ts",
    "node_modules/dependency/index.ts",
    "test/index.ts",
    "types.d.ts",
    "docs/index.ts",
  ]) {
    yield* write(root, `scratchpad/probe/${name}`, "export const ignored = new Set();\n");
  }
  yield* fs.makeDirectory(`${root}/scratchpad/empty`, { recursive: true });
  return yield* StepExec.runCaptured({
    command: "bun",
    args: ["run", `${repo}/packages/tooling/tool/cli/src/bin.ts`, "--", "laws", "native-runtime", "--check", ...args],
    cwd: root,
    env: R.filter(process.env, (_, key) => !Str.startsWith("VITEST")(key)),
    extendEnv: false,
  });
});

describe("native-runtime prefix command", { concurrent: false }, () => {
  it.effect(
    "reports only the requested prefix, excluding artifacts, declarations and sibling roots",
    Effect.fnUntraced(function* () {
      const result = yield* run(["--include-prefix", " scratchpad/probe/ , scratchpad/empty "]);
      expect(result.exitCode, result.output).toBe(1);
      expect(result.output).toContain("scanned_files=1");
      expect(result.output).toContain("touched_files=1");
      expect(result.output).toContain("scratchpad/probe/index.tsx:");
      expect(result.output).not.toContain("packages/outside/");
      expect(result.output).not.toContain("probe-neighbor/");
    }, providePlatform),
    300_000
  );

  it.effect(
    "unions prefixes with explicit files without double-reporting an overlap",
    Effect.fnUntraced(function* () {
      const result = yield* run([
        "--include-prefix",
        "scratchpad/probe",
        "--include",
        "scratchpad/probe/index.tsx,packages/outside/clean.ts,packages/outside/violation.ts",
      ]);
      expect(result.exitCode, result.output).toBe(1);
      expect(result.output).toContain("scanned_files=3");
      expect(result.output).toContain("touched_files=2");
      expect(result.output).toContain("scratchpad/probe/index.tsx:");
      expect(result.output).toContain("packages/outside/violation.ts:");
      expect(result.output).not.toContain("probe-neighbor/");
    }, providePlatform),
    300_000
  );

  it.effect(
    "rejects prefixes that escape the repository or carry glob characters",
    Effect.fnUntraced(function* () {
      for (const prefix of ["../outside", "/scratchpad", "packages/*", "scratchpad/../packages"]) {
        const result = yield* run(["--include-prefix", prefix]);
        expect(result.exitCode, result.output).not.toBe(0);
        expect(result.output).toContain("--include-prefix must name repository-relative directories");
        expect(result.output).toContain(prefix);
      }
    }, providePlatform),
    300_000
  );

  it.effect(
    "scans nothing and exits successfully for an empty directory prefix",
    Effect.fnUntraced(function* () {
      const result = yield* run(["--include-prefix", "scratchpad/empty"]);
      expect(result.exitCode, result.output).toBe(0);
      expect(result.output).toContain("scanned_files=0");
      expect(result.output).toContain("touched_files=0");
    }, providePlatform),
    300_000
  );

  it.effect(
    "preserves explicit-file scope and caller exclusions",
    Effect.fnUntraced(function* () {
      const files = yield* run(["--include", "packages/outside/clean.ts"]);
      expect(files.exitCode, files.output).toBe(0);
      expect(files.output).toContain("scanned_files=1");
      const excluded = yield* run(["--include-prefix", "scratchpad/probe", "--exclude", "scratchpad/probe/index.tsx"]);
      expect(excluded.exitCode, excluded.output).toBe(0);
      expect(excluded.output).toContain("scanned_files=0");
    }, providePlatform),
    300_000
  );
});
