import { $RepoCliId } from "@beep/identity/packages";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { FsUtilsLive, findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("test/doctest-turbo-inputs");
class DoctestTaskDefinition extends S.Class<DoctestTaskDefinition>($I`DoctestTaskDefinition`)(
  {
    cache: S.Boolean,
    outputs: S.Array(S.String),
    inputs: S.Array(S.String),
    dependsOn: S.Array(S.String),
    env: S.Array(S.String),
  },
  $I.annote("DoctestTaskDefinition", { description: "Production doctest task declaration for the real hash fixture." })
) {}
class DoctestTaskSummary extends S.Class<DoctestTaskSummary>($I`DoctestTaskSummary`)(
  { taskId: S.String, hash: S.String, dependencies: S.Array(S.String) },
  $I.annote("DoctestTaskSummary", { description: "Doctest identity, hash and transit edges from Turbo." })
) {}
const Configuration = S.Struct({ tasks: S.Struct({ doctest: DoctestTaskDefinition, transit: S.Unknown }) });
const Summary = S.Struct({ tasks: S.Array(DoctestTaskSummary) });
const decodeConfiguration = S.decodeEffect(S.fromJsonString(Configuration));
const decodeSummary = S.decodeEffect(S.fromJsonString(Summary));
const providePlatform = provideScopedLayer(FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer)));

const writeFile = Effect.fn("DoctestTurboTest.writeFile")(function* (root: string, file: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, content);
});
const writeJson = Effect.fn("DoctestTurboTest.writeJson")(function* (root: string, file: string, value: unknown) {
  yield* writeFile(root, file, `${yield* jsonStringifyPretty(value)}\n`);
});

describe("doctest Turbo inputs", () => {
  it.effect(
    "tracks source, tests, setup, config and transit dependencies while ignoring docs",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const config = yield* decodeConfiguration(yield* fs.readFileString(`${repoRoot}/turbo.json`));
      expect(config.tasks.doctest).toEqual({
        cache: true,
        outputs: [],
        dependsOn: ["^transit"],
        env: ["BEEP_VITEST_DOCTEST"],
        inputs: [
          "src/**",
          "test/**",
          "package.json",
          "tsconfig*.json",
          "vitest*.config.ts",
          "$TURBO_ROOT$/vitest.shared.ts",
          "$TURBO_ROOT$/vitest.setup.ts",
          "$TURBO_ROOT$/vitest.aliases.generated.json",
          "$TURBO_ROOT$/packages/foundation/modeling/utils/src/**",
          "!node_modules/**",
          "$TURBO_ROOT$/packages/tooling/tool/cli/test/global-cleanup.ts",
        ],
      });
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "doctest-turbo-" });
      yield* writeJson(root, "package.json", {
        name: "doctest-fixture",
        private: true,
        packageManager: "bun@1.4.2",
        workspaces: ["packages/*"],
      });
      yield* writeJson(root, "packages/consumer/package.json", {
        name: "@fixture/consumer",
        dependencies: { "@fixture/upstream": "workspace:*" },
        scripts: { doctest: "echo doctest" },
      });
      yield* writeJson(root, "packages/upstream/package.json", { name: "@fixture/upstream" });
      yield* writeJson(root, "packages/unrelated/package.json", { name: "@fixture/unrelated" });
      yield* writeJson(root, "turbo.json", { tasks: config.tasks });
      yield* writeFile(root, ".gitignore", "node_modules\n.turbo\n");
      const inputs = [
        "packages/consumer/src/index.ts",
        "packages/consumer/test/example.tsx",
        "packages/consumer/test/setup.ts",
        "packages/consumer/vitest.config.ts",
        "packages/consumer/tsconfig.test.json",
        "packages/consumer/package.json",
        "vitest.shared.ts",
        "vitest.setup.ts",
        "vitest.aliases.generated.json",
        "packages/foundation/modeling/utils/src/index.ts",
        "packages/tooling/tool/cli/test/global-cleanup.ts",
        "packages/upstream/src/index.ts",
      ];
      const unrelated = ["README.md", "packages/consumer/README.md", "packages/unrelated/src/index.ts"];
      yield* Effect.forEach(
        A.filter([...inputs, ...unrelated], (file) => file !== "packages/consumer/package.json"),
        (file) => writeFile(root, file, "{}\n")
      );
      const hash = Effect.fnUntraced(function* (flag = "1") {
        const run = yield* StepExec.runCaptured({
          command: path.join(repoRoot, "node_modules/.bin/turbo"),
          args: ["run", "doctest", "--filter=@fixture/consumer", "--dry-run=json", "--cache=local:rw"],
          cwd: root,
          source: "stdout",
          timeout: "20 seconds",
          env: { BEEP_VITEST_DOCTEST: flag, TURBO_TELEMETRY_DISABLED: "1" },
          extendEnv: true,
        });
        expect(run.exitCode, run.output).toBe(0);
        const summary = yield* decodeSummary(run.output);
        const task = O.getOrThrow(A.findFirst(summary.tasks, (row) => row.taskId === "@fixture/consumer#doctest"));
        expect(task.dependencies).toEqual(["@fixture/upstream#transit"]);
        return task.hash;
      });
      const baseline = yield* hash();
      for (const file of [...inputs, ...unrelated]) {
        const original = yield* fs.readFileString(path.join(root, file));
        yield* writeFile(root, file, `${original}\n`);
        expect((yield* hash()) === baseline, file).toBe(A.contains(unrelated, file));
        yield* writeFile(root, file, original);
        expect(yield* hash(), `${file}: restored`).toBe(baseline);
      }
      expect(yield* hash("0")).not.toBe(baseline);
    }, providePlatform),
    { timeout: 180_000 }
  );
});
