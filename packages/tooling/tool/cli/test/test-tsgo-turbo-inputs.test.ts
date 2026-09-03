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

const $I = $RepoCliId.create("test/test-tsgo-turbo-inputs");

const EXPECTED_TEST_TSGO_INPUTS: ReadonlyArray<string> = [
  "package.json",
  "scripts/**",
  "server/**",
  "src/**",
  "src-tauri/**",
  "test/**",
  "tsconfig*.json",
  "$TURBO_ROOT$/tsconfig.base.json",
  "$TURBO_ROOT$/packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts",
  "$TURBO_ROOT$/packages/tooling/tool/cli/src/commands/Quality/internal/TestTsgoSyntheticConfig.ts",
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
    description: "Subset of a Turbo run summary needed by the tsgo tests input tripwire.",
  })
) {}

const TurboConfiguration = S.Struct({
  tasks: S.Struct({
    "package-test-typecheck": S.Struct({
      cache: S.Boolean,
      dependsOn: S.Array(S.String),
      inputs: S.Array(S.String),
    }),
  }),
}).annotate(
  $I.annote("TurboConfiguration", {
    description: "Tsgo tests input declaration decoded from the repository Turbo configuration.",
  })
);

const decodeTurboConfiguration = S.decodeUnknownEffect(S.fromJsonString(TurboConfiguration));
const decodeTurboRunSummary = S.decodeUnknownEffect(S.fromJsonString(TurboRunSummary));

