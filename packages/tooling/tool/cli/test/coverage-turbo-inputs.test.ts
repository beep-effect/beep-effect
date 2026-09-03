import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { encodeJsonString } from "@beep/schema/Json";
import { provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("test/coverage-turbo-inputs");

const EXPECTED_COVERAGE_INPUTS: ReadonlyArray<string> = [
  "package.json",
  "server/**",
  "src/**",
  "src-tauri/**",
  "test/**",
  "tsconfig*.json",
  "vitest.config.ts",
  "vitest.coverage.config.ts",
  "$TURBO_ROOT$/vitest.aliases.generated.json",
  "$TURBO_ROOT$/vitest.shared.ts",
  "$TURBO_ROOT$/vitest.setup.ts",
];

class TurboTaskSummary extends S.Class<TurboTaskSummary>($I`TurboTaskSummary`)(
  {
    hash: S.String,
    taskId: S.String,
  },
  $I.annote("TurboTaskSummary", {
    description: "Task identity and input hash read from a Turbo run summary fixture.",
  })
) {}

class TurboRunSummary extends S.Class<TurboRunSummary>($I`TurboRunSummary`)(
  {
    tasks: S.Array(TurboTaskSummary),
  },
  $I.annote("TurboRunSummary", {
    description: "Subset of a Turbo run summary needed by the coverage input tripwire.",
  })
) {}

const TurboConfiguration = S.Struct({
  tasks: S.Struct({
    coverage: S.Struct({
      cache: S.Boolean,
      inputs: S.Array(S.String),
    }),
  }),
}).annotate(
  $I.annote("TurboConfiguration", {
    description: "Coverage input declaration decoded from the repository Turbo configuration.",
  })
);

const decodeTurboConfiguration = S.decodeUnknownEffect(S.fromJsonString(TurboConfiguration));
const decodeTurboRunSummary = S.decodeUnknownEffect(S.fromJsonString(TurboRunSummary));

const writeFixtureFile = Effect.fn("CoverageTurboInputsTest.writeFixtureFile")(function* (
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

const writeFixtureJson = Effect.fn("CoverageTurboInputsTest.writeFixtureJson")(function* (
  root: string,
  relativePath: string,
  document: unknown
) {
  yield* writeFixtureFile(root, relativePath, `${yield* encodeJsonString(document)}\n`);
});

const coverageHashFromSummary = Effect.fn("CoverageTurboInputsTest.coverageHashFromSummary")(function* (
  root: string,
  turboBinary: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runsDirectory = path.join(root, ".turbo", "runs");

  yield* fs.remove(runsDirectory, { recursive: true, force: true });
  const run = Bun.spawnSync(
    [turboBinary, "run", "coverage", "--filter=@fixture/coverage", "--cache=local:rw", "--summarize"],
    {
      cwd: root,
      env: { ...process.env, TURBO_TELEMETRY_DISABLED: "1", TURBO_UI: "stream" },
      stderr: "pipe",
      stdout: "pipe",
    }
  );
  expect(run.exitCode, `${run.stdout.toString()}\n${run.stderr.toString()}`).toBe(0);

  const summaryFiles = pipe(yield* fs.readDirectory(runsDirectory), A.filter(Str.endsWith(".json")));
  expect(summaryFiles).toHaveLength(1);

  const summary = yield* decodeTurboRunSummary(
    yield* fs.readFileString(path.join(runsDirectory, summaryFiles[0] ?? "missing-summary.json"))
  );
  const coverageTask = A.findFirst(summary.tasks, (task) => task.taskId === "@fixture/coverage#coverage");

  expect(O.isSome(coverageTask)).toBe(true);
  return pipe(
    coverageTask,
    O.map((task) => task.hash),
    O.getOrElse(() => "missing-coverage-hash")
  );
});

describe("coverage Turbo inputs", () => {
  it.effect(
    "keeps docs outside the package hash and invalidates source or test edits",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "coverage-turbo-inputs-" });
        const turboBinary = path.join(repoRoot, "node_modules", ".bin", "turbo");
        const turboConfiguration = yield* decodeTurboConfiguration(
          yield* fs.readFileString(path.join(repoRoot, "turbo.json"))
        );
        const coverageTask = turboConfiguration.tasks.coverage;

        expect(coverageTask.cache).toBe(false);
        expect(coverageTask.inputs).toEqual(EXPECTED_COVERAGE_INPUTS);

        yield* writeFixtureJson(root, "package.json", {
          name: "coverage-turbo-input-fixture",
          packageManager: "bun@1.4.0",
          private: true,
          workspaces: ["packages/*"],
        });
        yield* writeFixtureJson(root, "packages/coverage/package.json", {
          name: "@fixture/coverage",
          private: true,
          scripts: { coverage: "echo coverage" },
        });
        yield* writeFixtureJson(root, "turbo.json", {
          tasks: {
            coverage: {
              cache: coverageTask.cache,
              inputs: coverageTask.inputs,
            },
          },
        });
        yield* writeFixtureJson(root, "vitest.aliases.generated.json", {});
        yield* writeFixtureFile(root, "vitest.shared.ts", "export const shared = true;\n");
        yield* writeFixtureFile(root, "vitest.setup.ts", "export const setup = true;\n");
        yield* writeFixtureFile(root, "packages/coverage/server/index.ts", "export const serverValue = 1;\n");
        yield* writeFixtureFile(root, "packages/coverage/src/index.ts", "export const value = 1;\n");
        yield* writeFixtureFile(root, "packages/coverage/src-tauri/src/lib.rs", "pub const VALUE: u8 = 1;\n");
        yield* writeFixtureFile(root, "packages/coverage/test/index.test.ts", "export const expected = 1;\n");
        yield* writeFixtureFile(root, "packages/coverage/tsconfig.json", "{}\n");
        yield* writeFixtureFile(root, "packages/coverage/vitest.config.ts", "export default {};\n");
        yield* writeFixtureFile(root, "packages/coverage/vitest.coverage.config.ts", "export default {};\n");
        yield* writeFixtureFile(root, "packages/coverage/README.md", "# Initial docs\n");

        const baselineHash = yield* coverageHashFromSummary(root, turboBinary);

        yield* writeFixtureFile(root, "packages/coverage/README.md", "# Docs-only edit\n");
        expect(yield* coverageHashFromSummary(root, turboBinary)).toBe(baselineHash);

        yield* writeFixtureFile(root, "packages/coverage/src/index.ts", "export const value = 2;\n");
        expect(yield* coverageHashFromSummary(root, turboBinary)).not.toBe(baselineHash);

        yield* writeFixtureFile(root, "packages/coverage/src/index.ts", "export const value = 1;\n");
        expect(yield* coverageHashFromSummary(root, turboBinary)).toBe(baselineHash);

        yield* writeFixtureFile(root, "packages/coverage/test/index.test.ts", "export const expected = 2;\n");
        expect(yield* coverageHashFromSummary(root, turboBinary)).not.toBe(baselineHash);

        yield* writeFixtureFile(root, "packages/coverage/test/index.test.ts", "export const expected = 1;\n");
        expect(yield* coverageHashFromSummary(root, turboBinary)).toBe(baselineHash);

        yield* writeFixtureFile(root, "packages/coverage/vitest.coverage.config.ts", "export default { test: {} };\n");
        expect(yield* coverageHashFromSummary(root, turboBinary)).not.toBe(baselineHash);

        yield* writeFixtureFile(root, "packages/coverage/vitest.coverage.config.ts", "export default {};\n");
        expect(yield* coverageHashFromSummary(root, turboBinary)).toBe(baselineHash);

        yield* writeFixtureFile(root, "packages/coverage/server/index.ts", "export const serverValue = 2;\n");
        expect(yield* coverageHashFromSummary(root, turboBinary)).not.toBe(baselineHash);
      },
      Effect.scoped,
      provideScopedLayer(NodeServices.layer)
    )
  );
});
