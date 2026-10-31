import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Str from "effect/String";

// Process-wide state a suite can leak into the next file of a shared (`isolate: false`) worker.
const leakPatterns = [
  /process\.chdir\(/,
  /\b(?:temporaryWorkingDirectory|withTempWorkingDirectory)\b/,
  // Any reassignment, anywhere on a line; `exitCode` only appears in child-process scripts.
  /(?<![\w$.])process\.(?!exitCode\b|env\b)[A-Za-z_$][\w$]*\s*=(?!=)/,
  /(?<![\w$.])globalThis\.[A-Za-z_$][\w$]*\s*=(?!=)/,
  /\bObject\.defineProperty\(\s*(?:process|globalThis)\b/,
  /\bvi\.spyOn\(\s*process\s*,/,
  /\bvi\.(?:mock|doMock|stubGlobal|stubEnv)\(/,
  /process\.env(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])\s*=(?!=)/,
  /\bdelete\s+process\.env\b/,
];

const selfPath = "test/vitest-isolation-census.test.ts";

const censusInputs = Effect.fn("VitestIsolationCensus.inputs")(function* (packageRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const testRoot = path.join(packageRoot, "test");
  const testFiles = A.filter(
    yield* fs.readDirectory(testRoot, { recursive: true }),
    (entry) => /\.test\.tsx?$/.test(entry) && !Str.startsWith("fixtures/")(entry)
  );
  const leaking = yield* Effect.forEach(testFiles, (entry) =>
    Effect.map(fs.readFileString(path.join(testRoot, entry)), (source) =>
      A.some(leakPatterns, (pattern) => pattern.test(source)) ? [`test/${entry}`] : []
    )
  );
  const config = yield* fs.readFileString(path.join(packageRoot, "vitest.config.ts"));
  const listed = Str.split(config, "const isolatedSuites = [")[1] ?? "";
  const declared = A.map(
    A.fromIterable(Str.matchAll(/"([^"]+)"/g)(Str.split(listed, "];")[0] ?? "")),
    (match) => match[1] ?? ""
  );
  return {
    leaking: A.sort(
      A.filter(A.flatten(leaking), (file) => file !== selfPath),
      Str.Order
    ),
    declared,
  };
});

it.layer(NodeServices.layer)("repo-cli vitest isolation census", (it) => {
  it.effect("keeps exactly the state-leaking suites in the isolated project", () =>
    Effect.gen(function* () {
      // The census reads this checkout's real test sources.
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const packageRoot = yield* fs.realPath(yield* path.fromFileUrl(new URL("..", import.meta.url)));
      const { leaking, declared } = yield* censusInputs(packageRoot);
      expect(declared.length).toBeGreaterThan(0);
      expect(declared).toEqual(A.sort(declared, Str.Order));
      expect(declared).toEqual(leaking);
    })
  );
});