const writeFixtureFile = Effect.fn("TestTsgoTurboInputsTest.writeFixtureFile")(function* (
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

const writeFixtureJson = Effect.fn("TestTsgoTurboInputsTest.writeFixtureJson")(function* (
  root: string,
  relativePath: string,
  document: unknown
) {
  yield* writeFixtureFile(root, relativePath, `${yield* encodeJsonString(document)}\n`);
});

const testTsgoHashFromSummary = Effect.fn("TestTsgoTurboInputsTest.testTsgoHashFromSummary")(function* (
  root: string,
  turboBinary: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runsDirectory = path.join(root, ".turbo", "runs");

  yield* fs.remove(runsDirectory, { recursive: true, force: true });
  const run = Bun.spawnSync(
    [turboBinary, "run", "package-test-typecheck", "--filter=@fixture/test-tsgo", "--cache=local:rw", "--summarize"],
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
  const packageTask = A.findFirst(summary.tasks, (task) => task.taskId === "@fixture/test-tsgo#package-test-typecheck");

  expect(O.isSome(packageTask)).toBe(true);
  return pipe(
    packageTask,
    O.map((task) => task.hash),
    O.getOrElse(() => "missing-test-tsgo-hash")
  );
});

describe("tsgo tests Turbo inputs", () => {
  it.effect(
    "keeps docs outside the package hash and invalidates every declared tsgo input class",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "test-tsgo-turbo-inputs-" });
        const turboBinary = path.join(repoRoot, "node_modules", ".bin", "turbo");
        const turboConfiguration = yield* decodeTurboConfiguration(
          yield* fs.readFileString(path.join(repoRoot, "turbo.json"))
        );
        const packageTask = turboConfiguration.tasks["package-test-typecheck"];

        expect(packageTask.cache).toBe(false);
        expect(packageTask.dependsOn).toEqual(["^transit"]);
        expect(packageTask.inputs).toEqual(EXPECTED_TEST_TSGO_INPUTS);

        yield* writeFixtureJson(root, "package.json", {
          name: "test-tsgo-turbo-input-fixture",
          packageManager: "bun@1.4.0",
          private: true,
          workspaces: ["packages/*"],
        });
        yield* writeFixtureFile(root, ".gitignore", ".turbo\nnode_modules\n");
        yield* writeFixtureJson(root, "packages/test-tsgo/package.json", {
          dependencies: { "@fixture/config": "workspace:*" },
          name: "@fixture/test-tsgo",
          private: true,
          scripts: { "package-test-typecheck": "echo test-tsgo" },
        });
        yield* writeFixtureJson(root, "packages/config/package.json", {
          name: "@fixture/config",
          private: true,
        });
        yield* writeFixtureJson(root, "turbo.json", {
          tasks: {
            transit: {
              dependsOn: ["^transit"],
            },
            "package-test-typecheck": {
              cache: packageTask.cache,
              dependsOn: packageTask.dependsOn,
              inputs: packageTask.inputs,
            },
          },
        });
        yield* writeFixtureFile(root, "tsconfig.base.json", "{}\n");
        yield* writeFixtureFile(
          root,
          "packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts",
          "export const worker = true;\n"
        );
        yield* writeFixtureFile(
          root,
          "packages/tooling/tool/cli/src/commands/Quality/internal/TestTsgoSyntheticConfig.ts",
          "export const template = true;\n"
        );
        yield* writeFixtureFile(root, "packages/test-tsgo/test/index.test.ts", "export const expected = 1;\n");
        yield* writeFixtureFile(root, "packages/test-tsgo/src/index.ts", "export const value = 1;\n");
        yield* writeFixtureFile(root, "packages/test-tsgo/tsconfig.json", "{}\n");
        yield* writeFixtureFile(root, "packages/test-tsgo/README.md", "# Initial docs\n");
        yield* writeFixtureFile(root, "packages/config/src/index.ts", "export const config = 1;\n");

        const baselineHash = yield* testTsgoHashFromSummary(root, turboBinary);

        yield* writeFixtureFile(root, "packages/test-tsgo/README.md", "# Docs-only edit\n");
        expect(yield* testTsgoHashFromSummary(root, turboBinary)).toBe(baselineHash);

        yield* writeFixtureFile(root, "packages/test-tsgo/test/index.test.ts", "export const expected = 2;\n");
        expect(yield* testTsgoHashFromSummary(root, turboBinary)).not.toBe(baselineHash);
        yield* writeFixtureFile(root, "packages/test-tsgo/test/index.test.ts", "export const expected = 1;\n");

        yield* writeFixtureFile(root, "packages/test-tsgo/src/index.ts", "export const value = 2;\n");
        expect(yield* testTsgoHashFromSummary(root, turboBinary)).not.toBe(baselineHash);
        yield* writeFixtureFile(root, "packages/test-tsgo/src/index.ts", "export const value = 1;\n");

        yield* writeFixtureFile(root, "packages/config/src/index.ts", "export const config = 2;\n");
        expect(yield* testTsgoHashFromSummary(root, turboBinary)).not.toBe(baselineHash);
        yield* writeFixtureFile(root, "packages/config/src/index.ts", "export const config = 1;\n");

        yield* writeFixtureFile(root, "packages/test-tsgo/tsconfig.json", '{"compilerOptions":{}}\n');
        expect(yield* testTsgoHashFromSummary(root, turboBinary)).not.toBe(baselineHash);
        yield* writeFixtureFile(root, "packages/test-tsgo/tsconfig.json", "{}\n");

        yield* writeFixtureFile(root, "tsconfig.base.json", '{"compilerOptions":{}}\n');
        expect(yield* testTsgoHashFromSummary(root, turboBinary)).not.toBe(baselineHash);
        yield* writeFixtureFile(root, "tsconfig.base.json", "{}\n");

        yield* writeFixtureFile(
          root,
          "packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts",
          "export const worker = false;\n"
        );
        expect(yield* testTsgoHashFromSummary(root, turboBinary)).not.toBe(baselineHash);
        yield* writeFixtureFile(
          root,
          "packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts",
          "export const worker = true;\n"
        );

        yield* writeFixtureFile(
          root,
          "packages/tooling/tool/cli/src/commands/Quality/internal/TestTsgoSyntheticConfig.ts",
          "export const template = false;\n"
        );
        expect(yield* testTsgoHashFromSummary(root, turboBinary)).not.toBe(baselineHash);
      },
      Effect.scoped,
      provideScopedLayer(NodeServices.layer)
    )
  );
});
